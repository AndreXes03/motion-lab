import {createRenderPlan, validateRenderPlan, overrideRenderPlan, resolveRenderPlan, RENDERER_LABELS, RENDERERS} from '../engine/render-policy.js';
import './render-panel.css';

function sceneId(value) { return typeof value === 'string' ? value : value?.id ?? value?.scene; }
function timeLabel(seconds) {
  if (seconds < 60) return `about ${Math.ceil(seconds)} seconds`;
  if (seconds < 3600) return `about ${Math.ceil(seconds / 60)} minutes`;
  return `about ${(seconds / 3600).toFixed(1)} hours`;
}
function field(parent, title, options) {
  const label = document.createElement('label');
  label.className = 'render-policy-field';
  const caption = document.createElement('span');
  caption.textContent = title;
  const select = document.createElement('select');
  select.setAttribute('aria-label', title);
  for (const [value, text] of options) select.append(new Option(text, value));
  label.append(caption, select); parent.append(label);
  return select;
}

/** Export-only renderer controls; live scene preview always stays in Three.js. */
export function mountRenderPanel({container, getScene, getParameters = () => ({}), getExportSettings = () => ({}), publicDemo = false, capabilities = {}, onChange = () => {}}) {
  if (!container?.append || typeof getScene !== 'function') throw new TypeError('Render panel needs a container and scene callback.');
  const scenePlans = new Map();
  let capState = capabilities;
  let activeScene = null;
  let plan = createRenderPlan();
  let destroyed = false;
  const root = document.createElement('section');
  root.className = 'render-policy-panel';
  root.setAttribute('aria-label', 'Final renderer');
  const title = document.createElement('strong'); title.textContent = 'Final renderer'; root.append(title);
  const renderer = field(root, 'Renderer', RENDERERS.map(id => [id, id === 'auto' ? 'Auto · use scene recommendation' : RENDERER_LABELS[id]]));
  const cycleFields = document.createElement('div'); cycleFields.className = 'render-policy-cycles'; root.append(cycleFields);
  const quality = field(cycleFields, 'Render quality', [['draft', 'Draft · fast check'], ['balanced', 'Balanced'], ['final', 'Final · cleaner surfaces']]);
  const sampleLabel = document.createElement('label'); sampleLabel.className = 'render-policy-field';
  const sampleCaption = document.createElement('span'); sampleCaption.textContent = 'Cycles samples';
  const samples = document.createElement('input'); samples.type = 'number'; samples.min = '1'; samples.max = '4096'; samples.step = '1'; samples.inputMode = 'numeric'; samples.setAttribute('aria-label', 'Cycles samples');
  sampleLabel.append(sampleCaption, samples); cycleFields.append(sampleLabel);
  const device = field(cycleFields, 'Render device', [['auto', 'Auto · verified GPU or CPU'], ['gpu', 'GPU · if verified by Blender'], ['cpu', 'CPU']]);
  const workers = field(cycleFields, 'Parallel workers', [['auto', 'Auto · bounded for this computer'], ['1', '1 worker'], ['2', '2 workers']]);
  const denoiseLabel = document.createElement('label'); denoiseLabel.className = 'render-policy-denoise';
  const denoise = document.createElement('input'); denoise.type = 'checkbox'; denoiseLabel.append(denoise, document.createTextNode('Denoise final frames')); cycleFields.append(denoiseLabel);
  const status = document.createElement('p'); status.className = 'render-policy-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const rationale = document.createElement('p'); rationale.className = 'render-policy-note';
  const cost = document.createElement('p'); cost.className = 'render-policy-note';
  const preview = document.createElement('small'); preview.className = 'render-policy-note'; preview.textContent = 'Interactive preview uses Three.js for 3D and Canvas for procedural 2D. The chosen renderer applies to local exports.';
  const adaptation = document.createElement('small'); adaptation.className = 'render-policy-note render-policy-adaptation';
  adaptation.textContent = 'Cycles supports PULSE only. Color contrast and saturation carry over; materials and lighting are adapted. Preview depth of field, fisheye, bloom and ambient occlusion do not carry over.';
  const mixedNote = document.createElement('small'); mixedNote.className = 'render-policy-note render-policy-mixed-note';
  root.append(status, rationale, cost, preview, adaptation, mixedNote); container.append(root);

  function context() {
    return {scene: sceneId(getScene()), publicDemo, capabilities: capState, ...getExportSettings()};
  }
  function selection() { return resolveRenderPlan(plan, context()); }
  function sync() {
    if (destroyed) return;
    const resolved = selection();
    renderer.value = plan.renderer; quality.value = plan.quality; samples.value = String(plan.cycles.samples);
    device.value = plan.cycles.device === 'metal' ? 'gpu' : plan.cycles.device; workers.value = String(plan.cycles.workers); denoise.checked = plan.cycles.denoise;
    const usesCycles = resolved.selectedRenderer === 'cycles' || plan.renderer === 'cycles' || plan.renderer === 'mixed' || plan.preferredRenderer === 'cycles';
    cycleFields.hidden = !usesCycles;
    adaptation.hidden = !usesCycles;
    mixedNote.hidden = !(plan.renderer === 'mixed' || resolved.selectedRenderer === 'mixed' || (plan.renderer === 'auto' && plan.preferredRenderer === 'mixed'));
    mixedNote.textContent = 'Prepared layers keep their rendered content; re-render layers after scene edits. ' + (plan.composite.audioFile ? 'Prepared audio selected. Live Audio changes require a newly prepared soundtrack.' : 'This plan has no prepared soundtrack. Live Audio changes require a newly prepared soundtrack.');
    for (const input of cycleFields.querySelectorAll('input,select')) input.disabled = publicDemo;
    root.dataset.renderer = resolved.selectedRenderer;
    root.dataset.available = String(resolved.runnable);
    status.textContent = `${RENDERER_LABELS[resolved.selectedRenderer]} · ${resolved.runnable ? 'ready locally' : 'local setup required'}`;
    rationale.textContent = [resolved.reason, resolved.availability, ...resolved.warnings.filter(note => note !== resolved.availability)].filter(Boolean).join(' ');
    cost.textContent = resolved.estimateSeconds !== null ? `Estimated render: ${timeLabel(resolved.estimateSeconds)}. ${resolved.estimateNote}` : resolved.estimateNote;
    if (publicDemo) {status.textContent = 'Browser video · Three.js / Canvas'; cost.textContent = 'Cycles and Mixed final renders require the local app. Those renderer choices can be saved in recipes, but are not run on this site.';}
    const mixed = renderer.querySelector('option[value="mixed"]');
    mixed.textContent = plan.composite.enabled && plan.composite.planFile ? 'Mixed · prepared compositing plan' : 'Mixed · requires a compositing plan';
  }
  function changed(next) {
    plan = validateRenderPlan(next); scenePlans.set(activeScene, structuredClone(plan)); sync(); onChange(structuredClone(plan), selection());
  }
  renderer.addEventListener('change', () => changed(overrideRenderPlan(plan, renderer.value)));
  quality.addEventListener('change', () => changed({...plan, source: 'user', quality: quality.value, cycles: {...plan.cycles, samples: {draft: 16, balanced: 64, final: 128}[quality.value]}}));
  samples.addEventListener('change', () => {
    const value = Number(samples.value);
    if (!Number.isInteger(value) || value < 1 || value > 4096) {samples.setCustomValidity('Choose a whole number from 1 to 4096.'); samples.reportValidity(); return;}
    samples.setCustomValidity(''); changed({...plan, source: 'user', cycles: {...plan.cycles, samples: value}});
  });
  device.addEventListener('change', () => changed({...plan, source: 'user', cycles: {...plan.cycles, device: device.value}}));
  workers.addEventListener('change', () => changed({...plan, source: 'user', cycles: {...plan.cycles, workers: workers.value === 'auto' ? 'auto' : Number(workers.value)}}));
  denoise.addEventListener('change', () => changed({...plan, source: 'user', cycles: {...plan.cycles, denoise: denoise.checked}}));

  function refresh() {
    const currentScene = sceneId(getScene());
    if (currentScene !== activeScene) {
      if (activeScene) scenePlans.set(activeScene, structuredClone(plan));
      activeScene = currentScene;
      // getParameters must return the authored recipe, without calling getPlan recursively.
      const authored = getParameters()?.renderPolicy;
      plan = scenePlans.get(currentScene) ?? (authored ? validateRenderPlan(authored) : createRenderPlan());
    }
    sync();
    return selection();
  }
  refresh();
  return {
    getPlan: () => structuredClone(plan),
    getSelection: selection,
    setPlan(next, {notify = false} = {}) {
      activeScene = sceneId(getScene()); plan = validateRenderPlan(next); scenePlans.set(activeScene, structuredClone(plan)); sync();
      if (notify) onChange(structuredClone(plan), selection());
      return structuredClone(plan);
    },
    setCapabilities(next) {capState = next ?? {}; sync(); return selection();},
    refresh,
    destroy() {destroyed = true; root.remove();}
  };
}
