import { createFeedbackReport, feedbackMailto } from './feedback-report.js';
export function mountFeedbackMemory(container){
  const open=document.createElement('button');open.id='feedback-memory-open';open.type='button';open.textContent='Feedback memory';container.append(open);
  const dialog=document.createElement('dialog');dialog.className='feedback-memory-dialog';dialog.setAttribute('aria-labelledby','memory-title');
  dialog.innerHTML=`<header><h2 id="memory-title">Feedback memory</h2><button type="button" data-close aria-label="Close feedback memory">Close</button></header>
    <p>A local history of feedback, the agent’s interpretation, changes, before/after notes and your response. It helps preserve approved choices. If you share examples with Andrea, they can help improve Framevolve’s workflows.</p>
    <p>No automatic uploads. No video, images, full chats or credentials are attached. Text can still contain client information: review it before sharing. Your AI agent’s own data handling is separate.</p>
    <label class="memory-consent"><input id="memory-enabled" type="checkbox"> Save revision memory in this project</label>
    <p class="memory-hint">Off stops new entries; existing entries remain until deleted. This optional history is separate from project files and the live checklist.</p>
    <div class="memory-actions"><button id="memory-refresh" type="button">Refresh entries</button><button id="memory-erase" type="button">Delete all memory…</button></div>
    <div id="memory-delete-confirm" hidden><p>Delete all feedback entries and turn memory off? This cannot be undone. Project files and already shared reports stay unchanged.</p><button id="memory-delete-yes" type="button">Delete memory &amp; turn off</button><button id="memory-delete-no" type="button">Cancel</button></div>
    <p id="memory-status" role="status"></p><div id="memory-entries"></div>
    <section class="memory-share"><h3>Share only what you choose</h3><p>Select examples above, then review and edit the report. Remove names, confidential details and anything you do not want to share. Basic email, link and path filtering is not guaranteed anonymization.</p>
    <button id="memory-prepare" type="button">Prepare selected examples</button>
    <div id="memory-report-area" hidden><label for="memory-report">Exact report to download</label><textarea id="memory-report" spellcheck="false" rows="12"></textarea>
    <label class="memory-consent"><input id="memory-reviewed" type="checkbox"> I reviewed this report and want to share its contents.</label>
    <p>Recipient: <strong>framevolve.app@gmail.com</strong>. Download the report, open a draft, then attach the downloaded file yourself. Nothing is sent until you press Send in your email app.</p>
    <div class="memory-actions"><button id="memory-download" type="button" disabled>Download reviewed report</button><button id="memory-email" type="button" disabled>Open email draft</button><button id="memory-copy" type="button" disabled>Copy report</button></div>
    <p class="memory-hint">No email app? Download or copy the report and use your webmail. The file is not automatically attached. Deleting local memory does not recall emails or remove downloaded copies.</p></div></section>`;
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#'+id);let data=null,busy=false;
  async function api(route='',body){
    const response=await fetch('/__framevolve_memory/'+route,{cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Framevolve-Memory':data?.token??''},body:JSON.stringify(body)})});
    const value=await response.json();if(!response.ok)throw Error(value.error||'Feedback memory is unavailable.');return value;
  }
  function invalidateReport(){ $('memory-report-area').hidden=true;$('memory-report').value='';$('memory-reviewed').checked=false;syncShare(); }
  function syncShare(){const reviewed=$('memory-reviewed').checked&&!!$('memory-report').value.trim();for(const id of ['memory-download','memory-email','memory-copy'])$(id).disabled=!reviewed||busy;}
  function render(){
    $('memory-enabled').checked=!!data?.consent.enabled;
    $('memory-entries').replaceChildren();
    $('memory-status').textContent=`${data?.records.length??0} saved examples · ${data?.consent.enabled?'Memory on':'Memory off'}`;
    for(const record of [...data.records].reverse()){
      const article=document.createElement('article');article.className='memory-entry';
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.recordId=record.id;check.onchange=invalidateReport;
      label.append(check,document.createTextNode(' '+record.feedback));article.append(label);
      const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Interpretation and change';details.append(summary);
      for(const key of ['context','intent','diagnosis','change','preserve','before','after','verification','visualStatus','lesson']){if(!record[key])continue;const line=document.createElement('p'),title=document.createElement('b');title.textContent=key+': ';line.append(title,document.createTextNode(record[key]));details.append(line);}
      article.append(details);
      const outcomeLabel=document.createElement('label');outcomeLabel.textContent='Client response ';const select=document.createElement('select');select.setAttribute('aria-label','Client response');
      for(const [value,text] of [['pending','Not reviewed by client'],['accepted','Better / accepted'],['mixed','Partly better'],['rejected','Worse / rejected']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=record.clientOutcome;outcomeLabel.append(select);
      const note=document.createElement('textarea');note.rows=2;note.maxLength=4000;note.setAttribute('aria-label','Client response note');note.placeholder='What worked or still needs changing?';note.value=record.clientResponse;
      const save=document.createElement('button');save.type='button';save.textContent='Save response';save.disabled=!data.consent.enabled;save.dataset.requiresConsent='true';save.onclick=()=>action(async()=>{data=await api('outcome',{id:record.id,outcome:select.value,response:note.value});invalidateReport();render();});
      const remove=document.createElement('button');remove.type='button';remove.textContent='Delete entry…';remove.onclick=()=>{remove.textContent='Confirm delete entry';remove.onclick=()=>action(async()=>{data=await api('delete',{id:record.id});invalidateReport();render();});};
      article.append(outcomeLabel,note,save,remove);$('memory-entries').append(article);
    }
    $('memory-prepare').disabled=!data?.records.length;
  }
  async function action(fn){
    if(busy)return;busy=true;dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
    try{await fn();}catch(error){$('memory-status').textContent=error.message;}
    finally{busy=false;dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);dialog.querySelectorAll('[data-requires-consent]').forEach(el=>el.disabled=!data?.consent.enabled);$('memory-prepare').disabled=!data?.records.length;syncShare();}
  }
  const refresh=()=>action(async()=>{data=await api();invalidateReport();render();});
  open.onclick=()=>{dialog.showModal();refresh();};
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{invalidateReport();$('memory-entries').replaceChildren();data=null;});
  $('memory-refresh').onclick=refresh;
  $('memory-enabled').onchange=()=>action(async()=>{try{data=await api('consent',{enabled:$('memory-enabled').checked});invalidateReport();render();}catch(error){$('memory-enabled').checked=!!data?.consent.enabled;throw error;}});
  $('memory-erase').onclick=()=>{$('memory-delete-confirm').hidden=false;};
  $('memory-delete-no').onclick=()=>{$('memory-delete-confirm').hidden=true;};
  $('memory-delete-yes').onclick=()=>action(async()=>{data=await api('erase',{});$('memory-delete-confirm').hidden=true;invalidateReport();render();});
  $('memory-prepare').onclick=()=>{
    const ids=new Set([...dialog.querySelectorAll('[data-record-id]:checked')].map(el=>el.dataset.recordId));
    if(!ids.size){$('memory-status').textContent='Select at least one example to share.';return;}
    $('memory-report').value=createFeedbackReport(data.records.filter(r=>ids.has(r.id)));$('memory-report-area').hidden=false;$('memory-reviewed').checked=false;syncShare();$('memory-report').focus();
  };
  $('memory-report').oninput=()=>{$('memory-reviewed').checked=false;syncShare();};$('memory-reviewed').onchange=syncShare;
  $('memory-download').onclick=()=>{
    const url=URL.createObjectURL(new Blob([$('memory-report').value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='framevolve-feedback-report.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('memory-status').textContent='Report downloaded. Attach it yourself if you choose to send an email.';
  };
  $('memory-email').onclick=()=>{location.href=feedbackMailto('framevolve.app@gmail.com');$('memory-status').textContent='Email draft requested. Attach your reviewed report before sending. If no app opens, use your webmail.';};
  $('memory-copy').onclick=()=>action(async()=>{await navigator.clipboard.writeText($('memory-report').value);$('memory-status').textContent='Reviewed report copied.';});
  return {open:()=>open.click()};
}
