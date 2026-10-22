import {createRenderPlan, validateRenderPlan, overrideRenderPlan, resolveRenderPlan, RENDERER_LABELS, RENDERERS} from '../engine/render-policy.js';
import './render-panel.css';
import {mountExportSheet} from './export-panel.js';

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

/** Shared final-render intent for full-resolution Render View and delivered files. */
export function mountRenderPanel({container, getScene, getParameters = () => ({}), getExportSettings = () => ({}), publicDemo = false, capabilities = {}, onChange = () => {}}) {
  if (!container?.append || typeof getScene !== 'function') throw new TypeError('Render panel needs a container and scene callback.');
  const destroyExportSheet = mountExportSheet();
  const scenePlans = new Map();
  let capState = capabilities;
  let activeScene = null;
  let plan = createRenderPlan();
  let destroyed = false;
  let componentState = capabilities.cycles?.component ?? null, componentPending = false, componentTimer;
  const root = document.createElement('section');
  root.className = 'render-policy-panel';
  root.setAttribute('aria-label', 'Final renderer');
  const heading = document.createElement('header'); heading.className = 'render-policy-heading';
  const title = document.createElement('strong'); title.textContent = 'Render engine';
  const scope = document.createElement('span'); scope.className = 'render-policy-scope'; scope.textContent = 'Final look';
  heading.append(title, scope); root.append(heading);
  const renderer = field(root, 'Renderer', RENDERERS.map(id => [id, id === 'auto' ? 'Auto · scene recommendation' : RENDERER_LABELS[id]]));
  const cycleFields = document.createElement('div'); cycleFields.className = 'render-policy-cycles'; root.append(cycleFields);
  const quality = field(cycleFields, 'Render quality', [['draft', 'Draft · 16 samples'], ['balanced', 'Balanced · 64 samples'], ['final', 'Final · 128 samples']]);
  const advanced = document.createElement('details'); advanced.className = 'render-policy-advanced';
  const advancedTitle = document.createElement('summary'); advancedTitle.textContent = 'Sampling & device'; advanced.append(advancedTitle); cycleFields.append(advanced);
  const sampleLabel = document.createElement('label'); sampleLabel.className = 'render-policy-field';
  const sampleCaption = document.createElement('span'); sampleCaption.textContent = 'Cycles samples';
  const samples = document.createElement('input'); samples.type = 'number'; samples.min = '1'; samples.max = '4096'; samples.step = '1'; samples.inputMode = 'numeric'; samples.setAttribute('aria-label', 'Cycles samples'); samples.title = 'More samples reduce noise and take longer to render.';
  sampleLabel.append(sampleCaption, samples); advanced.append(sampleLabel);
  const device = field(advanced, 'Render device', [['auto', 'Auto · verified GPU or CPU'], ['gpu', 'GPU · verified native device'], ['cpu', 'CPU']]);
  const workers = field(advanced, 'Parallel workers', [['auto', 'Auto · bounded for this computer'], ['1', '1 worker'], ['2', '2 workers']]);
  const denoiseLabel = document.createElement('label'); denoiseLabel.className = 'render-policy-denoise';
  const denoise = document.createElement('input'); denoise.type = 'checkbox'; denoiseLabel.append(denoise, document.createTextNode('Denoise')); advanced.append(denoiseLabel);
  const status = document.createElement('p'); status.className = 'render-policy-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const rationale = document.createElement('p'); rationale.className = 'render-policy-note';
  const cost = document.createElement('p'); cost.className = 'render-policy-note render-policy-cost';
  const preview = document.createElement('small'); preview.className = 'render-policy-note'; preview.textContent = 'Final look uses this engine in Render View. Interactive preview stays real time.';
  const adaptation = document.createElement('small'); adaptation.className = 'render-policy-note render-policy-adaptation';
  adaptation.textContent = 'PULSE Cycles adapts materials and lighting. Depth of field, fisheye, bloom and ambient occlusion are not included.';
  const mixedNote = document.createElement('small'); mixedNote.className = 'render-policy-note render-policy-mixed-note';
  const warnings = document.createElement('p'); warnings.className = 'render-policy-note render-policy-warning';
  const details = document.createElement('details'); details.className = 'render-policy-advanced render-policy-details';
  const detailsTitle = document.createElement('summary'); detailsTitle.textContent = 'Engine details';
  const estimateNote = document.createElement('p'); estimateNote.className = 'render-policy-note';
  details.append(detailsTitle, rationale, warnings, estimateNote, preview, adaptation, mixedNote);
  const outcome = document.createElement('div'); outcome.className = 'render-policy-outcome'; outcome.append(status, cost);
  root.insertBefore(outcome, cycleFields);
  const componentDetails = document.createElement('details'); componentDetails.className = 'render-policy-advanced render-policy-component';
  const componentTitle = document.createElement('summary'); componentTitle.textContent = 'Rendering Cycles · optional';
  const componentStatus = document.createElement('p'); componentStatus.className = 'render-policy-note'; componentStatus.setAttribute('role','status');
  const componentProgress = document.createElement('progress'); componentProgress.max = 1; componentProgress.hidden = true; componentProgress.setAttribute('aria-label','Rendering Cycles installation');
  const componentButtons = document.createElement('div'); componentButtons.className = 'render-policy-component-actions';
  const installComponent = document.createElement('button'), updateComponent = document.createElement('button'), authorizeComponent = document.createElement('button'), checkComponent = document.createElement('button'), removeComponent = document.createElement('button');
  for (const [button,label] of [[installComponent,'Download Rendering Cycles'],[updateComponent,'Update Rendering Cycles'],[authorizeComponent,'Authorize in macOS'],[checkComponent,'Check authorization'],[removeComponent,'Remove Rendering Cycles']]) {button.type='button';button.textContent=label;componentButtons.append(button);}
  componentDetails.append(componentTitle,componentStatus,componentProgress,componentButtons);
  root.append(details,componentDetails); container.append(root);
  function syncComponent() {
    const value = componentState ?? {}, busy = componentPending || value.busy;
    componentStatus.textContent = publicDemo ? 'Install the local Framevolve app to manage this optional component. Three.js is included.' : busy ? `Rendering Cycles · ${value.phase || 'preparing'}${value.phase === 'downloading' ? ` ${Math.round((value.progress || 0) * 100)}%` : ''}` : value.reason || (value.compatible ? `Rendering Cycles ${value.installed.version} · installed` : 'Checking optional component…');
    componentProgress.hidden = !busy; componentProgress.value = value.progress || 0;
    installComponent.hidden = !value.canInstall || publicDemo; installComponent.disabled = !value.canInstall || !!busy;
    updateComponent.hidden = !value.canUpdate || publicDemo; updateComponent.disabled = !!busy;
    authorizeComponent.hidden = !value.canAuthorize || publicDemo; authorizeComponent.disabled = !value.canAuthorize || !!busy;
    checkComponent.hidden = !value.canCheck || publicDemo; checkComponent.disabled = !value.canCheck || !!busy;
    removeComponent.hidden = !value.canRemove || publicDemo; removeComponent.disabled = !value.canRemove || !!busy;
  }
  async function refreshComponent() {
    if (destroyed || publicDemo) return;
    try {
      const response = await fetch('/api/studio/components/cycles'); const value = await response.json(); if (!response.ok) throw Error(value.error || 'Optional component status is unavailable.');
      if (destroyed) return; const wasBusy=componentState?.busy; componentState=value.component; syncComponent();
      if(wasBusy&&!componentState.busy){try{const caps=await fetch('/api/studio/capabilities');if(caps.ok){capState=(await caps.json()).capabilities;sync();}}catch{}}
      if (componentState.busy) {clearTimeout(componentTimer);componentTimer=setTimeout(refreshComponent,700);}
    } catch(error) {if (!destroyed) {componentState={reason:error.message};syncComponent();}}
  }
  async function componentAction(action) {
    if (componentPending || componentState?.busy || publicDemo) return;
    componentPending=true;syncComponent();
    try {
      const response=await fetch('/api/studio/components/cycles/' + action,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); const value=await response.json();
      if(!response.ok) throw Error(value.error || 'Rendering Cycles operation failed.');
      componentState=value.component;
      const watch = async () => {
        await refreshComponent();
        if (destroyed) return;
        if (componentState?.busy) return;
        try {const response=await fetch('/api/studio/capabilities');if(response.ok) {capState=(await response.json()).capabilities;sync();}}catch {}
      };
      clearTimeout(componentTimer); componentTimer=setTimeout(watch,750);
    } catch(error) {componentState={...componentState,reason:error.message};}
    finally {componentPending=false;if(!destroyed)syncComponent();}
  }
  installComponent.onclick=()=>componentAction('install'); updateComponent.onclick=()=>componentAction('update'); authorizeComponent.onclick=()=>componentAction('authorize'); checkComponent.onclick=()=>componentAction('check'); removeComponent.onclick=()=>componentAction('remove');
  componentDetails.addEventListener('toggle',()=>{if(componentDetails.open)refreshComponent();});
  syncComponent(); refreshComponent();

  function context() {
    return {scene: sceneId(getScene()), publicDemo, capabilities: capState, ...getExportSettings()};
  }
  function selection(contextOverrides = {}) { return resolveRenderPlan(plan, {...context(), ...contextOverrides}); }
  function sync() {
    if (destroyed) return;
    const standalone=capState.cycles?.backend==='cycles-standalone';
    if(standalone)plan.cycles.workers=1;
    const resolved = selection();
    renderer.value = plan.renderer; quality.value = plan.quality; samples.value = String(plan.cycles.samples);
    workers.closest('label').hidden=standalone;
    device.value = plan.cycles.device === 'metal' ? 'gpu' : plan.cycles.device; workers.value = String(plan.cycles.workers); denoise.checked = plan.cycles.denoise;
    const usesCycles = resolved.selectedRenderer === 'cycles' || plan.renderer === 'cycles' || plan.renderer === 'mixed' || plan.preferredRenderer === 'cycles';
    cycleFields.hidden = !usesCycles;
    adaptation.hidden = !usesCycles;
    adaptation.textContent = 'PULSE Cycles adapts materials and lighting. Depth of field, fisheye, bloom and ambient occlusion are not included.' + (standalone ? ' The standalone engine renders with one worker.' : '');
    mixedNote.hidden = !(plan.renderer === 'mixed' || resolved.selectedRenderer === 'mixed' || (plan.renderer === 'auto' && plan.preferredRenderer === 'mixed'));
    mixedNote.textContent = 'Re-render prepared layers after scene edits. ' + (plan.composite.audioFile ? 'Prepared audio selected; rebuild it after audio changes.' : 'No prepared soundtrack. Prepare audio to include your current mix.');
    for (const input of cycleFields.querySelectorAll('input,select')) input.disabled = publicDemo;
    root.dataset.renderer = resolved.selectedRenderer;
    root.dataset.available = String(resolved.runnable);
    status.textContent = `${RENDERER_LABELS[resolved.selectedRenderer]} · ${resolved.runnable ? 'ready' : 'unavailable'}`;
    scope.textContent = publicDemo ? 'Browser + local' : 'Final look';
    rationale.textContent = [resolved.reason, resolved.runnable ? resolved.availability : ''].filter(Boolean).join(' ');
    warnings.textContent = [...new Set([!resolved.runnable && resolved.availability, ...resolved.warnings].filter(Boolean))].join(' ');
    warnings.hidden = !warnings.textContent;
    cost.textContent = resolved.estimateSeconds !== null ? `Estimated render: ${timeLabel(resolved.estimateSeconds)}` : '';
    cost.hidden = !cost.textContent;
    estimateNote.textContent = resolved.estimateNote;
    if (publicDemo) {
      const nativeEngine = ['cycles', 'mixed'].includes(resolved.selectedRenderer);
      status.textContent = nativeEngine ? `${RENDERER_LABELS[resolved.selectedRenderer]} · local app required` : 'Browser export · ready';
      root.dataset.available = String(!nativeEngine);
      preview.textContent = 'Browser video uses Three.js / Canvas. Native final renders run in the local app.';
    }
    const mixed = renderer.querySelector('option[value="mixed"]');
    mixed.textContent = plan.composite.enabled && plan.composite.planFile ? 'Mixed · prepared' : 'Mixed · local plan required';
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
    setCapabilities(next) {capState = next ?? {}; if(capState.cycles?.component)componentState=capState.cycles.component; syncComponent(); sync(); return selection();},
    refresh,
    destroy() {destroyed = true; clearTimeout(componentTimer); destroyExportSheet(); root.remove();}
  };
}
