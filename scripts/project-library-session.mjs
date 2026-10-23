import {mkdir,lstat,rename,rm,open,realpath} from 'node:fs/promises';
import path from 'node:path';
import {constants,realpathSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {listProjects,readProject,saveProject,openProject,importProject,exportProject,recoverProjectOpen,assertProjectLibraryIdle,manageProject,replaceProjectScene,projectExportPreflight,restoreProjectRecord,saveProjectCopy} from './project-library-store.mjs';
import {readReview,writeReview,validateReview} from './live-review-store.mjs';
import {importImageAsset} from './image-assets.mjs';

export async function importLibraryImage(root,activeId,bytes){root=await realpath(path.resolve(root));return exclusive(root,async()=>{
 const current=await expected(root,activeId);if(!current)throw failure('Create your App Demo project first.');await assertProjectLibraryIdle(root);
 const record=await readProject(root,current.id);if(record.snapshot?.parameters?.scene!=='appdemo')throw failure('Open an App Demo project before adding screenshots.');
 return importImageAsset(root,bytes);
});}

const sessions=globalThis[Symbol.for('framevolve.project-library.sessions')]??=new Map();
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const failure=(message,status=409)=>Object.assign(Error(message),{status});
const hash=snapshot=>createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
export function projectSession(root){root=realpathSync(path.resolve(root));if(!sessions.has(root))sessions.set(root,{working:false,error:'',pending:false});return sessions.get(root);}
async function cache(root){
 const base=path.resolve(root);let current=path.parse(base).root;for(const part of base.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);const info=await lstat(current);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Project storage cannot be a link.');}
 const dir=path.join(base,'.motion-cache');await mkdir(dir,{recursive:true});const info=await lstat(dir);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Project storage cannot be a link.');return dir;
}
async function readJson(file,max=65536){const info=await lstat(file);if(info.isSymbolicLink()||!info.isFile()||info.size>max)throw Error('Invalid project session storage.');const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const bytes=await handle.readFile();if(bytes.length>max)throw Error('Invalid project session storage.');return JSON.parse(bytes);}finally{await handle.close();}}
async function atomic(file,value){
 try{const info=await lstat(file);if(info.isSymbolicLink()||!info.isFile())throw Error('Invalid project session storage.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const temp=file+'.'+randomUUID()+'.tmp';let handle;try{handle=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await handle.writeFile(JSON.stringify(value));await handle.sync();await handle.close();handle=null;await rename(temp,file);}finally{await handle?.close();await rm(temp,{force:true});}
}
async function pointer(root){const file=path.join(await cache(root),'active-project.json');try{const value=await readJson(file);if(value.version!==1||!idPattern.test(value.id)||!Array.isArray(value.trusted??[])||(value.trusted??[]).some(id=>!idPattern.test(id)))throw Error('Invalid active project.');return value;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function activeProjectId(root){root=await realpath(path.resolve(root));return (await pointer(root))?.id??null;}
async function activate(root,id,trusted=[]){await atomic(path.join(await cache(root),'active-project.json'),{version:1,id,trusted});}
const sessionJournal=root=>path.join(root,'.motion-cache/project-session-open.json');
async function restoreSession(root,journal){
 if(journal.version!==1||!idPattern.test(journal.targetId)||!idPattern.test(journal.backupId)||(journal.previous&&(!idPattern.test(journal.previous.id)||!Array.isArray(journal.previous.trusted??[])||(journal.previous.trusted??[]).some(id=>!idPattern.test(id)))))throw Error('Invalid project session recovery journal.');
 validateReview(journal.review);const current=await pointer(root);if(current&&current.id!==journal.targetId&&current.id!==journal.previous?.id)throw failure('A newer active project needs manual recovery; the workspace backup was preserved.');
 await openProject(root,journal.backupId,{snapshot:journal.targetSnapshot});
 if(journal.previous)await activate(root,journal.previous.id,journal.previous.trusted??[]);else await rm(path.join(await cache(root),'active-project.json'),{force:true});
 await writeReview(root,journal.review);await rm(sessionJournal(root),{force:true});
}
const storeJournal=root=>path.join(root,'.motion-cache/project-library/apply.json');
async function exists(file){try{await lstat(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function recoverSession(root){
 // Finish the source transaction first; activation recovery may then open its backup safely.
 if(await exists(storeJournal(root)))await recoverProjectOpen(root);
 if(await exists(sessionJournal(root)))await restoreSession(root,await readJson(sessionJournal(root),8*1024*1024));
}
function publicRecord(record){if(!record)return null;return {id:record.id,name:record.name,revision:record.revision,updatedAt:record.updatedAt,snapshot:record.snapshot,snapshotHash:hash(record.snapshot),customCode:record.customCode,imported:record.imported,warnings:record.portabilityWarnings??[],trashedAt:record.trashedAt??null};}
export async function libraryState(root){root=await realpath(path.resolve(root));await cache(root);if(await exists(sessionJournal(root))||await exists(storeJournal(root)))await exclusive(root,async()=>{});const current=await pointer(root),state=projectSession(root);return {active:current?publicRecord(await readProject(root,current.id)):null,projects:await listProjects(root),working:state.working,pending:state.pending,error:state.error};}
async function exclusive(root,operation){
 const lock=path.join(await cache(root),'project-session.lock'),state=projectSession(root);let acquired=false;
 for(let attempt=0;attempt<30;attempt++){
  try{await mkdir(lock,{mode:0o700});acquired=true;await atomic(path.join(lock,'owner.json'),{pid:process.pid});break;}
  catch(e){if(acquired){await rm(lock,{recursive:true,force:true});throw e;}if(e.code!=='EEXIST')throw e;
   const info=await lstat(lock);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Project session lock cannot be a link.');
   let owner;try{owner=await readJson(path.join(lock,'owner.json'),1024);}catch(error){if(error.code!=='ENOENT')throw error;}
   if(owner){if(!Number.isSafeInteger(owner.pid)||owner.pid<1)throw Error('Invalid project session lock.');let dead=false;try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')dead=true;else if(error.code!=='EPERM')throw error;}if(dead){await rm(lock,{recursive:true,force:true});continue;}}
   await delay(100);
  }
 }
 if(!acquired)throw failure('Another project operation is running. Try again shortly.');
 state.working=true;
 try{await recoverSession(root);const result=await operation();state.error='';return result;}catch(e){state.error=e.message;throw e;}finally{state.working=false;await rm(lock,{recursive:true,force:true});}
}
async function expected(root,id){const current=await pointer(root);if((current?.id??null)!==(id??null))throw failure('The active project changed in another window. Reload to continue; your local draft is preserved.');return current;}
export async function saveActiveProject(root,input){root=await realpath(path.resolve(root));return exclusive(root,async()=>{
 const current=await expected(root,input.activeId);
 if(!current){const record=await saveProject(root,{name:input.name||'Untitled project',snapshot:input.snapshot});await activate(root,record.id);return publicRecord(record);}
 const previous=await readProject(root,current.id);
 if(input.revision!==previous.revision&&input.baseSnapshotHash!==hash(previous.snapshot))throw failure('This project has newer changes. Save a copy to keep your edits without replacing them.');
 const record=await saveProject(root,{id:previous.id,name:input.name||previous.name,snapshot:input.snapshot,expectedRevision:previous.revision});return publicRecord(record);
});}
export async function autosaveActiveProject(root,{snapshot,reviewCheckpoint}={}){root=await realpath(path.resolve(root));return exclusive(root,async()=>{
 const current=await pointer(root);if(!current)return null;
 const previous=await readProject(root,current.id);
 const review=snapshot?.parameters?.scene?await readReview(root):null;
 // A watcher may have read its checkpoint before waiting for this session lock.
 // Recovery activation publishes a new checkpoint; never apply that stale recipe.
 const published=review?.phase==='ready'&&review.snapshot&&hash(review.snapshot)===hash(snapshot)&&(reviewCheckpoint===undefined||review.checkpoint===reviewCheckpoint);
 const nextSnapshot=published?snapshot:previous.snapshot;
 return publicRecord(await saveProject(root,{id:previous.id,name:previous.name,snapshot:nextSnapshot,expectedRevision:previous.revision}));
});}
export async function createActiveProject(root,input){root=await realpath(path.resolve(root));return exclusive(root,async()=>{
 const current=await expected(root,input.activeId);await assertProjectLibraryIdle(root);
 const record=await saveProject(root,{name:input.name,snapshot:input.snapshot});
 try{await activate(root,record.id,current?.trusted??[]);await writeReview(root,{version:1,phase:'ready',tasks:[],checkpoint:randomUUID(),snapshot:record.snapshot,label:'Project created',updatedAt:new Date().toISOString()});return publicRecord(record);}
 catch(error){try{const now=await pointer(root);if(now?.id!==record.id&&now?.id!==current?.id)throw failure('A newer active project prevents rollback.');if(current)await activate(root,current.id,current.trusted??[]);else await rm(path.join(await cache(root),'active-project.json'),{force:true});}catch(recovery){throw failure(`${error.message} The new project was saved as ${record.id}; activation recovery needs attention: ${recovery.message}`);}throw failure(`${error.message} The previous project remains open; the new project is saved in the collection.`,400);}
});}
/** beforeActivate is a private failure-injection hook; never accept it from API input. */
export async function openActiveProject(root,input,options={}){root=await realpath(path.resolve(root));return exclusive(root,()=>openInSession(root,input,options));}
async function openInSession(root,input,{beforeActivate=async()=>{}}={}){
 const current=await expected(root,input.activeId),record=await readProject(root,input.id),trusted=current?.trusted??[];
 if(!record.snapshot?.parameters?.scene)throw failure('This package has no scene recipe to open in Studio.',400);
 if(record.imported&&record.customCode&&!trusted.includes(record.id)&&input.trusted!==true)throw failure('This imported project contains scene code. Confirm that you trust its source before opening it.',428);
 const review=await readReview(root);let journal,result;
 try{
  result=await openProject(root,record.id,{snapshot:input.snapshot,beforeWrite:async({backupId,record:target})=>{
   journal={version:1,previous:current,targetId:target.id,backupId,targetSnapshot:target.snapshot,review};
   await atomic(sessionJournal(root),journal);
  }});
  await beforeActivate();await activate(root,record.id,input.trusted?[...new Set([...trusted,record.id])]:trusted);
  await writeReview(root,{version:1,phase:'ready',tasks:[],checkpoint:randomUUID(),snapshot:record.snapshot,label:'Project opened',updatedAt:new Date().toISOString()});
  await rm(sessionJournal(root),{force:true});return {...result,record:publicRecord(result.record)};
 }catch(error){
  // openProject has released its own lock before this compensation can begin.
  if(journal)try{
   if(!result){
    // The store owns failed-apply rollback. Preserve newer edits it deliberately left alone.
    if(await exists(storeJournal(root)))throw error;
    if(await exists(sessionJournal(root))){const saved=await readJson(sessionJournal(root),8*1024*1024);if(saved.backupId!==journal.backupId||saved.targetId!==journal.targetId)throw failure('A newer activation journal needs manual recovery.');await rm(sessionJournal(root));}
   }else await recoverSession(root);
  }catch(recovery){throw failure(`${error.message} Recovery could not finish: ${recovery.message} Workspace backup ${journal.backupId} was preserved.`);}
  throw error;
 }
}
/** copyId is a caller-generated idempotency key. Retry the exact payload. */
export async function saveCopyActiveProject(root,input,{beforeActivate=async()=>{}}={}){root=await realpath(path.resolve(root));return exclusive(root,async()=>{
 if(!idPattern.test(input.copyId)||!idPattern.test(input.sourceId)||input.copyId===input.sourceId)throw failure('Choose a fresh project id for this recovery copy.',400);
 await assertProjectLibraryIdle(root);
 const current=await pointer(root);if(!current)throw failure('No active project is available. Your local draft is preserved.');
 const source=await readProject(root,input.sourceId),trusted=current.trusted??[];
 if(source.imported&&source.customCode&&!trusted.includes(source.id))throw failure('This imported source contains scene code. Open it through the collection and confirm that you trust it before saving a recovery copy.',428);
 const sameSource=current.id===source.id;
 const {record,replayed}=await saveProjectCopy(root,{copyId:input.copyId,sourceId:source.id,name:input.name,snapshot:input.snapshot,captureWorkspace:sameSource});
 if(current.id===record.id)return {record:publicRecord(record),reloadRequired:record.recoveryCopy.requiresReload,replayed};
 // Another window may have switched projects since this tab last saved. Save
 // that project's shared source first, using its own latest recipe, before apply.
 let previous=await readProject(root,current.id);
 if(!sameSource)previous=await saveProject(root,{id:previous.id,name:previous.name,snapshot:previous.snapshot,expectedRevision:previous.revision});
 const opened=await openInSession(root,{activeId:current.id,id:record.id,snapshot:previous.snapshot,trusted:record.imported&&record.customCode&&trusted.includes(source.id)},{beforeActivate});
 return {...opened,record:opened.record,reloadRequired:record.recoveryCopy.requiresReload||opened.filesChanged>0,replayed};
});}
export async function importLibraryProject(root,bytes){root=await realpath(path.resolve(root));return exclusive(root,async()=>publicRecord(await importProject(root,bytes)));}
export async function exportLibraryProject(root,id,revision){root=await realpath(path.resolve(root));return exclusive(root,async()=>{await expected(root,id);return exportProject(root,id,{expectedRevision:revision});});}
export async function preflightLibraryProject(root,input){root=await realpath(path.resolve(root));return exclusive(root,async()=>{await expected(root,input.activeId);return projectExportPreflight(root,input.activeId);});}
export async function manageLibraryProject(root,input){root=await realpath(path.resolve(root));return exclusive(root,async()=>{
 const current=await expected(root,input.activeId);await assertProjectLibraryIdle(root);
 if(input.action==='trash'&&current?.id===input.id)throw failure('Open another project before moving the active project to Trash. Your current work stays open.');
 return publicRecord(await manageProject(root,{id:input.id,expectedRevision:input.revision,action:input.action,name:input.name}));
});}
/** beforePublish is a private failure-injection hook, never accepted from HTTP input. */
export async function chooseLibraryScene(root,input,{beforePublish=async()=>{}}={}){root=await realpath(path.resolve(root));return exclusive(root,async()=>{
 const current=await expected(root,input.activeId);await assertProjectLibraryIdle(root);
 if(!current)throw failure('Save the current project before choosing an example.');
 const previous=await readProject(root,current.id);
 if(input.revision!==previous.revision)throw failure('The project changed while choosing an example. Try again after the current save.');
 if(!input.snapshot?.parameters?.scene||input.snapshot.parameters.scene!==input.sceneId)throw failure('The chosen example does not match its scene snapshot.',400);
 let record,checkpoint;
 try{
  if(input.mode==='new'){record=await saveProject(root,{name:input.name||input.label||'Example project',snapshot:input.snapshot});await activate(root,record.id,current.trusted??[]);}
  else if(input.mode==='replace')({record,checkpoint}=await replaceProjectScene(root,{id:current.id,expectedRevision:input.revision,snapshot:input.snapshot,label:input.label}));
  else throw failure('Choose New project or Replace current project.',400);
  await beforePublish();await writeReview(root,{version:1,phase:'ready',tasks:[],checkpoint:randomUUID(),snapshot:record.snapshot,label:'Example opened',updatedAt:new Date().toISOString()});
  return {record:publicRecord(record),checkpoint:publicRecord(checkpoint)};
 }catch(error){
  if(!record)throw error;
  try{
   const now=await pointer(root);if(now?.id!==(input.mode==='new'?record.id:current.id)&&now?.id!==current.id)throw failure('A newer active project prevents rollback.');
   if(input.mode==='replace')await restoreProjectRecord(root,previous,record.revision);
   await activate(root,current.id,current.trusted??[]);
  }catch(recovery){throw failure(`${error.message} The example was saved but rollback needs attention: ${recovery.message} Prior work remains in project ${checkpoint?.id??previous.id}. Reload before further editing.`);}
  throw failure(`${error.message} The previous project was restored. ${checkpoint?'Its recovery copy remains in Recent projects.':'The new example remains saved in the collection.'}`,400);
 }
});}
