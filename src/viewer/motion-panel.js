import './motion-curve-editor.css';
import {moveCurveSelection} from '../engine/curve-interaction.js';
import {sourceCurvePoints, sourceTimingKeys, sampleSourceChannel} from '../engine/motion-curve-preview.js';
import {findAnimationGroupOutputTime} from '../engine/motion-source-seek.js';
import {sceneConfig} from '../scene-registry.js';
import {getControlCatalog, createControlManifest, readControlValue} from '../engine/control-catalog.js';
import {sampleParameterTrack} from '../engine/parameter-animation.js';
import * as animationGroupData from '../engine/animation-groups.js';
import {getInterpolationPresets} from '../engine/control-presets.js';
import {getAuthoredAnimationTracks, editAuthoredKey, editAuthoredKeys} from '../engine/authored-animation.js';

const BEZIER_EQUIVALENTS = {linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3], in: [1 / 3, 0, 2 / 3, 0], out: [1 / 3, 1, 2 / 3, 1]};
const SVG_NS = 'http://www.w3.org/2000/svg';
const GRAPH = {width: 480, height: 240, left: 48, right: 454, top: 22, bottom: 204, labelY: 226};
const {getAnimationGroups} = animationGroupData;
const round = value => Number(Number(value).toFixed(6));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

