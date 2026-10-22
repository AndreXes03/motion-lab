import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,rename,rm,lstat} from 'node:fs/promises';
import path from 'node:path';
import {readReview,writeReview} from './live-review-store.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const safe=name=>typeof name==='string'&&!name.split('/').some(x=>!x||x==='.'||x==='..')&&!name.includes('\\')&&(/^(src\/.*\.(js|json|css|glsl)|project\/(?!history\/|versions\/|references\/|briefs\/).*\.json)$/.test(name));
const folder=root=>path.join(root,'.motion-cache/session-checkpoints');
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
async function target(root,name){if(!safe(name))throw Error('Unsafe checkpoint path.');let file=root;for(const part of name.split('/')){file=path.join(file,part);try{if((await lstat(file)).isSymbolicLink())throw Error('Checkpoint paths must not be symbolic links.');}catch(e){if(e.code!=='ENOENT')throw e;}}return file;}
async function scan(root){const result={};let size=0;async function walk(dir){let entries;try{entries=await readdir(path.join(root,dir),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}for(const e of entries){const name=dir+'/'+e.name;if(e.isSymbolicLink())throw Error('Move linked project files into the project before saving a checkpoint.');if(e.isDirectory()){if(!/^project\/(history|versions|references|briefs)$/.test(name))await walk(name);}else if(e.isFile()&&safe(name)){const file=await target(root,name),info=await lstat(file);if(info.size>8*1024*1024||(size+=info.size)>64*1024*1024)throw Error('Checkpoint source exceeds 64 MB; keep large assets outside source JSON.');const bytes=await readFile(file);result[name]={bytes,sha:digest(bytes),mode:info.mode&0o777};}}}await walk('src');await walk('project');return result;}
async function atomic(file,bytes,mode=0o600){await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,bytes,{mode});await rename(tmp,file);}finally{await rm(tmp,{force:true});}}
export async function assertSessionIdle(root,{allowEditing=false}={}){
 if(!allowEditing&&(await readReview(root)).phase==='editing')throw Error('Ask your agent to finish or pause the current revision first.');
 const states=globalThis[Symbol.for('framevolve.studio-render-states')];if(states?.get(root)?.activeRenderId)throw Error('Wait for the current render to finish.');
 let cache=[];try{cache=await readdir(path.join(root,'.motion-cache'));}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const name of cache.filter(name=>/^launcher-\d+\.json$/.test(name))){
  const state=JSON.parse(await readFile(path.join(root,'.motion-cache',name),'utf8'));if(!Number.isInteger(state.pid)||state.pid<1)continue;try{process.kill(state.pid,0);}catch(e){if(e.code==='ESRCH')continue;throw e;}
  const port=Number(name.match(/\d+/)[0]);let data;try{const response=await fetch('http://127.0.0.1:'+port+'/api/studio',{signal:AbortSignal.timeout(2000)});if(!response.ok)throw Error();data=await response.json();}catch{throw Error('Cannot verify Studio render status. Close Studio before restoring.');}
  if(data.jobs?.some(j=>['running','queued'].includes(j.status)))throw Error('Wait for the current render to finish.');
 }
 for(const file of ['distribution-update.lock','checkpoint-restore.json'])try{await lstat(path.join(root,'.motion-cache',file));throw Error(file==='checkpoint-restore.json'?'A restore was interrupted. Recover it before continuing.':'Wait for the application update to finish.');}catch(e){if(e.code!=='ENOENT')throw e;}
}
async function locked(root,fn){const lock=path.join(root,'.motion-cache/checkpoint.lock');await mkdir(path.dirname(lock),{recursive:true});try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')throw Error('Another checkpoint operation is running.');throw e;}try{return await fn();}finally{await rm(lock,{recursive:true,force:true});}}
async function save(root,label,snapshot){
 const data=await scan(root),id=randomUUID(),files={};if(!Object.keys(data).length)throw Error('No project source found.');
 const dir=path.join(folder(root),id);await mkdir(dir,{recursive:true});
 for(const [name,item]of Object.entries(data)){files[name]={sha:item.sha,mode:item.mode};await atomic(path.join(dir,'files',name),item.bytes);}
 const current=await scan(root);if(JSON.stringify(Object.entries(current).map(([k,v])=>[k,v.sha]))!==JSON.stringify(Object.entries(data).map(([k,v])=>[k,v.sha])))throw Error('Project changed while saving. Retry when the agent has paused.');
 const record={version:1,id,label:String(label||'Before revision').slice(0,100),createdAt:new Date().toISOString(),files,snapshot:snapshot??(await readReview(root)).snapshot??null};
 await atomic(path.join(dir,'checkpoint.json'),Buffer.from(JSON.stringify(record)));return record;
}
export async function saveCheckpoint(root,{label,snapshot,allowEditing=false}={}){return locked(root,async()=>{await assertSessionIdle(root,{allowEditing});return save(root,label,snapshot);});}
export async function listCheckpoints(root){let entries;try{entries=await readdir(folder(root));}catch(e){if(e.code==='ENOENT')return [];throw e;}const out=[];for(const id of entries.filter(validId)){try{const r=JSON.parse(await readFile(path.join(folder(root),id,'checkpoint.json'),'utf8'));out.push({id:r.id,label:r.label,createdAt:r.createdAt,files:Object.keys(r.files).length});}catch{}}return out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
async function load(root,id){if(!validId(id))throw Error('Invalid checkpoint.');const record=JSON.parse(await readFile(path.join(folder(root),id,'checkpoint.json'),'utf8'));if(record.version!==1||record.id!==id||!record.files||Object.keys(record.files).length>5000)throw Error('Invalid checkpoint manifest.');const data={};for(const [name,item]of Object.entries(record.files)){await target(root,name);if(!safe(name)||!/^[a-f0-9]{64}$/.test(item.sha)||!Number.isInteger(item.mode)||item.mode<0||item.mode>0o777)throw Error('Invalid checkpoint file.');const bytes=await readFile(path.join(folder(root),id,'files',name));if(digest(bytes)!==item.sha)throw Error('Checkpoint file failed verification.');data[name]={...item,bytes};}return {record,data};}
async function hash(root,name){try{return digest(await readFile(await target(root,name)));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function rollback(root,journal){const backup=await load(root,journal.backupId);for(const item of [...journal.written].reverse()){const current=await hash(root,item.name);if(current!==item.after&&current!==item.before)throw Error('A newer edit needs manual recovery: '+item.name);const previous=backup.data[item.name],file=await target(root,item.name);if(previous)await atomic(file,previous.bytes,previous.mode);else await rm(file,{force:true});}await writeReview(root,journal.review);await rm(path.join(root,'.motion-cache/checkpoint-restore.json'),{force:true});}
export async function restoreCheckpoint(root,id,{snapshot,busy=()=>assertSessionIdle(root),afterWrite=async()=>{}}={}){return locked(root,async()=>{
 await busy();const desired=await load(root,id),backup=await save(root,'Before restore',snapshot),before=await load(root,backup.id),review=await readReview(root);
 await busy();
 const changes=[...new Set([...Object.keys(before.data),...Object.keys(desired.data)])].filter(name=>before.data[name]?.sha!==desired.data[name]?.sha);
 const journal={version:1,backupId:backup.id,review,written:[]},file=path.join(root,'.motion-cache/checkpoint-restore.json');
 await atomic(file,Buffer.from(JSON.stringify(journal)));await writeReview(root,{...review,phase:'editing',label:'Restoring saved revision'});
 try{for(const name of changes){const old=before.data[name],next=desired.data[name];if(await hash(root,name)!==(old?.sha??null))throw Error('Project changed during restore: '+name);journal.written.push({name,before:old?.sha??null,after:next?.sha??null});await atomic(file,Buffer.from(JSON.stringify(journal)));if(next)await atomic(await target(root,name),next.bytes,next.mode);else await rm(await target(root,name),{force:true});await afterWrite(name);}
 await writeReview(root,{...review,phase:'ready',snapshot:desired.record.snapshot,checkpoint:randomUUID(),label:'Restored: '+desired.record.label,updatedAt:new Date().toISOString()});await rm(file);return {id,backupId:backup.id,snapshot:desired.record.snapshot,files:changes.length};
 }catch(error){await rollback(root,journal);throw error;}
 });}
export async function recoverCheckpoint(root){const file=path.join(root,'.motion-cache/checkpoint-restore.json'),journal=JSON.parse(await readFile(file,'utf8'));if(journal.version!==1||!validId(journal.backupId)||!Array.isArray(journal.written))throw Error('Invalid restore journal.');await rollback(root,journal);}
