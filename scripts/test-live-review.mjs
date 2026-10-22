import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {readReview,writeReview,updateReview,validateReview} from './live-review-store.mjs';
import {liveArgs} from './live-studio.mjs';
import {isLiveSource,validateLiveSource,liveStudioPlugin} from './live-studio-server.mjs';
import {mountLiveReview,shouldApplyLive,rebaseLiveRecipe} from '../src/viewer/live-review.js';
test('feedback progresses through plan, edit, published checkpoint and verified completion',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'live-review-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let state=updateReview(await readReview(root),'plan',{tasks:[{id:'f1',title:'Title size'},{id:'f2',title:'Camera timing'}]});
 assert.throws(()=>updateReview(state,'done',{task:'f1'}),/Publish/);
 state=updateReview(state,'begin',{task:'f1'});assert.equal(state.phase,'editing');
 assert.throws(()=>updateReview(state,'done',{task:'f1'}),/Publish/);
 state=updateReview(state,'publish',{task:'f1',snapshot:{parameters:{scene:'pop',graphics:{accent:'#ff0000'}}}});
 const checkpoint=state.checkpoint;state=updateReview(state,'done',{task:'f1'});
 assert.equal(state.tasks[0].status,'done');assert.equal(state.checkpoint,checkpoint);
 state=updateReview(state,'begin',{task:'f2'});state=updateReview(state,'block',{task:'f2',label:'Missing reference'});
 await writeReview(root,state);assert.deepEqual(await readReview(root),state);
 assert.equal(state.tasks[1].status,'blocked');assert.equal(state.snapshot.parameters.graphics.accent,'#ff0000');
 assert.throws(()=>validateReview({...state,tasks:[state.tasks[0],state.tasks[0]]}),/unique/);
});
test('only appropriate source files trigger live refresh, not outputs or feedback temporary files',()=>{
 const root='/tmp/film';for(const f of ['src/scenes/pop.js','src/viewer/style.css','project/look.json'])assert.ok(isLiveSource(root,path.join(root,f)));
 for(const f of ['renders/test.mp4','project/history/look.json','.motion-cache/live-review.json.tmp','../other/src/film.js'])assert.equal(isLiveSource(root,path.resolve(root,f)),false);
});
test('manual edits, pause, exports, source errors and in-progress batches defer updates',()=>{
 assert.ok(shouldApplyLive({phase:'ready'}));for(const key of ['paused','dirty','busy','error'])assert.equal(shouldApplyLive({phase:'ready',[key]:true}),false);
 for(const phase of ['editing','blocked'])assert.equal(shouldApplyLive({phase}),false);
});
test('integrated browser mode returns an explicit capability request, with strict options',()=>{
 assert.equal(liveArgs(['start','--browser','integrated','--scene','pop']).browser,'integrated');
 assert.equal(liveArgs(['start']).browser,'none');
 assert.throws(()=>liveArgs(['start','--browser','codex://invented']),/Browser/);
 assert.throws(()=>liveArgs(['start','--port','bad']),/port/);
 assert.throws(()=>liveArgs(['begin','--task']),/option/);
});
test('reloading API schemas preserves the active render reservation',async()=>{
 const {ROOT}=await import('./project-store.mjs');
 const first=await import('./studio-api.mjs?live-reservation-first');
 const state=globalThis[Symbol.for('framevolve.studio-render-states')].get(ROOT);
 const previous=state.activeRenderId;state.activeRenderId='pending:live-test';
 try{
  const next=await import('./studio-api.mjs?live-reservation-next');
  const response={statusCode:200,setHeader(){},end(value){this.body=value;}};
  const request={method:'POST',url:'/studio/render',headers:{host:'127.0.0.1:4173'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify({kind:'frame',parameters:{scene:'procedural'}}));}};
  await next.createStudioApi()(request,response,()=>assert.fail('Unexpected route fallthrough'));
  assert.equal(response.statusCode,409);assert.match(response.body,/already running/);
  assert.notEqual(first,next);
 }finally{state.activeRenderId=previous;}
});

test('checkpoint syntax validation reads new bytes rather than a cached transform',()=>{
 validateLiveSource('scene.js','export const value = 1;');
 assert.throws(()=>validateLiveSource('scene.js','export const value = ;'),/Unexpected token/);
 assert.throws(()=>validateLiveSource('look.json','{"post":'),SyntaxError);
 validateLiveSource('scene.js','export const value = 2;');
});

