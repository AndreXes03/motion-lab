const RECOVERY='framevolve-live-reload', BACKUP='framevolve-before-live-update';
export function readLiveRecovery(){try{return JSON.parse(sessionStorage.getItem(RECOVERY)||'null');}catch{return null;}}
const signature=snapshot=>JSON.stringify(snapshot.parameters);
export function shouldApplyLive({paused,dirty,busy,error,phase}){return !paused&&!dirty&&!busy&&!error&&!['editing','blocked'].includes(phase);}
export function mountLiveReview({container,enabled,baseline,getSnapshot,setSnapshot,getView,setView,isBusy,recovery}){
  if(!enabled)return null;
  container.hidden=false;
  const status=document.createElement('span');status.id='live-review-status';status.setAttribute('role','status');
  const toggle=document.createElement('button');toggle.id='live-review-toggle';toggle.type='button';
  const apply=document.createElement('button');apply.id='live-review-apply';apply.type='button';apply.textContent='Apply latest';apply.hidden=true;
  const undo=document.createElement('button');undo.id='live-review-restore';undo.type='button';undo.textContent='Restore local edits';undo.hidden=true;
  const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ol');
  summary.textContent='Agent feedback';details.append(summary,list);container.append(status,toggle,apply,undo,details);
  let paused=sessionStorage.getItem('framevolve-live-paused')==='true',base=signature(baseline),seen=null,current=null,pending=null,stopped=false,reloading=false,localError='',taskSignature='';
  const dirty=()=>signature(getSnapshot())!==base;
  function render(){
    toggle.textContent=paused?'Resume live updates':'Pause live updates';toggle.setAttribute('aria-pressed',String(!paused));
    toggle.disabled=reloading;
    const jobs=isBusy();
    status.textContent=localError||current?.error||(jobs?'Live updates waiting for render':paused?'Live updates paused':pending&&dirty()?'Update ready · your local edits are kept':current?.phase==='editing'?'Agent editing · '+(current.label||'Next change'):current?.phase==='blocked'?'Agent blocked · '+(current.label||'Waiting'):pending?'Applying update…':current?.label||'Live updates ready');
    apply.hidden=!pending||reloading||!!current?.error||['editing','blocked'].includes(current?.phase);apply.disabled=jobs;
    undo.hidden=!sessionStorage.getItem(BACKUP);undo.disabled=jobs||reloading;
    details.hidden=!current?.tasks?.length;
    const next=JSON.stringify(current?.tasks??[]);
    if(next!==taskSignature){taskSignature=next;list.replaceChildren();for(const task of current?.tasks??[]){const item=document.createElement('li');item.dataset.status=task.status;item.textContent=({todo:'To do',doing:'In progress',done:'Done',blocked:'Blocked'})[task.status]+' · '+task.title;list.append(item);}summary.textContent=`Agent feedback · ${(current?.tasks??[]).filter(t=>t.status==='done').length}/${current?.tasks?.length??0}`;}
  }
  function install(next,explicit=false){
    if(reloading||isBusy())return;
    const before=getSnapshot(),view=getView();
    if(explicit&&dirty())sessionStorage.setItem(BACKUP,JSON.stringify({snapshot:before,view}));
    if(seen&&next.sourceRevision!==seen.sourceRevision){
      sessionStorage.setItem(RECOVERY,JSON.stringify({...view,scene:next.snapshot?.parameters?.scene??before.parameters.scene}));
      reloading=true;render();const url=new URL(location.href);url.searchParams.set('scene',next.snapshot?.parameters?.scene??before.parameters.scene);location.replace(url.href);return;
    }
    try{
      if(next.snapshot)setSnapshot(next.snapshot);
      setView(view);base=signature(getSnapshot());seen=next;pending=null;localError='';
    }catch(error){try{setSnapshot(before);setView(view);}catch{}localError='Update could not be applied: '+error.message;}
    render();
  }
  toggle.onclick=()=>{paused=!paused;sessionStorage.setItem('framevolve-live-paused',String(paused));render();};
  apply.onclick=()=>{if(pending)install(pending,true);};
  undo.onclick=()=>{try{const backup=JSON.parse(sessionStorage.getItem(BACKUP));setSnapshot(backup.snapshot);setView(backup.view);sessionStorage.removeItem(BACKUP);paused=true;sessionStorage.setItem('framevolve-live-paused','true');localError='Local edits restored · live updates paused';}catch(error){localError=error.message;}render();};
  async function poll(){
    if(stopped||reloading)return;
    try{
      const response=await fetch('/__framevolve_live',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Connection unavailable');
      current=await response.json();
      if(!seen){
        seen=current;
        if(recovery){if(current.snapshot)setSnapshot(current.snapshot);setView(recovery);base=signature(getSnapshot());sessionStorage.removeItem(RECOVERY);recovery=null;}
        else if(current.snapshot&&current.snapshot.parameters.scene===getSnapshot().parameters.scene){pending=current;}
      }else if(current.epoch!==seen.epoch){pending={...current,sourceRevision:seen.sourceRevision+1};}
      else if(current.revision!==seen.revision)pending=current;
      if(pending&&shouldApplyLive({paused,dirty:dirty(),busy:isBusy(),error:current.error,phase:current.phase}))install(pending);
      render();
    }catch(error){status.textContent='Live connection unavailable · retrying';}
    if(!stopped&&!reloading)setTimeout(poll,700);
  }
  render();poll();
  const stop=()=>{stopped=true;};window.addEventListener('pagehide',stop,{once:true});
  return {getState:()=>({paused,dirty:dirty(),revision:seen?.revision,pending:!!pending,tasks:current?.tasks??[]}),stop};
}
