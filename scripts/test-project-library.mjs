import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,mkdir,writeFile,readFile,rm,symlink,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {saveProject,readProject,listProjects,openProject,exportProject,importProject,isManagedProjectPath} from './project-library-store.mjs';
const snapshot=name=>({parameters:{scene:'starter'},label:name});
async function put(root,name,value){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),value);}
async function fixture(t){const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'framevolve-library-')));t.after(()=>rm(root,{recursive:true,force:true}));await put(root,'src/scenes/film.js','export const film="first";');await put(root,'src/config.js','export const fps=30;');await put(root,'project/look.json','{"lighting":"first"}');await put(root,'src/viewer/app.js','shared viewer');return root;}
async function text(root,name){return readFile(path.join(root,name),'utf8');}
const mutate=(bytes,fn)=>{const pkg=JSON.parse(gunzipSync(bytes));fn(pkg);return gzipSync(JSON.stringify(pkg));};

test('disk saves preserve two independent projects, deduplicate and back up unsaved work',async t=>{
 const root=await fixture(t),a=await saveProject(root,{name:'First film',snapshot:snapshot('a')});
 assert.equal((await saveProject(root,{id:a.id,name:a.name,snapshot:a.snapshot,expectedRevision:1})).revision,1);
 await put(root,'src/scenes/film.js','export const film="second";');await put(root,'src/scenes/only-second.js','second');await put(root,'project/look.json','{"lighting":"second"}');
 const b=await saveProject(root,{name:'Second film',snapshot:snapshot('b')});await put(root,'src/scenes/unsaved.js','precious unsaved work');
 const opened=await openProject(root,a.id,{snapshot:snapshot('unsaved')});assert.equal(opened.sourceChanged,true);assert.equal(await text(root,'src/scenes/film.js'),'export const film="first";');await assert.rejects(text(root,'src/scenes/only-second.js'),{code:'ENOENT'});assert.equal(await text(root,'src/viewer/app.js'),'shared viewer');
 assert.equal((await readProject(root,opened.backupId)).snapshot.label,'unsaved');
 await openProject(root,b.id);assert.equal(await text(root,'src/scenes/film.js'),'export const film="second";');assert.equal(await text(root,'src/scenes/only-second.js'),'second');
 await openProject(root,opened.backupId);assert.equal(await text(root,'src/scenes/unsaved.js'),'precious unsaved work');assert.equal((await listProjects(root)).length,2);
 await put(root,'src/scenes/film.js','third');const updated=await saveProject(root,{id:b.id,expectedRevision:b.revision,name:b.name,snapshot:b.snapshot});assert.equal(updated.revision,2);await assert.rejects(saveProject(root,{id:b.id,expectedRevision:1,name:b.name}),{status:409});
});

test('portable projects transport authored media, licenses and snapshot into a fresh root without applying code',async t=>{
 const root=await fixture(t),fresh=await fixture(t),asset=Buffer.from([0,255,1,128]);
 for(const name of ['project/audio/music.wav','project/references/product.png','project/assets/model.glb','src/assets/fonts/font.json','public/assets/texture.png'])await put(root,name,asset);
 await put(root,'project/assets/large.bin',Buffer.alloc(1024*1024,37));await put(root,'src/assets/fonts/LICENSE.txt','license');await put(root,'project/history/private.json','private');await put(root,'project/briefs/customer.json','private');await put(root,'project/feedback.json','private');
 const a=await saveProject(root,{name:'Portable',snapshot:snapshot('portable')}),portable=await exportProject(root,a.id);assert.equal(a.customCode,true);assert.equal(a.files['project/briefs/customer.json'],undefined);assert.equal(a.files['project/feedback.json'],undefined);
 await put(fresh,'src/scenes/film.js','keep current until explicit open');const imported=await importProject(fresh,portable);assert.notEqual(imported.id,a.id);assert.equal(imported.origin.id,a.id);assert.equal(imported.imported,true);assert.equal((await listProjects(fresh))[0].imported,true);assert.equal(await text(fresh,'src/scenes/film.js'),'keep current until explicit open');assert.deepEqual(imported.snapshot,a.snapshot);
 await openProject(fresh,imported.id);for(const name of ['project/audio/music.wav','project/references/product.png','src/assets/fonts/font.json','public/assets/texture.png'])assert.deepEqual(await readFile(path.join(fresh,name)),asset);assert.equal(await text(fresh,'src/assets/fonts/LICENSE.txt'),'license');assert.equal((await readProject(root,a.id)).id,a.id);await put(fresh,'src/scenes/film.js','local revision after import');const revised=await saveProject(fresh,{id:imported.id,expectedRevision:imported.revision,name:'Imported revised'});assert.equal(revised.imported,true);assert.deepEqual(revised.origin,imported.origin);
});

