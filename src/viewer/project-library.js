import {mountProjectLibraryUI} from './project-library-ui.js';
const signature=value=>JSON.stringify(value);
export async function mountProjectLibrary({container,getSnapshot,setSnapshot,newSnapshot,isBusy}){
 let active=null,projects=[],token=null,base='',working=false,saving=false,stopped=false,conflict=false,timer,pollTimer,observed='',changedAt=0,ready=false,switching=false,retryAt=0;
 let status='loading',message='';
 const ui=mountProjectLibraryUI({container,isBusy,actions:{save:()=>save(true),newProject,openProject,importProject,exportProject}});
 function paint(){ui.render({active,projects,status,message,working:working||saving});}
 function fail(error){retryAt=Date.now()+5000;status='error';message=error.message;conflict=error.status===409;paint();}
 async function request(route='',body,{binary=false,download=false,keepalive=false}={}){
  const response=await fetch('/__framevolve_projects'+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':binary?'application/octet-stream':'application/json','X-Framevolve-Project':token},body:binary?body:JSON.stringify(body),keepalive});
  if(download&&response.ok)return response.blob();
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Project storage is unavailable.'),{status:response.status});return data;
 }
 function installRecord(record,{restore=false}={}){active=record;base=signature(record.snapshot);if(restore)setSnapshot(record.snapshot);observed=signature(getSnapshot());projects=[record,...projects.filter(p=>p.id!==record.id)];status='saved';message='';conflict=false;paint();}
 async function refresh({initial=false}={}){
  const data=await request();if(!initial&&(working||saving||stopped))return;token=data.token;projects=data.projects;
  if(initial){
   if(data.active){
    installRecord(data.active,{restore:true});
    try{const draft=JSON.parse(sessionStorage.getItem('framevolve-session-draft'));if(draft?.projectId===active.id&&draft.savedAt>active.updatedAt&&draft.projectSnapshotHash===active.snapshotHash&&draft.snapshot){setSnapshot(draft.snapshot);observed=signature(getSnapshot());status='unsaved';}}catch{}
   }else{observed=signature(getSnapshot());base=observed;await save(true);}
  }else if(data.active?.id!==active?.id){throw Object.assign(Error('A different project is open in another window. Reload to continue; your draft is preserved.'),{status:409});}
  else if(data.active&&data.active.revision>active.revision){
   if(signature(data.active.snapshot)===base){active=data.active;}
   else if(signature(getSnapshot())===base){installRecord(data.active,{restore:true});}
   else throw Object.assign(Error('New agent or window changes are available. Your local draft is preserved; reload before saving over them.'),{status:409});
  }
  if(data.error){status='error';message=data.error;}
  else if(data.pending||data.working){status='saving';message='Saving agent changes…';}
  else if(!conflict){status=signature(getSnapshot())===base?'saved':'unsaved';message='';}
  paint();
 }
 async function save(force=false){
  if(saving)return; if(conflict)throw Error(message||'Reload before saving over newer changes.');
  const snapshot=getSnapshot(),captured=signature(snapshot);
  if(!force&&active&&captured===base)return;
  saving=true;status='saving';message='';paint();
  try{if(!token){const data=await request();token=data.token;}
   const {record}=await request('/save',{activeId:active?.id??null,revision:active?.revision,baseSnapshotHash:active?.snapshotHash,name:active?.name||'My first project',snapshot});
   active=record;base=captured;projects=[record,...projects.filter(p=>p.id!==record.id)];status=signature(getSnapshot())===base?'saved':'unsaved';conflict=false;
  }catch(error){fail(error);throw error;}finally{saving=false;paint();}
 }
 async function operation(fn){if(working||isBusy())throw Error('Wait for the current render or project operation to finish.');working=true;paint();try{return await fn();}catch(error){fail(error);throw error;}finally{working=false;paint();}}
 async function newProject(name){return operation(async()=>{
  await save(true);const before=getSnapshot();
  try{const snapshot=newSnapshot();const {record}=await request('/new',{activeId:active.id,name,snapshot});installRecord(record);sessionStorage.removeItem('framevolve-session-draft');return record;}
  catch(error){setSnapshot(before);throw error;}
 });}
 async function openProject(id,{trusted=false}={}){return operation(async()=>{
  await save(true);
  const result=await request('/open',{activeId:active.id,id,snapshot:getSnapshot(),trusted});
  // Server has verified and applied the saved source. Reload only this tab with
  // its saved recipe; draft/live-reload state must never leak between projects.
  installRecord(result.record);
  sessionStorage.removeItem('framevolve-session-draft');sessionStorage.removeItem('framevolve-live-reload');sessionStorage.removeItem('framevolve-before-live-update');
  stopped=true;switching=true;clearTimeout(timer);clearTimeout(pollTimer);
  const url=new URL(location.href);url.searchParams.set('scene',result.record.snapshot.parameters.scene);url.searchParams.delete('welcome');url.searchParams.delete('onboarding');
  location.replace(url.href);return result.record;
 });}
 async function importProject(file){return operation(async()=>{
  if(file.size>100*1024*1024)throw Error('Project packages can be up to 100 MB.');
  const {record}=await request('/import',file,{binary:true});projects=[record,...projects.filter(p=>p.id!==record.id)];paint();return record;
 });}
 async function exportProject(){return operation(async()=>{
  await save(true);const blob=await request('/export',{id:active.id},{download:true});const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=active.name.replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,80)+'.framevolve';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  return active;
 });}
 function tick(){if(stopped)return;
  if(ready&&!working&&!saving&&!conflict){const current=signature(getSnapshot());if(current!==observed){observed=current;changedAt=Date.now();status='unsaved';message='';paint();}
   if(current!==base&&Date.now()>=retryAt&&Date.now()-changedAt>=400)save().catch(()=>{});
  }timer=setTimeout(tick,400);
 }
 async function poll(){if(stopped)return;if(ready&&!working&&!saving&&!conflict)try{await refresh();}catch(error){fail(error);}pollTimer=setTimeout(poll,1800);}
 const flushOnHide=()=>{
  if(!ready||stopped||conflict||working||saving||!active)return;
  const snapshot=getSnapshot();if(signature(snapshot)===base)return;
  const body={activeId:active.id,revision:active.revision,baseSnapshotHash:active.snapshotHash,name:active.name,snapshot};
  // Keepalive has a browser payload limit; the ordinary disk autosave and
  // tab-local recovery draft remain responsible for larger edits.
  if(new TextEncoder().encode(JSON.stringify(body)).length<60000)request('/save',body,{keepalive:true}).catch(()=>{});
 };
 window.addEventListener('pagehide',flushOnHide);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushOnHide();});
 try{await refresh({initial:true});ready=true;paint();}catch(error){fail(error);ready=true;}
 tick();pollTimer=setTimeout(poll,1800);
 return {getActiveId:()=>active?.id,save,getSnapshotHash:()=>active?.snapshotHash,isSwitching:()=>working||switching,dispose(){stopped=true;clearTimeout(timer);clearTimeout(pollTimer);window.removeEventListener('pagehide',flushOnHide);ui.dispose();}};
}