test('project switches ignore stale live snapshots and reset to the supplied baseline without consuming later edits',async t=>{
 const prior={document:globalThis.document,window:globalThis.window,storage:globalThis.sessionStorage,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,location:globalThis.location};
 t.after(()=>{Object.assign(globalThis,{document:prior.document,window:prior.window,sessionStorage:prior.storage,fetch:prior.fetch,setTimeout:prior.setTimeout,location:prior.location});});
 const elements=new Map(),timers=[],storage=new Map(),calls=[],reloads=[];
 const element=()=>({hidden:false,dataset:{},append(){},replaceChildren(){},setAttribute(){},set id(value){elements.set(value,this);},get id(){return '';}});
 globalThis.document={createElement:element};globalThis.window={addEventListener(){}};globalThis.sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 globalThis.setTimeout=callback=>{timers.push(callback);return timers.length;};globalThis.location={href:'http://localhost/?scene=starter',replace:url=>reloads.push(url)};
 let active='old',current={parameters:{scene:'starter',amount:1}},next={projectId:'old',epoch:'epoch',revision:1,sourceRevision:0,phase:'ready',snapshot:structuredClone(current),tasks:[]};
 globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(next)});
 const app=mountLiveReview({container:element(),enabled:true,baseline:structuredClone(current),getSnapshot:()=>structuredClone(current),setSnapshot:value=>{current=structuredClone(value);calls.push(value);},getView:()=>({time:0}),setView(){},isBusy:()=>false,getProjectId:()=>active});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
 const fresh={parameters:{scene:'starter',amount:2}};active='new';current=structuredClone(fresh);storage.set('framevolve-live-reload','old recovery');storage.set('framevolve-before-live-update','old local backup');app.resetProject(fresh);current.parameters.amount=99;
 assert.equal(storage.has('framevolve-live-reload'),false);assert.equal(storage.has('framevolve-before-live-update'),false);
 next={...next,revision:2,sourceRevision:99};timers.shift()();await settle();assert.equal(current.parameters.amount,99);assert.equal(app.getState().pending,false);assert.deepEqual(reloads,[]);assert.deepEqual(calls,[]);
 next={...next,projectId:'new',revision:3,sourceRevision:0,snapshot:structuredClone(fresh)};timers.shift()();await settle();assert.equal(app.getState().dirty,true);assert.equal(app.getState().pending,false);assert.equal(current.parameters.amount,99,'the first poll must preserve edits made after reset');
 next={...next,revision:4,snapshot:{parameters:{scene:'starter',amount:3}}};timers.shift()();await settle();assert.equal(app.getState().pending,true);assert.equal(current.parameters.amount,99);elements.get('live-review-apply').onclick();assert.equal(current.parameters.amount,3);assert.equal(app.getState().pending,false);app.stop();
});

test('source-only recipe rebase follows changed authored defaults while preserving saved title, audio, arrays and removals',()=>{
 const old={parameters:{scene:'starter',look:{grain:0,exposure:1},title:'Default',audio:{tracks:[]},removeMe:true,newArray:[1]},config:{fps:30}};
 const saved=structuredClone(old);saved.parameters.title='Saved title';saved.parameters.audio.tracks=[{assetId:'a'.repeat(64),name:'Music'}];saved.parameters.newArray=[9];delete saved.parameters.removeMe;
 const next=structuredClone(old);next.parameters.look.grain=.025;next.parameters.look.exposure=2;next.parameters.newArray=[2];next.parameters.added='new default';next.config.fps=60;
 const merged=rebaseLiveRecipe(old,saved,next);assert.equal(merged.parameters.look.grain,.025);assert.equal(merged.parameters.look.exposure,2);assert.equal(merged.parameters.title,'Saved title');assert.deepEqual(merged.parameters.audio,saved.parameters.audio);assert.deepEqual(merged.parameters.newArray,[9]);assert.equal('removeMe' in merged.parameters,false);assert.equal(merged.parameters.added,'new default');assert.equal(merged.config.fps,60);assert.equal(old.parameters.look.grain,0);
});

