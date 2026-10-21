const $ = id => document.getElementById(id);
// Capability stays in this tab's memory, not in referrers or persistent storage.
const token = location.hash.slice(1);
history.replaceState(null, '', '/');
let state = {}, pending = false, disconnected = false, selectionChanged = false, memoryChanged = false, clientError = '';
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
  $('install').textContent = busy ? 'Working…' : ready ? 'Open Studio' : (state.error || clientError) ? 'Retry setup & open Framevolve' : 'Set up & open Framevolve';
  $('install-note').textContent = ready ? 'Ready on this Mac. You can close setup whenever you like.' : 'No account needed to explore. First setup needs an internet connection.';
  $('auto-summary').textContent = $('browser').value === 'auto' ? (state.chrome ? 'Chrome found. We’ll use it and open your demo automatically.' : 'We’ll install Chromium for you and open your demo automatically.') : $('browser').value === 'chrome' ? 'We’ll use Google Chrome to preview and render your scenes.' : 'We’ll install Chromium for Framevolve and open your demo.';
  $('locate').hidden = $('browser').value !== 'chrome';
  $('chrome-status').textContent = state.chrome ? 'Google Chrome found on this Mac.' : 'Chrome was not found. Choose Automatic or Chromium, or locate your Chrome app.';
  $('message').textContent = state.message || (busy ? 'Preparing Framevolve…' : '');
  $('error').textContent = clientError || state.error || '';
  $('feedback').hidden = !state.message && !state.error && !clientError && !busy;
  $('launcher-warning').textContent = state.launcherWarning || '';
  $('logs').hidden = !state.log; $('log').textContent = state.log || '';
  $('repo').textContent = state.root || '';
  $('ready').hidden = !ready;
  const hasAgent = !!docs[provider()];
  $('agent').hidden = !hasAgent; $('agent-note').hidden = !hasAgent; $('prompt-area').hidden = !hasAgent;
  $('provider-help').hidden = !hasAgent;
  if (hasAgent) $('provider-docs').href = docs[provider()];
}
async function action(fn) {
  if (pending || state.busy || disconnected) return;
  pending = true; clientError = ''; render(state);
  try { await fn(); } catch (error) { clientError = error.message; }
  finally { pending = false; render(state); }
}
document.querySelectorAll('input[name="provider"]').forEach(el => el.addEventListener('change', () => render(state)));
$('browser').onchange = () => { selectionChanged = true; render(state); };
$('memory-info').onclick = () => $('memory-notice').showModal();
$('feedback-memory').onclick = event => { if ($('feedback-memory').checked) { event.preventDefault(); $('memory-notice').showModal(); } else { memoryChanged = true; if (state.ready) action(persistMemory); } };
$('memory-enable').onclick = () => { $('feedback-memory').checked = true; memoryChanged = true; $('memory-notice').close(); if (state.ready) action(persistMemory); };
$('memory-decline').onclick = () => { $('feedback-memory').checked = false; memoryChanged = true; $('memory-notice').close(); if (state.ready) action(persistMemory); };
$('memory-notice-close').onclick = () => $('memory-notice').close();
async function persistMemory() { if (memoryChanged) { state = await api('memory', { enabled: $('feedback-memory').checked }); memoryChanged = false; } }
$('install').onclick = () => action(async () => {
  await persistMemory();
  if (state.ready && !selectionChanged) state = await api('finish', {});
  else { state = await api('install', { provider: provider(), browser: $('browser').value }); selectionChanged = false; }
});
$('agent').onclick = () => action(async () => { state = await api('provider', { provider: provider() }); state = await api('agent', {}); });
$('locate').onclick = () => action(async () => { state = await api('locate', {}); selectionChanged = true; });
$('copy-prompt').onclick = () => action(async () => { await navigator.clipboard.writeText(document.querySelector('blockquote').textContent); $('copy-prompt').textContent = 'Copied'; });
$('close').onclick = () => action(async () => { await persistMemory(); await api('close', {}); disconnected = true; state.message = 'Setup is complete. You can close this tab and its Terminal window.'; });
try {
  state = await api('state');
  $('feedback-memory').checked = !!state.feedbackMemory;
  document.querySelector(`input[name="provider"][value="${['codex','claude','other'].includes(state.provider) ? state.provider : 'other'}"]`).checked = true;
  $('browser').value = ['chrome','chromium'].includes(state.browser) ? state.browser : 'auto';
  render(state);
  const poll = async () => {
    if (disconnected) return;
    try { if (!pending) render(await api('state')); }
    catch { if (!disconnected) { disconnected = true; clientError = 'Setup is no longer connected. Reopen Setup Framevolve.command to continue.'; render(state); } return; }
    setTimeout(poll, 700);
  };
  setTimeout(poll, 700);
} catch { disconnected = true; clientError = 'Reopen Setup Framevolve.command to start a new setup session.'; render(state); }
