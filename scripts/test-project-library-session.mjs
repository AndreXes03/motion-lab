import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,mkdir,writeFile,readFile,rm,symlink,lstat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {saveProject,exportProject,readProject,openProject} from './project-library-store.mjs';
import {libraryState,saveActiveProject,autosaveActiveProject,createActiveProject,openActiveProject,importLibraryProject,projectSession} from './project-library-session.mjs';
const recipe=label=>({parameters:{scene:'starter'},label});
async function put(root,name,value){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),value);}
async function fixture(t){const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'framevolve-session-')));t.after(()=>rm(root,{recursive:true,force:true}));await put(root,'src/scenes/film.js','original');await put(root,'src/config.js','config');await put(root,'project/look.json','{}');return root;}
const read=(root,name)=>readFile(path.join(root,name),'utf8');
const stateFile=root=>path.join(root,'.motion-cache/active-project.json');

test('source autosaves rebase a UI save without dropping source edits, while newer UI edits conflict',async t=>{
 const root=await fixture(t),first=await saveActiveProject(root,{activeId:null,name:'Film',snapshot:recipe('initial')});await put(root,'src/scenes/film.js','agent edit');const auto=await autosaveActiveProject(root);assert.equal(auto.revision,2);
 const ui=await saveActiveProject(root,{activeId:first.id,revision:first.revision,baseSnapshotHash:first.snapshotHash,snapshot:recipe('UI edit')});assert.equal(ui.revision,3);assert.equal(await read(root,'src/scenes/film.js'),'agent edit');
 await assert.rejects(saveActiveProject(root,{activeId:first.id,revision:first.revision,baseSnapshotHash:first.snapshotHash,snapshot:recipe('stale UI edit')}),{status:409});assert.equal((await readProject(root,first.id)).snapshot.label,'UI edit');assert.equal(projectSession(root).working,false);
});

