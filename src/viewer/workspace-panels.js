import './workspace-panels.css';

/** Export history is a destination, not a second timeline beneath the editor. */
export function mountWorkspacePanels(){
 mountPreviewToolbar();
 const dock=document.getElementById('export-dock'),delivery=document.querySelector('.delivery-actions');
 if(!dock||!delivery)return;
 const trigger=document.createElement('button');trigger.id='exports-open';trigger.type='button';trigger.textContent='Exports';trigger.title='Export history and progress';trigger.setAttribute('aria-haspopup','dialog');
 delivery.prepend(trigger);
 const dialog=document.createElement('dialog');dialog.id='exports-dialog';dialog.setAttribute('aria-labelledby','exports-title');
 dialog.innerHTML='<header><div><span class="eyebrow">YOUR FILES</span><h2 id="exports-title">Exports</h2><p>Find your finished files or follow an export in progress.</p></div><button type="button" data-close aria-label="Close exports">×</button></header><nav class="exports-filters" aria-label="Filter exports"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="completed" aria-pressed="false">Ready</button><button type="button" data-filter="active" aria-pressed="false">In progress</button><button type="button" data-filter="issues" aria-pressed="false">Unfinished</button></nav><p class="exports-no-match" hidden>No exports in this view.</p>';
 document.body.append(dialog);dialog.append(dock);
 const summary=dock.querySelector('summary');summary.hidden=true;
 const list=document.getElementById('export-list'),progress=document.getElementById('render-progress');let filter='all';
 function applyFilter(){let visible=0;for(const row of list.querySelectorAll('.export-row')){const status=row.dataset.status;row.hidden=!(filter==='all'||filter===status||filter==='active'&&['running','queued','cancelling'].includes(status)||filter==='issues'&&['failed','cancelled'].includes(status));if(!row.hidden)visible++;}dialog.querySelector('.exports-no-match').hidden=visible>0||!list.querySelector('.export-row');}
 function open(){dock.open=true;if(!dialog.open)dialog.showModal();applyFilter();}
 trigger.onclick=open;
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{dock.open=false;trigger.focus({preventScroll:true});});
 for(const button of dialog.querySelectorAll('[data-filter]'))button.onclick=()=>{filter=button.dataset.filter;for(const other of dialog.querySelectorAll('[data-filter]'))other.setAttribute('aria-pressed',String(other===button));applyFilter();};
 // Existing render code opens the dock: preserve that contract and all cancel/file actions.
 dock.addEventListener('toggle',()=>{if(dock.open&&!dialog.open)open();});
 new MutationObserver(applyFilter).observe(list,{childList:true});
 function syncProgress(){const active=!progress.hidden;trigger.dataset.active=String(active);trigger.textContent=active?`Exporting ${Math.round(Number(progress.value)||0)}%`:'Exports';trigger.setAttribute('aria-label',active?trigger.textContent+' · Open export progress':'Open exports');}
 new MutationObserver(syncProgress).observe(progress,{attributes:true,attributeFilter:['hidden','value']});syncProgress();
 // Keep pause/recovery controls available on demand, without a permanent status bar.
 const review=document.getElementById('live-review'),more=document.querySelector('.studio-more-panel');
 if(review&&more&&!review.hidden){const updates=document.createElement('details');updates.className='workspace-updates';const label=document.createElement('summary');label.textContent='Assistant updates';updates.append(label,review);more.append(updates);}
}

/** Keep the primary view choice visible; inspection tools are opt-in. */
function mountPreviewToolbar(){
 const heading=document.querySelector('.stage-heading'),row=document.querySelector('.stage-view-switch'),strip=document.querySelector('.preview-strip');
 if(!heading||!row||!strip)return;
 heading.classList.add('compact-preview-heading');
 heading.firstElementChild.hidden=true;
 const modes=row.querySelector('.story-mode-switch');
 for(const [id,label] of [['story-mode','Storyboard'],['video-mode','Video']]){
  const button=modes.querySelector('#'+id);button.textContent=label;button.classList.remove('studio-icon-only','studio-has-icon');
 }
 heading.prepend(modes);row.remove();
 const options=document.createElement('details');options.className='preview-options';
 options.innerHTML='<summary aria-label="Preview options">Preview <span aria-hidden="true">⌄</span></summary><div class="preview-options-panel"><p>Preview settings</p></div>';
 const panel=options.querySelector('.preview-options-panel');panel.append(strip);
 const comparison=heading.querySelector('.comparison-tools');if(comparison)panel.append(comparison);
 heading.append(options);
 options.addEventListener('keydown',event=>{if(event.key==='Escape'){options.open=false;options.querySelector('summary').focus();event.stopPropagation();}});
 document.addEventListener('pointerdown',event=>{if(!options.contains(event.target))options.open=false;});
 modes.addEventListener('click',()=>{options.open=false;});
}
