import assert from 'node:assert/strict';
import {createRenderFrameView} from '../src/viewer/render-frame-view.js';
function harness() {
  let clock = 0, id = 0;
  const timers = new Map(), calls = [], events = [], jobs = new Map();
  const view = createRenderFrameView({
    schedule(fn, delay) { const key = ++id; timers.set(key, {fn, at: clock + delay}); return key; },
    unschedule(key) { timers.delete(key); }, now: () => clock,
    async api(route, body) {
      calls.push({route, body});
      if (route === '/render') { const jobId = String(calls.length); jobs.set(jobId, {id: jobId, status: 'running', engine: body.parameters.renderPolicy.renderer, progress: 8}); return {id: jobId}; }
      return jobs.get(route.split('/').at(-1));
    }, onState: state => events.push(state)
  });
  async function tick(ms = 1000) {
    clock += ms;
    const ready = [...timers].filter(([, t]) => t.at <= clock);
    for (const [key, t] of ready) { timers.delete(key); t.fn(); await Promise.resolve(); await Promise.resolve(); }
  }
  return {view, calls, events, jobs, tick, timers};
}
const request = (time, overrides = {}) => ({parameters: {scene: 'pulse', renderPolicy: {renderer: 'cycles'}, sceneControls: {keyLight: 1}}, time, settings: {width: 1920, height: 1080, fps: 30, temporalSamples: 1}, selection: {selectedRenderer: 'cycles', runnable: true}, ...overrides});
{
  const h = harness();
  const first = request(1); h.view.request(first); first.parameters.sceneControls.keyLight = 2;
  h.view.request(request(2)); await h.tick();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].body.time, 2);
  assert.equal(h.calls[0].body.purpose, 'viewport');
  assert.equal(h.calls[0].body.settings.width, 1920);
  await h.tick();
  h.view.request(request(3)); h.view.request(request(4));
  await h.tick(); assert.equal(h.calls.filter(c => c.route === '/render').length, 1);
  const old = [...h.jobs.values()][0]; Object.assign(old, {status: 'completed', url: '/old.png'});
  await h.tick(); assert.equal(h.events.filter(s => s.status === 'ready').length, 0);
  await h.tick(); assert.equal(h.calls.at(-1).body.time, 4);
  const latest = [...h.jobs.values()].at(-1); Object.assign(latest, {status: 'completed', url: '/latest.png'});
  await h.tick(); assert.equal(h.view.getState().url, '/latest.png');
  const count = h.calls.length; h.view.request(request(4)); await h.tick(); assert.equal(h.calls.length, count);
  h.view.dispose(); assert.equal(h.timers.size, 0);
}
{
  const h = harness(); const frozen = request(2); h.view.request(frozen); frozen.parameters.sceneControls.keyLight = 4; await h.tick();
  assert.equal(h.calls[0].body.parameters.sceneControls.keyLight, 1);
  h.view.suspend(); Object.assign([...h.jobs.values()][0], {status: 'completed', url: '/stale.png'}); await h.tick();
  assert.equal(h.view.getState().status, 'idle'); assert.equal(h.events.some(s => s.url === '/stale.png'), false);
  h.view.request(request(5)); await h.tick();
  Object.assign([...h.jobs.values()].at(-1), {status: 'completed', engine: 'threejs', url: '/wrong.png'}); await h.tick();
  assert.equal(h.view.getState().status, 'error'); assert.match(h.view.getState().error, /Expected cycles/);
}
{
  const h = harness(); h.view.request(request(1, {publicDemo: true})); await h.tick();
  assert.equal(h.view.getState().status, 'unavailable'); assert.equal(h.calls.length, 0);
  h.view.request(request(1, {selection: {selectedRenderer: 'cycles', runnable: false, availability: 'Install Blender'}}));
  assert.equal(h.view.getState().error, 'Install Blender'); await h.tick(); assert.equal(h.calls.length, 0);
  h.view.dispose(); h.view.request(request(2)); await h.tick(); assert.equal(h.calls.length, 0);
}
{
  let attempts = 0, run;
  const events = [];
  const view = createRenderFrameView({schedule(fn) { run = fn; return 1; }, unschedule() {}, onState: s => events.push(s), api: async () => { attempts++; if (attempts === 1) { const error = new Error('Another local render is already running'); error.status = 409; throw error; } return {id: 'retry'}; }});
  view.request(request(1)); run(); await Promise.resolve(); await Promise.resolve();
  assert.equal(view.getState().phase, 'waiting'); run(); await Promise.resolve(); await Promise.resolve(); assert.equal(attempts, 2);
  view.dispose();
}
{
  const h = harness(); h.view.request(request(6)); await h.tick();
  const job = [...h.jobs.values()][0];
  Object.assign(job, {previewStage: 1, previewUrl: '/preview?stage=1', previewWidth:480, previewHeight:270, previewSamples:4, phase:'refining'}); await h.tick();
  assert.equal(h.view.getState().status, 'rendering'); assert.equal(h.view.getState().previewUrl, '/preview?stage=1'); assert.equal(h.view.getState().previewSamples, 4);
  Object.assign(job, {previewStage:2, previewUrl:'/preview?stage=2', previewWidth:960, previewHeight:540, previewSamples:16}); await h.tick();
  assert.equal(h.view.getState().stage, 2); assert.equal(h.view.getState().previewWidth, 960);
  h.view.request(request(7)); await h.tick(); assert.equal(h.view.getState().previewUrl, undefined);
  Object.assign(job,{status:'completed',url:'/obsolete-final'});await h.tick();
  assert.equal(h.events.some(s=>s.url==='/obsolete-final'),false);h.view.dispose();
}
console.log('Render frame view: full-resolution snapshot, latest-only serialization, stale suppression, engine verification, local availability, busy retry and disposal passed.');