test('corrupt blobs, traversal, excluded runtime files and compressed garbage are rejected before library mutation',async t=>{
 const root=await fixture(t),fresh=await fixture(t),a=await saveProject(root,{name:'Safe'}),bytes=await exportProject(root,a.id);
 for(const unsafe of ['../escape','src/viewer/app.js','project/../secret','project/.env','project/assets/credentials.json','/project/a','project/a\\b','project/history/a'])assert.equal(isManagedProjectPath(unsafe),false);
 await assert.rejects(importProject(fresh,mutate(bytes,pkg=>{const hash=Object.values(pkg.project.files)[0];pkg.blobs[hash]=Buffer.from('corrupt').toString('base64');})),/verification/);
 await assert.rejects(importProject(fresh,mutate(bytes,pkg=>{pkg.project.files['../escape']=Object.values(pkg.project.files)[0];})),/Unsafe/);
 await assert.rejects(importProject(fresh,mutate(bytes,pkg=>{pkg.project.files['src/viewer/app.js']=Object.values(pkg.project.files)[0];})),/Unsafe/);
 await assert.rejects(importProject(fresh,Buffer.from('garbage')),/Invalid/);assert.equal((await listProjects(fresh)).length,0);
 const hash=Object.values(a.files)[0];await put(root,'.motion-cache/project-library/blobs/'+hash,'corrupted disk blob');await assert.rejects(exportProject(root,a.id),/verification/);
});

test('linked managed files, storage, and apply destinations are rejected without modifying outside files',async t=>{
 const root=await fixture(t),outside=await fixture(t),saved=await saveProject(root,{name:'Safe'});await rm(path.join(root,'src/scenes/film.js'));await symlink(path.join(outside,'src/scenes/film.js'),path.join(root,'src/scenes/film.js'));
 await assert.rejects(saveProject(root,{name:'Unsafe'}),/Linked/);await assert.rejects(openProject(root,saved.id),/Linked/);assert.equal(await text(outside,'src/scenes/film.js'),'export const film="first";');
 const fresh=await fixture(t);await mkdir(path.join(fresh,'.motion-cache'));await symlink(path.join(outside,'project'),path.join(fresh,'.motion-cache/project-library'));await assert.rejects(listProjects(fresh),/Linked/);
});

test('open refuses editing and active renders, and rolls back partial writes after an apply failure',async t=>{
 const root=await fixture(t),a=await saveProject(root,{name:'Initial'});await put(root,'src/scenes/film.js','current film');await put(root,'project/look.json','current look');
 await put(root,'.motion-cache/live-review.json',JSON.stringify({version:1,phase:'editing',tasks:[]}));await assert.rejects(openProject(root,a.id),/finish or pause/);assert.equal(await text(root,'src/scenes/film.js'),'current film');
 await put(root,'.motion-cache/live-review.json',JSON.stringify({version:1,phase:'idle',tasks:[]}));const states=new Map([[root,{activeRenderId:'render'}]]),key=Symbol.for('framevolve.studio-render-states'),prior=globalThis[key];globalThis[key]=states;try{await assert.rejects(openProject(root,a.id),/render/);}finally{globalThis[key]=prior;}
 let writes=0;await assert.rejects(openProject(root,a.id,{afterWrite:async()=>{if(++writes===2)throw Error('Injected disk failure');}}),/Injected disk failure/);assert.equal(writes,2);assert.equal(await text(root,'src/scenes/film.js'),'current film');assert.equal(await text(root,'project/look.json'),'current look');assert.equal((await readdir(path.join(root,'.motion-cache/project-library'))).includes('apply.json'),false);
});

