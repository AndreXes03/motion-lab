const RECOVERY='framevolve-live-reload', BACKUP='framevolve-before-live-update';
export function readLiveRecovery(){try{return JSON.parse(sessionStorage.getItem(RECOVERY)||'null');}catch{return null;}}
const signature=snapshot=>JSON.stringify(snapshot.parameters);
/** Keep saved changes while fields unchanged from the previous source follow new authored defaults. */
export function rebaseLiveRecipe(previousAuthored,saved,nextAuthored){
  if(JSON.stringify(saved)===JSON.stringify(previousAuthored))return structuredClone(nextAuthored);
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  if(!record(previousAuthored)||!record(saved)||!record(nextAuthored))return structuredClone(saved);
  const result={};for(const key of new Set([...Object.keys(saved),...Object.keys(nextAuthored)])){
    const value=rebaseLiveRecipe(previousAuthored[key],saved[key],nextAuthored[key]);
    if(value!==undefined)Object.defineProperty(result,key,{value,enumerable:true,configurable:true,writable:true});
  }return result;
}

export function shouldApplyLive({paused,dirty,busy,error,phase}){return !paused&&!dirty&&!busy&&!error&&!['editing','blocked'].includes(phase);}
export function mountLiveReview({container,enabled,baseline,getSnapshot,setSnapshot,getView,setView,isBusy,recovery,getProjectId,authoredBaseline=baseline}){
  if(!enabled)return null;
  container.hidden=false;
  const status=document.createElement('span');status.id='live-review-status';status.setAttribute('role','status');
  const toggle=document.createElement('button');toggle.id='live-review-toggle';toggle.type='button';
  const apply=document.createElement('button');apply.id='live-review-apply';apply.type='button';apply.textContent='Apply latest';apply.hidden=true;
  const undo=document.createElement('button');undo.id='live-review-restore';undo.type='button';undo.textContent='Restore local edits';undo.hidden=true;
  const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ol');
  summary.textContent='Agent feedback';details.append(summary,list);container.append(status,toggle,apply,undo,details);
  let paused=sessionStorage.getItem('framevolve-live-paused')==='true',base=signature(baseline),seen=null,current=null,pending=null,stopped=false,reloading=false,localError='',taskSignature='',projectGeneration=0;
  let authored=structuredClone(authoredBaseline);
  const dirty=()=>signature(getSnapshot())!==base;
  const matchesProject=next=>!getProjectId||(next?.projectId??null)===(getProjectId()??null);
  function render(){
    toggle.textContent=paused?'Resume live updates':'Pause live updates';toggle.setAttribute('aria-pressed',String(!paused));
    toggle.disabled=reloading;
    const jobs=isBusy();
    container.dataset.attention=String(!!pending||!!localError||!!current?.error||current?.phase==='blocked');
    status.textContent=localError||current?.error||(jobs?'Live updates waiting for render':paused?'Live updates paused':pending&&dirty()?'Update ready · your local edits are kept':current?.phase==='editing'?'Agent editing · '+(current.label||'Next change'):current?.phase==='blocked'?'Agent blocked · '+(current.label||'Waiting'):pending?'Applying update…':current?.label||'Live updates ready');
    apply.hidden=!pending||reloading||!!current?.error||['editing','blocked'].includes(current?.phase);apply.disabled=jobs;
    undo.hidden=!sessionStorage.getItem(BACKUP);undo.disabled=jobs||reloading;
    details.hidden=!current?.tasks?.length;
    const next=JSON.stringify(current?.tasks??[]);
    if(next!==taskSignature){taskSignature=next;list.replaceChildren();for(const task of current?.tasks??[]){const item=document.createElement('li');item.dataset.status=task.status;item.textContent=({todo:'To do',doing:'In progress',done:'Done',blocked:'Blocked'})[task.status]+' · '+task.title;list.append(item);}summary.textContent=`Agent feedback · ${(current?.tasks??[]).filter(t=>t.status==='done').length}/${current?.tasks?.length??0}`;}
  }
  function install(next,explicit=false){
    if(reloading||isBusy()||!matchesProject(next))return;
    const before=getSnapshot(),view=getView(),sourceOnly=!next.snapshot||!!getProjectId&&next.snapshotChanged===false,recipe=sourceOnly?before:next.snapshot;
    if(explicit&&dirty())sessionStorage.setItem(BACKUP,JSON.stringify({snapshot:before,view}));
    if(seen&&next.sourceRevision!==seen.sourceRevision){
      sessionStorage.setItem(RECOVERY,JSON.stringify({...view,projectId:getProjectId?.()??null,snapshot:recipe,sourceOnly,...(sourceOnly?{authoredBaseline:authored}:{}),scene:recipe.parameters.scene}));
      reloading=true;render();const url=new URL(location.href);url.searchParams.set('scene',recipe.parameters.scene);location.replace(url.href);return;
    }
    try{
      if(recipe!==before)setSnapshot(recipe);
      setView(view);base=signature(getSnapshot());seen=next;pending=null;localError='';
    }catch(error){try{setSnapshot(before);setView(view);}catch{}localError='Update could not be applied: '+error.message;}
    render();
  }
  toggle.onclick=()=>{paused=!paused;sessionStorage.setItem('framevolve-live-paused',String(paused));render();};
  apply.onclick=()=>{if(pending)install(pending,true);};
  undo.onclick=()=>{try{const backup=JSON.parse(sessionStorage.getItem(BACKUP));setSnapshot(backup.snapshot);setView(backup.view);sessionStorage.removeItem(BACKUP);paused=true;sessionStorage.setItem('framevolve-live-paused','true');localError='Local edits restored · live updates paused';}catch(error){localError=error.message;}render();};
  async function poll(){
    if(stopped||reloading)return;const requestGeneration=projectGeneration;
    try{
      const response=await fetch('/__framevolve_live',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Connection unavailable');
      const next=await response.json();
      if(requestGeneration===projectGeneration&&matchesProject(next)){
      current=next;
      if(!seen){
        seen=current;
        if(recovery){const captured=(!getProjectId||(recovery.projectId??null)===(getProjectId()??null))?(recovery.snapshot??(!getProjectId?current.snapshot:null)):null;if(captured)setSnapshot(recovery.sourceOnly?rebaseLiveRecipe(recovery.authoredBaseline??captured,captured,authored):captured);setView(recovery);base=signature(getSnapshot());sessionStorage.removeItem(RECOVERY);recovery=null;}
        else if(!getProjectId&&current.snapshot&&current.snapshot.parameters.scene===getSnapshot().parameters.scene&&signature(current.snapshot)!==base){pending=current;}
      }else if(current.epoch!==seen.epoch){pending={...current,sourceRevision:seen.sourceRevision+1};}
      else if(current.revision!==seen.revision)pending=current;
      if(pending&&shouldApplyLive({paused,dirty:dirty(),busy:isBusy(),error:current.error,phase:current.phase}))install(pending);
      render();
      }else{if(pending&&!matchesProject(pending))pending=null;render();}
    }catch(error){status.textContent='Live connection unavailable · retrying';}
    if(!stopped&&!reloading)setTimeout(poll,700);
  }
  function resetProject(snapshot){
    // Use the exact activation snapshot now; a later poll must never redefine a user's edits.
    base=signature(snapshot);authored=structuredClone(snapshot);projectGeneration++;seen=null;current=null;pending=null;recovery=null;reloading=false;localError='';taskSignature='';
    sessionStorage.removeItem(RECOVERY);sessionStorage.removeItem(BACKUP);render();
  }
  render();poll();
  const stop=()=>{stopped=true;};window.addEventListener('pagehide',stop,{once:true});
  return {resetProject,getState:()=>({paused,dirty:dirty(),revision:seen?.revision,pending:!!pending,tasks:current?.tasks??[]}),stop};
}
