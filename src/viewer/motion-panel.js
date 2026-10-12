import {sceneConfig} from '../scene-registry.js';
import {getControlCatalog, createControlManifest, readControlValue} from '../engine/control-catalog.js';
import {sampleParameterTrack} from '../engine/parameter-animation.js';
import * as animationGroupData from '../engine/animation-groups.js';
import {getInterpolationPresets} from '../engine/control-presets.js';
import {getAuthoredAnimationTracks} from '../engine/authored-animation.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
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

/** A draft curve editor. Mounting and viewing never writes animation state. */
export function mountMotionPanel({container, getScene, getParameters, getAnimation, getTime, getAuthoredTracks, onChange, onSeek}) {
  let scene, selectedControl, selectedTime = null, catalog = [], groups = [], selectedWindow = null, graphEnd = 1, showAllTools = false;
  let nativeTracks = [], selectedNativeTrack, nativePlayhead, nativeAxis;
  let nativeRequest = 0, nativeRequestKey = '', nativeLoading = false;
  const observedWindows = new Map();
  let playhead, graphGeometry = {left: 36, right: 254, top: 16, bottom: 126};
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
  const keys = () => [...(isGroup() ? currentGroup()?.keys ?? identityKeys() : getAnimation?.()?.tracks?.[selectedControl] ?? [])].sort((a, b) => a.t - b.t);
  const definition = () => isGroup() ? {...groupDefinition(), min: 0, max: 1, step: .01} : catalog.find(d => d.id === selectedControl);
  const duration = () => sceneConfig(getScene()).duration;
  const outputTime = () => Number(getTime?.() ?? 0);
  const limit = () => isGroup() ? clip().end - clip().start : duration();
  const sourceTime = () => clamp(round(clamp((outputTime() - (isGroup() ? clip().start : 0)) * targetRate(), 0, limit())), 0, limit());
  const seekTime = local => (isGroup() ? clip().start : 0) + local / targetRate();
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
  const root = el('section', 'motion-panel');
  const intro = el('p', 'context-note', 'Shape the motion of one camera or object group inside an authored shot. Other groups, captions, cuts and film duration keep their own timing.');
  const enable = field('Enable keyframes', 'motion-enabled', 'checkbox');
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
  const choose = field('Animation target', 'motion-control', 'text');
  const controlSelect = document.createElement('select');
  controlSelect.id = 'motion-control';
  choose.input.replaceWith(controlSelect);
  controlSelect.onchange = () => { selectedControl = controlSelect.value; selectedTime = null; selectedWindow = null; sync(); };
  const allTools = field('Advanced parameter tracks', 'motion-show-all-tools', 'checkbox');
  allTools.wrap.append(el('small', '', 'Animate individual numeric parameters. Existing parameter tracks remain available. This view preference is not saved.'));
  allTools.input.onchange = () => { showAllTools = allTools.input.checked; sync(); };
  const windowField = field('Motion clip', 'motion-window', 'text');
  const windowSelect = document.createElement('select'); windowSelect.id = 'motion-window'; windowField.input.replaceWith(windowSelect);
  windowSelect.onchange = () => {
    const window = groupDefinition()?.windows[Number(windowSelect.value)];
    if (window) { selectedWindow = {...window}; selectedTime = null; sync(); }
  };
  const windowHelp = el('small', '', 'One motion clip per target. Choosing a shot only changes the view; creating its curve replaces that target’s previous clip.');
  windowField.wrap.append(windowHelp);
  const createCurve = button('Reset timing to original', () => { selectedTime = null; write(a => seedGroup(a)); }, 'motion-create-curve');
  const nativeSection = el('section', 'context-section motion-native-section');
  nativeSection.id = 'motion-native-section';
  nativeSection.append(el('h3', '', 'Authored movement'));
  const nativeField = field('Original pose track', 'motion-native-track', 'text');
  const nativeSelect = document.createElement('select'); nativeSelect.id = 'motion-native-track'; nativeField.input.replaceWith(nativeSelect);
  const nativeStatus = el('p', 'context-note'); nativeStatus.id = 'motion-native-status';
  const nativeGraph = svgEl('svg', {id: 'motion-native-graph', viewBox: '0 0 280 160', role: 'img', 'aria-label': 'Original authored movement in scene seconds'});
  nativeGraph.classList.add('motion-curve'); nativeGraph.style.width = '100%'; nativeGraph.style.height = 'auto'; nativeGraph.style.display = 'block';
  const nativeList = el('div', 'motion-key-list'); nativeList.id = 'motion-native-keys';
  nativeSelect.onchange = () => { selectedNativeTrack = nativeSelect.value; drawNativeGraph(); updateTime(); };
  const nativeRefresh = button('Refresh original movement', () => { nativeRequestKey = ''; requestNativeTracks(); }, 'motion-native-refresh');
  nativeSection.append(nativeField.wrap, nativeStatus, nativeGraph, nativeList, nativeRefresh);
  const timingHeading = el('h3', '', 'Timing overlay'); timingHeading.id = 'motion-timing-title';
  const summary = el('p', 'context-note');
  summary.setAttribute('aria-live', 'polite');
  const graph = svgEl('svg', {viewBox: '0 0 280 160', role: 'img', 'aria-label': 'Selected control animation curve. Horizontal axis is source time in seconds.'});
  graph.classList.add('motion-curve');
  graph.style.width = '100%'; graph.style.height = 'auto'; graph.style.display = 'block';
  const graphHint = el('small');
  const transport = el('div', 'motion-actions');
  const previous = button('← Previous key', () => navigate(-1), 'motion-prev-key');
  const next = button('Next key →', () => navigate(1), 'motion-next-key');
  transport.append(previous, next);
  const newKey = button('New key at playhead', () => { selectedTime = null; loadEditor(); }, 'motion-new-key');
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
  const presetField = field('Suggested interpolation', 'motion-easing-preset', 'text');
  const easingPreset = document.createElement('select'); easingPreset.id = 'motion-easing-preset'; presetField.input.replaceWith(easingPreset);
  presetField.wrap.append(el('small', '', 'Agent-selected curves for this scene. Save the key to apply; manual easing and handles remain editable.'));
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
  const actions = el('div', 'motion-actions'); actions.append(saveKey, removeKey, deleteTrack);
  editor.append(editorTitle, timeField.wrap, keyOutput, valueField.wrap, presetField.wrap, easingField.wrap, handles, error, actions);
  root.append(intro, enable.wrap, choose.wrap, allTools.wrap, windowField.wrap, nativeSection, timingHeading, rateField.wrap, summary, graph, graphHint, transport, empty, createCurve, keyList, newKey, editor);
  container.replaceChildren(root);

  function navigate(direction) {
    const list = keys(), t = sourceTime();
    const key = direction < 0 ? [...list].reverse().find(k => k.t < t - 1e-6) : list.find(k => k.t > t + 1e-6);
    if (key) selectKey(key);
  }
  function selectKey(key) {
    selectedTime = key.t;
    onSeek(seekTime(key.t));
    sync();
  }
  function loadEditor() {
    const def = definition(), list = keys(), key = list.find(k => k.t === selectedTime);
    if (!def) return;
    if (selectedTime !== null && !key) selectedTime = null;
    editorTitle.textContent = key ? 'Edit selected key' : 'Add key';
    saveKey.textContent = key ? 'Update key' : 'Add key';
    const t = key?.t ?? sourceTime();
    timeField.input.max = String(limit());
    timeField.wrap.querySelector('label').textContent = isGroup() ? 'Key time · local clip seconds' : 'Key time · parameter source seconds';
    valueField.wrap.querySelector('label').textContent = isGroup() ? 'Motion progress · 0–1' : 'Key value';
    const sampled = list.length ? sampleParameterTrack(list, t) : isGroup() ? t / limit() : readControlValue(def, getParameters());
    const value = key?.value ?? (typeof sampled === 'number' ? sampled : def.default);
    const set = (input, v) => { if (document.activeElement !== input) input.value = String(v); };
    set(timeField.input, t); set(valueField.input, value);
    Object.assign(valueField.input, {min: String(def.min), max: String(def.max), step: String(def.step ?? .01)});
    set(easing, key?.ease ?? (isGroup() ? 'linear' : 'smooth'));
    easingPreset.value = '';
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
    selectedTime = key.t;
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
    const oldTime = selectedTime; selectedTime = null;
    write(a => {
      if (isGroup()) {
        const list = (a.groups[groupId()]?.keys ?? []).filter(k => k.t !== oldTime);
        if (list.length) a.groups[groupId()].keys = list; else delete a.groups[groupId()];
      } else {
        const list = (a.tracks[selectedControl] ?? []).filter(k => k.t !== oldTime);
        if (list.length) a.tracks[selectedControl] = list; else { delete a.tracks[selectedControl]; delete a.rates[selectedControl]; }
      }
    });
  }
  function drawNativeGraph() {
    nativeGraph.replaceChildren(); nativeList.replaceChildren(); nativePlayhead = undefined; nativeAxis = undefined;
    const track = nativeTracks.find(item => item.id === selectedNativeTrack);
    if (!track) { nativeStatus.textContent = 'The original movement is defined in this scene’s source. Its unchanged timing is shown below.'; return; }
    const valid = points => (points ?? []).filter(key => Number.isFinite(key.t) && Number.isFinite(key.value)).sort((a, b) => a.t - b.t);
    const knots = valid(track.keys), sampled = valid(track.samples), all = sampled.length ? sampled : knots;
    if (!all.length) { nativeStatus.textContent = 'No finite authored pose data is available for this track.'; return; }
    const window = clip(), start = window.start, end = window.end;
    let points = all.filter(key => key.t >= start - 1e-9 && key.t <= end + 1e-9);
    if (!points.length) points = all;
    const inWindow = knots.filter(key => key.t >= start - 1e-9 && key.t <= end + 1e-9);
    const values = [...points, ...(track.source === 'keys' ? inWindow : [])].map(key => key.value), low = Math.min(...values), high = Math.max(...values), span = Math.max(high - low, .01);
    const lo = low - span * .08, hi = high + span * .08;
    const {left, right, top, bottom} = graphGeometry;
    const x = t => left + clamp((t - start) / Math.max(end - start, .00001), 0, 1) * (right - left);
    const y = value => bottom - (value - lo) / (hi - lo) * (bottom - top);
    const format = value => Math.abs(value) >= 10000 ? value.toExponential(1) : String(Number(value.toFixed(2)));
    for (let i = 0; i <= 4; i++) {
      const t = start + (end - start) * i / 4, px = x(t);
      nativeGraph.append(svgEl('line', {x1: px, x2: px, y1: top, y2: bottom, stroke: 'currentColor', opacity: '.12'}));
      const label = svgEl('text', {x: px, y: 148, fill: 'currentColor', 'font-size': 9, 'text-anchor': 'middle'}); label.textContent = t.toFixed(2) + 's'; nativeGraph.append(label);
    }
    for (const value of [low, (low + high) / 2, high]) {
      const label = svgEl('text', {x: left - 5, y: y(value) + 3, fill: 'currentColor', 'font-size': 9, 'text-anchor': 'end'}); label.textContent = format(value); nativeGraph.append(label);
    }
    nativeGraph.append(svgEl('polyline', {points: points.map(key => `${x(key.t).toFixed(2)},${y(key.value).toFixed(2)}`).join(' '), fill: 'none', stroke: '#88c8ff', 'stroke-width': 2}));
    const isSampled = track.source === 'samples' || !inWindow.length;
    const shown = isSampled ? points : inWindow;
    nativeStatus.textContent = `${isSampled ? 'Sampled authored path · observed poses' : 'Authored pose keys'}${track.unit ? ' · ' + track.unit : ''} · read only.${!isSampled && !sampled.length ? ' Graph joins keyframe values; intermediate poses follow the scene’s own interpolation.' : ''} ${track.description ?? 'Timing edits below change when this original movement is sampled.'}`;
    nativeList.setAttribute('aria-label', isSampled ? 'Sampled points on the original path' : 'Original authored pose keyframes');
    // Native data is inspected directly. Do not reapply an easing function to
    // samples that already came from the scene’s interpolation implementation.
    const observations = isSampled && shown.length > 5 ? [...new Set([0, 1, 2, 3, 4].map(i => Math.round((shown.length - 1) * i / 4)))].map(i => shown[i]) : shown;
    observations.forEach(key => {
      if (key.t >= start && key.t <= end) nativeGraph.append(svgEl('circle', {cx: x(key.t), cy: y(key.value), r: isSampled ? 2 : 3.5, fill: '#88c8ff'}));
      const item = button(`${key.t.toFixed(3)} s · ${format(key.value)}${track.unit ? ' ' + track.unit : ''}${key.ease && !isSampled ? ' · ' + key.ease : ''}`, () => onSeek(key.t));
      item.className = 'motion-native-key'; nativeList.append(item);
    });
    nativePlayhead = svgEl('line', {y1: top, y2: bottom, stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', 'pointer-events': 'none'});
    nativeGraph.append(nativePlayhead); nativeAxis = {start, end, left, right};
  }
  function requestNativeTracks() {
    if (!isGroup() || container.hidden) return;
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
      const text = svgEl('text', {x: px, y: 148, fill: 'currentColor', 'font-size': 9, 'text-anchor': 'middle'});
      text.textContent = (graphEnd * i / 4).toFixed(1) + 's'; graph.append(text);
    }
    for (const [v, py] of [[lo, bottom], [(lo + hi) / 2, (top + bottom) / 2], [hi, top]]) {
      graph.append(svgEl('line', {x1: left, x2: right, y1: py, y2: py, stroke: 'currentColor', opacity: '.12'}));
      const text = svgEl('text', {x: left - 5, y: py + 3, fill: 'currentColor', 'font-size': 9, 'text-anchor': 'end'});
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
      graph.append(svgEl('polyline', {points: points.join(' '), fill: 'none', stroke: '#d7f56b', 'stroke-width': 2}));
      for (const key of list) {
        const dot = svgEl('circle', {cx: x(key.t), cy: y(key.value), r: selectedTime === key.t ? 5 : 4, fill: selectedTime === key.t ? '#ffffff' : '#d7f56b', stroke: '#111', 'stroke-width': 1, role: 'button', tabindex: 0, 'aria-label': `Key at ${key.t} source seconds, value ${key.value}`});
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', event => { event.stopPropagation(); selectKey(key); });
        dot.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectKey(key); } });
        graph.append(dot);
      }
    }
    playhead = svgEl('line', {y1: top, y2: bottom, stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', 'pointer-events': 'none'});
    graph.append(playhead);
  }
  graph.addEventListener('click', event => {
    const rect = graph.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * 280;
    const source = clamp((px - graphGeometry.left) / (graphGeometry.right - graphGeometry.left), 0, 1) * graphEnd;
    onSeek(clamp(seekTime(source), 0, duration()));
  });
  function updateTime(time = outputTime()) {
    // Playback updates avoid cloning tracks, rebuilding the SVG, or touching editor fields.
    const a = getAnimation?.() ?? {}, rate = targetRate(a);
    const source = clamp((Number(time) - (isGroup() ? clip().start : 0)) * rate, 0, limit());
    if (playhead) {
      const x = graphGeometry.left + clamp(source / graphEnd, 0, 1) * (graphGeometry.right - graphGeometry.left);
      playhead.setAttribute('x1', String(x)); playhead.setAttribute('x2', String(x));
    }
    if (nativePlayhead && nativeAxis) {
      const poseTime = animationGroupData.sampleAnimationGroupTime({animation: a}, groupId(), Number(time));
      const px = nativeAxis.left + clamp((poseTime - nativeAxis.start) / Math.max(nativeAxis.end - nativeAxis.start, .00001), 0, 1) * (nativeAxis.right - nativeAxis.left);
      nativePlayhead.setAttribute('x1', String(px)); nativePlayhead.setAttribute('x2', String(px));
    }
    summary.textContent = `${a.enabled !== false ? 'Enabled' : 'Disabled'} · ${Number(time).toFixed(2)} s output / ${source.toFixed(2)} s ${isGroup() ? 'local clip' : 'parameter source'}`;
    const list = isGroup() ? currentGroup(a)?.keys ?? identityKeys() : a.tracks?.[selectedControl] ?? [];
    previous.disabled = !list.some(k => k.t < source - 1e-6);
    next.disabled = !list.some(k => k.t > source + 1e-6);
  }
  function sync() {
    const nextScene = getScene();
    if (scene !== nextScene) { showAllTools = false; selectedWindow = null; }
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
      const option = el('option', '', `${group.label}${getAnimation?.()?.groups?.[group.id] ? ' · timing edited' : ' · authored'}`);
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
    nativeSection.hidden = !isGroup();
    timingHeading.textContent = isGroup() ? `Timing overlay · ${currentGroup() ? 'edited' : 'original'}` : 'Parameter curve';
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
    easingPreset.replaceChildren(); const manual = el('option', '', 'Manual / choose a suggestion'); manual.value = ''; easingPreset.append(manual);
    for (const preset of getInterpolationPresets(nextScene)) { const option = el('option', '', preset.label); option.value = preset.id; easingPreset.append(option); }
    graphHint.textContent = isGroup() ? `Timing progress, not position · local seconds. Output clip starts at ${clip().start.toFixed(2)} s.` : 'Parameter value / source seconds. Click to seek.';
    rateHelp.textContent = isGroup() ? '0.25–2.5× · changes only this target inside its clip. Film playback and other targets keep their timing.' : '0.25–2.5× · changes only this parameter track. Other tracks and film playback keep their timing.';
    graph.setAttribute('aria-label', isGroup() ? 'Selected target motion progress curve. Horizontal axis is local clip time in seconds.' : 'Selected parameter curve. Horizontal axis is source time in seconds.');
    enable.input.checked = state().enabled;
    if (document.activeElement !== rateField.input) rateField.input.value = String(targetRate());
    const list = keys();
    empty.hidden = isGroup() ? Boolean(currentGroup()) : list.length > 0;
    empty.textContent = isGroup() ? 'Original timing · these reference keys preserve the authored movement. Select, edit and save a key to add a timing override. Pose values above remain authored.' : definition() ? 'No keys for this parameter. Move the playhead, set a value, then add a key.' : 'Choose an animation target.';
    editor.hidden = !definition(); newKey.disabled = !definition();
    keyList.replaceChildren();
    for (const key of list) {
      const item = button(`${isGroup() && !currentGroup() ? 'Reference · ' : ''}${key.t.toFixed(3)} s · ${isGroup() ? Math.round(key.value * 100) + '%' : key.value} · ${key.ease ?? (isGroup() ? 'linear' : 'smooth')}`, () => selectKey(key));
      item.className = 'motion-key'; item.setAttribute('aria-pressed', String(key.t === selectedTime)); keyList.append(item);
    }
    loadEditor(); drawGraph(); updateTime(); requestNativeTracks();
  }
  sync();
  return {sync, updateTime};
}
