import './onboarding.css';

export function mountOnboarding({container, isBusy, explore, edit, renderFrame, createBrief}) {
  let token, root = '', progress = {version: 1, seen: false, completed: []}, saving = Promise.resolve();
  const entry = document.createElement('button');
  entry.className = 'onboarding-entry'; entry.type = 'button';
  container.prepend(entry);
  const dialog = document.createElement('dialog');
  dialog.className = 'onboarding'; dialog.setAttribute('aria-labelledby', 'onboarding-title');
  dialog.innerHTML = `
    <header class="ob-top"><span class="ob-brand">FRAMEVOLVE <i> / FIRST MOVES</i></span><button type="button" data-action="close" aria-label="Close getting started">×</button></header>
    <div class="ob-hero"><div class="ob-intro"><p class="ob-eyebrow">FROM IDEA TO SOMETHING YOU CAN SEE</p><h1 id="onboarding-title">Make your first move.</h1><p class="ob-lead">Press play. Make it yours. Take a frame home.<br>Your first result is closer than you think.</p></div>
    <div class="ob-art" role="img" aria-label="Illustration of a bold typographic motion design with a timeline"><span class="ob-art-label">YOUR IDEAS, IN MOTION</span><strong>MAKE<br><em>IT MOVE.</em></strong><span class="ob-orbit"></span><div class="ob-art-track"><i></i><i></i><i></i><i></i></div><small>WORKFLOW ILLUSTRATION</small></div></div>
    <div class="ob-progress"><span data-progress>YOUR FIRST 3 MOVES</span><div role="progressbar" aria-label="Getting started" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0"><i></i></div></div>
    <ol class="ob-steps">
      <li data-step="explore"><span class="ob-number">01</span><div><h2>Find your moment</h2><p>Play the scene or drag the timeline. Every moment is editable.</p></div><button type="button" data-action="explore">Explore</button></li>
      <li data-step="edit"><span class="ob-number">02</span><div><h2>Put your spin on it</h2><p>Change a scene control in Scene: try a title, color or shape.</p></div><button type="button" data-action="edit">Make a change</button></li>
      <li data-step="render"><span class="ob-number">03</span><div><h2>Your first frame, for real</h2><p>Render a small PNG, then download it from Render View.</p></div><button type="button" data-action="render">Render a frame</button></li>
    </ol>
    <p class="ob-starter">Your work stays with you.<span>Changes save automatically on this Mac, including agent edits. Look for Saved beside the save icon. Use the folder icon → New project for a fresh start, or Export portable project to take your scene and local assets to another computer.</span></p>
    <details class="ob-ai"><summary><span>Bring your own AI</span><small>Chat + Studio, side by side</small></summary><div class="ob-ai-body"><p>Framevolve is your local workspace. Use a compatible coding assistant with your own account, subscription or API access. Availability and charges depend on your provider; Framevolve does not include an AI subscription.</p><div class="ob-split" role="img" aria-label="Example layout: your AI chat on the left, Framevolve Studio on the right"><div><b>Your AI chat</b><span>“Make the title bolder.”</span><i>Describe → revise</i></div><div><b>Framevolve Studio</b><span class="ob-mini-title">MAKE IT<br>MOVE.</span><i>Preview → adjust → export</i></div></div><ol><li>Open the project folder below in your local coding assistant.</li><li>Ask it to open the Studio link in its integrated browser, if it can access localhost. Keep chat and preview side by side.</li><li>No integrated browser? Open the same link in Safari or Firefox beside your chat.</li></ol><p class="ob-honest">Choosing an assistant in setup does not sign you in or connect it automatically. Your provider handles sign-in. You can explore and render without AI.</p><label>Project folder<input data-root readonly aria-label="Project folder"></label><label>Studio link<input data-link readonly aria-label="Studio link"></label><div class="ob-copy"><button type="button" data-action="copy-link">Copy Studio link</button><button type="button" data-action="copy-prompt">Copy starter prompt</button></div><textarea data-prompt readonly aria-label="Starter prompt" hidden></textarea></div></details>
    <p class="ob-message" role="status" aria-live="polite"></p>
    <footer><button type="button" data-action="close" class="ob-later">Explore on my own</button><button type="button" data-action="brief" class="ob-primary">Start my own video ↗</button><small>You can reopen this guide from Getting started.</small></footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const link = new URL(location.href); link.hash = ''; link.searchParams.delete('welcome'); link.searchParams.delete('onboarding');
  $('[data-link]').value = link.href;
  function paint() {
    const count = progress.completed.length;
    entry.textContent = count === 3 ? '✓ Getting started' : `Getting started · ${count}/3`;
    for (const li of dialog.querySelectorAll('[data-step]')) {
      const done = progress.completed.includes(li.dataset.step);
      li.classList.toggle('is-done', done);
      li.querySelector('.ob-number').textContent = done ? '✓' : {explore:'01',edit:'02',render:'03'}[li.dataset.step];
      li.querySelector('.ob-number').setAttribute('aria-label', done ? 'Completed' : 'Not completed');
    }
    $('[data-progress]').textContent = count === 3 ? 'THREE MOVES. YOUR NEXT IDEA IS UP.' : `${count} OF 3 MOVES COMPLETE`;
    $('[role="progressbar"]').setAttribute('aria-valuenow', String(count));
    $('[role="progressbar"] i').style.width = `${count / 3 * 100}%`;
    $('#onboarding-title').textContent = count === 3 ? 'You made it move.' : 'Make your first move.';
    $('.ob-lead').textContent = count === 3 ? 'You explored, changed the scene and rendered a real result. Now bring your own idea to life.' : 'Press play. Make it yours. Take a frame home. Your first result is closer than you think.';
    const busy = isBusy();
    for (const action of ['explore','edit','render','brief']) $(`[data-action="${action}"]`).disabled = busy;
  }
  async function load() {
    const response = await fetch('/__framevolve_session/onboarding');
    if (!response.ok) throw Error('Your progress could not be loaded. Reopen this guide to retry.');
    const data = await response.json(); token = data.token; root = data.root;
    progress = {...data.progress, seen: data.progress.seen || progress.seen, completed: [...new Set([...data.progress.completed, ...progress.completed])]};
    $('[data-root]').value = root;
    $('[data-prompt]').value = `Work in my Framevolve project at ${root}. Read AGENTS.md and the repository instructions first. Help me create my first short video: ask about my idea, audience and style before making changes. My Studio is at ${link.href}. If your integrated browser can access localhost, open it alongside our chat; otherwise I will use my browser. Preserve my existing projects, edits and active renders. Do not install paid services or change my provider without asking.`;
    paint();
  }
  function save() {
    saving = saving.catch(() => {}).then(async () => {
      if (!token) await load();
      const response = await fetch('/__framevolve_session/onboarding', {method: 'POST', headers: {'Content-Type':'application/json','X-Framevolve-Session':token}, body:JSON.stringify(progress)});
      if (!response.ok) { token = null; throw Error('Progress was not saved. Reopen the guide to retry.'); }
      const data = await response.json();
      progress.completed = [...new Set([...progress.completed, ...data.progress.completed])]; paint();
    }).catch(error => { $('.ob-message').textContent = error.message; });
  }
  function mark(step) { if (!progress.completed.includes(step)) { progress.completed.push(step); paint(); save(); } }
  async function open({section} = {}) {
    try { await load(); $('.ob-message').textContent = ''; } catch(error) { $('.ob-message').textContent = error.message; }
    paint(); if (!dialog.open) dialog.showModal();
    if (section === 'ai') {
      const ai = dialog.querySelector('.ob-ai');
      ai.open = true;
      requestAnimationFrame(() => ai.scrollIntoView({behavior: 'smooth', block: 'start'}));
    }
  }
  entry.onclick = open;
  dialog.addEventListener('close', () => { progress.seen = true; save(); if (dialog.contains(document.activeElement) || document.activeElement === document.body) entry.focus(); });
  dialog.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close') { dialog.close(); return; }
    if (action.startsWith('copy-')) {
      const field = action === 'copy-link' ? $('[data-link]') : $('[data-prompt]');
      if (!field.value) { $('.ob-message').textContent = 'Reopen the guide to load your project details.'; return; }
      try { await navigator.clipboard.writeText(field.value); $('.ob-message').textContent = action === 'copy-link' ? 'Studio link copied. Open it beside your chat.' : 'Prompt copied. Paste it into your coding assistant.'; }
      catch { field.hidden = false; field.focus(); field.select(); $('.ob-message').textContent = 'Select and copy the text above.'; }
      return;
    }
    if (isBusy()) { $('.ob-message').textContent = 'Let the current render finish before starting another step.'; return; }
    dialog.close();
    if (action === 'explore') explore();
    if (action === 'edit') edit();
    if (action === 'render') renderFrame();
    if (action === 'brief') createBrief();
  });
  for (const [selector, event] of [['#play','click'],['#seek','input'],['#moments','click']]) document.querySelector(selector)?.addEventListener(event, e => { if(e.isTrusted) mark('explore'); });
  document.querySelector('#project-controls')?.addEventListener('input', event => {
    if (event.isTrusted && event.target.matches('input:not([type="search"]),select,textarea')) mark('edit');
  });
  const started = Date.now();
  paint();
  load().then(async () => {
    const params = new URLSearchParams(location.search);
    // Only a setup/starter invitation can auto-open; ordinary existing sessions stay untouched.
    if (!progress.seen && (params.get('welcome') === '1' || params.get('onboarding') === 'practice')) {
      const response = await fetch('/api/studio'), data = await response.json();
      if (response.ok && !(data.jobs || []).some(job => ['running','queued','cancelling'].includes(job.status)) && !isBusy() && !document.querySelector('dialog[open]')) dialog.showModal();
    }
  }).catch(error => { $('.ob-message').textContent = error.message; });
  return {open, noteRender(job) { if (job.status === 'completed' && job.url && Date.parse(job.createdAt) >= started) mark('render'); }};
}