test('concurrent saves serialize and optimistic revision admits only one changed writer',async t=>{
 const root=await fixture(t),a=await saveProject(root,{name:'First'});await put(root,'src/scenes/film.js','updated');const attempts=await Promise.allSettled([saveProject(root,{id:a.id,expectedRevision:1,name:'Writer one'}),saveProject(root,{id:a.id,expectedRevision:1,name:'Writer two'})]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(attempts.find(r=>r.status==='rejected').reason.status,409);assert.equal((await readProject(root,a.id)).revision,2);
});

test('reports unsupported external media references instead of promising a self-contained export',async t=>{const root=await fixture(t);await put(root,'project/references.json',JSON.stringify({image:'https://example.com/product.png',video:'file:///Volumes/Drive/video.mov',texture:'/assets/missing.png'}));const saved=await saveProject(root,{name:'References'});assert.equal(saved.portabilityWarnings.length,3);});

 test('snapshot references report missing audio/media, malformed snapshots fail and unknown scenes import without applying',async t=>{
 const root=await fixture(t),fresh=await fixture(t),missing='a'.repeat(64),recipe={parameters:{scene:'starter',audio:{version:1,tracks:[{assetId:missing}]},texture:'https://example.com/texture.png',model:'project/assets/missing.glb'}};
 await put(root,'package.json',JSON.stringify({version:'1.0.0'}));await put(fresh,'package.json',JSON.stringify({version:'2.0.0'}));const saved=await saveProject(root,{name:'References in snapshot',snapshot:recipe});assert.equal(saved.portabilityWarnings.length,3);assert.ok(saved.portabilityWarnings.some(w=>w.reference==='project/audio/'+missing+'.audio'));
 for(const bad of [{scene:'starter'},{parameters:{}},{parameters:{scene:'../evil'}},'starter',[]])await assert.rejects(saveProject(root,{name:'Bad',snapshot:bad}),/snapshot/);
 const portable=await exportProject(root,saved.id),unknown=await importProject(fresh,mutate(portable,pkg=>{pkg.project.snapshot.parameters.scene='newer-scene';}));assert.ok(unknown.portabilityWarnings.some(w=>w.reference==='scene:newer-scene'));assert.ok(unknown.portabilityWarnings.some(w=>w.reference==='application'));await assert.rejects(openProject(fresh,unknown.id),/not supported/);assert.equal(await text(fresh,'src/scenes/film.js'),'export const film="first";');
 });

 test('beforeWrite sees a durable backup/apply journal before source mutation and callback failure stays reversible',async t=>{
 const root=await fixture(t),saved=await saveProject(root,{name:'Target',snapshot:snapshot('target')});await put(root,'src/scenes/film.js','unsaved current');let called=false;
 await assert.rejects(openProject(root,saved.id,{beforeWrite:async({backupId,record})=>{called=true;assert.equal(record.id,saved.id);assert.equal(await text(root,'src/scenes/film.js'),'unsaved current');const journal=JSON.parse(await text(root,'.motion-cache/project-library/apply.json'));assert.equal(journal.backupId,backupId);assert.deepEqual(journal.written,[]);const backup=JSON.parse(await text(root,'.motion-cache/project-library/records/'+backupId+'.json'));assert.ok(backup.files['src/scenes/film.js']);throw Error('Session journal persistence failed');}}),/persistence failed/);assert.equal(called,true);assert.equal(await text(root,'src/scenes/film.js'),'unsaved current');await assert.rejects(text(root,'.motion-cache/project-library/apply.json'),{code:'ENOENT'});
 });
