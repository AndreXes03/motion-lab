import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,realpath,mkdir,writeFile,rm} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {projectLibraryMiddleware,projectLibraryPlugin} from './project-library-server.mjs';
import {libraryState,saveActiveProject} from './project-library-session.mjs';
import {readProject} from './project-library-store.mjs';

async function fixture(t){const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'framevolve-project-api-')));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'src/scenes'),{recursive:true});await writeFile(path.join(root,'src/scenes/film.js'),'export const title="before";');return root;}
const snapshot=title=>({parameters:{scene:'procedural',studio:{values:{title}}}});

test('local project API rejects foreign origins and transfers a real package without changing active project',async t=>{
 const root=await fixture(t),server=http.createServer(projectLibraryMiddleware(root));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port,data=await(await fetch(origin)).json();assert.equal(data.active,null);
 const headers={Origin:origin,'Content-Type':'application/json','X-Framevolve-Project':data.token};
 const post=(route,body,extra={})=>fetch(origin+route,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
 assert.equal((await post('/save',{}, {Origin:'https://example.com'})).status,403);
 assert.equal((await post('/save',{}, {'X-Framevolve-Project':'wrong'})).status,403);
 const response=await post('/save',{activeId:null,name:'My film',snapshot:snapshot('saved')});assert.equal(response.status,200);const {record}=await response.json();
 const exported=await post('/export',{id:record.id});assert.equal(exported.status,200);const bytes=await exported.arrayBuffer();assert.ok(bytes.byteLength>100);
 const imported=await fetch(origin+'/import',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes});assert.equal(imported.status,200);const copy=(await imported.json()).record;assert.notEqual(copy.id,record.id);assert.equal(copy.imported,true);assert.equal((await(await fetch(origin)).json()).active.id,record.id);
 assert.equal((await post('/open',{activeId:record.id,id:copy.id,snapshot:record.snapshot})).status,428);
 assert.equal((await post('/open',{activeId:record.id,id:copy.id,snapshot:record.snapshot,trusted:true})).status,200);
 assert.equal((await(await fetch(origin)).json()).active.id,copy.id);
});

test('watcher autosaves agent source edits without overwriting the saved UI recipe',async t=>{
 const root=await fixture(t),record=await saveActiveProject(root,{activeId:null,name:'Agent work',snapshot:snapshot('keep UI title')});
 const watcher=new EventEmitter();watcher.add=()=>{};const plugin=projectLibraryPlugin();await plugin.configureServer({config:{root},watcher,middlewares:{use(){}}});t.after(()=>plugin.closeBundle());
 const file=path.join(root,'src/scenes/film.js');await writeFile(file,'export const title="agent edit";');watcher.emit('change',file);
 let state;for(let i=0;i<30;i++){await delay(100);state=await libraryState(root);if(!state.pending&&state.active.revision>record.revision)break;}
 assert.ok(state.active.revision>record.revision);assert.deepEqual(state.active.snapshot,record.snapshot);assert.equal(state.error,'');
 assert.notEqual((await readProject(root,record.id)).files['src/scenes/film.js'],undefined);
});

test('collection, example and preflight routes preserve recovery and reviewed revisions',async t=>{
 const root=await fixture(t),server=http.createServer(projectLibraryMiddleware(root));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port,{token}=await(await fetch(origin)).json();
 const post=(route,body)=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Framevolve-Project':token},body:JSON.stringify(body)});
 const active=(await(await post('/save',{activeId:null,name:'Original project',snapshot:snapshot('preserved')})).json()).record;
 const copied=(await(await post('/manage',{activeId:active.id,id:active.id,revision:active.revision,action:'duplicate'})).json()).record;
 assert.notEqual(copied.id,active.id);assert.equal((await post('/manage',{activeId:active.id,id:active.id,revision:active.revision,action:'trash'})).status,409);
 const trash=(await(await post('/manage',{activeId:active.id,id:copied.id,revision:copied.revision,action:'trash'})).json()).record;assert.ok(trash.trashedAt);
 const restored=(await(await post('/manage',{activeId:active.id,id:trash.id,revision:trash.revision,action:'restore'})).json()).record;assert.equal(restored.trashedAt,null);
 const replacedResponse=await post('/scene',{activeId:active.id,revision:active.revision,sceneId:'procedural',label:'Procedural',mode:'replace',snapshot:snapshot('example')});assert.equal(replacedResponse.status,200);const replaced=await replacedResponse.json();assert.deepEqual(replaced.checkpoint.snapshot,active.snapshot);
 const preflight=await(await post('/preflight',{activeId:active.id})).json();assert.equal(preflight.revision,replaced.record.revision);assert.ok(preflight.files.some(file=>file.path==='src/scenes/film.js'));assert.match(preflight.limitations,/Computed paths/);
 assert.equal((await post('/export',{id:active.id,revision:active.revision})).status,409);assert.equal((await post('/export',{id:active.id,revision:preflight.revision})).status,200);
});
