import {studioProjects} from '../engine/project-controls.js';
import {icon} from './studio-icons.js';
import './preview-quality.css';

const STORAGE_KEY = 'motion-lab-preview-quality';
const MODES = ['auto', 'balanced', 'fast', 'sharp'];
const MODE_LABELS = {auto: 'Auto', balanced: 'Balanced', fast: 'Fast', sharp: 'Sharp'};

function sceneInfo(scene) {
  const id = typeof scene === 'string' ? scene : scene?.id ?? scene?.scene;
  const project = studioProjects.find(item => item.id === id);
  return {id, kind: typeof scene === 'object' && scene?.kind ? scene.kind : project?.kind ?? '3d'};
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

function loadMode() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function saveMode(mode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
}

function mobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width: 620px)').matches
    : typeof window !== 'undefined' && window.innerWidth <= 620;
}

/** Mount the preview-quality selector and expose a render policy for the viewer. */
export function mountPreviewQuality({container, getScene, getOutputSettings = () => ({width:1920,height:1080}), onChange = () => {}, onModeChange = () => {}}) {
  if (!container?.append || typeof getScene !== 'function') {
    throw new TypeError('Preview quality requires a container and getScene callback.');
  }

  let interactiveMode = loadMode();
  let mode = interactiveMode;
  let renderState = 'pending';
  let renderPhase = '';
  let renderMilliseconds = null;
  let samples = [];
  // A tier stays in place until costs recover well below the downgrade limit.
  let adaptiveTier = 0;

  const toolbar = document.createElement('div');
  toolbar.className = 'preview-toolbar preview-mode-toolbar';
  const modes = document.createElement('div'); modes.className = 'preview-mode-buttons';
  modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Preview mode');
  const interactiveButton = document.createElement('button'); interactiveButton.type = 'button'; interactiveButton.id = 'preview-mode-interactive';
  interactiveButton.setAttribute('aria-label', 'Interactive'); interactiveButton.title = 'Interactive preview'; interactiveButton.innerHTML = icon('play');
  const renderButton = document.createElement('button'); renderButton.type = 'button'; renderButton.id = 'preview-mode-render';
  renderButton.setAttribute('aria-label', 'Render view'); renderButton.title = 'Full-resolution frame · selected final renderer'; renderButton.innerHTML = icon('frame');
  modes.append(interactiveButton, renderButton);
  const qualityControl = document.createElement('div'); qualityControl.className = 'preview-interactive-quality';
  const label = document.createElement('label');
  label.htmlFor = 'preview-quality';
  label.textContent = 'Quality';
  label.className = 'preview-quality-label';
  const select = document.createElement('select');
  select.id = 'preview-quality';
  select.setAttribute('aria-label', 'Preview quality');
  for (const value of MODES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = MODE_LABELS[value];
    select.append(option);
  }
  select.value = mode;
  const status = document.createElement('span');
  status.id = 'preview-quality-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  qualityControl.append(label, select);
  toolbar.append(modes, qualityControl, status);
  container.append(toolbar);

  function getSettings(interacting = false) {
    const {kind} = sceneInfo(getScene());
    const isMobile = mobileViewport();
    const isTwoDimensional = kind === '2d';
    const requestedOutput = getOutputSettings();
    const output = Number.isFinite(requestedOutput?.width) && requestedOutput.width > 0 && Number.isFinite(requestedOutput?.height) && requestedOutput.height > 0 ? requestedOutput : {width: 1920, height: 1080};
    const aspect = output.height / output.width;
    let width;
    let quality = 'full';

    if (mode === 'render') {
      width = interacting ? Math.min(640, output.width) : output.width;
      return {width, height: interacting ? Math.round(width * output.height / output.width) : output.height, quality: 'full', label: 'Render view'};
    }

    if (mode === 'balanced') width = 640;
    else if (mode === 'fast') { width = 384; quality = 'fast'; }
    else if (mode === 'sharp') width = 960;
    else if (interacting) width = isTwoDimensional ? 640 : 480;
    else width = isTwoDimensional ? 960 : 640;

    // Auto sacrifices expensive effects only during interaction or sustained
    // overload. Pausing always requests a fresh, full-effect refinement.
    if (mode === 'auto' && interacting && !isTwoDimensional) quality = 'fast';
    if (mode === 'auto' && !interacting) {
      if (adaptiveTier >= 2) width = Math.min(width, 384);
      else if (adaptiveTier >= 1) width = Math.min(width, 480);
    }
    if (isMobile) width = Math.min(width, 480);

    const height = Math.max(1, Math.round(width * aspect));
    return {width, height, quality, label: MODE_LABELS[mode]};
  }

  function updateStatus(setting = getSettings(false)) {
    const isRender = mode === 'render';
    toolbar.dataset.mode = isRender ? 'render' : 'interactive';
    toolbar.dataset.renderState = renderState;
    interactiveButton.setAttribute('aria-pressed', String(!isRender));
    renderButton.setAttribute('aria-pressed', String(isRender));
    qualityControl.hidden = isRender;
    toolbar.setAttribute('aria-busy', String(isRender && renderState === 'rendering'));
    if (isRender) {
      const duration = renderMilliseconds === null ? '' : renderMilliseconds < 1000 ? ` · ${Math.round(renderMilliseconds)} ms` : ` · ${(renderMilliseconds / 1000).toFixed(1)} s`;
      status.textContent = renderState === 'pending' ? (renderPhase === 'waiting' ? 'Renderer busy…' : 'Waiting to refine…') : renderState === 'rendering' ? (['freezing','baking','starting','preparing'].includes(renderPhase) ? 'Preparing scene…' : renderPhase === 'refining' ? 'Refining…' : renderPhase === 'final' ? 'Final pass…' : 'Rendering…') : renderState === 'error' ? 'Render failed' : renderState === 'unavailable' ? 'Local renderer required' : `${setting.width} × ${setting.height}${duration}`;
    } else status.textContent = `${setting.width} × ${setting.height}${setting.quality === 'fast' ? ' · simplified effects' : ''}`;
  }

  function reportFrame(ms) {
    updateStatus(getSettings());
    if (mode !== 'auto' || !Number.isFinite(ms) || ms < 0) return;
    samples.push(ms);
    if (samples.length > 5) samples.shift();
    if (samples.length < 5) return;

    const cost = median(samples);
    const previousTier = adaptiveTier;
    if (adaptiveTier === 0) {
      if (cost > 95) adaptiveTier = 2;
      else if (cost > 55) adaptiveTier = 1;
    } else if (adaptiveTier === 1) {
      if (cost > 95) adaptiveTier = 2;
      else if (cost < 36) adaptiveTier = 0;
    } else if (cost < 60) {
      adaptiveTier = cost < 36 ? 0 : 1;
    }
    if (adaptiveTier !== previousTier) updateStatus();
  }

  function setMode(nextMode) {
    if (nextMode === 'interactive') nextMode = interactiveMode;
    if (nextMode !== 'render' && !MODES.includes(nextMode)) throw new RangeError(`Unknown preview quality: ${nextMode}`);
    if (mode === nextMode) return;
    const previousMode = mode;
    mode = nextMode;
    if (mode === 'render') {
      renderState = 'pending';
      renderMilliseconds = null;
    } else {
      interactiveMode = mode;
      select.value = mode;
      saveMode(mode);
      if (mode === 'auto') { samples = []; adaptiveTier = 0; }
    }
    updateStatus();
    onModeChange(mode, previousMode);
    onChange({mode, previousMode, interactiveMode});
  }

  function setRenderState(state, ms, phase = '') {
    if (!['pending', 'rendering', 'ready', 'error', 'unavailable'].includes(state)) throw new RangeError(`Unknown preview render state: ${state}`);
    renderState = state; renderPhase = phase;
    renderMilliseconds = state === 'ready' && Number.isFinite(ms) && ms >= 0 ? ms : null;
    updateStatus();
  }

  interactiveButton.addEventListener('click', () => setMode(interactiveMode));
  renderButton.addEventListener('click', () => setMode('render'));
  select.addEventListener('change', () => setMode(select.value));
  updateStatus();

  return {
    getSettings,
    reportFrame,
    syncScene() { samples = []; adaptiveTier = 0; renderState = 'pending'; renderMilliseconds = null; updateStatus(); },
    getMode: () => mode,
    getInteractiveMode: () => interactiveMode,
    setRenderState,
    setMode
  };
}
