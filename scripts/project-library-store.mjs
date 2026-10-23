/** Disk-backed authored projects. Packages contain code: import is storage-only. */
import {constants,realpathSync} from 'node:fs';
import {open, lstat, mkdir, readdir, rename, rm, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {gzipSync, gunzipSync} from 'node:zlib';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assertSessionIdle} from './session-checkpoints.mjs';
import {sceneIds} from '../src/scene-registry.js';
import {canonicalScene} from '../src/engine/legacy-scene.js';

export const PROJECT_LIBRARY_LIMITS = Object.freeze({files:10000,fileBytes:100*1024*1024,totalBytes:200*1024*1024,compressedBytes:100*1024*1024,manifestBytes:4*1024*1024,snapshotBytes:2*1024*1024});
export const MAX_PACKAGE_BYTES=PROJECT_LIBRARY_LIMITS.compressedBytes;
export const PROJECT_LIBRARY_ROOTS = Object.freeze(['src/scenes','src/components','src/product-kit','src/assets','src/config.js','project','public/assets']);
const L=PROJECT_LIBRARY_LIMITS, queues=new Map(), sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const validId=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
const validSha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=(status,message)=>Object.assign(Error(message),{status});
const store=root=>path.join(root,'.motion-cache/project-library');
// Workspace aliases (/var -> /private/var on macOS) may key runtime state differently.
// Canonicalize only the trusted workspace root; managed descendants still reject links.
export async function assertProjectLibraryIdle(root){
 const canonical=await realpath(path.resolve(root));await assertSessionIdle(canonical);
 const states=globalThis[Symbol.for('framevolve.studio-render-states')];
 for(const [alias,state]of states??[]){if(!state?.activeRenderId||typeof alias!=='string')continue;let resolved;try{resolved=realpathSync(alias);}catch(error){if(error.code==='ENOENT')continue;throw error;}if(resolved===canonical)throw fail(409,'Wait for the current render to finish.');}
}

