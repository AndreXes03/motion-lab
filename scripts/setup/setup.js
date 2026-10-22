const $ = id => document.getElementById(id);
// Capability stays in this tab's memory, not in referrers or persistent storage.
const token = location.hash.slice(1);
history.replaceState(null, '', '/');
let state = {}, pending = false, disconnected = false, selectionChanged = false, memoryChanged = false, clientError = '';
let stage='welcome';
function showStage(next,{focus=false}={}){stage=next;$('welcome-stage').hidden=stage!=='welcome';$('setup-stage').hidden=stage!=='setup';$('setup-back').hidden=stage!=='setup';$('setup-step').textContent=stage==='welcome'?'WELCOME':'SETUP';if(focus){window.scrollTo({top:0,behavior:'instant'});const heading=$(stage==='welcome'?'welcome-stage':'setup-stage').querySelector('h1');heading.tabIndex=-1;heading.focus({preventScroll:true});}}
const docs = { codex: 'https://developers.openai.com/codex/cli/', claude: 'https://code.claude.com/docs/en/setup' };
const provider = () => document.querySelector('input[name="provider"]:checked').value;
async function api(route, body) {
  const response = await fetch('/api/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Framevolve-Setup': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json(); if (!response.ok) throw Error(data.error || 'Setup request failed.'); return data;
}
function render(data) {
  state = data;
  if (!memoryChanged) $('feedback-memory').checked = !!state.feedbackMemory;
  const busy = state.busy || pending, ready = state.ready && !selectionChanged;
  document.querySelectorAll('button,input,select').forEach(el => { el.disabled = busy || disconnected; });
  const cycles = state.cyclesComponent ?? {};
  if ((cycles.busy || cycles.pendingAuthorization || cycles.error) && !$('cycles-component').open) $('cycles-component').open = true;
  $('cycles-download').disabled = busy || disconnected || !cycles.canInstall;
  if (!cycles.canInstall) $('cycles-download').checked = false;
  $('cycles-status').textContent = cycles.busy ? `Rendering Cycles · ${cycles.phase}${cycles.phase === 'downloading' ? ` ${Math.round((cycles.progress || 0) * 100)}%` : ''}` : cycles.reason || (cycles.compatible ? `Rendering Cycles ${cycles.installed.version} · installed` : 'Rendering Cycles is unavailable.');
  $('cycles-progress').hidden = !cycles.busy; $('cycles-progress').value = cycles.progress || 0;
  for (const [id, allowed] of [['cycles-install',cycles.canInstall && !cycles.installed], ['cycles-update',cycles.canUpdate], ['cycles-authorize',cycles.canAuthorize], ['cycles-check',cycles.canCheck], ['cycles-remove',cycles.canRemove]]) { $(id).hidden = !allowed; $(id).disabled = !allowed || busy || disconnected || cycles.busy; }
  $('install').textContent = busy ? 'Working…' : ready && $('cycles-download').checked ? 'Download Rendering Cycles' : ready ? 'Open Studio' : (state.error || clientError) ? 'Retry setup & open Framevolve' : 'Set up & open Framevolve';
  $('install-note').textContent = ready ? 'Ready on this Mac. You can close setup whenever you like.' : 'No account needed to explore. First setup needs an internet connection.';
  $('auto-summary').textContent = $('browser').value === 'native' ? 'Native production is selected. We’ll check local Canvas and video encoding, then open Studio in your default browser.' : $('browser').value === 'auto' ? (state.chrome ? 'Chrome found for legacy rendering. We’ll use it and open your demo automatically.' : 'We’ll install Chromium for legacy rendering and open your demo automatically.') : $('browser').value === 'chrome' ? 'We’ll use Google Chrome for legacy browser rendering.' : 'We’ll install Chromium for legacy browser rendering.';
  $('browser').querySelector('[value="native"]').disabled = !state.nativeSupported || busy || disconnected;
  $('locate').hidden = $('browser').value !== 'chrome';
  $('chrome-status').textContent = state.chrome ? 'Google Chrome found on this Mac for legacy rendering.' : 'Chrome was not found. Choose legacy automatic or Chromium if an unmigrated scene needs browser rendering.';
  $('message').textContent = state.message || (busy ? 'Preparing Framevolve…' : '');
  $('error').textContent = clientError || state.error || '';
  $('feedback').hidden = !state.message && !state.error && !clientError && !busy;
  $('launcher-warning').textContent = state.launcherWarning || '';
  $('logs').hidden = !state.log; $('log').textContent = state.log || '';
  $('repo').textContent = state.root || '';
  $('ready').hidden = !ready;
  const hasAgent = !!docs[provider()];
  $('agent').hidden = !hasAgent; $('agent-note').hidden = !hasAgent;
  let studioUrl='';
  try { const url=new URL(state.studioUrl);if(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.username&&!url.password)studioUrl=url.href; } catch {}
  $('studio-link').textContent=studioUrl||'Studio link will appear when setup finishes.';
  if(studioUrl)$('studio-link').href=studioUrl;else $('studio-link').removeAttribute('href');
  $('copy-studio-link').disabled=busy||disconnected||!studioUrl;
  const assistant=provider()==='codex'?'Codex':provider()==='claude'?'Claude Code':'my assistant';
  $('starter-prompt').textContent=`Help me create my first Framevolve video using ${assistant}.\nLocal project folder: ${state.root||'(available after setup)'}\nStudio: ${studioUrl||'(available after setup)'}\nRead AGENTS.md and docs/FOUNDER_START.md in this project first. Ask me for the brief and use the local Studio for preview and editing. If your integrated browser can open localhost, keep chat and Studio side by side; otherwise help me use Studio in Safari or Firefox. Use native local rendering where supported. Ask before any paid generation or provider usage.`;
  $('provider-help').hidden = !hasAgent;
  if (hasAgent) $('provider-docs').href = docs[provider()];
}
async function action(fn) {
  if (pending || state.busy || disconnected) return;
  pending = true; clientError = ''; render(state);
  try { await fn(); } catch (error) { clientError = error.message; }
  finally { pending = false; render(state); }
}
$('setup-continue').onclick=$('setup-skip').onclick=()=>showStage('setup',{focus:true});
$('setup-back').onclick=()=>showStage('welcome',{focus:true});
document.querySelectorAll('input[name="provider"]').forEach(el => el.addEventListener('change', () => render(state)));
$('browser').onchange = () => { selectionChanged = true; render(state); };
$('cycles-download').onchange = () => { if ($('cycles-download').checked) $('cycles-component').open = true; render(state); };
$('memory-info').onclick = () => $('memory-notice').showModal();
$('feedback-memory').onclick = event => { if ($('feedback-memory').checked) { event.preventDefault(); $('memory-notice').showModal(); } else { memoryChanged = true; if (state.ready) action(persistMemory); } };
$('memory-enable').onclick = () => { $('feedback-memory').checked = true; memoryChanged = true; $('memory-notice').close(); if (state.ready) action(persistMemory); };
$('memory-decline').onclick = () => { $('feedback-memory').checked = false; memoryChanged = true; $('memory-notice').close(); if (state.ready) action(persistMemory); };
$('memory-notice-close').onclick = () => $('memory-notice').close();
async function persistMemory() { if (memoryChanged) { state = await api('memory', { enabled: $('feedback-memory').checked }); memoryChanged = false; } }
$('install').onclick = () => action(async () => {
  await persistMemory();
  if (state.ready && !selectionChanged) state = await api($('cycles-download').checked ? 'components/cycles/install' : 'finish', {});
  else { state = await api('install', { provider: provider(), browser: $('browser').value, cyclesOptional: $('cycles-download').checked }); selectionChanged = false; }
});
for (const name of ['install','update','authorize','check','remove']) $('cycles-' + name).onclick = () => action(async () => { state = await api('components/cycles/' + name, {}); });
$('agent').onclick = () => action(async () => { state = await api('provider', { provider: provider() }); state = await api('agent', {}); });
$('locate').onclick = () => action(async () => { state = await api('locate', {}); selectionChanged = true; });
$('copy-prompt').onclick = () => action(async () => { await navigator.clipboard.writeText($('starter-prompt').textContent); $('copy-prompt').textContent = 'Copied'; });
$('copy-studio-link').onclick = () => action(async () => { await navigator.clipboard.writeText($('studio-link').href); $('copy-studio-link').textContent = 'Copied'; });
$('close').onclick = () => action(async () => { await persistMemory(); await api('close', {}); disconnected = true; state.message = 'Setup is complete. You can close this tab and its Terminal window.'; });
try {
  state = await api('state');
  showStage(state.ready?'setup':'welcome');
  $('feedback-memory').checked = !!state.feedbackMemory;
  document.querySelector(`input[name="provider"][value="${['codex','claude','other'].includes(state.provider) ? state.provider : 'other'}"]`).checked = true;
  $('browser').value = ['native','auto','chrome','chromium'].includes(state.browser) ? state.browser : 'auto';
  render(state);
  const poll = async () => {
    if (disconnected) return;
    try { if (!pending) render(await api('state')); }
    catch { if (!disconnected) { disconnected = true; clientError = 'Setup is no longer connected. Reopen Setup Framevolve.command to continue.'; render(state); } return; }
    setTimeout(poll, 700);
  };
  setTimeout(poll, 700);
} catch { showStage('setup'); disconnected = true; clientError = 'Reopen Setup Framevolve.command to start a new setup session.'; render(state); }
