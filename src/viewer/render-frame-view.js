/** Actual final-engine frames for the viewport. This never substitutes a raster preview. */
export function createRenderFrameView({
  api = async (route, body) => {
    const response = await fetch(`/api/studio${route}`, body === undefined ? {} : {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'Frame render failed.'); error.status = response.status; throw error; }
    return data;
  },
  onState = () => {}, debounceMs = 450, pollMs = 800, busyRetryMs = 1500,
  schedule = setTimeout, unschedule = clearTimeout, now = Date.now,
  timeoutMs = 30 * 60 * 1000
} = {}) {
  let desired = null, active = null, timer = null, disposed = false, generation = 0;
  let state = {status: 'idle'}, lastReady = null;
  const emit = (next, request = desired) => {
    if (disposed || (request && request !== desired)) return;
    state = {...(request ? {requestKey: request.key, engine: request.engine, scene: request.body.parameters.scene, time: request.body.time, settings: request.body.settings} : {}), ...next};
    onState({...state});
  };
  function clearTimer() { if (timer !== null) { unschedule(timer); timer = null; } }
  function later(fn, delay) { clearTimer(); timer = schedule(() => { timer = null; fn(); }, delay); }
  function finish(request) {
    if (active === request) active = null;
    if (disposed) return;
    if (desired && desired !== request) later(start, Math.max(0, desired.readyAt - now()));
  }
  async function poll(request) {
    if (disposed || active !== request) return;
    try {
      const job = await api(`/jobs/${request.jobId}`);
      if (disposed || active !== request) return;
      if (job.engine && job.engine !== request.engine) throw new Error(`Expected ${request.engine}, but the renderer returned ${job.engine}.`);
      if (job.status === 'completed') {
        if (job.engine !== request.engine) throw new Error(`Expected ${request.engine}, but the renderer returned ${job.engine || 'an unknown engine'}.`);
        if (!job.url) throw new Error('The rendered frame has no image URL.');
        if (desired === request) {
          lastReady = {key: request.key, url: job.url, engine: job.engine};
          emit({status: 'ready', url: job.url, jobId: job.id, progress: 100, elapsedMs: now() - request.startedAt}, request);
        }
        finish(request);
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        throw new Error(job.error || 'Frame render failed.');
      } else {
        if (now() - request.startedAt > timeoutMs) throw new Error('Frame render timed out. Check the local render job before retrying.');
        emit({status: 'rendering', jobId: request.jobId, progress: Math.max(0, Math.min(99, Number(job.progress) || 0)), phase: job.phase || 'preparing', ...(job.previewStage&&job.previewUrl ? {previewUrl:job.previewUrl,stage:job.previewStage,previewWidth:job.previewWidth,previewHeight:job.previewHeight,previewSamples:job.previewSamples} : {})}, request);
        later(() => poll(request), pollMs);
      }
    } catch (error) { emit({status: 'error', error: error.message}, request); finish(request); }
  }
  async function start() {
    if (disposed || active || !desired) return;
    const request = desired;
    active = request;
    request.startedAt = now();
    emit({status: 'rendering', progress: 0, phase: 'starting'}, request);
    try {
      const job = await api('/render', request.body);
      if (disposed || active !== request) return;
      if (!job.id) throw new Error('The renderer did not return a job ID.');
      request.jobId = job.id;
      // Continue observing obsolete jobs until completion: the local renderer is single-job.
      // Only the newest desired snapshot is ever displayed or submitted next.
      later(() => poll(request), 0);
    } catch (error) {
      if (disposed) return;
      if (error.status === 409 || /another local render.*running/i.test(error.message)) {
        active = null;
        if (desired) {
          emit({status: 'pending', phase: 'waiting', progress: 0});
          later(start, busyRetryMs);
        }
      } else { emit({status: 'error', error: error.message}, request); finish(request); }
    }
  }
  return {
    request({parameters, time, settings, selection, publicDemo = false, force = false}) {
      if (disposed) return;
      const engine = selection?.selectedRenderer || parameters?.renderPolicy?.renderer;
      const body = structuredClone({kind: 'frame', purpose: 'viewport', time, parameters, settings});
      const key = JSON.stringify({engine, body});
      if (!force && desired?.key === key) return;
      desired = {key, engine, body, generation: ++generation, readyAt: now() + debounceMs};
      if (publicDemo || selection?.runnable === false || !['threejs', 'cycles', 'mixed'].includes(engine)) {
        emit({status: 'unavailable', error: publicDemo ? 'Open the local Studio to render final-engine frames.' : selection?.availability || 'Select an available final renderer.'});
        // Invalid requests must not be submitted when the preceding job finishes.
        desired = null;
        if (!active) clearTimer();
        return;
      }
      if (!force && lastReady?.key === key && !active) { emit({status: 'ready', url: lastReady.url, progress: 100}); return; }
      emit({status: 'pending', progress: 0, phase: active ? 'waiting' : 'settling'});
      if (!active) later(start, debounceMs);
    },
    suspend() {
      desired = null;
      if (!active) clearTimer();
      emit({status: 'idle'});
    },
    getState() { return {...state}; },
    dispose() { disposed = true; desired = null; active = null; clearTimer(); }
  };
}
