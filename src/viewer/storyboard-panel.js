import {defaultEditorialEdit, validateEditorialEdit, editorialDuration} from '../engine/editorial.js';
import {sceneConfig} from '../scene-registry.js';
import {createPreviewFrameCache, previewFrameKey} from './preview-frame-cache.js';
import './storyboard-panel.css';

const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const button = (text, label = text) => { const node = element('button', '', text); node.type = 'button'; node.setAttribute('aria-label', label); return node; };
const seconds = value => Number(value.toFixed(3)).toString();
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

/** One serialized, disposable renderer; stale preparations never publish frames. */
export function createStoryboardThumbnailer({createRuntime, createCanvas = () => document.createElement('canvas'), onFrame = () => {}, onError = () => {}, yieldTask = nextTask, maxFrames = 24, cloneFrame, releaseFrame} = {}) {
  if (typeof createRuntime !== 'function') throw new TypeError('Storyboard thumbnails require a runtime factory.');
  const cache = createPreviewFrameCache({maxEntries: maxFrames, maxBytes: maxFrames * 240 * 135 * 4, cloneFrame, releaseFrame});
  let generation = 0, disposed = false, runtime = null, runtimeScene, canvas, work = Promise.resolve(), identity, recipeRevision = 0;
  function releaseRuntime() { runtime?.dispose?.(); runtime = null; runtimeScene = undefined; canvas = null; }
  function request({scene, parameters, shots}) {
    if (disposed) return Promise.resolve();
    const token = ++generation, frozen = structuredClone(parameters);
    // Source windows are authored time; avoid applying the editorial map twice.
    delete frozen.edit;
    frozen.scene = scene;
    const revision = JSON.stringify(frozen), captured = shots.map(shot => ({...shot}));
    work = work.catch(() => {}).then(async () => {
      if (disposed || token !== generation) return;
      if (identity !== scene + revision) { identity = scene + revision; recipeRevision++; cache.clear(); }
      try {
        if (runtimeScene !== scene || !runtime) {
          releaseRuntime();
          canvas = createCanvas();
          const candidate = await createRuntime({canvas, scene});
          if (disposed || token !== generation) { candidate?.dispose?.(); return; }
          runtime = candidate; runtimeScene = scene;
          await runtime.ready;
        }
        if (disposed || token !== generation) return;
        await runtime.prepare?.(frozen);
        if (disposed || token !== generation) return;
        for (const shot of captured) {
          if (disposed || token !== generation) return;
          const key = previewFrameKey({scene, revision: recipeRevision, time: shot.time, width: 240, height: 135, quality: 'fast'});
          let frame = cache.get(key);
          if (!frame) {
            await yieldTask();
            if (disposed || token !== generation) return;
            await runtime.render(shot.time, {width: 240, height: 135, previewQuality: 'fast', parameters: frozen});
            if (disposed || token !== generation) return;
            cache.set(key, canvas); frame = cache.get(key);
          }
          if (frame) {
            try { onFrame(shot.id, frame); }
            finally { if (frame.getContext) { frame.width = 1; frame.height = 1; } else frame.close?.(); }
          }
        }
      } catch (error) { if (!disposed && token === generation) onError(error); }
    });
    return work;
  }
  return {request, cancel() { generation++; }, dispose() { if (disposed) return; disposed = true; generation++; cache.dispose(); releaseRuntime(); }, get stats() { return cache.stats; }};
}