test('saved music survives stale initial live state and source-only reload while new authored defaults and explicit publishes still apply',async t=>{
 const prior={document:globalThis.document,window:globalThis.window,storage:globalThis.sessionStorage,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,location:globalThis.location};t.after(()=>Object.assign(globalThis,{document:prior.document,window:prior.window,sessionStorage:prior.storage,fetch:prior.fetch,setTimeout:prior.setTimeout,location:prior.location}));
 const timers=[],storage=new Map(),calls=[],reloads=[],element=()=>({dataset:{},append(){},replaceChildren(){},setAttribute(){}});globalThis.document={createElement:element};globalThis.window={addEventListener(){}};globalThis.sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};globalThis.setTimeout=callback=>{timers.push(callback);return timers.length;};globalThis.location={href:'http://localhost/?scene=starter',replace:url=>reloads.push(url)};
 const authored={parameters:{scene:'starter',look:{grain:0},title:'Default',audio:{version:1,tracks:[]}}},saved=structuredClone(authored);saved.parameters.title='My saved title';saved.parameters.audio.tracks=[{assetId:'a'.repeat(64),name:'Saved music'}];let current=structuredClone(saved),next={projectId:'project',epoch:'epoch',revision:1,sourceRevision:0,phase:'ready',snapshot:structuredClone(authored),snapshotChanged:false,tasks:[]};globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(next)});
 const mount=(baseline,defaults,recovery)=>mountLiveReview({container:element(),enabled:true,baseline,authoredBaseline:defaults,recovery,getSnapshot:()=>structuredClone(current),setSnapshot:value=>{current=structuredClone(value);calls.push(value);},getView:()=>({time:2}),setView(){},isBusy:()=>false,getProjectId:()=> 'project'}),settle=()=>new Promise(resolve=>setImmediate(resolve));
 const first=mount(saved,authored);await settle();assert.deepEqual(current,saved);assert.deepEqual(calls,[]);assert.equal(first.getState().pending,false);
 next={...next,revision:2,sourceRevision:1};timers.shift()();await settle();assert.equal(reloads.length,1);assert.deepEqual(current,saved);const recovery=JSON.parse(storage.get('framevolve-live-reload'));assert.equal(recovery.sourceOnly,true);assert.deepEqual(recovery.snapshot,saved);first.stop();timers.length=0;
 const updatedAuthored=structuredClone(authored);updatedAuthored.parameters.look.grain=.025;current=structuredClone(updatedAuthored);next={...next,snapshot:null};const recovered=mount(updatedAuthored,updatedAuthored,recovery);await settle();assert.equal(current.parameters.look.grain,.025);assert.equal(current.parameters.title,'My saved title');assert.deepEqual(current.parameters.audio,saved.parameters.audio);assert.equal(recovered.getState().dirty,false);assert.equal(storage.has('framevolve-live-reload'),false);
 const published={parameters:{scene:'starter',look:{grain:.07},title:'Explicit publish',audio:{version:1,tracks:[]}}};next={...next,revision:3,snapshotChanged:true,snapshot:published};timers.shift()();await settle();assert.deepEqual(current,published);recovered.stop();
});

test('live server releases no cached recipe for source-only updates and observes first active identity without a new checkpoint',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'live-source-only-'));t.after(()=>rm(root,{recursive:true,force:true}));const originalTimer=globalThis.setTimeout,originalClear=globalThis.clearTimeout,timers=[];globalThis.setTimeout=callback=>{timers.push(callback);return timers.length;};globalThis.clearTimeout=()=>{};t.after(()=>{globalThis.setTimeout=originalTimer;globalThis.clearTimeout=originalClear;});
 const stale={parameters:{scene:'starter',audio:{tracks:[]}}};await writeReview(root,{version:1,phase:'ready',tasks:[],checkpoint:'same-checkpoint',snapshot:stale,updatedAt:'one'});await mkdir(path.join(root,'src/scenes'),{recursive:true});const file=path.join(root,'src/scenes/test.js');await writeFile(file,'export const value=1;');const callbacks=new Map();let route;const plugin=liveStudioPlugin();await plugin.configureServer({config:{root},watcher:{add(){},on:(event,callback)=>callbacks.set(event,callback),off(){}},middlewares:{use:(url,handler)=>{route=handler;}},transformRequest:async()=>({})});t.after(()=>plugin.closeBundle());const state=()=>{let value;route({method:'GET',headers:{host:'localhost:4173'}},{setHeader(){},end:raw=>{value=JSON.parse(raw);}});return value;};
 callbacks.get('change')(file);await timers.shift()();assert.equal(state().sourceRevision,1);assert.equal(state().snapshot,null);assert.equal(state().snapshotChanged,false);
 const id='11111111-1111-4111-8111-111111111111';await writeFile(path.join(root,'.motion-cache/active-project.json'),JSON.stringify({version:1,id,trusted:[]}));callbacks.get('add')(path.join(root,'.motion-cache/active-project.json'));await timers.shift()();assert.equal(state().projectId,id);assert.equal(state().snapshot,null);assert.equal(state().sourceRevision,1);assert.equal(state().revision,1,'identity changes are not authored revisions');
 const published={parameters:{scene:'starter',title:'Published'}};await writeReview(root,{version:1,phase:'ready',tasks:[],checkpoint:'published-checkpoint',snapshot:published,updatedAt:'two'});callbacks.get('change')(path.join(root,'.motion-cache/live-review.json'));await timers.shift()();assert.equal(state().snapshotChanged,true);assert.deepEqual(state().snapshot,published);
});
