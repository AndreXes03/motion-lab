import {isIdentityEditorialEdit} from './editorial.js';
/** Renderer choice is recipe metadata. Availability must come from local preflight. */
export const RENDERERS = Object.freeze(['auto', 'threejs', 'cycles', 'mixed']);
export const RENDERER_LABELS = Object.freeze({auto: 'Auto', threejs: 'Three.js', cycles: 'Cycles', mixed: 'Mixed'});
export const RENDER_QUALITIES = Object.freeze(['draft', 'balanced', 'final']);
const ENGINES = RENDERERS.slice(1);
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  for (const key of Object.keys(value)) if (FORBIDDEN.has(key)) throw new Error(`Unsafe field in ${label}.`);
  return value;
}
function fields(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${label} field: ${key}.`);
}
function choice(value, options, fallback, label) {
  if (value === undefined) return fallback;
  if (!options.includes(value)) throw new Error(`Invalid ${label}: ${String(value)}.`);
  return value;
}
function number(value, min, max, fallback, label, integer = false) {
  if (value === undefined || (value === null && fallback === null)) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`${label} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`);
  return value;
}
function text(value, fallback, label, max = 500) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`);
  return value.trim();
}
function boolean(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  return value;
}
function id(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function audioFile(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 240 || !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.(?:wav|mp3|m4a|aac|mp4|mov|webm)$/i.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Prepared audio must be a relative media file inside the project.');
  return value;
}
function planFile(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 240 || !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.json$/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Compositing plan must be a relative JSON file inside the project.');
  return value;
}

/** Strict canonical plan; no paths, commands or unchecked executable data in renderer settings. */
export function validateRenderPlan(input) {
  if (input === undefined || input === null) input = {};
  fields(input, ['version', 'renderer', 'source', 'intent', 'preferredRenderer', 'rationale', 'quality', 'budgetSeconds', 'cycles', 'shots', 'layers', 'composite'], 'render policy');
  if (input.version !== undefined && input.version !== 1) throw new Error('Unsupported render policy version.');
  const quality = choice(input.quality, RENDER_QUALITIES, 'balanced', 'render quality');
  const cycles = input.cycles ?? {};
  fields(cycles, ['samples', 'denoise', 'device', 'workers'], 'Cycles');
  const worker = cycles.workers === undefined ? 'auto' : cycles.workers;
  if (worker !== 'auto') number(worker, 1, 2, 1, 'Cycles workers', true);
  const composite = input.composite ?? {};
  fields(composite, ['enabled', 'planFile', 'rationale', 'audioFile', 'audioOffset'], 'compositing');
  const preparedAudio = audioFile(composite.audioFile);
  const preparedAudioOffset = number(composite.audioOffset, 0, 7200, 0, 'Prepared audio offset');
  if (preparedAudioOffset !== 0 && !preparedAudio) throw new Error('A prepared audio offset requires an audio file.');
  const shots = input.shots ?? [];
  if (!Array.isArray(shots) || shots.length > 128) throw new Error('Render shots must be an array of at most 128 entries.');
  const shotIds = new Set();
  const validShots = shots.map(shot => {
    fields(shot, ['id', 'start', 'end', 'renderer', 'rationale'], 'shot');
    const shotId = id(shot.id, 'shot id');
    if (shotIds.has(shotId)) throw new Error(`Duplicate shot id: ${shotId}.`);
    shotIds.add(shotId);
    const start = number(shot.start, 0, 86400, undefined, 'Shot start');
    const end = number(shot.end, 0, 86400, undefined, 'Shot end');
    if (start === undefined || end === undefined || end <= start) throw new Error('Each shot needs an end after its start.');
    return {id: shotId, start, end, renderer: choice(shot.renderer, ['threejs', 'cycles'], 'threejs', 'shot renderer'), rationale: text(shot.rationale, '', 'Shot rationale')};
  });
  const layers = input.layers ?? [];
  if (!Array.isArray(layers) || layers.length > 32) throw new Error('Render layers must be an array of at most 32 entries.');
  const layerIds = new Set();
  const validLayers = layers.map(layer => {
    fields(layer, ['id', 'renderer', 'role', 'opacity'], 'render layer');
    const layerId = id(layer.id, 'layer id');
    if (layerIds.has(layerId)) throw new Error(`Duplicate layer id: ${layerId}.`);
    layerIds.add(layerId);
    return {id: layerId, renderer: choice(layer.renderer, ['threejs', 'cycles'], 'threejs', 'layer renderer'), role: choice(layer.role, ['beauty', 'overlay', 'background'], 'beauty', 'layer role'), opacity: number(layer.opacity, 0, 1, 1, 'Layer opacity')};
  });
  return {
    version: 1,
    renderer: choice(input.renderer, RENDERERS, 'auto', 'renderer'),
    source: choice(input.source, ['agent', 'user'], 'agent', 'renderer selection source'),
    intent: choice(input.intent, ['motion-graphics', 'product', 'photoreal'], 'motion-graphics', 'render intent'),
    preferredRenderer: choice(input.preferredRenderer, ENGINES, 'threejs', 'preferred renderer'),
    rationale: text(input.rationale, 'Three.js preserves the authored scene and provides the fastest iteration.', 'Renderer rationale'),
    quality,
    budgetSeconds: number(input.budgetSeconds, 1, 86400, null, 'Render time budget'),
    cycles: {samples: number(cycles.samples, 1, 4096, quality === 'draft' ? 16 : quality === 'final' ? 128 : 64, 'Cycles samples', true), denoise: boolean(cycles.denoise, true, 'Cycles denoising'), device: choice(cycles.device, ['auto', 'cpu', 'gpu', 'metal'], 'auto', 'Cycles device'), workers: worker},
    shots: validShots,
    layers: validLayers,
    composite: {enabled: boolean(composite.enabled, false, 'Compositing enabled'), planFile: planFile(composite.planFile), rationale: text(composite.rationale, '', 'Compositing rationale'), audioFile: preparedAudio, audioOffset: preparedAudioOffset}
  };
}

export function createRenderPlan(overrides = {}) { return validateRenderPlan(overrides); }

/** User engine selection has priority over the agent's Auto preference. */
export function overrideRenderPlan(plan, renderer) {
  return validateRenderPlan({...validateRenderPlan(plan), renderer, source: 'user'});
}

function supported(capability, scene) {
  return capability?.available === true && (!Array.isArray(capability.scenes) || capability.scenes.includes(scene));
}
function availability(engine, plan, context) {
  if (context.publicDemo) return {available: false, reason: 'Final renderer jobs run in the local app. Browser video uses the real-time Three.js/Canvas path; Cycles and prepared Mixed renders are not executed on this site.'};
  if(engine!=='threejs'&&!isIdentityEditorialEdit(context.parameters?.edit??context.edit,context.scene))return {available:false,reason:'Edited shot timelines currently render with Three.js/Canvas. Restore the original edit to use Cycles or prepared Mixed inputs.'};
  if(engine==='mixed'&&context.parameters?.music)return {available:false,reason:'Imported songs use the Three.js/Canvas or supported Cycles export. Mixed inputs keep their separately prepared soundtrack.'};
  const caps = context.capabilities ?? {};
  if (engine === 'threejs') return {available: caps.threejs?.available !== false, reason: caps.threejs?.reason ?? 'Available in the local app.'};
  if (engine === 'cycles') {
    const cap = caps.cycles;
    if (!supported(cap, context.scene)) return {available: false, reason: cap?.reason || (cap?.available ? 'Cycles currently supports the PULSE scene only.' : 'Blender preflight is required before Cycles can render locally.')};
    const gpuTypes = ['METAL', 'CUDA', 'OPTIX', 'HIP', 'ONEAPI'];
    const verifiedDevices = cap.devices ?? [];
    if (plan.cycles.device === 'gpu' && !verifiedDevices.some(device => gpuTypes.includes(String(device.type).toUpperCase()))) return {available: false, reason: 'No compatible GPU was verified by Blender. Select Auto or CPU.'};
    if (plan.cycles.device === 'metal' && !verifiedDevices.some(device => String(device.type).toUpperCase() === 'METAL')) return {available: false, reason: 'A verified Metal device is required for the Metal renderer. Select Auto or CPU.'};
    if (typeof plan.cycles.workers === 'number' && plan.cycles.workers > (cap.limits?.workers ?? 2)) return {available: false, reason: 'This computer allows fewer parallel Cycles workers. Select Auto.'};
    return {available: true, reason: `Local Blender ready · ${cap.device || 'device selected at render time'}.`};
  }
  if (!plan.composite.enabled || !plan.composite.planFile) return {available: false, reason: 'Mixed rendering needs an agent-authored compositing plan with prepared layer inputs.'};
  if (!supported(caps.mixed, context.scene)) return {available: false, reason: caps.mixed?.reason || 'Mixed rendering is available through the local compositing CLI after its layer inputs are rendered.'};
  // Mixed inputs are validated by the compositor; recipe layer metadata never triggers a hidden render.
  return {available: true, reason: caps.mixed.reason || 'Prepared local layers and compositing plan are available.'};
}

/** Estimate from an actual comparable benchmark, never from CPU/GPU usage percentages. */
export function estimateRenderSeconds(plan, context = {}) {
  const normalized = validateRenderPlan(plan);
  const benchmark = context.capabilities?.cycles?.measured;
  const width = Number(context.width), height = Number(context.height);
  const frameCount = context.kind === 'frame' ? 1 : Number(context.frameCount) || (Number(context.duration) * Number(context.fps));
  if (!benchmark || ![benchmark.secondsPerFrame, benchmark.width, benchmark.height, benchmark.samples, width, height, frameCount].every(value => Number.isFinite(value) && value > 0)) return null;
  if (benchmark.device && context.capabilities.cycles.device && String(benchmark.device).toUpperCase() !== String(context.capabilities.cycles.device).toUpperCase()) return null;
  const measuredDevice = String(benchmark.device ?? context.capabilities.cycles.device ?? '').toUpperCase();
  if (normalized.cycles.device === 'cpu' && measuredDevice !== 'CPU') return null;
  const gpuTypes = ['METAL', 'CUDA', 'OPTIX', 'HIP', 'ONEAPI'];
  if (normalized.cycles.device === 'gpu' && !gpuTypes.includes(measuredDevice)) return null;
  if (normalized.cycles.device === 'metal' && measuredDevice !== 'METAL') return null;
  return Math.ceil(benchmark.secondsPerFrame * width * height / (benchmark.width * benchmark.height) * normalized.cycles.samples / benchmark.samples * frameCount);
}

export function resolveRenderPlan(input, context = {}) {
  const plan = validateRenderPlan(input);
  let selectedRenderer = plan.renderer;
  const warnings = [];
  let reason = plan.renderer !== 'auto' && plan.source === 'user' ? `User selected ${RENDERER_LABELS[plan.renderer]} for this export.` : plan.rationale;
  const estimateSeconds = estimateRenderSeconds(plan, context);
  if (plan.renderer === 'auto') {
    const candidate = plan.preferredRenderer !== 'threejs' ? plan.preferredRenderer : plan.intent === 'photoreal' ? 'cycles' : 'threejs';
    const ready = availability(candidate, plan, context);
    const withinBudget = candidate === 'threejs' || plan.budgetSeconds === null || (estimateSeconds !== null && estimateSeconds <= plan.budgetSeconds);
    selectedRenderer = ready.available && withinBudget ? candidate : 'threejs';
    if (candidate !== 'threejs' && selectedRenderer === 'threejs') {
      warnings.push(!ready.available ? ready.reason : estimateSeconds === null ? 'Render time has not been measured for this device; Auto keeps the faster renderer within the requested budget.' : 'The Cycles estimate exceeds the requested time budget.');
      reason = 'Auto selected Three.js to preserve the working scene and keep rendering available.';
    } else reason = candidate === 'threejs' ? plan.rationale : `Auto selected ${RENDERER_LABELS[candidate]} for ${plan.intent === 'photoreal' ? 'photoreal 3D' : 'the agent-authored render plan'}.`;
  }
  const status = availability(selectedRenderer, plan, context);
  if (!status.available) warnings.push(status.reason);
  const overridesShots = selectedRenderer !== 'mixed';
  const shots = plan.shots.map(shot => ({...shot, renderer: overridesShots ? selectedRenderer : shot.renderer}));
  const layers = plan.layers.map(layer => ({...layer, renderer: overridesShots ? selectedRenderer : layer.renderer}));
  return {plan, requestedRenderer: plan.renderer, selectedRenderer, previewRenderer: 'threejs', runnable: status.available, availability: status.reason, reason, warnings: [...new Set(warnings)], shots, layers, estimateSeconds: selectedRenderer === 'cycles' ? estimateSeconds : null, estimateNote: selectedRenderer === 'cycles' ? estimateSeconds === null ? 'Time estimate unavailable; render one frame to measure this device.' : 'Approximate estimate from a measured frame; scene complexity and encoding can change the total.' : 'Three.js render time depends on resolution and motion blur samples.'};
}
