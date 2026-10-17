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
  const heading = document.createElement('header'); heading.className = 'render-policy-heading';
  const title = document.createElement('strong'); title.textContent = 'Final renderer';
  const scope = document.createElement('span'); scope.className = 'render-policy-scope'; scope.textContent = 'Export only';
  heading.append(title, scope); root.append(heading);
  const renderer = field(root, 'Renderer', RENDERERS.map(id => [id, id === 'auto' ? 'Auto · recommended' : RENDERER_LABELS[id]]));
  const cycleFields = document.createElement('div'); cycleFields.className = 'render-policy-cycles'; root.append(cycleFields);
  const quality = field(cycleFields, 'Render quality', [['draft', 'Draft · fast check'], ['balanced', 'Balanced'], ['final', 'Final']]);
  const advanced = document.createElement('details'); advanced.className = 'render-policy-advanced';
  const advancedTitle = document.createElement('summary'); advancedTitle.textContent = 'Advanced render settings'; advanced.append(advancedTitle); cycleFields.append(advanced);
  const sampleLabel = document.createElement('label'); sampleLabel.className = 'render-policy-field';
  const sampleCaption = document.createElement('span'); sampleCaption.textContent = 'Cycles samples';
  const samples = document.createElement('input'); samples.type = 'number'; samples.min = '1'; samples.max = '4096'; samples.step = '1'; samples.inputMode = 'numeric'; samples.setAttribute('aria-label', 'Cycles samples'); samples.title = 'More samples reduce noise and take longer to render.';
  sampleLabel.append(sampleCaption, samples); advanced.append(sampleLabel);
  const device = field(advanced, 'Render device', [['auto', 'Auto · verified GPU or CPU'], ['gpu', 'GPU · if verified by Blender'], ['cpu', 'CPU']]);
  const workers = field(advanced, 'Parallel workers', [['auto', 'Auto · bounded for this computer'], ['1', '1 worker'], ['2', '2 workers']]);
  const denoiseLabel = document.createElement('label'); denoiseLabel.className = 'render-policy-denoise';
  const denoise = document.createElement('input'); denoise.type = 'checkbox'; denoiseLabel.append(denoise, document.createTextNode('Reduce image noise')); advanced.append(denoiseLabel);
  const status = document.createElement('p'); status.className = 'render-policy-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const rationale = document.createElement('p'); rationale.className = 'render-policy-note';
  const cost = document.createElement('p'); cost.className = 'render-policy-note render-policy-cost';
  const preview = document.createElement('small'); preview.className = 'render-policy-note'; preview.textContent = 'This setting affects exports. Preview quality is separate.';
  const adaptation = document.createElement('small'); adaptation.className = 'render-policy-note render-policy-adaptation';
  adaptation.textContent = 'Cycles: PULSE only. Materials and lighting are adapted; contrast and saturation carry over. Depth of field, fisheye, bloom and ambient occlusion do not carry over.';
  const mixedNote = document.createElement('small'); mixedNote.className = 'render-policy-note render-policy-mixed-note';
  const warnings = document.createElement('p'); warnings.className = 'render-policy-note render-policy-warning';
  const details = document.createElement('details'); details.className = 'render-policy-advanced render-policy-details';
  const detailsTitle = document.createElement('summary'); detailsTitle.textContent = 'Renderer details';
  const estimateNote = document.createElement('p'); estimateNote.className = 'render-policy-note';
  details.append(detailsTitle, rationale, estimateNote, preview);
  const outcome = document.createElement('div'); outcome.className = 'render-policy-outcome'; outcome.append(status, warnings, cost);
  root.insertBefore(outcome, cycleFields);
  root.append(adaptation, mixedNote, details); container.append(root);

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
    mixedNote.textContent = 'Re-render prepared layers after scene edits. ' + (plan.composite.audioFile ? 'Prepared audio selected; rebuild it after audio changes.' : 'No prepared soundtrack. Prepare audio to include your current mix.');
    for (const input of cycleFields.querySelectorAll('input,select')) input.disabled = publicDemo;
    root.dataset.renderer = resolved.selectedRenderer;
    root.dataset.available = String(resolved.runnable);
    status.textContent = `${RENDERER_LABELS[resolved.selectedRenderer]} · ${resolved.runnable ? 'ready locally' : 'local setup required'}`;
    rationale.textContent = [resolved.reason, resolved.runnable ? resolved.availability : ''].filter(Boolean).join(' ');
    warnings.textContent = [...new Set([!resolved.runnable && resolved.availability, ...resolved.warnings].filter(Boolean))].join(' ');
    warnings.hidden = !warnings.textContent;
    cost.textContent = resolved.estimateSeconds !== null ? `Estimated render: ${timeLabel(resolved.estimateSeconds)}` : '';
    cost.hidden = !cost.textContent;
    estimateNote.textContent = resolved.estimateNote;
    if (publicDemo) {status.textContent = 'Browser video · Three.js / Canvas';}
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
