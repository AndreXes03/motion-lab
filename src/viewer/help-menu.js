import './help-menu.css';

/** Persistent help entry point. The getting-started guide remains the source of onboarding actions. */
export function mountHelpMenu({container, onboarding, onStartVideo} = {}) {
  if (!container?.append) throw new TypeError('Help menu needs a container.');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'fv-help-trigger';
  trigger.textContent = 'Help';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-label', 'Help and getting started');

  const dialog = document.createElement('dialog');
  dialog.className = 'fv-help-dialog';
  dialog.setAttribute('aria-labelledby', 'fv-help-title');
  dialog.innerHTML = `
    <header><div><span class="fv-help-kicker">FRAMEVOLVE / STUDIO GUIDE</span><h2 id="fv-help-title">A good place to start.</h2></div><button type="button" data-close aria-label="Close help">×</button></header>
    <div class="fv-help-content">
      <button type="button" class="fv-help-card" data-getting-started><span class="fv-help-number">01</span><span><strong>Getting started</strong><small>Explore a scene, make a change and render your first frame.</small></span><span aria-hidden="true">↗</span></button>
      <button type="button" class="fv-help-card fv-help-ai" data-ai-help><span class="fv-help-number">02</span><span><strong>Bring your own AI</strong><small>See how to use your coding assistant beside Studio, including the project folder and Studio link.</small></span><span aria-hidden="true">↗</span></button>
      <button type="button" class="fv-help-card" data-start-video><span class="fv-help-number">03</span><span><strong>Start your own video</strong><small>Open the project guide and begin with your idea, audience and style.</small></span><span aria-hidden="true">↗</span></button>
    </div>
    <footer><span>Need a first step? The guide walks you through it.</span><button type="button" data-close>Close</button></footer>`;
  container.append(trigger);
  document.body.append(dialog);

  let focusHandoff = false;
  function open() { if (!dialog.open) dialog.showModal(); }
  function close() { if (dialog.open) dialog.close(); }
  function openDestination(destination) {
    focusHandoff = true;
    close();
    Promise.resolve().then(destination).finally(() => { focusHandoff = false; });
  }
  trigger.addEventListener('click', open);
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  dialog.querySelector('[data-getting-started]').addEventListener('click', () => openDestination(() => onboarding?.open?.()));
  dialog.querySelector('[data-ai-help]').addEventListener('click', () => openDestination(() => onboarding?.open?.({section: 'ai'})));
  dialog.querySelector('[data-start-video]').addEventListener('click', () => {
    openDestination(() => typeof onStartVideo === 'function' ? onStartVideo() : onboarding?.open?.());
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    if (!focusHandoff && !document.querySelector('dialog[open]')) trigger.focus({preventScroll: true});
  });
  return {open, destroy() { close(); trigger.remove(); dialog.remove(); }};
}
