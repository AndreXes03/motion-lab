import {mountProjectLibraryUI} from './project-library-ui.js';
const signature=value=>JSON.stringify(value);
export async function mountProjectLibrary({container,getSnapshot,setSnapshot,newSnapshot,isBusy,liveRecovery=false,canApplyExternal=()=>true,onProjectCreated=()=>{},onProjectCopied=()=>{}}){
 let active=null,projects=[],token=null,base='',working=false,saving=false,stopped=false,conflict=false,externalPending=false,timer,pollTimer,observed='',changedAt=0,ready=false,switching=false,retryAt=0;
 let status='loading',message='',generation=0,copyAttempt=null,reloadPending=false;
 const ui=mountProjectLibraryUI({container,isBusy,actions:{save:()=>save(true),saveCopy,newProject,openProject,importProject,exportProject,manageProject}});
 function paint(){ui.render({active,projects,status,message,conflict:conflict||externalPending,working:working||saving});}
 function preserveDraft(){try{const previous=JSON.parse(sessionStorage.getItem('framevolve-session-draft')||'{}');sessionStorage.setItem('framevolve-session-draft',JSON.stringify({...previous,version:1,projectId:active?.id,projectSnapshotHash:active?.snapshotHash,snapshot:getSnapshot(),savedAt:new Date().toISOString()}));}catch{}}
 function fail(error){retryAt=Date.now()+5000;status='error';message=error.message;conflict=conflict||error.status===409;preserveDraft();paint();}
 async function request(route='',body,{binary=false,download=false,keepalive=false}={}){
  const response=await fetch('/__framevolve_projects'+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':binary?'application/octet-stream':'application/json','X-Framevolve-Project':token},body:binary?body:JSON.stringify(body),keepalive});
  if(download&&response.ok)return response.blob();
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Project storage is unavailable.'),{status:response.status});return data;
 }
 function installRecord(record,{restore=false}={}){active=record;base=signature(record.snapshot);if(restore)setSnapshot(record.snapshot);observed=signature(getSnapshot());projects=[record,...projects.filter(p=>p.id!==record.id)];status='saved';message='';conflict=false;externalPending=false;paint();}
 async function refresh({initial=false}={}){
  const requestGeneration=generation,obsolete=()=>!initial&&(requestGeneration!==generation||working||saving||stopped);let data;
  try{data=await request();}catch(error){if(obsolete())return;throw error;}
  if(obsolete())return;token=data.token;projects=data.projects;
  if(initial){
   if(data.active){
    installRecord(data.active,{restore:!liveRecovery});
    try{const draft=JSON.parse(sessionStorage.getItem('framevolve-session-draft'));if(!liveRecovery&&draft?.projectId===active.id&&draft.savedAt>active.updatedAt&&draft.projectSnapshotHash===active.snapshotHash&&draft.snapshot){setSnapshot(draft.snapshot);observed=signature(getSnapshot());status='unsaved';}}catch{}
   }else{observed=signature(getSnapshot());base=observed;await save(true);}
  }else if(data.active?.id!==active?.id){throw Object.assign(Error('Another window opened a different project. Save a copy to keep working with your edits.'),{status:409});}
  else if(data.active&&data.active.revision>active.revision){
   if(signature(data.active.snapshot)===base){active=data.active;}
   else if(signature(getSnapshot())===signature(data.active.snapshot)){installRecord(data.active);}
   else if(signature(getSnapshot())===base&&canApplyExternal()){installRecord(data.active,{restore:true});}
   else externalPending=true;
  }
  if(data.error){status='error';message=data.error;}
  else if(externalPending){status='unsaved';message='New changes available. Save a copy to keep your edits, or apply the live update.';}
  else if(data.pending||data.working){status='saving';message='Saving agent changes…';}
  else if(!conflict){status=signature(getSnapshot())===base?'saved':'unsaved';message='';}
  paint();
 }
 async function save(force=false){
  if(saving)return; if(conflict||externalPending)throw Object.assign(Error(message||'Save a copy to keep your edits without replacing newer changes.'),{status:409});
  const snapshot=getSnapshot(),captured=signature(snapshot);
  if(!force&&active&&captured===base)return;
  saving=true;status='saving';message='';paint();
  try{if(!token){const data=await request();token=data.token;}
   const {record}=await request('/save',{activeId:active?.id??null,revision:active?.revision,baseSnapshotHash:active?.snapshotHash,name:active?.name||'My first project',snapshot});
   active=record;base=captured;projects=[record,...projects.filter(p=>p.id!==record.id)];status=signature(getSnapshot())===base?'saved':'unsaved';conflict=false;
   if(reloadPending&&signature(getSnapshot())===base)reloadProject(record);
  }catch(error){fail(error);throw error;}finally{saving=false;paint();}
 }
 async function operation(fn){if(working||saving||isBusy())throw Error('Wait for the current render or project operation to finish.');working=true;paint();try{return await fn();}catch(error){fail(error);throw error;}finally{working=false;paint();}}
 function reloadProject(record){
  sessionStorage.removeItem('framevolve-session-draft');sessionStorage.removeItem('framevolve-live-reload');sessionStorage.removeItem('framevolve-before-live-update');
  stopped=true;switching=true;clearTimeout(timer);clearTimeout(pollTimer);
  const url=new URL(location.href);url.searchParams.set('scene',record.snapshot.parameters.scene);url.searchParams.delete('welcome');url.searchParams.delete('onboarding');location.replace(url.href);
 }
 async function saveCopy(name){return operation(async()=>{
  if(!active)throw Error('Open a saved project before making a recovery copy.');
  const body={sourceId:active.id,name,snapshot:getSnapshot()},key=signature(body);
  // A lost response must not create another copy when the same request is retried.
  if(copyAttempt?.key!==key)copyAttempt={key,body:{...body,copyId:crypto.randomUUID()}};
  generation++;preserveDraft();status='saving';message='Saving your copy…';paint();
  const result=await request('/save-copy',copyAttempt.body);
  generation++;reloadPending=reloadPending||result.reloadRequired;
  installRecord(result.record);copyAttempt=null;onProjectCopied(result.record.snapshot);
  // Keep Undo, playhead and edits made while saving when the source is unchanged.
  // If source files changed, persist any later edits before reloading this tab.
  if(reloadPending){if(signature(getSnapshot())!==base)await save(true);else reloadProject(result.record);}
  else {preserveDraft();status=signature(getSnapshot())===base?'saved':'unsaved';message='Copy saved · continue editing';paint();}
  return result.record;
 });}
 async function newProject(name){return operation(async()=>{
  await save(true);const snapshot=newSnapshot();const {record}=await request('/new',{activeId:active.id,name,snapshot});installRecord(record,{restore:true});onProjectCreated(record.snapshot);sessionStorage.removeItem('framevolve-session-draft');return record;
 });}
 async function openProject(id,{trusted=false}={}){return operation(async()=>{
  await save(true);
  const result=await request('/open',{activeId:active.id,id,snapshot:getSnapshot(),trusted});
  // Server has verified and applied the saved source. Reload only this tab with
  // its saved recipe; draft/live-reload state must never leak between projects.
  installRecord(result.record);
  reloadProject(result.record);return result.record;
 });}
 async function importProject(file){return operation(async()=>{
  if(file.size>100*1024*1024)throw Error('Project packages can be up to 100 MB.');
  const {record}=await request('/import',file,{binary:true});projects=[record,...projects.filter(p=>p.id!==record.id)];paint();return record;
 });}
 async function manageProject(action,id,name){return operation(async()=>{
  await save(true);const target=id===active.id?active:projects.find(project=>project.id===id);
  if(!target)throw Error('This project is no longer in the collection. Refresh and try again.');
  const {record}=await request('/manage',{activeId:active.id,id,revision:target.revision,action,name});
  if(record.id===active.id)installRecord(record);else projects=[record,...projects.filter(project=>project.id!==record.id)];
  paint();return record;
 });}
 // makeSnapshot is pure: nothing is applied to the editor until the server has
 // saved the new project or preserved a visible checkpoint for replacement.
 async function chooseScene(sceneId,label,makeSnapshot){
  if(working||saving||isBusy())throw Error('Wait for the current render or project operation to finish.');
  const choice=await ui.chooseScene({sceneId,label,active});if(!choice)return false;
  return operation(async()=>{
   await save(true);const next=makeSnapshot(sceneId);
   const {record,checkpoint}=await request('/scene',{activeId:active.id,revision:active.revision,mode:choice.mode,name:choice.name,sceneId,label,snapshot:next});
   if(checkpoint)projects=[checkpoint,...projects.filter(project=>project.id!==checkpoint.id)];
   installRecord(record,{restore:true});onProjectCreated(record.snapshot);sessionStorage.removeItem('framevolve-session-draft');
   return true;
  });
 }
 async function exportProject(){return operation(async()=>{
  await save(true);const preflight=await request('/preflight',{activeId:active.id});
  if(!await ui.confirmExport(preflight))return null;
  // Bind the download to the reviewed revision. Source autosave in another
  // window may have changed it while the review dialog was open.
  const blob=await request('/export',{id:active.id,revision:preflight.revision},{download:true});const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=active.name.replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,80)+'.framevolve';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  return active;
 });}
 function tick(){if(stopped)return;
  if(ready&&!working&&!saving&&!conflict&&!externalPending){const current=signature(getSnapshot());if(current!==observed){observed=current;changedAt=Date.now();status='unsaved';message='';paint();}
   if(current!==base&&Date.now()>=retryAt&&Date.now()-changedAt>=400)save().catch(()=>{});
  }timer=setTimeout(tick,400);
 }
 async function poll(){if(stopped)return;if(ready&&!working&&!saving&&!conflict)try{await refresh();}catch(error){fail(error);}pollTimer=setTimeout(poll,1800);}
 const flushOnHide=()=>{
  if(!ready||stopped||conflict||externalPending||working||saving||!active)return;
  const snapshot=getSnapshot();if(signature(snapshot)===base)return;
  const body={activeId:active.id,revision:active.revision,baseSnapshotHash:active.snapshotHash,name:active.name,snapshot};
  // Keepalive has a browser payload limit; the ordinary disk autosave and
  // tab-local recovery draft remain responsible for larger edits.
  if(new TextEncoder().encode(JSON.stringify(body)).length<60000)request('/save',body,{keepalive:true}).catch(()=>{});
 };
 window.addEventListener('pagehide',flushOnHide);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushOnHide();});
 try{await refresh({initial:true});ready=true;paint();}catch(error){fail(error);ready=true;}
 tick();pollTimer=setTimeout(poll,1800);
 return {getActiveId:()=>active?.id,save,chooseScene,getSnapshotHash:()=>active?.snapshotHash,isSwitching:()=>working||switching||reloadPending,dispose(){stopped=true;clearTimeout(timer);clearTimeout(pollTimer);window.removeEventListener('pagehide',flushOnHide);ui.dispose();}};
}
