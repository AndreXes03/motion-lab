const $ = id => document.getElementById(id);
// Capability stays in this tab's memory, not in referrers or persistent storage.
const token = location.hash.slice(1);
history.replaceState(null, '', '/');
let step = 1, state = {}, pending = false, awaitingBrowser = false;
const docs = { codex: 'https://developers.openai.com/codex/cli/', claude: 'https://code.claude.com/docs/en/setup' };
const selected = name => document.querySelector(`input[name="${name}"]:checked`)?.value;
function showStep(value) { step = value; for (let i = 1; i <= 3; i++) { $('step' + i).hidden = i !== step; $('nav' + i).classList.toggle('active', i === step); } }
async function api(route, body) {
  const response = await fetch('/api/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Framevolve-Setup': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json(); if (!response.ok) throw Error(data.error || 'Setup request failed.'); return data;
}
function providerUI() {
  const provider = selected('provider'); $('agent-options').hidden = provider === 'other';
  if (docs[provider]) $('provider-docs').href = docs[provider];
}
function render(data) {
  state = data;
  document.querySelectorAll('button,input').forEach(el => { el.disabled = state.busy || pending; });
  $('chrome-status').textContent = state.chrome ? 'Found on this Mac. No browser download needed.' : 'Not found automatically. Locate your app or choose Chromium.';
  $('message').textContent = state.message || (state.busy ? 'Working…' : '');
  $('error').textContent = state.error || '';
  $('feedback').hidden = !state.message && !state.error && !state.busy;
  $('logs').hidden = !state.log; $('log').textContent = state.log || '';
  if (awaitingBrowser && state.ready && !state.busy && !state.error && state.stage === 'browser') { awaitingBrowser = false; showStep(3); }
  $('repo').textContent = state.root || '';
  $('browser-summary').textContent = state.browser === 'chrome' ? 'Using your existing Google Chrome.' : 'Using dedicated Chromium.';
  $('launcher-result').textContent = state.launcherWarning || 'Your Framevolve shortcut is in your user Applications folder. Keep this project folder in place.';
  providerUI();
}
async function action(fn) {
  if (pending || state.busy) return;
  pending = true; render(state);
  try { await fn(); } catch (error) { state.error = error.message; }
  finally { pending = false; render(state); }
}
document.querySelectorAll('input[name="provider"]').forEach(el => el.addEventListener('change', providerUI));
$('next').onclick = () => action(async () => { state = await api('provider', { provider: selected('provider') }); showStep(2); });
$('back').onclick = () => showStep(1);
$('change').onclick = () => { state.stage = 'welcome'; showStep(1); };
$('agent').onclick = () => action(async () => { state = await api('provider', { provider: selected('provider') }); state = await api('agent', {}); });
$('locate').onclick = () => action(async () => { state = await api('locate', {}); });
$('prepare').onclick = () => action(async () => { awaitingBrowser = true; state = await api('prepare', { browser: selected('browser') }); });
$('finish').onclick = () => action(async () => { state = await api('finish', {}); });
$('copy-prompt').onclick = () => action(async () => { await navigator.clipboard.writeText(document.querySelector('blockquote').textContent); $('copy-prompt').textContent = 'Copied'; });
try {
  state = await api('state');
  document.querySelector(`input[name="provider"][value="${['codex','claude','other'].includes(state.provider) ? state.provider : 'other'}"]`).checked = true;
  document.querySelector(`input[name="browser"][value="${state.browser === 'chromium' || !state.chrome ? 'chromium' : 'chrome'}"]`).checked = true;
  render(state);
  const poll = async () => { try { if (!pending) render(await api('state')); } catch (error) { $('feedback').hidden = false; $('error').textContent = 'Setup is no longer connected. Reopen Setup Framevolve.command to continue.'; return; } if (!(state.stage === 'finish' && state.studioUrl && !state.busy)) setTimeout(poll, 1000); };
  setTimeout(poll, 1000);
} catch (error) { $('feedback').hidden = false; $('error').textContent = 'Reopen Setup Framevolve.command to start a new setup session.'; document.querySelectorAll('button').forEach(el => { el.disabled = true; }); }