test('activeId guard rejects stale windows and the pointer survives a fresh process',async t=>{
 const root=await fixture(t),first=await createActiveProject(root,{activeId:null,name:'First',snapshot:recipe('first')}),second=await createActiveProject(root,{activeId:first.id,name:'Second',snapshot:recipe('second')});
 for(const attempt of [()=>saveActiveProject(root,{activeId:first.id,name:'Wrong'}),()=>createActiveProject(root,{activeId:first.id,name:'Wrong',snapshot:recipe('wrong')}),()=>openActiveProject(root,{activeId:first.id,id:first.id,snapshot:recipe('wrong')})])await assert.rejects(attempt(),{status:409});assert.equal((await libraryState(root)).active.id,second.id);
 const module=new URL('./project-library-session.mjs',import.meta.url).href,code=`const {libraryState}=await import(${JSON.stringify(module)});const state=await libraryState(process.argv[1]);process.stdout.write(JSON.stringify({id:state.active.id,name:state.active.name}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code,root],{encoding:'utf8',timeout:5000});assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{id:second.id,name:'Second'});
});

test('import only adds a library record; imported code needs explicit trust and remembers that trust',async t=>{
 const root=await fixture(t),other=await fixture(t),active=await createActiveProject(root,{activeId:null,name:'Current',snapshot:recipe('current')});await put(other,'src/scenes/film.js','imported source');const source=await saveProject(other,{name:'Imported',snapshot:recipe('imported')}),imported=await importLibraryProject(root,await exportProject(other,source.id));
 assert.equal(imported.imported,true);assert.equal((await libraryState(root)).active.id,active.id);assert.equal(await read(root,'src/scenes/film.js'),'original');
 await assert.rejects(openActiveProject(root,{activeId:active.id,id:imported.id,snapshot:active.snapshot}),{status:428});assert.equal(await read(root,'src/scenes/film.js'),'original');
 await openActiveProject(root,{activeId:active.id,id:imported.id,snapshot:active.snapshot,trusted:true});assert.equal(await read(root,'src/scenes/film.js'),'imported source');
 await openActiveProject(root,{activeId:imported.id,id:active.id,snapshot:imported.snapshot});await openActiveProject(root,{activeId:active.id,id:imported.id,snapshot:active.snapshot});assert.equal((await libraryState(root)).active.id,imported.id);assert.ok(JSON.parse(await readFile(stateFile(root),'utf8')).trusted.includes(imported.id));
});

test('dead PID session locks recover and symlinked locks fail without touching the external directory',async t=>{
 const root=await fixture(t);const child=spawnSync(process.execPath,['-e',''],{timeout:5000});assert.equal(child.status,0);const lock='.motion-cache/project-session.lock';await put(root,lock+'/owner.json',JSON.stringify({pid:child.pid}));
 const created=await createActiveProject(root,{activeId:null,name:'Recovered lock',snapshot:recipe('recovered')});assert.ok(created.id);await assert.rejects(lstat(path.join(root,lock)),{code:'ENOENT'});
 const outside=await fixture(t);await symlink(path.join(outside,'project'),path.join(root,lock));await assert.rejects(autosaveActiveProject(root),/cannot be a link/);assert.equal(await read(outside,'project/look.json'),'{}');
});

test('pointer activation failure restores source, unsaved files, prior pointer and review',async t=>{
 const root=await fixture(t),active=await createActiveProject(root,{activeId:null,name:'Current',snapshot:recipe('current')});await put(root,'src/scenes/film.js','target');const target=await saveProject(root,{name:'Target',snapshot:recipe('target')});await put(root,'src/scenes/film.js','unsaved current');await put(root,'src/scenes/unsaved.js','keep this');const reviewBefore=await read(root,'.motion-cache/live-review.json'),pointerBefore=await readFile(stateFile(root),'utf8');
 await assert.rejects(openActiveProject(root,{activeId:active.id,id:target.id,snapshot:recipe('unsaved')},{beforeActivate:async()=>{throw Error('Injected pointer write failure');}}),/Injected pointer/);
 assert.equal(await read(root,'src/scenes/film.js'),'unsaved current');assert.equal(await read(root,'src/scenes/unsaved.js'),'keep this');assert.deepEqual(JSON.parse(await readFile(stateFile(root),'utf8')),JSON.parse(pointerBefore));assert.deepEqual(JSON.parse(await read(root,'.motion-cache/live-review.json')),JSON.parse(reviewBefore));assert.equal((await libraryState(root)).active.id,active.id);await assert.rejects(lstat(path.join(root,'.motion-cache/project-session-open.json')),{code:'ENOENT'});
});

test('an interrupted activation journal restores the prior workspace before accepting another save',async t=>{
 const root=await fixture(t),active=await createActiveProject(root,{activeId:null,name:'Current',snapshot:recipe('current')});const previous=JSON.parse(await readFile(stateFile(root),'utf8')),review=JSON.parse(await read(root,'.motion-cache/live-review.json'));await put(root,'src/scenes/film.js','target');const target=await saveProject(root,{name:'Target',snapshot:recipe('target')});await put(root,'src/scenes/film.js','unsaved current');const opened=await openProject(root,target.id,{snapshot:recipe('unsaved')});await put(root,'.motion-cache/project-session-open.json',JSON.stringify({version:1,previous,targetId:target.id,backupId:opened.backupId,targetSnapshot:target.snapshot,review}));
 const state=await libraryState(root);assert.equal(state.active.id,active.id);assert.equal(await read(root,'src/scenes/film.js'),'unsaved current');assert.equal(projectSession(root).working,false);await assert.rejects(lstat(path.join(root,'.motion-cache/project-session-open.json')),{code:'ENOENT'});
});

 test('startup recovers a killed store apply even when no session journal was written',async t=>{
 const root=await fixture(t),active=await createActiveProject(root,{activeId:null,name:'Current',snapshot:recipe('current')});await put(root,'src/scenes/film.js','target');const target=await saveProject(root,{name:'Target',snapshot:recipe('target')});await put(root,'src/scenes/film.js','unsaved current');const module=new URL('./project-library-store.mjs',import.meta.url).href;
 const code=`const {openProject}=await import(${JSON.stringify(module)});await openProject(process.argv[1],process.argv[2],{afterWrite:async()=>process.exit(79)});`;const child=spawnSync(process.execPath,['--input-type=module','-e',code,root,target.id],{encoding:'utf8',timeout:5000});assert.equal(child.status,79,child.stderr);assert.equal(await read(root,'src/scenes/film.js'),'target');await assert.rejects(lstat(path.join(root,'.motion-cache/project-session-open.json')),{code:'ENOENT'});
 const state=await libraryState(root);assert.equal(state.active.id,active.id);assert.equal(await read(root,'src/scenes/film.js'),'unsaved current');await assert.rejects(lstat(path.join(root,'.motion-cache/project-library/apply.json')),{code:'ENOENT'});
 });

 test('killed activation has a durable session journal before commit and recovers both pointer and source',async t=>{
 const root=await fixture(t),active=await createActiveProject(root,{activeId:null,name:'Current',snapshot:recipe('current')});await put(root,'src/scenes/film.js','target');const target=await saveProject(root,{name:'Target',snapshot:recipe('target')});await put(root,'src/scenes/film.js','unsaved current');const module=new URL('./project-library-session.mjs',import.meta.url).href;
 const code=`const {openActiveProject}=await import(${JSON.stringify(module)});await openActiveProject(process.argv[1],{activeId:process.argv[2],id:process.argv[3],snapshot:{parameters:{scene:'starter'}}},{beforeActivate:async()=>process.exit(81)});`;const child=spawnSync(process.execPath,['--input-type=module','-e',code,root,active.id,target.id],{encoding:'utf8',timeout:5000});assert.equal(child.status,81,child.stderr);assert.equal(await read(root,'src/scenes/film.js'),'target');const journal=JSON.parse(await read(root,'.motion-cache/project-session-open.json'));assert.equal(journal.targetId,target.id);
 const state=await libraryState(root);assert.equal(state.active.id,active.id);assert.equal(await read(root,'src/scenes/film.js'),'unsaved current');await assert.rejects(lstat(path.join(root,'.motion-cache/project-session-open.json')),{code:'ENOENT'});
 });

 test('OS workspace aliases share persistence/session state while internal links and aliased active renders remain blocked',async t=>{
 const root=await fixture(t);let alias=path.join(os.tmpdir(),path.basename(root));
 if(alias===root){const aliases=await realpath(await mkdtemp(path.join(os.tmpdir(),'framevolve-alias-')));t.after(()=>rm(aliases,{recursive:true,force:true}));alias=path.join(aliases,'workspace');await symlink(root,alias);}
 assert.notEqual(alias,root);assert.equal(await realpath(alias),root);assert.strictEqual(projectSession(alias),projectSession(root));
 const created=await createActiveProject(alias,{activeId:null,name:'Mac temp alias',snapshot:recipe('alias')});await put(root,'src/scenes/film.js','agent edited through alias');const saved=await autosaveActiveProject(alias);assert.equal(saved.revision,2);assert.equal((await libraryState(root)).active.id,created.id);assert.equal((await libraryState(alias)).active.id,created.id);assert.equal((await readProject(alias,created.id)).revision,2);
 const key=Symbol.for('framevolve.studio-render-states'),prior=globalThis[key];globalThis[key]=new Map([[alias,{activeRenderId:'aliased-render'}]]);try{await assert.rejects(createActiveProject(root,{activeId:created.id,name:'Blocked render',snapshot:recipe('blocked')}),/render/);await assert.rejects(openProject(root,created.id),/render/);}finally{globalThis[key]=prior;}
 const outside=await fixture(t);await symlink(path.join(outside,'src/scenes/film.js'),path.join(root,'src/scenes/linked.js'));await assert.rejects(autosaveActiveProject(alias),/Linked/);await rm(path.join(root,'src/scenes/linked.js'));
 await rm(path.join(root,'.motion-cache'),{recursive:true,force:true});await symlink(path.join(outside,'project'),path.join(root,'.motion-cache'));await assert.rejects(libraryState(alias),/cannot be a link/);await assert.rejects(readProject(alias,created.id),/Linked/);assert.equal(await read(outside,'project/look.json'),'{}');
 });
