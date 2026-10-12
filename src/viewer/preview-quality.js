import {studioProjects} from '../engine/project-controls.js';

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
export function mountPreviewQuality({container, getScene, onChange = () => {}}) {
  if (!container?.append || typeof getScene !== 'function') {
    throw new TypeError('Preview quality requires a container and getScene callback.');
  }

  let mode = loadMode();
  let samples = [];
  // A tier stays in place until costs recover well below the downgrade limit.
  let adaptiveTier = 0;

  const toolbar = document.createElement('div');
  toolbar.className = 'preview-toolbar';
  const label = document.createElement('label');
  label.htmlFor = 'preview-quality';
  label.textContent = 'Preview';
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
  toolbar.append(label, select, status);
  container.append(toolbar);

  function getSettings(interacting = false) {
    const {kind} = sceneInfo(getScene());
    const isMobile = mobileViewport();
    const isTwoDimensional = kind === '2d';
    let width;
    let quality = 'full';

    if (mode === 'balanced') width = 640;
    else if (mode === 'fast') { width = 384; quality = 'fast'; }
    else if (mode === 'sharp') width = 960;
    else if (interacting) width = isTwoDimensional ? 640 : 480;
    else width = isTwoDimensional ? 960 : 640;

    if (mode === 'auto' && !interacting) {
      if (adaptiveTier >= 2) width = Math.min(width, 384);
      else if (adaptiveTier >= 1) width = Math.min(width, 480);
    }
    if (isMobile) width = Math.min(width, 480);

    const height = Math.round(width * 9 / 16);
    return {width, height, quality, label: MODE_LABELS[mode]};
  }

  function updateStatus(setting = getSettings(false)) {
    status.textContent = `${setting.label} · ${setting.width} × ${setting.height}${setting.quality === 'fast' ? ' · simplified effects' : ''}`;
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
      if (cost > 180) adaptiveTier = 2;
      else if (cost > 100) adaptiveTier = 1;
    } else if (adaptiveTier === 1) {
      if (cost > 180) adaptiveTier = 2;
      else if (cost < 75) adaptiveTier = 0;
    } else if (cost < 140) {
      adaptiveTier = cost < 75 ? 0 : 1;
    }
    if (adaptiveTier !== previousTier) updateStatus();
  }

  function setMode(nextMode) {
    if (!MODES.includes(nextMode)) throw new RangeError(`Unknown preview quality: ${nextMode}`);
    if (mode === nextMode) return;
    mode = nextMode;
    if (mode === 'auto') {
      samples = [];
      adaptiveTier = 0;
    }
    select.value = mode;
    saveMode(mode);
    updateStatus();
    onChange();
  }

  select.addEventListener('change', () => setMode(select.value));
  updateStatus();

  return {
    getSettings,
    reportFrame,
    syncScene() { samples = []; adaptiveTier = 0; updateStatus(); },
    getMode: () => mode,
    setMode
  };
}
