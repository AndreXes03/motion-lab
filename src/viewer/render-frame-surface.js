import './render-frame-surface.css';

/** Keep a real rendered frame visible while the next frame is being computed. */
export function mountRenderFrameSurface({container, onInteractive, onSettings, onRetry, onCancel}) {
  const root = document.createElement('section');
  root.id = 'final-frame-view'; root.hidden = true;
  root.setAttribute('aria-label', 'Final renderer preview');
  const image = document.createElement('img'); image.alt = 'Final rendered frame'; image.hidden = true;
  const deviceBadge=document.createElement('small');deviceBadge.className='final-frame-device';deviceBadge.hidden=true;root.append(deviceBadge);
  const message = document.createElement('div'); message.className = 'final-frame-message';
  const title = document.createElement('strong'); title.setAttribute('role', 'status');
  const detail = document.createElement('span');
  const actions = document.createElement('div'); actions.className = 'final-frame-actions';
  const button = (label, action) => { const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.onclick = action; actions.append(el); return el; };
  const retry = button('Retry frame', onRetry);
  const cancel = button('Cancel render', onCancel); cancel.hidden = true;
  button('Renderer settings', onSettings);
  button('Back to interactive', onInteractive);
  message.append(title, detail, actions); root.append(image, message); container.append(root);
  let state = {status: 'idle'}, displayed = null;
  function render(next) {
    state = next; root.hidden = next.status === 'idle';
    root.dataset.status = next.status;
    deviceBadge.hidden=!next.device;const deviceRenderer=next.engine==='skia'?'Skia':next.engine==='cycles'?(next.backend==='cycles-standalone'?'Cycles standalone':'Cycles'):next.engine==='mixed'?'Mixed':'Renderer';deviceBadge.textContent=next.device ? `${deviceRenderer} · ${next.deviceName||next.device}` : '';
    image.alt=next.device?`Final frame · ${deviceBadge.textContent}`:'Final rendered frame';
    root.setAttribute('aria-busy', String(['pending', 'rendering'].includes(next.status)));
    if (next.status === 'idle') { displayed = null; image.hidden = true; image.removeAttribute('src'); return; }
    const engine = next.engine === 'cycles' ? 'Cycles' : next.engine === 'mixed' ? 'Mixed' : next.engine === 'skia' ? 'Skia' : 'Three.js';
    if (displayed?.scene !== next.scene) { displayed = null; image.hidden = true; }
    const failed = ['error', 'unavailable', 'cancelled'].includes(next.status);
    actions.hidden = !failed && !['pending','rendering'].includes(next.status); retry.hidden = !['error','cancelled'].includes(next.status); cancel.hidden = !['pending','rendering'].includes(next.status);cancel.disabled=next.phase==='cancelling';
    const phaseLabel = next.phase === 'cancelling' ? 'cancelling' : ['freezing','baking','starting','preparing'].includes(next.phase) ? 'preparing scene' : next.phase === 'final' ? 'final pass' : next.phase === 'refining' ? 'refining' : 'rendering';
    title.textContent = failed ? `${engine} · ${next.status === 'error' ? 'render failed' : next.status === 'cancelled' ? 'cancelled' : 'unavailable'}` : next.status === 'ready' ? `${engine} · loading frame…` : `${engine} · ${next.status === 'pending' ? (next.phase === 'waiting' ? 'renderer busy' : 'waiting') : phaseLabel}${next.progress > 0 ? ` ${Math.round(next.progress)}%` : '…'}`;
    detail.textContent = failed ? next.error : next.previewUrl ? `${next.previewWidth} × ${next.previewHeight} · ${next.previewSamples} samples · refining to full resolution` : displayed ? 'Showing the previous rendered frame' : 'Preparing the scene for its first image';
    message.hidden = false;
    const url = next.status === 'ready' ? next.url : next.previewUrl;
    if (url) {
      const requestedKey = next.requestKey, final = next.status === 'ready';
      image.onload = () => {
        if (state.requestKey !== requestedKey || (final ? state.status !== 'ready' : state.status === 'ready')) return;
        displayed = {...next}; image.hidden = false; message.hidden = final;
        image.dataset.stage = final ? 'final' : String(next.stage);
      };
      image.onerror = () => {
        if (state.requestKey !== requestedKey) return;
        if (!final) return; // A following preview stage or final frame can recover.
        title.textContent = 'Could not load the rendered frame'; detail.textContent = 'Retry the frame or return to interactive.';
        actions.hidden = false; retry.hidden = false; message.hidden = false;
      };
      if (image.getAttribute('src') === url && image.complete && image.naturalWidth > 0) image.onload();
      else image.src = url;
    }
  }
  return {render, getReadyFrame: () => state.status === 'ready' && displayed?.status === 'ready' && displayed.url === state.url && displayed.requestKey === state.requestKey ? displayed : null};
}