const secret=part=>/^(?:\.|history$|versions$|briefs$|private$|feedback(?:[-_.].*)?$|feedback-memory$|node_modules$|renders?$|cache$|credentials?(?:\..*)?$|secrets?(?:\..*)?$)/i.test(part);
export function isManagedProjectPath(name){
 if(typeof name!=='string'||name.length>500||/[\\\x00-\x1f:]/.test(name)||name.startsWith('/'))return false;
 const parts=name.split('/');if(parts.some(p=>!p||p==='.'||p==='..'||secret(p)))return false;
 return PROJECT_LIBRARY_ROOTS.some(base=>name===base||name.startsWith(base+'/'));
}
function idCheck(id){if(!validId(id))throw fail(400,'Invalid library project id.');return id;}
async function info(file){try{const value=await lstat(file);if(value.isSymbolicLink())throw fail(400,'Linked files and directories cannot be used in a project: '+path.basename(file));return value;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
// Walk all parents, including parents of root, before accessing a controlled path.
async function safePath(root,relative=''){
 const base=path.resolve(root),absolute=path.resolve(base,relative);if(absolute!==base&&!absolute.startsWith(base+path.sep))throw fail(400,'Unsafe project path.');
 let current=path.parse(absolute).root;for(const part of absolute.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);const stat=await info(current);if(stat&&current!==absolute&&!stat.isDirectory())throw fail(400,'Project path parent must be a directory.');}return absolute;
}
async function directory(root,relative){const parts=relative.split('/');let current='';for(const part of parts){current=current?current+'/'+part:part;const target=await safePath(root,current);let stat=await info(target);if(!stat){try{await mkdir(target,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}stat=await info(target);}if(!stat?.isDirectory())throw fail(400,'Project storage must be a directory.');}}
async function ensure(root){const stat=await info(await safePath(root));if(!stat?.isDirectory())throw fail(400,'Project root must be a directory.');await directory(root,'.motion-cache/project-library/records');await directory(root,'.motion-cache/project-library/blobs');}
async function readBytes(root,relative,max=L.fileBytes){const file=await safePath(root,relative),stat=await info(file);if(!stat)throw Object.assign(Error('File not found: '+relative),{code:'ENOENT'});if(!stat.isFile()||stat.size>max)throw fail(400,'Project file is invalid or too large: '+relative);const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const before=await handle.stat();if(!before.isFile()||before.size>max)throw fail(400,'Project file is invalid or too large.');const bytes=await handle.readFile();const after=await handle.stat();if(bytes.length>max||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw fail(409,'Project changed while saving. Retry after the current edit.');return bytes;}finally{await handle.close();}}
async function atomic(root,relative,bytes){const file=await safePath(root,relative);await directory(root,path.posix.dirname(relative));const existing=await info(file);if(existing&&!existing.isFile())throw fail(400,'Cannot replace a non-file project path.');const temporary=relative+'.'+randomUUID()+'.tmp',temp=await safePath(root,temporary),handle=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}try{await safePath(root,relative);await rename(temp,file);}finally{await rm(temp,{force:true});}}
async function acquire(root){
 const relative='.motion-cache/project-library/operation.lock',file=await safePath(root,relative);
 try{await mkdir(file,{mode:0o700});}catch(error){
  if(error.code!=='EEXIST')throw error;
  let owner;try{owner=JSON.parse(await readBytes(root,relative+'/owner.json',1024));}catch{throw fail(409,'Another project library operation is running.');}
  if(!Number.isSafeInteger(owner.pid)||owner.pid<1)throw fail(409,'Invalid project library lock; inspect storage before recovery.');
  try{process.kill(owner.pid,0);throw fail(409,'Another project library operation is running.');}catch(error){if(error.code!=='ESRCH')throw error;}
  await rm(await safePath(root,relative),{recursive:true});try{await mkdir(file,{mode:0o700});}catch(error){if(error.code==='EEXIST')throw fail(409,'Another project library operation is running.');throw error;}
 }
 try{await atomic(root,relative+'/owner.json',Buffer.from(JSON.stringify({pid:process.pid})));}catch(error){await rm(file,{recursive:true,force:true});throw error;}
}
async function serialized(root,operation){root=await realpath(path.resolve(root));const previous=queues.get(root)??Promise.resolve();let release;const gate=new Promise(resolve=>{release=resolve;});const next=previous.catch(()=>{}).then(()=>gate);queues.set(root,next);await previous.catch(()=>{});let acquired=false;try{await ensure(root);await acquire(root);acquired=true;return await operation(root);}finally{if(acquired)await rm(await safePath(root,'.motion-cache/project-library/operation.lock'),{recursive:true,force:true});release();if(queues.get(root)===next)queues.delete(root);}}
function json(value,max,label){let encoded;try{encoded=JSON.stringify(value);}catch{throw fail(400,'Invalid '+label+'.');}if(!encoded||Buffer.byteLength(encoded)>max)throw fail(400,label+' is too large.');return JSON.parse(encoded);}
function snapshot(value){if(value==null)return null;const copy=json(value,L.snapshotBytes,'Project snapshot');if(!copy||Array.isArray(copy)||typeof copy!=='object'||!copy.parameters||Array.isArray(copy.parameters)||typeof copy.parameters!=='object'||typeof copy.parameters.scene!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(copy.parameters.scene))throw fail(400,'Project snapshot needs parameters.scene as a valid scene id.');return copy;}
function projectName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>160)throw fail(400,'Choose a project name of 1–160 characters.');return value.trim();}
function validateApplication(value){if(value===undefined)return;if(!value||typeof value!=='object'||Array.isArray(value)||['version','revision'].some(key=>typeof value[key]!=='string'||!value[key]||value[key].length>160))throw fail(400,'Invalid package application metadata.');}
function validateRecord(value,id){if(!value||value.version!==1||!validId(value.id)||(id&&value.id!==id)||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt))||!value.files||Array.isArray(value.files)||typeof value.files!=='object')throw fail(400,'Invalid project manifest.');projectName(value.name);snapshot(value.snapshot);validateApplication(value.application);const entries=Object.entries(value.files);if(entries.length>L.files)throw fail(400,'Too many project files.');for(const [name,hash]of entries)if(!isManagedProjectPath(name)||!validSha(hash))throw fail(400,'Unsafe project manifest path or hash: '+name);return value;}
async function readRecord(root,id){idCheck(id);let raw;try{raw=await readBytes(root,`.motion-cache/project-library/records/${id}.json`,L.manifestBytes);}catch(e){if(e.code==='ENOENT')throw fail(404,'Project not found.');throw e;}let record;try{record=JSON.parse(raw);}catch{throw fail(400,'Invalid project manifest JSON.');}return validateRecord(record,id);}
async function scan(root){const data=new Map();let total=0;
 async function walk(relative){const file=await safePath(root,relative),stat=await info(file);if(!stat)return;if(stat.isDirectory()){const entries=(await readdir(file)).sort();for(const entry of entries){const name=relative+'/'+entry;if(isManagedProjectPath(name))await walk(name);}return;}if(!stat.isFile())throw fail(400,'Unsupported project file: '+relative);if(data.size>=L.files)throw fail(400,'Too many project files.');const bytes=await readBytes(root,relative);total+=bytes.length;if(total>L.totalBytes)throw fail(400,'Project exceeds the 200 MiB storage limit.');data.set(relative,{bytes,sha:sha(bytes)});}
 for(const base of PROJECT_LIBRARY_ROOTS)await walk(base);return new Map([...data].sort(([a],[b])=>a.localeCompare(b)));
}
const filesOf=data=>Object.fromEntries([...data].map(([name,item])=>[name,item.sha]));
async function capture(root){const first=await scan(root),second=await scan(root);if(JSON.stringify(filesOf(first))!==JSON.stringify(filesOf(second)))throw fail(409,'Project changed while saving. Retry after the current edit.');return first;}
function warnings(data,recipe){
 const found=new Map(),add=(reference,reason='External, missing or unsupported reference is not included; relink or copy it into project/, src/assets/ or public/assets/.')=>found.set(reference,{reference,reason});
 function reference(value){
  if(/^(?:https?:\/\/|file:\/\/|\/(?:Users|home|Volumes)\/)/.test(value)){add(value);return;}
  const clean=value.split(/[?#]/)[0].replace(/^\.\//,'');
  const candidate=/^\/(?:assets|brand|media|audio|textures|models|fonts)\//.test(clean)?'public'+clean:clean;
  if((/^(?:project|src\/assets|public)\//.test(candidate))&&!data.has(candidate))add(value);
 }
 for(const [name,{bytes}]of data){
  if(!/\.(js|mjs|json|css|html|glsl)$/i.test(name))continue;
  for(const match of bytes.toString('utf8').matchAll(/["'`]([^\s"'`]+)["'`]/g)){
   const value=match[1];
   // Font homepage/license URLs are metadata, not missing runtime assets.
   if(name.startsWith('src/assets/')&&name.endsWith('.json')&&/^https?:/.test(value)&&!/\.(?:png|jpe?g|webp|svg|mp[34]|wav|ogg|glb|gltf|hdr|exr|woff2?|ttf|otf)(?:[?#]|$)/i.test(value))continue;
   reference(value);
  }
 }
 if(recipe){
  if(!sceneIds.includes(canonicalScene(recipe.parameters.scene)))add('scene:'+recipe.parameters.scene,'This scene is not registered in the installed Framevolve application; opening requires a compatible application.');
  const pending=[recipe];while(pending.length){const item=pending.pop();if(!item||typeof item!=='object')continue;for(const [key,value]of Object.entries(item)){
   if(typeof value==='string'){
    reference(value);
    if(key==='assetId'&&validSha(value)){
     const audio='project/audio/'+value+'.audio',meta='project/audio/'+value+'.json';
     if(!data.has(audio)||!data.has(meta)||data.get(audio)?.sha!==value)add(audio,'An imported audio track references missing or invalid audio bytes/metadata; include both project/audio/'+value+'.audio and .json.');
    }
   }else if(value&&typeof value==='object')pending.push(value);
  }}
 }
 return [...found.values()].sort((a,b)=>a.reference.localeCompare(b.reference));
}
async function application(root){let version='unknown',revision='unknown';try{version=JSON.parse(await readBytes(root,'package.json',1024*1024)).version??'unknown';}catch{}try{revision=(await promisify(execFile)('git',['rev-parse','HEAD'],{cwd:root,timeout:2000,maxBuffer:1024})).stdout.trim();}catch{}return {version,revision};}
async function persist(root,{id=randomUUID(),name,snapshot:recipe,revision=1,origin,imported=false,backup=false,recoveryCopy},data){const record={version:1,id,name:projectName(name),revision,snapshot:snapshot(recipe),updatedAt:new Date().toISOString(),files:filesOf(data),customCode:[...data.keys()].some(name=>/\.(?:js|mjs|cjs|html)$/i.test(name)),portabilityWarnings:warnings(data,snapshot(recipe)),portability:{scope:[...PROJECT_LIBRARY_ROOTS],dynamicReferences:'Computed paths and app/runtime dependencies require the same compatible Framevolve application.'},application:await application(root),...(backup?{backup:true}:{}),...(recoveryCopy?{recoveryCopy}:{}),...(origin?{origin}:{}),...(origin||imported?{imported:true}:{})};
 validateRecord(record);const sourceApp=origin?.application;if(sourceApp&&['version','revision'].some(key=>typeof sourceApp[key]==='string'&&sourceApp[key]!=='unknown'&&record.application[key]!=='unknown'&&sourceApp[key]!==record.application[key]))record.portabilityWarnings.push({reference:'application',reason:'This project was packaged with a different Framevolve application version or revision; runtime compatibility must be verified before opening.'});const encoded=Buffer.from(JSON.stringify(record));if(encoded.length>L.manifestBytes)throw fail(400,'Project manifest is too large.');for(const item of data.values()){const relative=`.motion-cache/project-library/blobs/${item.sha}`;const existing=await info(await safePath(root,relative));if(existing){if(sha(await readBytes(root,relative))!==item.sha)throw fail(400,'Stored project asset failed verification.');}else await atomic(root,relative,item.bytes);}await atomic(root,`.motion-cache/project-library/records/${id}.json`,encoded);return record;}
async function loadData(root,record){const data=new Map();let total=0;for(const [name,hash]of Object.entries(record.files)){const bytes=await readBytes(root,`.motion-cache/project-library/blobs/${hash}`);if(sha(bytes)!==hash)throw fail(400,'Stored project asset failed verification.');total+=bytes.length;if(total>L.totalBytes)throw fail(400,'Project exceeds the storage limit.');data.set(name,{bytes,sha:hash});}return data;}

export async function listProjects(root){return serialized(root,async root=>{const rows=[];for(const name of (await readdir(path.join(store(root),'records'))).sort()){if(!name.endsWith('.json'))continue;const id=name.slice(0,-5);if(!validId(id))continue;const r=await readRecord(root,id);if(r.backup)continue;rows.push({id:r.id,name:r.name,revision:r.revision,updatedAt:r.updatedAt,customCode:r.customCode,imported:r.imported===true,files:Object.keys(r.files).length,portabilityWarnings:r.portabilityWarnings??[],trashedAt:r.trashedAt??null});}return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));});}
export async function readProject(root,id){return serialized(root,async root=>readRecord(root,id));}
export async function saveProject(root,{id,name,snapshot:recipe,expectedRevision}={}){return serialized(root,async root=>{let previous;if(id){previous=await readRecord(root,id);if(previous.trashedAt)throw fail(409,'Restore this project from Trash before saving it.');if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==previous.revision)throw fail(409,'Project revision conflict. Reload the saved project before retrying.');}else if(expectedRevision!==undefined)throw fail(400,'A new project cannot have an expected revision.');if(await info(await safePath(root,'.motion-cache/project-library/apply.json')))throw fail(409,'An interrupted project open requires recovery.');const data=await capture(root),nextName=projectName(name??previous?.name),nextSnapshot=snapshot(recipe===undefined?previous?.snapshot:recipe);if(previous&&previous.name===nextName&&JSON.stringify(previous.snapshot)===JSON.stringify(nextSnapshot)&&JSON.stringify(previous.files)===JSON.stringify(filesOf(data)))return previous;return persist(root,{id,name:nextName,snapshot:nextSnapshot,revision:(previous?.revision??0)+1,origin:previous?.origin,imported:previous?.imported===true,backup:previous?.backup===true,recoveryCopy:previous?.recoveryCopy},data);});}
/** A recovery copy owns immutable source blobs and never overwrites its source record. */
export async function saveProjectCopy(root,{copyId,sourceId,name,snapshot:recipe,captureWorkspace=false}={}){return serialized(root,async root=>{
 idCheck(copyId);idCheck(sourceId);if(copyId===sourceId)throw fail(400,'A recovery copy needs a new project id.');
 const nextName=projectName(name),nextSnapshot=snapshot(recipe);if(!nextSnapshot)throw fail(400,'The recovery copy needs your current scene recipe.');
 const requestHash=sha(Buffer.from(JSON.stringify({sourceId,name:nextName,snapshot:nextSnapshot})));
 let existing;try{existing=await readRecord(root,copyId);}catch(error){if(error.status!==404)throw error;}
 if(existing){
  if(existing.recoveryCopy?.sourceId!==sourceId||existing.recoveryCopy?.requestHash!==requestHash)throw fail(409,'This copy id already belongs to another save. Start a new copy for the changed draft.');
  if(existing.trashedAt)throw fail(409,'This recovery copy is in Trash. Restore it before continuing.');
  await loadData(root,existing);return {record:existing,replayed:true};
 }
 await assertProjectLibraryIdle(root);
 if(await info(await safePath(root,'.motion-cache/project-library/apply.json')))throw fail(409,'An interrupted project open requires recovery.');
 const source=await readRecord(root,sourceId);if(source.trashedAt)throw fail(409,'Restore the source project from Trash before saving a copy.');
 const data=captureWorkspace?await capture(root):await loadData(root,source);
 // Imported tracks are hash-addressed; silently mixing another project's audio
 // with this recipe would create a copy that could not actually play its mix.
 const pending=[nextSnapshot];while(pending.length){const item=pending.pop();if(!item||typeof item!=='object')continue;for(const [key,value]of Object.entries(item)){
  if(key==='assetId'){
   const audio=data.get('project/audio/'+value+'.audio'),meta=data.get('project/audio/'+value+'.json');let metadata;try{metadata=meta&&JSON.parse(meta.bytes.toString('utf8'));}catch{}
   if(!validSha(value)||!audio||audio.sha!==value||metadata?.assetId!==value||!Number.isFinite(metadata?.duration)||metadata.duration<=0)throw fail(409,'The local draft references imported audio that is missing from its source project. Reopen the source and import that audio again before saving a copy.');
  }else if(value&&typeof value==='object')pending.push(value);
 }}
 const record=await persist(root,{id:copyId,name:nextName,snapshot:nextSnapshot,origin:source.origin,imported:source.imported===true,recoveryCopy:{sourceId,requestHash,requiresReload:!captureWorkspace}},data);
 return {record,replayed:false};
});}
async function currentHash(root,name){try{return sha(await readBytes(root,name));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
// Older projects predate App Demo. Keep its installed entry point and example
// assets available without replacing any source or content owned by the project.
function retainAppDemoSupport(desired,before){
 for(const name of ['src/scenes/app-demo.js',...['workspace','audio','delivery'].map(id=>`public/assets/app-demo/${id}.png`)]){
  if(!desired.has(name)&&before.has(name))desired.set(name,before.get(name));
 }
 for(const name of ['project/control-selections.json','project/render-plans.json']){
  const installed=before.get(name);if(!installed)continue;
  let defaults,target;try{defaults=JSON.parse(installed.bytes);target=desired.has(name)?JSON.parse(desired.get(name).bytes):{version:1,scenes:{}};}catch{continue;}
  if(defaults.scenes?.appdemo&&!target.scenes?.appdemo&&target.version===1&&target.scenes&&typeof target.scenes==='object'&&!Array.isArray(target.scenes)){
   const bytes=Buffer.from(JSON.stringify({...target,scenes:{...target.scenes,appdemo:defaults.scenes.appdemo}},null,2)+'\n');desired.set(name,{bytes,sha:sha(bytes)});
  }
 }
}
async function rollback(root,journal){const backup=await readRecord(root,journal.backupId),before=await loadData(root,backup);for(const item of [...journal.written].reverse()){if(!isManagedProjectPath(item.name))throw fail(400,'Unsafe recovery path.');const current=await currentHash(root,item.name);if(current!==item.after&&current!==item.before)throw fail(409,'A newer workspace edit needs manual recovery: '+item.name);const old=before.get(item.name);if(old)await atomic(root,item.name,old.bytes);else await rm(await safePath(root,item.name),{force:true});}await rm(await safePath(root,'.motion-cache/project-library/apply.json'),{force:true});}
/** beforeWrite persists session metadata after the backup/apply journal, before any source write.
 * Callbacks are private and must never be accepted from an HTTP request. */
export async function openProject(root,id,{snapshot:recipe,beforeWrite=async()=>{},afterWrite=async()=>{}}={}){return serialized(root,async root=>{
 if(await info(await safePath(root,'.motion-cache/project-library/apply.json')))throw fail(409,'An interrupted project open requires recovery.');await assertProjectLibraryIdle(root);const record=await readRecord(root,id);if(record.trashedAt)throw fail(409,'Restore this project from Trash before opening it.');if(record.snapshot&&!sceneIds.includes(canonicalScene(record.snapshot.parameters.scene)))throw fail(400,'This project scene is not supported by the installed Framevolve application.');const desired=await loadData(root,record),before=await capture(root);await assertProjectLibraryIdle(root);
 retainAppDemoSupport(desired,before);
 const backup=await persist(root,{name:('Workspace backup before '+record.name).slice(0,160),snapshot:recipe,backup:true},before),changes=[...new Set([...before.keys(),...desired.keys()])].filter(name=>before.get(name)?.sha!==desired.get(name)?.sha);
 // Validate every destination before any source mutation.
 for(const name of changes)await safePath(root,name);await assertProjectLibraryIdle(root);
 const journal={version:1,backupId:backup.id,targetId:id,written:[]},journalPath='.motion-cache/project-library/apply.json';await atomic(root,journalPath,Buffer.from(JSON.stringify(journal)));
 try{await beforeWrite({backupId:backup.id,record});for(const name of changes){const old=before.get(name),next=desired.get(name);if(await currentHash(root,name)!==(old?.sha??null))throw fail(409,'Project changed during open: '+name);journal.written.push({name,before:old?.sha??null,after:next?.sha??null});await atomic(root,journalPath,Buffer.from(JSON.stringify(journal)));if(next)await atomic(root,name,next.bytes);else await rm(await safePath(root,name),{force:true});await afterWrite(name);}
 // Catch concurrent edits even in a path outside the change set.
 if(JSON.stringify(filesOf(await scan(root)))!==JSON.stringify(filesOf(new Map([...desired].sort(([a],[b])=>a.localeCompare(b))))))throw fail(409,'Workspace changed during open.');await rm(await safePath(root,journalPath));return {record,backupId:backup.id,snapshot:record.snapshot,sourceChanged:changes.some(name=>name.startsWith('src/')),filesChanged:changes.length};
 }catch(error){try{await rollback(root,journal);}catch(recovery){throw fail(409,`${error.message} Automatic rollback stopped: ${recovery.message} Backup ${backup.id} and recovery journal were preserved.`);}throw error;}
 });}

// Collection changes reuse immutable asset blobs and never apply another project's files.
async function editableRecord(root,id,expectedRevision){
 await assertProjectLibraryIdle(root);
 if(await info(await safePath(root,'.motion-cache/project-library/apply.json')))throw fail(409,'An interrupted project open requires recovery.');
 const record=await readRecord(root,id);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==record.revision)throw fail(409,'Project revision conflict. Refresh the collection before retrying.');
 return record;
}
export async function manageProject(root,{id,expectedRevision,action,name}={}){return serialized(root,async root=>{
 const record=await editableRecord(root,id,expectedRevision);
 if(action==='duplicate'){
  if(record.trashedAt)throw fail(409,'Restore this project from Trash before duplicating it.');
  return persist(root,{name:name??(record.name+' copy').slice(0,160),snapshot:record.snapshot,origin:record.origin,imported:record.imported===true},await loadData(root,record));
 }
 if(!['rename','trash','restore'].includes(action))throw fail(400,'Unknown project collection action.');
 if(action==='rename'&&record.trashedAt)throw fail(409,'Restore this project from Trash before renaming it.');
 if(action==='restore'&&!record.trashedAt)throw fail(409,'This project is already in the collection.');
 if(action==='trash'&&record.trashedAt)throw fail(409,'This project is already in Trash.');
 const next={...record,revision:record.revision+1,updatedAt:new Date().toISOString()};
 if(action==='rename')next.name=projectName(name);
 if(action==='trash')next.trashedAt=next.updatedAt;
 if(action==='restore')delete next.trashedAt;
 validateRecord(next);await atomic(root,`.motion-cache/project-library/records/${id}.json`,Buffer.from(JSON.stringify(next)));return next;
});}
export async function replaceProjectScene(root,{id,expectedRevision,snapshot:recipe,label}={}){return serialized(root,async root=>{
 const previous=await editableRecord(root,id,expectedRevision);if(previous.trashedAt)throw fail(409,'Restore this project before replacing its scene.');
 const nextSnapshot=snapshot(recipe),data=await capture(root);
 const checkpointLabel=(typeof label==='string'?label:'scene change').slice(0,70),checkpointName=previous.name.slice(0,160-checkpointLabel.length-10)+' · before '+checkpointLabel;
 const checkpoint=await persist(root,{name:checkpointName,snapshot:previous.snapshot,origin:previous.origin,imported:previous.imported===true},await loadData(root,previous));
 const record=await persist(root,{id:previous.id,name:previous.name,snapshot:nextSnapshot,revision:previous.revision+1,origin:previous.origin,imported:previous.imported===true,recoveryCopy:previous.recoveryCopy},data);
 return {record,checkpoint};
});}
// Private session compensation: no workspace files are applied or removed.
export async function restoreProjectRecord(root,previous,expectedRevision){return serialized(root,async root=>{
 validateRecord(previous);const current=await editableRecord(root,previous.id,expectedRevision);await loadData(root,previous);
 const record={...previous,revision:current.revision+1,updatedAt:new Date().toISOString()};
 await atomic(root,`.motion-cache/project-library/records/${record.id}.json`,Buffer.from(JSON.stringify(record)));return record;
});}
export async function projectExportPreflight(root,id){return serialized(root,async root=>{
 const record=await readRecord(root,id);if(record.trashedAt)throw fail(409,'Restore this project before exporting it.');
 const data=await loadData(root,record),files=[...data].map(([path,{bytes}])=>({path,bytes:bytes.length}));
 const policy=record.snapshot?.parameters?.renderPolicy,engine=policy?.renderer;
 const automatic=engine==='auto'||!engine;
 const needsCycles=engine==='cycles'||automatic&&(policy?.preferredRenderer==='cycles'||policy?.intent==='photoreal')||engine==='mixed'&&(Array.isArray(policy?.shots)?policy.shots:[]).concat(Array.isArray(policy?.layers)?policy.layers:[]).some(item=>item.renderer==='cycles');
 const rendererRequirement=automatic?`Renderer: Auto${policy?.preferredRenderer?' (preference: '+policy.preferredRenderer+')':''}${needsCycles?'; install Cycles separately to use the preferred photoreal path. Auto may fall back on a supported renderer.':'; destination must support the selected rendering path.'}`:`Renderer support: ${engine}${needsCycles?' (install Cycles separately)':''}`;
 return {id:record.id,name:record.name,revision:record.revision,files,totalBytes:files.reduce((sum,file)=>sum+file.bytes,0),warnings:record.portabilityWarnings??[],requirements:[`Compatible Framevolve application (saved version: ${record.application?.version??'unknown'}, revision: ${record.application?.revision??'unknown'})`,`Registered scene: ${record.snapshot?.parameters?.scene??'unknown'}`,rendererRequirement,...(engine==='mixed'?['Mixed rendering also requires its prepared render inputs and compositing plan. Inputs outside the included file list must be copied separately.']:[])],limitations:'Computed paths cannot all be discovered automatically. External assets, app dependencies and renderer binaries are not bundled; verify the project after moving it.'};
});}

export async function recoverProjectOpen(root){return serialized(root,async root=>{await assertProjectLibraryIdle(root);const journal=JSON.parse(await readBytes(root,'.motion-cache/project-library/apply.json',L.manifestBytes));if(journal.version!==1||!validId(journal.backupId)||!Array.isArray(journal.written)||journal.written.length>L.files*2||journal.written.some(item=>!isManagedProjectPath(item.name)||(item.before!==null&&!validSha(item.before))||(item.after!==null&&!validSha(item.after))))throw fail(400,'Invalid project recovery journal.');await rollback(root,journal);return {recovered:true,backupId:journal.backupId};});}

export async function exportProject(root,id,{expectedRevision}={}){return serialized(root,async root=>{const record=await readRecord(root,id);if(record.trashedAt)throw fail(409,'Restore this project from Trash before exporting it.');if(expectedRevision!==undefined&&expectedRevision!==record.revision)throw fail(409,'The project changed after export review. Review it again before downloading.');const data=await loadData(root,record),blobs={};for(const {bytes,sha:hash}of data.values())blobs[hash]=bytes.toString('base64');const raw=Buffer.from(JSON.stringify({format:'framevolve',version:1,application:record.application,project:record,blobs}));const bytes=gzipSync(raw);if(bytes.length>L.compressedBytes)throw fail(400,'Portable project exceeds the 100 MiB compressed limit.');return bytes;});}
export async function importProject(root,buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length>L.compressedBytes)throw fail(400,'Portable project exceeds the 100 MiB compressed limit.');let pkg;try{const raw=gunzipSync(buffer,{maxOutputLength:Math.ceil(L.totalBytes*4/3)+L.manifestBytes+L.files*100});pkg=JSON.parse(raw);}catch{throw fail(400,'Invalid or oversized compressed Framevolve project.');}
 if(!pkg||pkg.format!=='framevolve'||pkg.version!==1||!pkg.blobs||Array.isArray(pkg.blobs)||typeof pkg.blobs!=='object'||Object.keys(pkg.blobs).length>L.files)throw fail(400,'Unsupported Framevolve project format.');validateApplication(pkg.application);const record=validateRecord(pkg.project),data=new Map(),decoded=new Map();let total=0;
 for(const [hash,base64]of Object.entries(pkg.blobs)){if(!validSha(hash)||typeof base64!=='string'||base64.length>Math.ceil(L.fileBytes/3)*4||base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw fail(400,'Invalid portable project asset.');const bytes=Buffer.from(base64,'base64');total+=bytes.length;if(total>L.totalBytes||bytes.length>L.fileBytes||sha(bytes)!==hash||bytes.toString('base64')!==base64)throw fail(400,'Portable project asset failed verification or exceeds limits.');decoded.set(hash,bytes);}
 let referencedTotal=0;const referenced=new Set();for(const [name,hash]of Object.entries(record.files)){const bytes=decoded.get(hash);if(!bytes)throw fail(400,'Portable project is missing an asset.');referencedTotal+=bytes.length;if(referencedTotal>L.totalBytes)throw fail(400,'Portable project exceeds decoded limits.');referenced.add(hash);data.set(name,{bytes,sha:hash});}if(referenced.size!==decoded.size)throw fail(400,'Portable project contains unreferenced assets.');
 return serialized(root,async root=>persist(root,{name:record.name,snapshot:record.snapshot,origin:{id:record.id,revision:record.revision,application:pkg.application??record.application??null,importedAt:new Date().toISOString()}},data));
}