/** Edit shot order, source trims and output duration within the current film. */
export function mountStoryboardPanel({container, getScene, getParameters, getTime = () => 0, onChange = () => {}, onSeek = () => {}, onContentEdit, createThumbnailRuntime} = {}) {
  if (!container?.append || typeof getScene !== 'function' || typeof getParameters !== 'function') throw new TypeError('Storyboard requires a container and scene/parameter callbacks.');
  const panel = element('section', 'storyboard-panel'); panel.setAttribute('aria-label', 'Shot storyboard');
  const header = element('div', 'storyboard-header'), heading = element('div');
  heading.append(element('h3', '', 'Story'), element('p', 'storyboard-help', 'Arrange shots and set their timing.'));
  const reset = button('Reset story', 'Reset shots to original order and timing'); reset.className = 'storyboard-reset';
  header.append(heading, reset);
  const summary = element('p', 'storyboard-summary'), list = element('ol', 'storyboard-list'), status = element('p', 'storyboard-status');
  list.tabIndex = 0; list.setAttribute('aria-label', 'Shots; scroll horizontally to browse');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  panel.append(header, summary, list, status); container.append(panel);
  let scene, edit, selectedId, fingerprint, destroyed = false;
  const rows = new Map();
  const thumbnailer = createThumbnailRuntime ? createStoryboardThumbnailer({createRuntime: createThumbnailRuntime, onFrame(id, frame) {
    const row = rows.get(id); if (!row) return;
    const target = row.querySelector('canvas'); if (!target) return;
    target.width = frame.width; target.height = frame.height;
    const context = target.getContext('2d'); if (!context) return;
    context.drawImage(frame, 0, 0); target.hidden = false;
    row.querySelector('.storyboard-frame-label').hidden = true;
  }, onError() { status.textContent = 'Shot previews unavailable. Timing and editing remain available.'; }}) : null;
  function commit(next, focusId = selectedId) {
    try {
      const validated = validateEditorialEdit(next, scene);
      onChange(validated); selectedId = focusId;
      let outputStart = 0;
      for (const clip of validated.clips) { if (clip.id === focusId) { onSeek(outputStart); break; } outputStart += clip.duration; }
      fingerprint = undefined; refresh();
      const row = rows.get(focusId); row?.querySelector('.storyboard-select')?.focus({preventScroll: true});
    } catch (error) { status.textContent = error.message; }
  }
  function select(clip, start, seek = true) { selectedId = clip.id; syncTime(false); if (seek) onSeek(start); }
  function numeric(parent, text, value, {min = .001, max, onChange: change}) {
    const label = element('label', 'storyboard-field'); label.append(element('span', '', text));
    const input = element('input'); input.type = 'number'; input.step = '.01'; input.min = String(min); if (max !== undefined) input.max = String(max); input.value = seconds(value); input.setAttribute('aria-label', `${text} for ${parent.dataset.label}`);
    input.onchange = () => { const number = Number(input.value); if (!Number.isFinite(number) || input.value.trim() === '') { status.textContent = 'Enter a valid time in seconds.'; input.value = seconds(value); return; } change(number); };
    label.append(input); parent.append(label);
  }
  function refresh() {
    if (destroyed) return;
    const nextScene = getScene(), parameters = getParameters(), nextFingerprint = JSON.stringify([nextScene, parameters]);
    if (fingerprint === nextFingerprint) { syncTime(); return; }
    const changedScene = scene !== nextScene;
    scene = nextScene;
    try { edit = parameters.edit === undefined ? defaultEditorialEdit(scene) : validateEditorialEdit(parameters.edit, scene); }
    catch (error) { status.textContent = error.message; return; }
    fingerprint = nextFingerprint;
    if (changedScene) { thumbnailer?.cancel(); selectedId = undefined; }
    if (!edit.clips.some(clip => clip.id === selectedId)) selectedId = edit.clips[0]?.id;
    list.replaceChildren(); rows.clear(); status.textContent = '';
    const original = defaultEditorialEdit(scene), total = editorialDuration({scene, edit});
    reset.disabled = JSON.stringify(edit) === JSON.stringify(original);
    summary.textContent = `${edit.clips.length} shots · ${seconds(total)} s`;
    let start = 0;
    for (const [index, clip] of edit.clips.entries()) {
      const outputStart = start; start += clip.duration;
      const sourceIndex = original.clips.findIndex(source => clip.sourceStart >= source.sourceStart && clip.sourceStart < source.sourceEnd);
      const title = scene === 'launch' ? ['Opening hook', 'Product overview', 'Feature focus', 'Product detail', 'Call to action'][sourceIndex] ?? `Shot ${sourceIndex + 1}` : `Shot ${sourceIndex + 1 || index + 1}`;
      const row = element('li', 'storyboard-shot'); row.dataset.clipId = clip.id; row.dataset.label = title;
      const selectButton = button('', `Select ${title}, position ${index + 1}`); selectButton.className = 'storyboard-select';
      const preview = element('span', 'storyboard-frame'), canvas = element('canvas'); canvas.hidden = true; canvas.setAttribute('aria-hidden', 'true');
      const frameLabel = element('span', 'storyboard-frame-label', `${seconds(clip.sourceStart)}–${seconds(clip.sourceEnd)} s`);
      preview.append(canvas, frameLabel); const text = element('span', 'storyboard-shot-title');
      text.append(element('strong', '', `${String(index + 1).padStart(2, '0')} · ${title}`), element('small', '', `${seconds(outputStart)}–${seconds(outputStart + clip.duration)} s`));
      selectButton.append(preview, text); selectButton.onclick = () => select(clip, outputStart);
      const order = element('div', 'storyboard-order'), up = button('↑', `Move ${title} earlier`), down = button('↓', `Move ${title} later`);
      up.disabled = index === 0; down.disabled = index === edit.clips.length - 1;
      function move(offset) { const next = structuredClone(edit); [next.clips[index], next.clips[index + offset]] = [next.clips[index + offset], next.clips[index]]; commit(next, clip.id); }
      up.onclick = () => move(-1); down.onclick = () => move(1); order.append(up, down);
      const timing = element('div', 'storyboard-timing'); timing.dataset.label = title;
      const update = (key, value) => { const next = structuredClone(edit); next.clips[index][key] = value; commit(next, clip.id); };
      numeric(timing, 'Source in', clip.sourceStart, {min: 0, max: sceneConfig(scene).duration, onChange: value => update('sourceStart', value)});
      numeric(timing, 'Source out', clip.sourceEnd, {min: .001, max: sceneConfig(scene).duration, onChange: value => update('sourceEnd', value)});
      numeric(timing, 'Duration', clip.duration, {min: .001, max: 300, onChange: value => update('duration', value)});
      row.append(selectButton, order, timing);
      if (onContentEdit) { const content = button('Edit content', `Edit content for ${title}`); content.className = 'storyboard-content'; content.onclick = () => { select(clip, outputStart); onContentEdit({scene, clip: structuredClone(clip), sourceTime: (clip.sourceStart + clip.sourceEnd) / 2, index: sourceIndex}); }; row.append(content); }
      rows.set(clip.id, row); list.append(row);
    }
    syncTime();
    thumbnailer?.request({scene, parameters, shots: edit.clips.map(clip => ({id: clip.id, time: (clip.sourceStart + clip.sourceEnd) / 2}))});
  }
  function syncTime(followPlayback = true) {
    if (!edit) return;
    const time = getTime(); let start = 0, current;
    for (const clip of edit.clips) { if (time >= start && time < start + clip.duration) current = clip.id; start += clip.duration; }
    if (followPlayback && current) selectedId = current;
    for (const [id, row] of rows) { row.classList.toggle('is-selected', id === selectedId); row.classList.toggle('is-current', id === current); row.querySelector('.storyboard-select').setAttribute('aria-pressed', String(id === selectedId)); }
  }
  reset.onclick = () => commit(defaultEditorialEdit(scene));
  // Keep transport shortcuts outside text entry and accessible order buttons.
  panel.addEventListener('keydown', event => event.stopPropagation());
  refresh();
  return {refresh, syncTime, destroy() { destroyed = true; thumbnailer?.dispose(); rows.clear(); panel.remove(); }};
}
