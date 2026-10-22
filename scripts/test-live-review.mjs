import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {readReview,writeReview,updateReview,validateReview} from './live-review-store.mjs';
import {liveArgs} from './live-studio.mjs';
import {isLiveSource,validateLiveSource} from './live-studio-server.mjs';
import {shouldApplyLive} from '../src/viewer/live-review.js';
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