/** Interactive target curve editor. Mounting and viewing never writes animation state. */
export function mountMotionPanel({container, getScene, getParameters, getAnimation, getTime, getAuthoredTracks, onAuthoredChange, onChange, onSeek}) {
  let scene, selectedControl, selectedTime = null, catalog = [], groups = [], selectedWindow = null, graphEnd = 1, showAllTools = false;
  let nativeTracks = [], selectedNativeTrack, nativePlayhead, nativeAxis;
  let motionView = 'auto', selectedNativeKey = null, nativeGesture = null, nativeSuppressClick = false, nativeSeekMessage = '';
  let nativeViewport = null, nativeViewportKey = '', retimeGesture = null, panGesture = null;
  const isEasy = () => document.body.dataset.experience !== 'pro';
  const retiming = () => isGroup() && (isEasy() || !nativeEditable() || motionView === 'retime' || (motionView === 'auto' && Boolean(currentGroup())));
  let nativeRequest = 0, nativeRequestKey = '', nativeLoading = false;
  const observedWindows = new Map();
  let gesture = null, suppressClick = false, previewBezier = null;
  let playhead, graphGeometry = GRAPH;
  let selectedTimes = new Set(), selectedNativeKeys = new Set(), selectedRetimeKeys = new Set(), surfaceGesture = null;
  const additive = event => event.shiftKey || event.metaKey || event.ctrlKey;
  const selectIndex = (set, index, event = {}) => {
    if (additive(event)) { if (set.has(index)) set.delete(index); else set.add(index); }
    else if (!set.has(index)) { set.clear(); set.add(index); }
  };
  const resetSelection = () => { selectedTimes.clear(); selectedNativeKeys.clear(); selectedRetimeKeys.clear(); };
  const snapStep = () => snap.input.checked ? 1 / sceneConfig(getScene()).fps : 0;

  const state = () => {
    const raw = getAnimation?.();
    return {version: 1, enabled: raw?.enabled ?? true, rate: raw?.rate ?? 1, tracks: structuredClone(raw?.tracks ?? {}), rates: structuredClone(raw?.rates ?? {}), groups: structuredClone(raw?.groups ?? {})};
  };
  const isGroup = () => selectedControl?.startsWith('group:');
  const groupId = () => selectedControl?.slice(6);
  const groupDefinition = () => groups.find(g => g.id === groupId());
  const clip = () => {
    const def = groupDefinition();
    if (!def) return {start: 0, end: duration()};
    if (selectedWindow) return selectedWindow;
    const existing = getAnimation?.()?.groups?.[def.id];
    if (existing) return {start: existing.start, end: existing.end};
    const preferred = def.preferredWindow;
    if (preferred && outputTime() < preferred.start) return preferred;
    return def.windows.find(w => outputTime() >= w.start && outputTime() < w.end) ?? def.windows[0];
  };
  const currentGroup = (animation = getAnimation?.()) => {
    const stored = animation?.groups?.[groupId()], window = clip();
    return stored && stored.start === window.start && stored.end === window.end ? stored : undefined;
  };
  const targetRate = (animation = getAnimation?.()) => isGroup() ? currentGroup(animation)?.rate ?? 1 : animation?.rates?.[selectedControl] ?? animation?.rate ?? 1;
  const identityKeys = () => [{t: 0, value: 0, ease: 'linear'}, {t: limit(), value: 1, ease: 'linear'}];
  const keys = () => structuredClone(isGroup() ? currentGroup()?.keys ?? identityKeys() : getAnimation?.()?.tracks?.[selectedControl] ?? []).sort((a, b) => a.t - b.t);
  const definition = () => isGroup() ? {...groupDefinition(), min: 0, max: 1, step: .01} : catalog.find(d => d.id === selectedControl);
  const duration = () => sceneConfig(getScene()).duration;
  const outputTime = () => Number(getTime?.() ?? 0);
  const limit = () => isGroup() ? clip().end - clip().start : duration();
  const sourceTime = () => clamp(round(clamp((outputTime() - (isGroup() ? clip().start : 0)) * targetRate(), 0, limit())), 0, limit());
  const seekTime = local => {
    if (!isGroup()) return local / targetRate();
    const window = clip();
    return clamp(window.start + local / targetRate(), window.start, Math.max(window.start, window.end - 1e-6));
  };
  const seedGroup = (animation, rate = targetRate()) => {
    const window = clip();
    animation.groups[groupId()] = {start: window.start, end: window.end, rate, keys: [{t: 0, value: 0, ease: 'linear'}, {t: window.end - window.start, value: 1, ease: 'linear'}]};
  };
  const write = mutate => {
    const animation = state();
    mutate(animation);
    try { onChange(animation); sync(); return true; }
    catch (failure) { error.textContent = failure.message ?? 'Could not update this animation.'; return false; }
  };
  const button = (text, fn, id) => {
    const node = el('button', '', text);
    node.type = 'button';
    if (id) node.id = id;
    node.onclick = fn;
    return node;
  };
  const field = (labelText, id, type = 'number') => {
    const wrap = el('div', 'control');
    const label = el('label', '', labelText);
    label.htmlFor = id;
    const input = document.createElement('input');
    input.id = id; input.type = type;
    wrap.append(label, input);
    return {wrap, input};
  };
  const root = el('section', 'motion-panel'); root.classList.add('motion-interactive');
  const intro = el('p', 'context-note motion-scope-note', 'Shape one target inside its shot. Film duration, cuts and other targets stay in sync.');
  const contextHeader = el('div', 'motion-context-heading');
  const contextTitle = el('h3', '', 'Target & shot');
  const timingState = el('span', 'motion-state'); timingState.id = 'motion-timing-state';
  contextHeader.append(contextTitle, timingState);
  const enable = field('Enable animation overrides', 'motion-enabled', 'checkbox');
  const rateField = field('Selected target rate', 'motion-rate');
  Object.assign(rateField.input, {min: '.25', max: '2.5', step: '.05'});
  const rateHelp = el('small', '', '0.25–2.5× · changes only this selected target inside its clip. Film playback and the other targets keep their timing.');
  rateField.wrap.append(rateHelp);
  enable.input.onchange = () => write(a => { a.enabled = enable.input.checked; });
  rateField.input.onchange = () => {
    const n = Number(rateField.input.value);
    if (rateField.input.value === '' || !Number.isFinite(n)) { rateField.input.value = String(targetRate()); return; }
    const rate = round(clamp(n, .25, 2.5));
    rateField.input.value = String(rate);
    write(a => {
      if (isGroup()) { if (!currentGroup(a)) seedGroup(a, rate); else a.groups[groupId()].rate = rate; }
      else { if (!a.tracks[selectedControl]?.length) a.tracks[selectedControl] = [{t: sourceTime(), value: readControlValue(definition(), getParameters()), ease: 'smooth'}]; a.rates[selectedControl] = rate; }
    });
  };
  const choose = field('Target', 'motion-control', 'text');
  const controlSelect = document.createElement('select');
  controlSelect.id = 'motion-control';
  choose.input.replaceWith(controlSelect);
  controlSelect.onchange = () => { selectedControl = controlSelect.value; motionView = 'auto'; resetSelection(); selectedTime = null; selectedWindow = null; previewBezier = null; nativeSeekMessage = ''; sync(); };
  const allTools = field('Show parameter tracks', 'motion-show-all-tools', 'checkbox');
  allTools.wrap.title = 'Show individual numeric parameter tracks. Existing animated tracks remain available. This preference is not saved.';
  allTools.input.onchange = () => { showAllTools = allTools.input.checked; sync(); };
  const windowField = field('Shot', 'motion-window', 'text');
  const windowSelect = document.createElement('select'); windowSelect.id = 'motion-window'; windowField.input.replaceWith(windowSelect);
  windowSelect.onchange = () => {
    const window = groupDefinition()?.windows[Number(windowSelect.value)];
    if (window) { selectedWindow = {...window}; motionView = 'auto'; resetSelection(); selectedTime = null; previewBezier = null; nativeSeekMessage = ''; sync(); }
  };
  const windowHelp = el('small', '', 'One motion clip per target. Choosing a shot only changes the view; creating its curve replaces that target’s previous clip.');
  windowHelp.hidden = true; windowField.wrap.append(windowHelp);
  const createCurve = button('Reset', () => { selectedTime = null; write(a => seedGroup(a, 1)); }, 'motion-create-curve');
  createCurve.title = 'Reset this target to original timing'; createCurve.setAttribute('aria-label', createCurve.title);
  const nativeDetails = el('details', 'motion-details motion-source-panel'); nativeDetails.id = 'motion-native-details';
  nativeDetails.open = true; nativeDetails.title = 'Original source movement'; nativeDetails.append(el('summary', '', 'Original movement · read only'));
  const nativeSection = el('section', 'context-section motion-native-section');
  nativeSection.id = 'motion-native-section';
  nativeSection.append(el('h3', '', 'Authored movement'));
  const nativeField = field('Channel', 'motion-native-track', 'text');
  const nativeSelect = document.createElement('select'); nativeSelect.id = 'motion-native-track'; nativeField.input.replaceWith(nativeSelect);
  const nativeStatus = el('p', 'context-note'); nativeStatus.id = 'motion-native-status';
  const nativeGraph = svgEl('svg', {id: 'motion-native-graph', viewBox: `0 0 ${GRAPH.width} ${GRAPH.height}`, role: 'group', tabindex: 0, 'aria-label': 'Original source movement in scene seconds'});
  nativeGraph.classList.add('motion-curve'); nativeGraph.style.width = '100%'; nativeGraph.style.height = 'auto'; nativeGraph.style.display = 'block';
  const nativeList = el('div', 'motion-key-list'); nativeList.id = 'motion-native-keys';
  nativeSelect.onchange = () => { selectedNativeTrack = nativeSelect.value; selectedNativeKeys.clear(); selectedRetimeKeys.clear(); selectedNativeKey = null; nativeSeekMessage = ''; drawNativeGraph(); updateTime(); };
  const nativeRefresh = button('Refresh', () => { nativeRequestKey = ''; requestNativeTracks(); }, 'motion-native-refresh');
  const nativeEditor = el('section', 'motion-native-editor');
  const nativeTime = field('Time (s)', 'motion-source-time');
  const nativeValue = field('Value', 'motion-source-value');
  nativeTime.input.step = '.001'; nativeValue.input.step = '.001';
  const nativeEaseField = field('Easing', 'motion-source-ease', 'text');
  const nativeEase = document.createElement('select'); nativeEase.id = 'motion-source-ease'; nativeEaseField.input.replaceWith(nativeEase);
  for (const [value, label] of [['smooth', 'Smooth'], ['linear', 'Linear'], ['hold', 'Hold'], ['in', 'Ease in'], ['out', 'Ease out'], ['inOut', 'Ease in / out'], ['bezier', 'Bézier']]) { const option = el('option', '', label); option.value = value; nativeEase.append(option); }
  const nativeHandleRow = el('div', 'motion-source-handles');
  const nativeHandles = ['X1', 'Y1', 'X2', 'Y2'].map((label, index) => { const item = field(label, 'motion-source-bezier-' + index); Object.assign(item.input, {min: '0', max: '1', step: '.01'}); nativeHandleRow.append(item.wrap); return item.input; });
  nativeEase.onchange = () => { nativeHandleRow.hidden = nativeEase.value !== 'bezier'; };
  const nativeError = el('p', 'context-note'); nativeError.setAttribute('role', 'status');
  const nativeSave = button('Update key', () => {
    if (nativeTime.input.value === '' || nativeValue.input.value === '') { nativeError.textContent = 'Enter time and value.'; return; }
    const patch = {t: Number(nativeTime.input.value), value: Number(nativeValue.input.value), ease: nativeEase.value};
    if (patch.ease === 'bezier') { if (nativeHandles.some(input => input.value === '')) { nativeError.textContent = 'Enter all four Bézier values.'; return; } patch.bezier = nativeHandles.map(input => Number(input.value)); }
    applyNativeEdit(patch);
  }, 'motion-source-save');
  const nativeValues = el('div', 'motion-fine-row'); nativeValues.append(nativeTime.wrap, nativeValue.wrap, nativeSave);
  const nativeShared = el('small', 'motion-source-shared');
  nativeEditor.append(nativeValues, nativeEaseField.wrap, nativeHandleRow, nativeShared, nativeError);
  const curveTools = el('div', 'motion-curve-tools');
  const fitCurve = button('Fit', () => { nativeViewport = null; drawNativeGraph(); updateTime(); }, 'motion-curve-fit');
  const zoomOut = button('−', () => navigateCurve(1.5), 'motion-curve-zoom-out'); zoomOut.setAttribute('aria-label', 'Zoom out curve');
  const zoomIn = button('+', () => navigateCurve(1 / 1.5), 'motion-curve-zoom-in'); zoomIn.setAttribute('aria-label', 'Zoom in curve');
  const panLeft = button('←', () => navigateCurve(1, -.25), 'motion-curve-pan-left'); panLeft.setAttribute('aria-label', 'Pan curve left');
  const panRight = button('→', () => navigateCurve(1, .25), 'motion-curve-pan-right'); panRight.setAttribute('aria-label', 'Pan curve right');
  const curveHelp = el('span', '', 'Scroll to pan · pinch to zoom');
  curveTools.append(curveHelp, panLeft, panRight, zoomOut, zoomIn, fitCurve);
  const easyTemplates = el('section', 'motion-easy-templates'); easyTemplates.setAttribute('aria-label', 'Motion templates');
  const retimeReset = button('Original timing', () => write(a => { delete a.groups[groupId()]; }), 'motion-source-reset-timing');
  const selectionTools = el('div', 'motion-selection-tools');
  const selectionCount = el('span', '', ''); selectionCount.id = 'motion-selection-count'; selectionCount.setAttribute('aria-live', 'polite');
  const selectAllKeys = button('Select all', () => selectAllVisible(), 'motion-select-all');
  const snap = field('Snap to frames', 'motion-snap', 'checkbox'); snap.input.checked = true;
  selectionTools.append(selectionCount, selectAllKeys, snap.wrap);
  const interactionHelp = el('small', 'motion-interaction-help', 'Drag background to scrub · Shift-click to select · Shift-drag to box select · Alt-drag to pan · Esc to cancel');
  nativeSection.append(nativeField.wrap, curveTools, nativeGraph, nativeStatus, easyTemplates, retimeReset, nativeList, nativeEditor, nativeRefresh);
  const editModeField = field('Curve editing', 'motion-edit-mode', 'text');
  const editMode = document.createElement('select'); editMode.id = 'motion-edit-mode'; editModeField.input.replaceWith(editMode);
  for (const [value, label] of [['original', 'Edit source keys'], ['retime', 'Edit timing']]) { const option = el('option', '', label); option.value = value; editMode.append(option); }
  editMode.onchange = () => { motionView = editMode.value; drawNativeGraph(); updateTime(); };
  const timingHeading = el('h3', '', 'Timing curve'); timingHeading.id = 'motion-timing-title';
  const graphSection = el('section', 'motion-graph-section');
  graphSection.setAttribute('aria-labelledby', timingHeading.id);
  const graphHeader = el('div', 'motion-graph-header');
  const curveType = el('span', 'motion-curve-type', 'Progress / time');
  graphHeader.append(timingHeading, curveType);
  const summary = el('p', 'context-note motion-clock');
  const graph = svgEl('svg', {id: 'motion-timing-graph', tabindex: 0, viewBox: `0 0 ${GRAPH.width} ${GRAPH.height}`, role: 'group', 'aria-label': 'Selected control animation curve. Horizontal axis is source time in seconds.'});
  graph.classList.add('motion-curve');
  graph.style.width = '100%'; graph.style.height = 'auto'; graph.style.display = 'block';
  const graphHint = el('small', 'motion-graph-hint', 'Drag points or handles · double-click to add a key');
  const transport = el('div', 'motion-actions');
  const previous = button('←', () => navigate(-1), 'motion-prev-key');
  const next = button('→', () => navigate(1), 'motion-next-key');
  previous.title = 'Previous key (←)'; previous.setAttribute('aria-label', previous.title);
  next.title = 'Next key (→)'; next.setAttribute('aria-label', next.title);
  transport.append(previous, next);
  const newKey = button('New key at playhead', () => { selectedTime = null; advanced.open = true; loadEditor(); timeField.input.focus(); }, 'motion-new-key');
  const quickAdd = button('Add key', () => addAt(sourceTime()), 'motion-add-key');
  const smoothKey = button('Bézier', () => convertSelected('bezier'), 'motion-smooth-key');
  const linearKey = button('Linear', () => convertSelected('linear'), 'motion-linear-key');
  for (const [control, title] of [[quickAdd, 'Add key at playhead'], [smoothKey, 'Show Bézier handles · drag to edit the selected segment'], [linearKey, 'Set selected segment to linear']]) { control.title = title; control.setAttribute('aria-label', title); }
  const quickActions = el('div', 'motion-actions motion-quick-actions'); quickActions.append(quickAdd, smoothKey, linearKey, createCurve);
  const selectedLabel = el('p', 'motion-selection'); selectedLabel.setAttribute('aria-live', 'polite'); transport.replaceChildren(previous, selectedLabel, next);
  const advanced = el('details', 'motion-details'); advanced.id = 'motion-advanced'; advanced.title = 'Numeric keyframe settings, rates and parameter tracks'; advanced.append(el('summary', '', 'Track options & precision'));
  const empty = el('p', 'context-note motion-empty');
  const keyList = el('div', 'motion-key-list');
  keyList.setAttribute('aria-label', 'Keyframes');
  const editor = el('section', 'context-section motion-key-editor');
  const editorTitle = el('h3', '', 'Add key');
  const timeField = field('Key time · source seconds', 'motion-key-time');
  Object.assign(timeField.input, {min: '0', step: '.001'});
  const valueField = field('Key value', 'motion-key-value');
  const easingField = field('Outgoing easing', 'motion-key-ease', 'text');
  const easing = document.createElement('select');
  easing.id = 'motion-key-ease';
  easingField.input.replaceWith(easing);
  for (const [value, label] of [['smooth', 'Smooth'], ['linear', 'Linear'], ['hold', 'Hold'], ['in', 'Ease in'], ['out', 'Ease out'], ['inOut', 'Ease in / out'], ['bezier', 'Custom Bézier']]) {
    const option = el('option', '', label); option.value = value; easing.append(option);
  }
  const presetField = field('Easing preset', 'motion-easing-preset', 'text');
  const easingPreset = document.createElement('select'); easingPreset.id = 'motion-easing-preset'; presetField.input.replaceWith(easingPreset);
  presetField.wrap.title = 'Agent-selected curves for this scene. Apply easing commits the selected key; choosing a suggestion alone does not change the film.';
  const handles = el('div', 'motion-bezier');
  const handleInputs = ['X1', 'Y1', 'X2', 'Y2'].map((label, i) => {
    const f = field(label, 'motion-bezier-' + i);
    Object.assign(f.input, {min: '0', max: '1', step: '.01'});
    handles.append(f.wrap); return f.input;
  });
  handles.style.display = 'grid'; handles.style.gridTemplateColumns = '1fr 1fr'; handles.style.gap = '8px';
  const showHandles = () => { handles.hidden = easing.value !== 'bezier'; handles.style.display = handles.hidden ? 'none' : 'grid'; };
  easing.onchange = () => { easingPreset.value = ''; showHandles(); };
  handleInputs.forEach(input => { input.oninput = () => { easingPreset.value = ''; }; });
  easingPreset.onchange = () => {
    const preset = getInterpolationPresets(getScene()).find(p => p.id === easingPreset.value);
    if (!preset) return;
    easing.value = preset.ease;
    (preset.bezier ?? [.25, .1, .25, 1]).forEach((v, i) => { handleInputs[i].value = String(v); });
    showHandles();
  };
  const keyOutput = el('small');
  timeField.input.oninput = () => {
    const n = Number(timeField.input.value);
    keyOutput.textContent = Number.isFinite(n) ? `Output time: ${seekTime(n).toFixed(3)} s` : '';
  };
  const error = el('p', 'context-note'); error.setAttribute('role', 'status');
  const saveKey = button('Add key', save, 'motion-save-key');
  const removeKey = button('Remove key', remove, 'motion-remove-key');
  const deleteTrack = button('Delete curve', () => { selectedTime = null; write(a => { if (isGroup()) delete a.groups[groupId()]; else { delete a.tracks[selectedControl]; delete a.rates[selectedControl]; } }); }, 'motion-delete-track');
  const actions = el('div', 'motion-actions'); actions.append(removeKey, deleteTrack);
  const fineRow = el('div', 'motion-fine-row'); fineRow.append(timeField.wrap, valueField.wrap, saveKey);
  const targetRow = el('div', 'motion-target-row'); targetRow.append(choose.wrap, windowField.wrap);
  const applyEasing = button('Apply', save, 'motion-apply-easing');
  applyEasing.title = 'Apply easing to selected key'; applyEasing.setAttribute('aria-label', applyEasing.title);
  const presetRow = el('div', 'motion-preset-row'); presetRow.append(presetField.wrap, applyEasing);
  const keySection = el('section', 'motion-selected-key');
  const keyHeading = el('h3', '', 'Selected key');
  keySection.append(keyHeading, fineRow, presetRow, error);
  editor.append(editorTitle, keyOutput, easingField.wrap, handles, actions);
  advanced.append(editModeField.wrap, newKey, rateField.wrap, editor, enable.wrap);
  allTools.wrap.classList.add('motion-parameter-toggle'); nativeDetails.append(nativeSection);
  graphSection.append(graphHeader, graph, summary, transport, quickActions, graphHint, keyList, empty);
  root.append(contextHeader, targetRow, intro, selectionTools, interactionHelp, nativeDetails, graphSection, keySection, advanced, allTools.wrap);
  container.replaceChildren(root);

  function navigate(direction) {
    const list = keys(), t = selectedTime ?? sourceTime();
    const key = direction < 0 ? [...list].reverse().find(k => k.t < t - 1e-6) : list.find(k => k.t > t + 1e-6);
    if (key) selectKey(key);
  }
  function selectKey(key, event = {}) {
    selectIndex(selectedTimes, key.t, event); selectedTime = key.t;
    onSeek(seekTime(key.t));
    sync();
  }
  function loadEditor() {
    const def = definition(), list = keys(), key = list.find(k => k.t === selectedTime);
    keyHeading.textContent = key ? 'Selected key' : 'Add a key';
    if (!def) return;
    if (selectedTime !== null && !key) selectedTime = null;
    editorTitle.textContent = key ? 'Edit selected key' : 'Add key';
    saveKey.textContent = key ? 'Update' : 'Add'; saveKey.title = key ? 'Update key' : 'Add key'; saveKey.setAttribute('aria-label', saveKey.title);
    const t = key?.t ?? sourceTime();
    timeField.input.max = String(limit());
    timeField.wrap.querySelector('label').textContent = 'Time (s)'; timeField.input.title = isGroup() ? 'Key time in local clip seconds' : 'Key time in parameter source seconds';
    valueField.wrap.querySelector('label').textContent = isGroup() ? 'Progress (0–1)' : 'Value';
    const sampled = list.length ? sampleParameterTrack(list, t) : isGroup() ? t / limit() : readControlValue(def, getParameters());
    const value = key?.value ?? (typeof sampled === 'number' ? sampled : def.default);
    const set = (input, v) => { if (document.activeElement !== input) input.value = String(v); };
    set(timeField.input, t); set(valueField.input, value);
    Object.assign(valueField.input, {min: String(def.min), max: String(def.max), step: String(def.step ?? .01)});
    set(easing, key?.ease ?? (isGroup() ? 'linear' : 'smooth'));
    easingPreset.value = ''; easingPreset.disabled = Boolean(key && key.t === list.at(-1).t);
    (key?.bezier ?? [.25, .1, .25, 1]).forEach((v, i) => set(handleInputs[i], v));
    handles.hidden = easing.value !== 'bezier'; handles.style.display = handles.hidden ? 'none' : 'grid';
    keyOutput.textContent = `Output time: ${seekTime(Number(timeField.input.value)).toFixed(3)} s`;
    removeKey.disabled = !key || (isGroup() && !currentGroup()); deleteTrack.disabled = isGroup() ? !currentGroup() : !list.length;
    error.textContent = '';
  }
  function save() {
    const def = definition(), t = Number(timeField.input.value), rawValue = Number(valueField.input.value);
    if (!def || timeField.input.value === '' || valueField.input.value === '' || !Number.isFinite(t) || !Number.isFinite(rawValue) || t < 0 || t > limit()) {
      error.textContent = `Enter a finite value and a key time between 0 and ${limit()} s.`; return;
    }
    const value = round(clamp(rawValue, def.min, def.max));
    const key = {t: Math.min(round(t), limit()), value, ease: easing.value};
    if (key.ease === 'bezier') {
      if (handleInputs.some(input => input.value === '' || !Number.isFinite(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > 1)) {
        error.textContent = 'Bézier handles must be numbers between 0 and 1.'; return;
      }
      key.bezier = handleInputs.map(input => Number(input.value));
    }
    const oldTime = selectedTime;
    if ((!isGroup() || currentGroup()) && keys().some(k => k.t !== oldTime && Math.abs(k.t - key.t) <= 1e-6)) {
      error.textContent = 'A key already uses that time. Select it to edit, or choose a different time.'; return;
    }
    selectedTimes = new Set([key.t]); selectedTime = key.t;
    const saved = write(a => {
      if (isGroup() && !currentGroup(a)) seedGroup(a);
      const source = isGroup() ? a.groups[groupId()].keys : a.tracks[selectedControl] ?? [];
      const list = [...source].filter(k => k.t !== oldTime && Math.abs(k.t - key.t) > 1e-6);
      list.push(key); list.sort((a, b) => a.t - b.t);
      if (isGroup()) a.groups[groupId()].keys = list;
      else a.tracks[selectedControl] = list;
    });
    if (!saved) selectedTime = oldTime;
  }
  function remove() {
    if (selectedTime === null || (isGroup() && !currentGroup())) return;
    const removed = selectedTimes.size ? new Set(selectedTimes) : new Set([selectedTime]); selectedTime = null; selectedTimes.clear();
    write(a => {
      if (isGroup()) {
        const list = (a.groups[groupId()]?.keys ?? []).filter(k => !removed.has(k.t));
        if (list.length) a.groups[groupId()].keys = list; else delete a.groups[groupId()];
      } else {
        const list = (a.tracks[selectedControl] ?? []).filter(k => !removed.has(k.t));
        if (list.length) a.tracks[selectedControl] = list; else { delete a.tracks[selectedControl]; delete a.rates[selectedControl]; }
      }
    });
  }
  function nativeTrack() { return nativeTracks.find(item => item.id === selectedNativeTrack); }
  function nativeEditable(track = nativeTrack()) { return Boolean(track?.editable && track.source === 'keys' && onAuthoredChange); }
  function syncMotionView() {
    const group = isGroup(), original = group && !retiming();
    root.dataset.motionView = original ? 'original' : 'retime';
    root.dataset.experience = isEasy() ? 'easy' : 'pro';
    editModeField.wrap.hidden = !group || !nativeEditable() || isEasy(); editMode.value = original ? 'original' : 'retime'; nativeDetails.hidden = !group; nativeDetails.open = true;
    // The source curve remains the main editing surface. The low-level clock
    // map is available only in Pro precision controls.
    graphSection.hidden = original; keySection.hidden = original; advanced.hidden = isEasy();
    for (const item of [newKey, rateField.wrap, editor, enable.wrap]) item.hidden = original;
    if (group) { editModeField.wrap.after(graphSection, keySection); }
    else { root.insertBefore(graphSection, advanced); root.insertBefore(keySection, advanced); }
    curveTools.hidden = isEasy(); easyTemplates.hidden = !group || !isEasy();
    retimeReset.hidden = !group || !retiming(); retimeReset.disabled = !currentGroup();
    nativeEditor.hidden = !original || !nativeEditable() || selectedNativeKey === null;
    nativeList.hidden = isEasy() || retiming() || nativeTrack()?.source === 'samples';
    nativeRefresh.hidden = isEasy() || nativeEditable();
    allTools.wrap.hidden = isEasy();
    const edited = Boolean(group ? currentGroup() : getAnimation?.()?.tracks?.[selectedControl]?.length);
    timingState.textContent = nativeLoading ? 'Loading' : getAnimation?.()?.enabled === false ? 'Overrides off' : retiming() ? nativeTrack()?.source === 'samples' ? 'Sampled timing' : edited ? 'Timing' : 'Source motion' : 'Source keys';
    timingState.dataset.edited = String(edited); intro.hidden = intro.dataset.warning !== 'true';
    timingHeading.textContent = group ? 'Clock mapping' : 'Parameter curve';
  }
  function navigateCurve(scale = 1, shift = 0, anchor = .5) {
    if (!nativeAxis) return;
    const full = clip(), old = nativeAxis.end - nativeAxis.start;
    const span = clamp(old * scale, (full.end - full.start) / 64, full.end - full.start);
    const start = clamp(nativeAxis.start + old * anchor - span * anchor + old * shift, full.start, full.end - span);
    nativeViewport = {start, end: start + span}; drawNativeGraph(); updateTime();
  }
  function timingKeys() { return structuredClone(currentGroup()?.keys ?? sourceTimingKeys(nativeTrack(), clip())); }
  function drawTemplates() {
    easyTemplates.replaceChildren();
    const track = nativeTrack(); if (!track || !isGroup()) return;
    const profiles = [{id:'original', label:'Original'}, ...getInterpolationPresets(getScene()).filter(p => p.ease !== 'linear')];
    for (const profile of profiles) {
      const a = state(); a.enabled = true;
      if (profile.id === 'original') delete a.groups[groupId()];
      else {
        seedGroup(a, 1);
        a.groups[groupId()].keys[0] = {...a.groups[groupId()].keys[0], ease: profile.ease, ...(profile.bezier ? {bezier: [...profile.bezier]} : {})};
      }
      const card = button('', () => { motionView = 'retime'; onChange(a); sync(); }, 'motion-template-' + profile.id);
      card.className = 'motion-template'; card.setAttribute('aria-label', profile.label + ' motion template');
      const proposed = a.groups[groupId()], current = currentGroup();
      card.setAttribute('aria-pressed', String(JSON.stringify(proposed ?? null) === JSON.stringify(current ?? null)));
      const points = sourceCurvePoints(track, {...clip(), animation:a, groupId:groupId(), count:48});
      const lo = Math.min(...points.map(p=>p.value)), hi = Math.max(...points.map(p=>p.value)), span = Math.max(hi-lo,.001);
      const mini = svgEl('svg', {viewBox:'0 0 112 44', 'aria-hidden':'true'});
      mini.append(svgEl('polyline',{points:points.map((p,i)=>`${4+i/48*104},${38-(p.value-lo)/span*30}`).join(' '), fill:'none',stroke:'currentColor','stroke-width':2}));
      card.append(mini, el('span','',profile.label)); easyTemplates.append(card);
    }
  }
  function loadNativeEditor() {
    const track = nativeTrack(), key = track?.keys?.[selectedNativeKey];
    nativeEditor.hidden = !nativeEditable(track) || !key;
    if (nativeEditor.hidden) return;
    const set = (input, value) => { if (document.activeElement !== input) input.value = String(value); };
    set(nativeTime.input, key.t); set(nativeValue.input, key.value);
    nativeTime.input.min = String(selectedNativeKey > 0 ? track.keys[selectedNativeKey - 1].t + .000001 : 0);
    nativeTime.input.max = String(selectedNativeKey < track.keys.length - 1 ? track.keys[selectedNativeKey + 1].t - .000001 : duration());
    nativeValue.wrap.querySelector('label').textContent = track.unit ? `Value (${track.unit})` : 'Value';
    set(nativeEase, key.ease ?? 'smooth');
    nativeEase.disabled = selectedNativeKey === track.keys.length - 1;
    const bezier = key.bezier ?? [.42, 0, .58, 1]; nativeHandles.forEach((input, index) => set(input, bezier[index]));
    nativeHandleRow.hidden = nativeEase.value !== 'bezier' || nativeEase.disabled;
    nativeShared.textContent = track.sharedTiming ? 'Time and easing are shared across X / Y / Z.' : '';
    nativeShared.hidden = !track.sharedTiming;
  }
  function seekNativeSource(sourceTime) {
    const window = clip(), config = sceneConfig(getScene());
    const lastFrameTime = (Math.round(config.duration * config.fps) - 1) / config.fps;
    const end = Math.min(window.end - 1e-8, lastFrameTime);
    const time = end < window.start ? null : findAnimationGroupOutputTime({animation: getAnimation?.()}, groupId(), sourceTime, {start: window.start, end, referenceTime: outputTime()});
    nativeSeekMessage = time === null ? 'Source time is not reached in this shot.' : '';
    if (time !== null) onSeek(time);
    else nativeStatus.textContent = nativeSeekMessage;
    return time;
  }
  function selectNativeKey(index, seek = true, event = {}) {
    selectIndex(selectedNativeKeys, index, event); selectedNativeKey = index; nativeError.textContent = '';
    if (seek) seekNativeSource(nativeTrack().keys[index].t);
    drawNativeGraph(); updateTime();
  }
  function refreshNativeSource(motion) {
    nativeTracks = getAuthoredAnimationTracks(getScene(), groupId(), {motion});
    nativeLoading = false; nativeSection.dataset.loading = 'false';
    nativeSelect.disabled = !nativeTracks.length;
    drawNativeGraph(); updateTime(); syncMotionView();
  }
  function applyNativeEdit(patch, options = {}, originalMotion) {
    const track = nativeTrack();
    if (!nativeEditable(track) || selectedNativeKey === null) return false;
    try {
      const next = editAuthoredKey(getScene(), groupId(), selectedNativeTrack, selectedNativeKey, patch, {motion: originalMotion ?? getParameters().motion});
      // An edit invalidates pending sampled inspection. Source keys redraw locally,
      // with exactly the renderer's easing, without waiting for another capture.
      ++nativeRequest; nativeRequestKey = '';
      onAuthoredChange(next, options); refreshNativeSource(next); nativeError.textContent = '';
      return next;
    } catch (failure) { nativeError.textContent = failure.message ?? 'Could not update source key.'; return false; }
  }
  function drawNativeGraph() {
    nativeGraph.replaceChildren(); nativeList.replaceChildren(); nativePlayhead = undefined; nativeAxis = undefined;
    const track = nativeTrack();
    nativeGraph.hidden = !track; nativeList.hidden = !track; nativeRefresh.hidden = nativeEditable(track);
    if (!track) { nativeStatus.textContent = nativeLoading ? 'Reading motion…' : 'No source channel available for this target.'; nativeEditor.hidden = true; syncMotionView(); return; }
    const valid = points => (points ?? []).filter(key => Number.isFinite(key.t) && Number.isFinite(key.value)).sort((a, b) => a.t - b.t);
    const knots = valid(track.keys), isSampled = track.source === 'samples';
    if (!knots.length) { nativeStatus.textContent = 'No motion data available.'; nativeEditor.hidden = true; return; }
    const window = clip(), viewKey = `${getScene()}:${groupId()}:${selectedNativeTrack}:${window.start}:${window.end}`;
    if (viewKey !== nativeViewportKey) { nativeViewport = null; nativeViewportKey = viewKey; }
    const {start, end} = !isEasy() && nativeViewport ? nativeViewport : window;
    const originalPoints = sourceCurvePoints(track, {start, end, count:256});
    const points = retiming() ? sourceCurvePoints(track, {start, end, animation:getAnimation?.(), groupId:groupId(), count:256}) : originalPoints;
    if (!points.length) { nativeStatus.textContent = 'No samples in this shot.'; nativeEditor.hidden = true; return; }
    const values = [...points, ...originalPoints].map(key => key.value), low = Math.min(...values), high = Math.max(...values), span = Math.max(high - low, .01);
    const lo = (nativeGesture ?? retimeGesture)?.axis.lo ?? low - span * .12, hi = (nativeGesture ?? retimeGesture)?.axis.hi ?? high + span * .12;
    const {left, right, top, bottom} = graphGeometry;
    const x = t => left + (t - start) / Math.max(end - start, .00001) * (right - left);
    const y = value => bottom - (value - lo) / (hi - lo) * (bottom - top);
    const format = value => Math.abs(value) >= 10000 ? value.toExponential(1) : String(Number(value.toFixed(2)));
    nativeAxis = {start, end, left, right, top, bottom, lo, hi};
    const clipPath = svgEl('clipPath', {id:'motion-native-plot-clip'}); clipPath.append(svgEl('rect', {x:left-8,y:top-8,width:right-left+16,height:bottom-top+16}));
    const defs = svgEl('defs'); defs.append(clipPath); nativeGraph.append(defs);
    for (let i = 0; i <= 4; i++) {
      const t = start + (end - start) * i / 4, px = x(t);
      nativeGraph.append(svgEl('line', {x1: px, x2: px, y1: top, y2: bottom, stroke: 'currentColor', opacity: '.12'}));
      const label = svgEl('text', {x: px, y: GRAPH.labelY, fill: 'currentColor', 'font-size': 11, 'text-anchor': 'middle'}); label.textContent = t.toFixed(2) + 's'; nativeGraph.append(label);
    }
    for (const value of [low, (low + high) / 2, high]) {
      nativeGraph.append(svgEl('line', {x1: left, x2: right, y1: y(value), y2: y(value), stroke: 'currentColor', opacity: '.12'}));
      const label = svgEl('text', {x: left - 5, y: y(value) + 3, fill: 'currentColor', 'font-size': 11, 'text-anchor': 'end'}); label.textContent = format(value); nativeGraph.append(label);
    }
    if (retiming() && currentGroup()) nativeGraph.append(svgEl('polyline', {points: originalPoints.map(key => `${x(key.t).toFixed(2)},${y(key.value).toFixed(2)}`).join(' '), fill: 'none', stroke: 'currentColor', opacity: '.35', 'stroke-width': 1.5, 'stroke-dasharray': '4 4'}));
    nativeGraph.append(svgEl('polyline', {points: points.map(key => `${x(key.t).toFixed(2)},${y(key.value).toFixed(2)}`).join(' '), fill: 'none', stroke: isSampled ? 'var(--studio-accent, #9abce3)' : 'var(--motion-accent, #b49aef)', 'stroke-width': 2}));
    const editable = nativeEditable(track) && !retiming() && !isEasy();
    nativeGraph.setAttribute('aria-label', retiming() ? 'Retimed source movement in film seconds' : 'Original source movement in scene seconds');
    nativeGraph.dataset.source = track.source; nativeGraph.dataset.editable = String(editable);
    nativeStatus.textContent = nativeSeekMessage || (retiming() ? (isEasy() ? 'Templates preserve the original motion.' : (currentGroup() ? 'Drag points to adjust timing · dashed: original' : 'Drag points to adjust timing')) + (isSampled ? ' · sampled channel' : '') : (isSampled ? 'Evaluated motion · sampled · read only' : editable ? 'Source keyframes · drag to edit' : 'Source keyframes · read only'));
    nativeList.hidden = isSampled;
    const indexed = knots.map((key, index) => ({key, index})).filter(({key}) => key.t >= start - 1e-9 && key.t <= end + 1e-9);
    if (!knots[selectedNativeKey]) { selectedNativeKey = indexed[0]?.index ?? null; selectedNativeKeys = new Set(selectedNativeKey === null ? [] : [selectedNativeKey]); }
    if (!isSampled && !retiming() && !isEasy()) for (const {key, index} of indexed) {
      const dot = svgEl('circle', {cx: x(key.t), cy: y(key.value), r: selectedNativeKeys.has(index) ? 6 : 4, 'aria-pressed': selectedNativeKeys.has(index), fill: selectedNativeKeys.has(index) ? '#eef0f3' : 'var(--motion-accent, #b49aef)', stroke: '#111', 'stroke-width': 2, 'data-native-key': index, tabindex: 0, role: 'button', 'aria-label': `Source key at ${key.t} seconds, ${key.value}, ${key.ease ?? 'smooth'}`});
      dot.classList.add('motion-source-key'); dot.addEventListener('click', event => { event.stopPropagation(); if (!nativeSuppressClick) selectNativeKey(index, true, event); });
      nativeGraph.append(dot);
      const item = button(`${key.t.toFixed(2)} s · ${format(key.value)}`, event => selectNativeKey(index, true, event));
      item.title = key.ease ?? 'smooth'; item.className = 'motion-native-key'; item.dataset.nativeKey = String(index); item.setAttribute('aria-pressed', String(selectedNativeKeys.has(index))); nativeList.append(item);
    }
    const key = knots[selectedNativeKey], next = knots[selectedNativeKey + 1];
    if (editable && key?.ease === 'bezier' && next && key.bezier) for (const handle of [0, 1]) {
      const hx = x(key.t + key.bezier[handle * 2] * (next.t - key.t)), hy = y(key.value + key.bezier[handle * 2 + 1] * (next.value - key.value)), anchor = handle ? next : key;
      nativeGraph.append(svgEl('line', {x1: x(anchor.t), y1: y(anchor.value), x2: hx, y2: hy, stroke: 'var(--motion-accent, #b49aef)', 'stroke-width': 1, 'pointer-events': 'none'}));
      nativeGraph.append(svgEl('circle', {cx: hx, cy: hy, r: 6, fill: 'var(--motion-accent, #b49aef)', stroke: '#0d0f11', 'stroke-width': 2, 'data-native-handle': handle, tabindex: 0, role: 'button', 'aria-label': handle ? 'Incoming source Bézier handle' : 'Outgoing source Bézier handle'}));
    }
    if (retiming() && !isEasy()) for (const [index, key] of timingKeys().entries()) {
      const time = window.start + key.t / targetRate();
      if (time < start || time > end) continue;
      const value = sampleSourceChannel(track, window.start + key.value * (window.end - window.start));
      nativeGraph.append(svgEl('circle', {cx:x(time), cy:y(value), r:selectedRetimeKeys.has(index)?7:6, 'aria-pressed':selectedRetimeKeys.has(index), fill:selectedRetimeKeys.has(index)?'#eef0f3':'var(--motion-accent)', stroke:'#111', 'stroke-width':2, 'data-retime-key':index, tabindex:0, role:'button', 'aria-label':`Timing point ${index + 1} at ${time.toFixed(3)} seconds. Drag horizontally to retime original movement.`}));
    }
    nativePlayhead = svgEl('line', {y1: top, y2: bottom, stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', 'pointer-events': 'none'});
    nativeGraph.append(nativePlayhead);
    for (const node of nativeGraph.querySelectorAll('polyline,circle,[data-native-handle]')) node.setAttribute('clip-path','url(#motion-native-plot-clip)');
    loadNativeEditor(); drawTemplates(); syncMotionView();
  }
  function nativePoint(event, axis = nativeAxis) {
    const rect = nativeGraph.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * GRAPH.width, py = (event.clientY - rect.top) / rect.height * GRAPH.height;
    return {t: axis.start + clamp((px - axis.left) / (axis.right - axis.left), 0, 1) * (axis.end - axis.start), value: axis.hi - (py - axis.top) / (axis.bottom - axis.top) * (axis.hi - axis.lo)};
  }
  nativeGraph.addEventListener('pointerdown', event => {
    const target = event.target.closest('[data-native-key],[data-native-handle]');
    if (!target || event.altKey || event.button !== 0 || retiming() || isEasy() || !nativeEditable() || nativeGesture) return;
    event.preventDefault(); event.stopPropagation();
    if (target.hasAttribute('data-native-key')) { selectedNativeKey = Number(target.dataset.nativeKey); selectIndex(selectedNativeKeys, selectedNativeKey, event); }
    const track = nativeTrack();
    nativeGesture = {additive:additive(event), pointerId: event.pointerId, index: selectedNativeKey, handle: target.hasAttribute('data-native-handle') ? Number(target.dataset.nativeHandle) : null, track: structuredClone(track), original: structuredClone(getParameters().motion), axis: {...nativeAxis}, indices: [...selectedNativeKeys], selection: [...selectedNativeKeys], originalTime: outputTime(), startPoint: nativePoint(event), x: event.clientX, y: event.clientY, changed: false};
    drawNativeGraph(); updateTime();
    nativeGraph.setPointerCapture(event.pointerId);
  });
  nativeGraph.addEventListener('pointermove', event => {
    const gesture = nativeGesture;
    if (!gesture || event.pointerId !== gesture.pointerId || (!gesture.changed && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 3)) return;
    event.preventDefault(); const point = nativePoint(event, gesture.axis), keys = gesture.track.keys, key = keys[gesture.index]; let patch;
    if (gesture.handle === null) {
      if (!gesture.indices.length) return;
      const moved = moveCurveSelection(keys, gesture.indices, point.t - gesture.startPoint.t, point.value - gesture.startPoint.value, {maxTime: duration(), step: snapStep(), anchor: gesture.index});
      try {
        const next = editAuthoredKeys(getScene(), groupId(), selectedNativeTrack, gesture.indices.map(index => ({index, t: moved[index].t, value: moved[index].value})), {motion: gesture.original});
        onAuthoredChange(next, {record:false}); gesture.changed = true; gesture.latest = next;
        refreshNativeSource(next); seekNativeSource(moved[gesture.index].t);
      } catch (failure) { nativeError.textContent = failure.message; }
      return;
    } else {
      const next = keys[gesture.index + 1], bezier = [...key.bezier];
      bezier[gesture.handle * 2] = round(clamp((point.t - key.t) / (next.t - key.t), 0, 1));
      bezier[gesture.handle * 2 + 1] = round(clamp(Math.abs(next.value - key.value) < 1e-9 ? bezier[gesture.handle * 2 + 1] : (point.value - key.value) / (next.value - key.value), 0, 1));
      patch = {ease: 'bezier', bezier};
    }
    const next = applyNativeEdit(patch, {record: false}, gesture.original);
    if (next) { gesture.changed = true; gesture.latest = next; seekNativeSource(patch.t ?? (key.t + keys[gesture.index + 1].t) / 2); }
  });
  function finishNativeGesture(event, cancelled = false) {
    const gesture = nativeGesture; if (!gesture || (event.pointerId !== undefined && event.pointerId !== gesture.pointerId)) return;
    nativeGesture = null;
    nativeSuppressClick = true; setTimeout(() => { nativeSuppressClick = false; }, 0);
    if (nativeGraph.hasPointerCapture(gesture.pointerId)) nativeGraph.releasePointerCapture(gesture.pointerId);
    if (gesture.changed) {
      const next = cancelled ? gesture.original : gesture.latest;
      onAuthoredChange(next, cancelled ? {record: false, cancelled: true} : {record: true}); refreshNativeSource(next);
      if (cancelled) onSeek(gesture.originalTime);
    } else if (!cancelled) { if(!gesture.additive&&gesture.handle===null)selectedNativeKeys=new Set([gesture.index]);seekNativeSource(nativeTrack().keys[gesture.index].t); drawNativeGraph(); updateTime(); }
    syncSelectionTools();
  }
  nativeGraph.addEventListener('pointerup', event => finishNativeGesture(event));
  nativeGraph.addEventListener('pointercancel', event => finishNativeGesture(event, true));
  nativeGraph.addEventListener('lostpointercapture', event => { if (nativeGesture) finishNativeGesture(event, true); });
  nativeGraph.addEventListener('click', event => {
    if (nativeSuppressClick || !nativeAxis || event.target.closest('[data-native-key],[data-native-handle],[data-retime-key]')) return;
    if (retiming()) onSeek(nativePoint(event).t); else seekNativeSource(nativePoint(event).t);
  });
  nativeGraph.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nativeGesture) { event.preventDefault(); event.stopPropagation(); finishNativeGesture(event, true); return; }
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (event.target.hasAttribute('data-native-key')) selectNativeKey(Number(event.target.dataset.nativeKey)); return; }
    if (retiming() || !['ArrowLeft', 'ArrowRight'].includes(event.key) || nativeTrack()?.source !== 'keys') return;
    event.preventDefault(); event.stopPropagation();
    const next = (selectedNativeKey ?? 0) + (event.key === 'ArrowRight' ? 1 : -1), key = nativeTrack().keys[next];
    if (key && key.t >= clip().start && key.t <= clip().end) { selectNativeKey(next); nativeGraph.focus(); }
  });
  nativeGraph.addEventListener('wheel', event => {
    if (isEasy() || !nativeAxis) return;
    event.preventDefault(); event.stopPropagation();
    const rect = nativeGraph.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) navigateCurve(Math.exp(clamp(event.deltaY, -80, 80) * .012), 0, clamp((event.clientX - rect.left) / rect.width, 0, 1));
    else navigateCurve(1, (event.deltaX || event.deltaY) * .002);
  }, {passive:false});
  nativeGraph.addEventListener('pointerdown', event => {
    if (isEasy() || !nativeAxis || nativeGesture || surfaceGesture) return;
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      event.preventDefault(); panGesture = {pointerId:event.pointerId, x:event.clientX, axis:{...nativeAxis}};
      nativeGraph.setPointerCapture(event.pointerId); return;
    }
    const target = event.target.closest('[data-retime-key]');
    if (!retiming() || !target || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const selectedIndex = Number(target.dataset.retimeKey); selectIndex(selectedRetimeKeys, selectedIndex, event);
    retimeGesture = {additive:additive(event),indices:[...selectedRetimeKeys], startPoint:nativePoint(event), originalTime:outputTime(), pointerId:event.pointerId, index:Number(target.dataset.retimeKey), keys:timingKeys(), original:structuredClone(getAnimation?.()), baseline:state(), axis:{...nativeAxis}, x:event.clientX, changed:false};
    nativeGraph.setPointerCapture(event.pointerId);
  });
  nativeGraph.addEventListener('pointermove', event => {
    if (panGesture?.pointerId === event.pointerId) {
      event.preventDefault(); const g = panGesture, full = clip(), span = g.axis.end - g.axis.start;
      const start = clamp(g.axis.start - (event.clientX - g.x) / nativeGraph.getBoundingClientRect().width * span, full.start, full.end - span);
      nativeViewport = {start, end:start + span}; drawNativeGraph(); updateTime(); return;
    }
    const g = retimeGesture;
    if (!g || g.pointerId !== event.pointerId || (!g.changed && Math.abs(event.clientX - g.x) < 3)) return;
    event.preventDefault();
    const list = structuredClone(g.keys), key = list[g.index], point = nativePoint(event,g.axis);
    if (!g.indices.length) return;
    const moved = moveCurveSelection(g.keys, g.indices, (point.t - g.startPoint.t) * targetRate(g.baseline), 0, {maxTime:limit(), step:snapStep() * targetRate(g.baseline), anchor:g.index});
    list.splice(0, list.length, ...moved);
    const a = structuredClone(g.baseline);
    if (!currentGroup(a)) seedGroup(a,1);
    a.groups[groupId()].keys = list;
    try { onChange(a,{record:false}); g.latest = a; g.changed = true; onSeek(seekTime(list[g.index].t)); drawNativeGraph(); drawGraph(); updateTime(); }
    catch (failure) { nativeStatus.textContent = failure.message; }
  });
  function finishRetime(event, cancelled = false) {
    if (panGesture?.pointerId === event.pointerId) {
      panGesture = null; nativeSuppressClick = true; setTimeout(()=>{nativeSuppressClick=false;},0);
      if (nativeGraph.hasPointerCapture(event.pointerId)) nativeGraph.releasePointerCapture(event.pointerId);
      return;
    }
    const g = retimeGesture;
    if (!g || (event.pointerId !== undefined && g.pointerId !== event.pointerId)) return;
    retimeGesture = null; nativeSuppressClick = true; setTimeout(()=>{nativeSuppressClick=false;},0);
    if (nativeGraph.hasPointerCapture(g.pointerId)) nativeGraph.releasePointerCapture(g.pointerId);
    if (g.changed) onChange(cancelled ? g.original : g.latest, cancelled ? {record:false,cancelled:true} : {record:true});
    else if (!cancelled) {if(!g.additive)selectedRetimeKeys=new Set([g.index]);onSeek(clip().start + g.keys[g.index].t / targetRate());}
    if (cancelled && g.changed) onSeek(g.originalTime);
    sync();
  }
  nativeGraph.addEventListener('pointerup', event => finishRetime(event));
  nativeGraph.addEventListener('pointercancel', event => finishRetime(event,true));
  nativeGraph.addEventListener('lostpointercapture', event => { if (retimeGesture || panGesture) finishRetime(event,true); });
  nativeGraph.addEventListener('keydown', event => {
    if (event.key === 'Escape' && retimeGesture) { event.preventDefault(); event.stopPropagation(); finishRetime(event,true); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); navigateCurve(1/1.5); }
    if (event.key === '-') { event.preventDefault(); navigateCurve(1.5); }
    if (event.key === 'Home') { event.preventDefault(); nativeViewport=null; drawNativeGraph(); updateTime(); }
    const target = event.target.closest('[data-retime-key]');
    if (target && ['Enter',' '].includes(event.key)) { event.preventDefault(); const key = timingKeys()[Number(target.dataset.retimeKey)]; onSeek(clip().start + key.t / targetRate()); return; }
    if (!target || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = Number(target.dataset.retimeKey), list = timingKeys(), key=list[index];
    key.t = clamp(key.t + (event.key === 'ArrowRight' ? 1 : -1) / sceneConfig(getScene()).fps * (event.shiftKey ? 10 : 1), index ? list[index-1].t + 1e-5 : 0, index < list.length-1 ? list[index+1].t - 1e-5 : limit());
    write(a=>{if(!currentGroup(a))seedGroup(a,1);a.groups[groupId()].keys=list;});
    nativeGraph.querySelector(`[data-retime-key="${index}"]`)?.focus();
  });
  function requestNativeTracks() {
    if (!isGroup() || container.hidden || nativeGesture || retimeGesture) return;
    const window = clip(), parameters = structuredClone(getParameters());
    delete parameters.animation;
    const payload = {scene: getScene(), groupId: groupId(), start: window.start, end: window.end, parameters};
    const key = JSON.stringify(payload);
    if (key === nativeRequestKey && (nativeLoading || nativeTracks.length)) return;
    nativeRequestKey = key; const request = ++nativeRequest;
    nativeLoading = true; nativeSection.dataset.loading = 'true'; nativeSelect.disabled = true;
    nativeTracks = []; drawNativeGraph(); nativeStatus.textContent = 'Reading the original scene movement…';
    let result;
    try { result = getAuthoredTracks ? getAuthoredTracks(payload) : getAuthoredAnimationTracks(payload.scene, payload.groupId, {motion: parameters.motion}); }
    catch (failure) { result = Promise.reject(failure); }
    Promise.resolve(result).then(tracks => {
      if (request !== nativeRequest) return;
      nativeTracks = Array.isArray(tracks) ? tracks : [];
      if (!nativeTracks.some(track => track.id === selectedNativeTrack)) selectedNativeTrack = nativeTracks[0]?.id;
      nativeSelect.replaceChildren();
      for (const track of nativeTracks) { const option = el('option', '', track.label); option.value = track.id; nativeSelect.append(option); }
      nativeSelect.value = selectedNativeTrack ?? ''; nativeSelect.disabled = !nativeTracks.length;
      nativeLoading = false; nativeSection.dataset.loading = 'false';
      drawNativeGraph(); updateTime();
    }).catch(failure => {
      if (request !== nativeRequest) return;
      nativeLoading = false; nativeSection.dataset.loading = 'false';
      nativeStatus.textContent = 'Original movement could not be read: ' + (failure.message ?? String(failure));
    });
  }
  const visibility = new MutationObserver(() => {
    if (container.hidden) { ++nativeRequest; nativeLoading = false; nativeRequestKey = ''; }
    else requestNativeTracks();
  });
  visibility.observe(container, {attributes: true, attributeFilter: ['hidden']});
  function drawGraph() {
    graph.replaceChildren();
    const def = definition(), list = keys();
    if (!def) return;
    const {left, right, top, bottom} = graphGeometry;
    graphEnd = limit();
    const lo = Number(def.min), hi = Number(def.max);
    const x = t => left + t / graphEnd * (right - left);
    const y = v => bottom - (v - lo) / Math.max(hi - lo, .00001) * (bottom - top);
    for (let i = 0; i <= 4; i++) {
      const px = left + (right - left) * i / 4;
      graph.append(svgEl('line', {x1: px, x2: px, y1: top, y2: bottom, stroke: 'currentColor', opacity: '.12'}));
      const text = svgEl('text', {x: px, y: GRAPH.labelY, fill: 'currentColor', 'font-size': 11, 'text-anchor': 'middle'});
      text.textContent = (graphEnd * i / 4).toFixed(1) + 's'; graph.append(text);
    }
    for (const [v, py] of [[lo, bottom], [(lo + hi) / 2, (top + bottom) / 2], [hi, top]]) {
      graph.append(svgEl('line', {x1: left, x2: right, y1: py, y2: py, stroke: 'currentColor', opacity: '.12'}));
      const text = svgEl('text', {x: left - 5, y: py + 3, fill: 'currentColor', 'font-size': 11, 'text-anchor': 'end'});
      text.textContent = isGroup() ? `${Math.round(v * 100)}%` : Number(v.toFixed(2)).toString(); graph.append(text);
    }
    if (list.length) {
      // Sample each segment independently so discontinuous hold easing has a vertical edge.
      const points = [];
      const times = [0, ...list.map(k => k.t), graphEnd].filter((v, i, all) => i === 0 || v !== all[i - 1]);
      for (let j = 0; j < times.length - 1; j++) {
        for (let i = 0; i < 32; i++) {
          const t = times[j] + (times[j + 1] - times[j]) * i / 32;
          points.push(`${x(t).toFixed(2)},${y(sampleParameterTrack(list, t)).toFixed(2)}`);
        }
      }
      points.push(`${x(graphEnd)},${y(sampleParameterTrack(list, graphEnd))}`);
      graph.append(svgEl('polyline', {points: points.join(' '), fill: 'none', stroke: 'var(--motion-accent, #b49aef)', 'stroke-width': 2}));
      for (const key of list) {
        const dot = svgEl('circle', {'data-key-time': key.t, class: 'motion-curve-key', cx: x(key.t), cy: y(key.value), r: selectedTimes.has(key.t) ? 6 : 4, 'aria-pressed':selectedTimes.has(key.t), fill: selectedTimes.has(key.t) ? '#eef0f3' : 'var(--motion-accent, #b49aef)', stroke: '#111', 'stroke-width': 1, role: 'button', tabindex: 0, 'aria-label': `Key at ${key.t} source seconds, value ${key.value}`});
        dot.style.cursor = 'grab';
        dot.addEventListener('click', event => { event.stopPropagation(); if (!suppressClick) selectKey(key, event); });
        dot.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); selectKey(key); graph.focus(); } });
        graph.append(dot);
      }
    }
    const selectedIndex = list.findIndex(key => key.t === selectedTime);
    const segmentIndex = selectedIndex === list.length - 1 ? selectedIndex - 1 : selectedIndex;
    const anchor = list[segmentIndex], end = list[segmentIndex + 1];
    const pendingBezier = previewBezier?.target === selectedControl && previewBezier?.time === anchor?.t && previewBezier?.window === `${clip().start}:${clip().end}` ? previewBezier.values : null;
    if ((anchor?.ease === 'bezier' || pendingBezier) && end) {
      const bezier = anchor.bezier ?? pendingBezier;
      for (const handleIndex of [0, 1]) {
        const index = handleIndex * 2;
        const hx = x(anchor.t + bezier[index] * (end.t - anchor.t));
        const hy = y(anchor.value + bezier[index + 1] * (end.value - anchor.value));
        const owner = handleIndex === 0 ? anchor : end;
        graph.append(svgEl('line', {x1: x(owner.t), y1: y(owner.value), x2: hx, y2: hy, stroke: 'var(--studio-accent, #9abce3)', 'stroke-width': 1.5, 'pointer-events': 'none'}));
        graph.append(svgEl('circle', {cx: hx, cy: hy, r: 7, fill: 'var(--studio-accent, #9abce3)', stroke: '#0d1019', 'stroke-width': 2, class: 'motion-curve-handle', 'data-handle': handleIndex, 'data-segment-time': anchor.t, role: 'button', tabindex: 0, 'aria-label': `${handleIndex ? 'Incoming' : 'Outgoing'} Bézier handle. Drag to shape the selected segment; arrow keys adjust.`}));
      }
    }
    playhead = svgEl('line', {y1: top, y2: bottom, stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', 'pointer-events': 'none'});
    graph.append(playhead);
  }
  graph.addEventListener('click', event => {
    if (suppressClick || event.target.closest('[data-handle]')) return;
    const rect = graph.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * GRAPH.width;
    const source = clamp((px - graphGeometry.left) / (graphGeometry.right - graphGeometry.left), 0, 1) * graphEnd;
    onSeek(clamp(seekTime(source), 0, duration()));
  });

  function setTargetKeys(animation, list) {
    if (isGroup()) {
      if (!currentGroup(animation)) seedGroup(animation);
      animation.groups[groupId()].keys = list;
    } else animation.tracks[selectedControl] = list;
  }
  function addAt(t, value) {
    const list = keys(), existing = list.find(key => Math.abs(key.t - t) <= 1e-6);
    if (existing) { selectKey(existing); return; }
    const def = definition(); if (!def) return;
    const key = {t: Math.min(round(t), limit()), value: round(clamp(value ?? (list.length ? sampleParameterTrack(list, t) : readControlValue(def, getParameters())), def.min, def.max)), ease: isGroup() ? 'linear' : 'smooth'};
    selectedTimes = new Set([key.t]); selectedTime = key.t;
    write(animation => setTargetKeys(animation, [...list, key].sort((a, b) => a.t - b.t)));
    onSeek(seekTime(key.t));
  }
  function convertSelected(ease) {
    const list = keys(); let index = list.findIndex(key => key.t === selectedTime);
    if (index === list.length - 1) index--;
    if (index < 0) return;
    if (ease === 'bezier') {
      previewBezier = {target: selectedControl, time: list[index].t, window: `${clip().start}:${clip().end}`, values: list[index].bezier ?? BEZIER_EQUIVALENTS[list[index].ease ?? (isGroup() ? 'linear' : 'smooth')] ?? [.42, 0, .58, 1]};
      drawGraph(); updateTime();
      selectedLabel.textContent = 'Bézier handles · drag to edit';
      return;
    }
    previewBezier = null; list[index] = {...list[index], ease}; delete list[index].bezier;
    write(animation => setTargetKeys(animation, list));
  }
  function graphPoint(event) {
    const rect = graph.getBoundingClientRect(), {left, right, top, bottom} = graphGeometry, def = definition();
    const px = (event.clientX - rect.left) / rect.width * GRAPH.width;
    const py = (event.clientY - rect.top) / rect.height * GRAPH.height;
    return {t: clamp((px - left) / (right - left), 0, 1) * limit(), value: clamp(def.max - (py - top) / (bottom - top) * (def.max - def.min), def.min, def.max)};
  }
  function beginGesture(event) {
    if (event.button !== 0 || gesture) return;
    const point = event.target.closest('[data-key-time], [data-handle]'); if (!point) return;
    event.preventDefault(); event.stopPropagation();
    const handle = point.hasAttribute('data-handle');
    if (!handle) selectKey(keys().find(key => key.t === Number(point.dataset.keyTime)), event);
    const list = keys(), index = list.findIndex(key => key.t === (handle ? Number(point.dataset.segmentTime) : selectedTime)); if (index < 0) return;
    if (handle) {
      selectedTime = list[index].t;
      list[index] = {...list[index], ease: 'bezier', bezier: list[index].bezier ?? [...previewBezier.values]};
    }
    gesture = {additive:additive(event),indices:list.map((key,index)=>selectedTimes.has(key.t)?index:-1).filter(index=>index>=0), selection:[...selectedTimes], originalTime:outputTime(), startPoint:graphPoint(event), pointerId: event.pointerId, kind: handle ? 'handle' : 'key', handle: Number(point.dataset.handle), index, list: structuredClone(list), baseline: state(), original: structuredClone(getAnimation?.()), x: event.clientX, y: event.clientY, changed: false};
    graph.setPointerCapture(event.pointerId);
  }
  function dragGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!gesture.changed && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 3) return;
    event.preventDefault();
    const g = gesture, list = structuredClone(g.list), key = list[g.index], point = graphPoint(event);
    if (g.kind === 'key') {
      if (!g.indices.length) return;
      const def = definition();
      const moved = moveCurveSelection(g.list, g.indices, point.t - g.startPoint.t, point.value - g.startPoint.value, {maxTime:limit(), minValue:def.min, maxValue:def.max, step:snapStep() * targetRate(g.baseline), anchor:g.index});
      list.splice(0,list.length,...moved); selectedTime = list[g.index].t;
      selectedTimes = new Set(g.indices.map(index=>list[index].t));
    } else {
      const end = list[g.index + 1]; if (!end) return;
      key.bezier = [...(key.bezier ?? [1 / 3, 0, 2 / 3, 1])];
      key.bezier[g.handle * 2] = round(clamp((point.t - key.t) / (end.t - key.t), 0, 1));
      key.bezier[g.handle * 2 + 1] = round(clamp(Math.abs(end.value - key.value) < 1e-9 ? (g.handle ? 1 : 0) : (point.value - key.value) / (end.value - key.value), 0, 1));
    }
    const animation = structuredClone(g.baseline); setTargetKeys(animation, list);
    try {
      onChange(animation, {record: false}); g.changed = true; g.latest = animation;
      onSeek(seekTime(g.kind === 'handle' ? (key.t + list[g.index + 1].t) / 2 : list[g.index].t));
      loadEditor(); drawGraph(); updateTime();
      selectedLabel.textContent = `Key ${g.index + 1} / ${list.length}`;
    } catch (failure) { error.textContent = failure.message ?? 'Could not move this key.'; }
  }
  function finishGesture(event, cancelled = false) {
    if (!gesture || (event.pointerId !== undefined && event.pointerId !== gesture.pointerId)) return;
    const g = gesture; gesture = null;
    if (g.changed) previewBezier = null;
    else if(!g.additive&&g.kind==='key')selectedTimes=new Set([selectedTime]);
    if (graph.hasPointerCapture(g.pointerId)) graph.releasePointerCapture(g.pointerId);
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    if (g.changed) {
      if (cancelled) { selectedTimes = new Set(g.selection); selectedTime = g.list[g.index].t; onChange(g.original, {record: false, cancelled: true}); onSeek(g.originalTime); }
      else onChange(g.latest, {record: true});
    }
    sync();
  }
  graph.addEventListener('pointerdown', beginGesture);
  graph.addEventListener('pointermove', dragGesture);
  graph.addEventListener('pointerup', event => finishGesture(event));
  graph.addEventListener('pointercancel', event => finishGesture(event, true));
  graph.addEventListener('lostpointercapture', event => { if (gesture) finishGesture(event, true); });
  graph.addEventListener('dblclick', event => { if (event.target.closest('[data-handle], [data-key-time]')) return; event.preventDefault(); const point = graphPoint(event); addAt(point.t, point.value); });
  root.addEventListener('keydown', event => {
    if (event.target.closest('input,select,textarea')) return;
    if (event.key === 'Escape' && gesture) { event.preventDefault(); event.stopPropagation(); finishGesture(event, true); return; }
    if (!event.target.closest('#motion-timing-graph,.motion-key-list,.motion-actions')) return;
    if (event.key === ' ' && event.target.closest('#motion-timing-graph')) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.target.hasAttribute('data-handle') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const list = keys(), key = list.find(key => key.t === Number(event.target.dataset.segmentTime)); if (!key) return;
      const index = Number(event.target.dataset.handle) * 2 + (['ArrowUp', 'ArrowDown'].includes(event.key) ? 1 : 0);
      key.ease = 'bezier'; key.bezier = [...(key.bezier ?? previewBezier.values)]; previewBezier = null; key.bezier[index] = round(clamp(key.bezier[index] + (['ArrowRight', 'ArrowUp'].includes(event.key) ? .02 : -.02), 0, 1));
      write(animation => setTargetKeys(animation, list)); graph.querySelector(`[data-handle="${Math.floor(index / 2)}"]`)?.focus(); return;
    }
    if (['Delete','Backspace'].includes(event.key) && selectedTimes.size) { event.preventDefault(); event.stopPropagation(); remove(); graph.focus(); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); navigate(event.key === 'ArrowLeft' ? -1 : 1); graph.focus(); }
  });

  function syncSelectionTools() {
    const source = isGroup() && !retiming(), count = source ? selectedNativeKeys.size : isGroup() ? selectedRetimeKeys.size : selectedTimes.size;
    selectionCount.textContent = count > 1 ? `${count} keys selected` : 'Select keys';
    selectionTools.hidden = isEasy(); interactionHelp.hidden = isEasy();
  }
  function selectAllVisible(surface = isGroup() ? nativeGraph : graph) {
    if (surface === nativeGraph) {
      if (retiming()) selectedRetimeKeys = new Set(timingKeys().map((_,i)=>i).filter(i=>{const t=clip().start+timingKeys()[i].t/targetRate();return t>=nativeAxis.start&&t<=nativeAxis.end;}));
      else selectedNativeKeys = new Set((nativeTrack()?.keys ?? []).map((_,i)=>i).filter(i=>nativeTrack().keys[i].t>=nativeAxis.start&&nativeTrack().keys[i].t<=nativeAxis.end));
      drawNativeGraph();
    } else { selectedTimes = new Set(keys().map(key=>key.t)); drawGraph(); }
    updateTime();
  }
  function installSurfaceGestures(surface, native) {
    const point = event => native ? nativePoint(event) : graphPoint(event);
    surface.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.altKey || gesture || nativeGesture || retimeGesture || panGesture || surfaceGesture || (native && !nativeAxis) || event.target.closest('[role=button]')) return;
      event.preventDefault(); surface.focus();
      surfaceGesture = {surface, native, pointerId:event.pointerId, start:point(event), x:event.clientX, y:event.clientY, marquee:event.shiftKey&&!isEasy(), moved:false,
        selectedTimes:[...selectedTimes], selectedNativeKeys:[...selectedNativeKeys], selectedRetimeKeys:[...selectedRetimeKeys], originalTime:outputTime()};
      surface.setPointerCapture(event.pointerId);
      if (!surfaceGesture.marquee) scrubSurface(surfaceGesture, event);
    });
    surface.addEventListener('pointermove', event => {
      const g=surfaceGesture;
      if (!g || g.surface!==surface || event.pointerId!==g.pointerId) return;
      event.preventDefault(); g.moved ||= Math.hypot(event.clientX-g.x,event.clientY-g.y)>3;
      if (!g.marquee) {scrubSurface(g,event);return;}
      const rect=surface.getBoundingClientRect();
      // Select by the visible point positions, including the evaluated retimed curve.
      const selector=native?(retiming()?'[data-retime-key]':'[data-native-key]'):'[data-key-time]';
      const hits=[...surface.querySelectorAll(selector)].filter(node=>{
        const box=node.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
        return x>=Math.min(g.x,event.clientX)&&x<=Math.max(g.x,event.clientX)&&y>=Math.min(g.y,event.clientY)&&y<=Math.max(g.y,event.clientY);
      });
      if (native && retiming()) selectedRetimeKeys=new Set([...g.selectedRetimeKeys,...hits.map(node=>Number(node.dataset.retimeKey))]);
      else if (native) selectedNativeKeys=new Set([...g.selectedNativeKeys,...hits.map(node=>Number(node.dataset.nativeKey))]);
      else selectedTimes=new Set([...g.selectedTimes,...hits.map(node=>Number(node.dataset.keyTime))]);
      if(native) drawNativeGraph(); else drawGraph(); updateTime();
      const x=(Math.min(g.x,event.clientX)-rect.left)/rect.width*GRAPH.width,y=(Math.min(g.y,event.clientY)-rect.top)/rect.height*GRAPH.height;
      surface.append(svgEl('rect',{x,y,width:Math.abs(event.clientX-g.x)/rect.width*GRAPH.width,height:Math.abs(event.clientY-g.y)/rect.height*GRAPH.height,class:'motion-selection-box','pointer-events':'none'}));
    });
    const finish=(event,cancelled=false)=>{
      const g=surfaceGesture;if(!g||g.surface!==surface||(event.pointerId!==undefined&&g.pointerId!==event.pointerId))return;
      surfaceGesture=null;
      if(cancelled){selectedTimes=new Set(g.selectedTimes);selectedNativeKeys=new Set(g.selectedNativeKeys);selectedRetimeKeys=new Set(g.selectedRetimeKeys);onSeek(g.originalTime);}
      if(native){nativeSuppressClick=true;setTimeout(()=>{nativeSuppressClick=false;},0);if(g.marquee)drawNativeGraph();}
      else{suppressClick=true;setTimeout(()=>{suppressClick=false;},0);if(g.marquee)drawGraph();}
      if(surface.hasPointerCapture(g.pointerId))surface.releasePointerCapture(g.pointerId);
      updateTime();
    };
    surface.addEventListener('pointerup',event=>finish(event));
    surface.addEventListener('pointercancel',event=>finish(event,true));
    surface.addEventListener('lostpointercapture',event=>finish(event,true));
    surface.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&surfaceGesture){event.preventDefault();event.stopPropagation();finish(event,true);}
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='a'){event.preventDefault();event.stopPropagation();selectAllVisible(surface);}
    });
  }
  function scrubSurface(g, event) {
    const local=g.native?nativePoint(event).t:graphPoint(event).t;
    if(g.native&&!retiming())seekNativeSource(local);else onSeek(g.native?local:seekTime(local));
    updateTime();
  }
  installSurfaceGestures(nativeGraph,true); installSurfaceGestures(graph,false);

  function nudgeSelection(surface, native, event) {
    if(!event.shiftKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();
    const direction=['ArrowRight','ArrowUp'].includes(event.key)?1:-1,horizontal=['ArrowLeft','ArrowRight'].includes(event.key);
    if(native&&!retiming()&&nativeEditable()) {
      const track=nativeTrack(),indices=[...selectedNativeKeys];if(!indices.length)return;
      const moved=moveCurveSelection(track.keys,indices,horizontal?direction/sceneConfig(getScene()).fps:0,horizontal?0:direction*(nativeAxis.hi-nativeAxis.lo)/100,{maxTime:duration()});
      try {const next=editAuthoredKeys(getScene(),groupId(),selectedNativeTrack,indices.map(index=>({index,t:moved[index].t,value:moved[index].value})),{motion:getParameters().motion});onAuthoredChange(next);refreshNativeSource(next);seekNativeSource(moved[selectedNativeKey??indices[0]].t);surface.focus();}catch(failure){nativeError.textContent=failure.message;}
    } else {
      const source=native?timingKeys():keys(),indices=native?[...selectedRetimeKeys]:source.map((key,i)=>selectedTimes.has(key.t)?i:-1).filter(i=>i>=0);if(!indices.length)return;
      const def=definition(),moved=moveCurveSelection(source,indices,horizontal?direction*targetRate()/sceneConfig(getScene()).fps:0,native||horizontal?0:direction*(def.max-def.min)/100,{maxTime:limit(),minValue:def.min,maxValue:def.max});
      if(!native){selectedTimes=new Set(indices.map(i=>moved[i].t));selectedTime=moved[indices[0]].t;}
      write(a=>setTargetKeys(a,moved));onSeek(seekTime(moved[indices[0]].t));surface.focus();
    }
  }
  nativeGraph.addEventListener('keydown',event=>nudgeSelection(nativeGraph,true,event),true);
  graph.addEventListener('keydown',event=>nudgeSelection(graph,false,event),true);

  function updateTime(time = outputTime()) {
    // Playback updates avoid cloning tracks, rebuilding the SVG, or touching editor fields.
    const a = getAnimation?.() ?? {}, rate = targetRate(a);
    const source = clamp((Number(time) - (isGroup() ? clip().start : 0)) * rate, 0, limit());
    if (playhead) {
      const x = graphGeometry.left + clamp(source / graphEnd, 0, 1) * (graphGeometry.right - graphGeometry.left);
      playhead.setAttribute('x1', String(x)); playhead.setAttribute('x2', String(x));
    }
    if (nativePlayhead && nativeAxis) {
      const poseTime = retiming() ? Number(time) : animationGroupData.sampleAnimationGroupTime({animation: a}, groupId(), Number(time));
      const px = nativeAxis.left + clamp((poseTime - nativeAxis.start) / Math.max(nativeAxis.end - nativeAxis.start, .00001), 0, 1) * (nativeAxis.right - nativeAxis.left);
      nativePlayhead.setAttribute('x1', String(px)); nativePlayhead.setAttribute('x2', String(px));
    }
    summary.textContent = `Film ${Number(time).toFixed(2)} s · ${isGroup() ? 'Shot' : 'Source'} ${source.toFixed(2)} s · ${Number(rate).toFixed(2)}×`;
    root.dataset.animationEnabled = String(a.enabled !== false); syncSelectionTools();
    const list = isGroup() ? currentGroup(a)?.keys ?? identityKeys() : a.tracks?.[selectedControl] ?? [];
    const navigationTime = selectedTime ?? source;
    previous.disabled = !list.some(k => k.t < navigationTime - 1e-6);
    next.disabled = !list.some(k => k.t > navigationTime + 1e-6);
  }
  function sync() {
    if (gesture || nativeGesture || retimeGesture) return;
    const nextScene = getScene();
    if (scene !== nextScene) { resetSelection(); showAllTools = false; selectedWindow = null; motionView = 'auto'; selectedNativeKey = null; }
    groups = getAnimationGroups(nextScene);
    const parameters = getParameters();
    const manifest = parameters.studio?.controlManifest ?? createControlManifest(nextScene);
    const trackedIds = new Set(Object.keys(getAnimation?.()?.tracks ?? {}));
    const available = getControlCatalog(nextScene).filter(d => d.animatable && ['range', 'number'].includes(d.type));
    catalog = available.filter(d => showAllTools || trackedIds.has(d.id));
    // Follow the author-selected manifest order, followed by retained tracks and
    // other tools. Toggling the view never changes parameters or animation state.
    const order = new Map(manifest.controls.map((id, i) => [id, i]));
    catalog.sort((a, b) => (order.get(a.id) ?? manifest.controls.length) - (order.get(b.id) ?? manifest.controls.length));
    allTools.input.checked = showAllTools;
    if (scene !== nextScene || !(groups.some(g => 'group:' + g.id === selectedControl) || catalog.some(d => d.id === selectedControl))) {
      scene = nextScene; selectedControl = groups.length ? 'group:' + groups[0].id : catalog[0]?.id; selectedTime = null; selectedWindow = null;
    }
    controlSelect.replaceChildren();
    const groupOptions = el('optgroup'); groupOptions.label = 'Camera and object groups';
    for (const group of groups) {
      const option = el('option', '', group.label); option.title = getAnimation?.()?.groups?.[group.id] ? 'Timing edited' : 'Original authored timing';
      option.value = 'group:' + group.id; groupOptions.append(option);
    }
    if (groups.length) controlSelect.append(groupOptions);
    const parameterOptions = el('optgroup'); parameterOptions.label = 'Advanced parameter tracks';
    for (const def of catalog) {
      const option = el('option', '', `${def.label}${state().tracks[def.id]?.length ? ' · animated' : ''}`);
      option.value = def.id; parameterOptions.append(option);
    }
    if (catalog.length) controlSelect.append(parameterOptions);
    controlSelect.value = selectedControl ?? '';
    windowField.wrap.hidden = !isGroup(); createCurve.hidden = !isGroup();
    nativeSection.hidden = !isGroup(); nativeDetails.hidden = !isGroup();
    timingHeading.textContent = isGroup() ? 'Timing curve' : 'Parameter curve';
    curveType.textContent = isGroup() ? 'Progress / shot time' : 'Value / source time';
    windowSelect.replaceChildren();
    if (isGroup()) {
      const stored = getAnimation?.()?.groups?.[groupId()], identity = `${nextScene}:${groupId()}`;
      const signature = stored ? `${stored.start}:${stored.end}` : '';
      if (stored && observedWindows.has(identity) && observedWindows.get(identity) !== signature) selectedWindow = {start: stored.start, end: stored.end};
      observedWindows.set(identity, signature);
      selectedWindow ??= {...clip()};
      const def = groupDefinition(); let selectedIndex = -1;
      def.windows.forEach((window, i) => {
        const option = el('option', '', `${window.label} · ${window.start.toFixed(2)}–${window.end.toFixed(2)} s`);
        option.value = String(i); windowSelect.append(option);
        if (window.start === selectedWindow.start && window.end === selectedWindow.end) selectedIndex = i;
      });
      if (selectedIndex < 0) { const option = el('option', '', `Saved clip · ${selectedWindow.start.toFixed(2)}–${selectedWindow.end.toFixed(2)} s`); option.value = 'custom'; windowSelect.append(option); }
      windowSelect.value = selectedIndex < 0 ? 'custom' : String(selectedIndex);
    }
    const hasTimingOverride = Boolean(isGroup() ? currentGroup() : getAnimation?.()?.tracks?.[selectedControl]?.length);
    timingState.textContent = getAnimation?.()?.enabled === false ? 'Overrides off' : hasTimingOverride ? 'Edited timing' : 'Original timing';
    timingState.dataset.edited = String(hasTimingOverride);
    easingPreset.replaceChildren(); const manual = el('option', '', 'Custom'); manual.value = ''; easingPreset.append(manual);
    for (const preset of getInterpolationPresets(nextScene)) { const option = el('option', '', preset.label); option.value = preset.id; easingPreset.append(option); }
    const graphDescription = isGroup() ? `Drag points to change this target’s timing. Select a point, then Bézier for handles. Double-click to add. Local seconds · output clip ${clip().start.toFixed(2)}–${clip().end.toFixed(2)} s.` : 'Drag points to edit. Select a point, then Bézier for handles. Double-click to add. Parameter value / source seconds.';
    graphHint.textContent = 'Drag points or handles · double-click to add a key';
    intro.textContent = isGroup() ? 'Timing affects only this target in the selected shot.' : 'Animate this parameter independently of the other tracks.';
    if (isGroup()) { const stored = getAnimation?.()?.groups?.[groupId()]; const differentClip = stored && !currentGroup(); intro.textContent = differentClip ? 'Editing this shot replaces the target’s existing timing clip.' : intro.textContent; intro.dataset.warning = String(Boolean(differentClip)); } else delete intro.dataset.warning;
    rateHelp.textContent = isGroup() ? '0.25–2.5× · changes only this target inside its clip. Film playback and other targets keep their timing.' : '0.25–2.5× · changes only this parameter track. Other tracks and film playback keep their timing.';
    graph.title = graphDescription; graph.setAttribute('aria-description', graphDescription);
    graph.setAttribute('aria-label', isGroup() ? 'Selected target motion progress curve. Horizontal axis is local clip time in seconds.' : 'Selected parameter curve. Horizontal axis is source time in seconds.');
    enable.input.checked = state().enabled;
    if (document.activeElement !== rateField.input) rateField.input.value = String(targetRate());
    const list = keys();
    if (isGroup() && selectedTime === null) { selectedTime = list[0]?.t ?? null; selectedTimes = new Set(selectedTime === null ? [] : [selectedTime]); }
    selectedTimes = new Set([...selectedTimes].filter(t=>list.some(key=>key.t===t)));
    const selectedIndex = list.findIndex(key => key.t === selectedTime), segment = list[selectedIndex === list.length - 1 ? selectedIndex - 1 : selectedIndex];
    const equivalent = BEZIER_EQUIVALENTS[segment?.ease ?? (isGroup() ? 'linear' : 'smooth')];
    if (isGroup() && segment && equivalent && !segment.bezier) previewBezier = {target: selectedControl, time: segment.t, window: `${clip().start}:${clip().end}`, values: [...equivalent]};
    empty.hidden = isGroup() || list.length > 0;
    empty.title = 'Moving a point or handle creates a timing override for this target only. The original movement stays intact.';
    empty.textContent = isGroup() ? 'Original timing' : definition() ? 'No keys for this parameter. Move the playhead, set a value, then add a key.' : 'Choose an animation target.';
    const hasTarget = Boolean(definition());
    editor.hidden = !hasTarget; newKey.disabled = !hasTarget; quickAdd.disabled = !hasTarget;
    timeField.input.disabled = !hasTarget; valueField.input.disabled = !hasTarget; saveKey.disabled = !hasTarget; rateField.input.disabled = !hasTarget;
    contextTitle.textContent = isGroup() ? 'Target & shot' : 'Parameter target';
    keyList.replaceChildren();
    for (const key of list) {
      const item = button(`${key.t.toFixed(2)}s · ${isGroup() ? Math.round(key.value * 100) + '%' : key.value}`, event => selectKey(key, event));
      item.title = `${isGroup() && !currentGroup() ? 'Original timing reference · ' : ''}${key.ease ?? (isGroup() ? 'linear' : 'smooth')} · select and seek`;
      item.className = 'motion-key'; item.dataset.keyTime = String(key.t); item.setAttribute('aria-pressed', String(selectedTimes.has(key.t))); keyList.append(item);
    }
    const selected = list.find(key => key.t === selectedTime), index = list.indexOf(selected);
    smoothKey.disabled = index < 0 || list.length < 2; linearKey.disabled = smoothKey.disabled;
    applyEasing.disabled = !selected || index === list.length - 1; easingPreset.disabled = Boolean(selected && index === list.length - 1);
    selectedLabel.textContent = selected ? `Key ${index + 1} / ${list.length} · ${selected.ease ?? 'linear'}` : 'Select a key';
    loadEditor(); drawGraph(); drawNativeGraph(); syncMotionView(); updateTime(); syncSelectionTools(); requestNativeTracks();
  }
  const experienceObserver = new MutationObserver(() => { if (isEasy() && !isGroup()) selectedControl = groups.length ? 'group:' + groups[0].id : selectedControl; sync(); });
  experienceObserver.observe(document.body, {attributes:true, attributeFilter:['data-experience']});
  sync();
  return {sync, updateTime};
}
