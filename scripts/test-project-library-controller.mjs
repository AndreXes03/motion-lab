import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath = new URL('../src/viewer/project-library.js', import.meta.url);
const source = (await readFile(sourcePath, 'utf8')).replace(
  "import {mountProjectLibraryUI} from './project-library-ui.js';",
  'const mountProjectLibraryUI=globalThis.__projectLibraryTestUI;'
);
assert.notEqual(source, await readFile(sourcePath, 'utf8'), 'controller UI import replacement must match');
let controllerImportNumber = 0;

function record(id, revision, snapshot) {
  return { id, name: 'Test project', revision, snapshotHash: `hash-${revision}`, updatedAt: revision, snapshot };
}
const response = body => ({ ok: true, json: async () => body });

async function harness(t, { initial, fetch, defaults = initial?.snapshot, liveRecovery = false, canApplyExternal = () => true } = {}) {
  const prior = {
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    window: globalThis.window,
    document: globalThis.document,
    sessionStorage: globalThis.sessionStorage,
    ui: globalThis.__projectLibraryTestUI,
    dateNow: Date.now,
  };
  t.after(() => {
    globalThis.fetch = prior.fetch;
    globalThis.setTimeout = prior.setTimeout;
    globalThis.clearTimeout = prior.clearTimeout;
    globalThis.window = prior.window;
    globalThis.document = prior.document;
    globalThis.sessionStorage = prior.sessionStorage;
    globalThis.__projectLibraryTestUI = prior.ui;
    Date.now = prior.dateNow;
  });

  let current = structuredClone(defaults), now = 1000, timerId = 0;
  const timers = new Map(), setCalls = [], views = [];
  Date.now = () => now;
  globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = fetch || (async () => response({ token: 'token', projects: [], active: initial }));
  globalThis.__projectLibraryTestUI = ({ actions }) => ({
    actions,
    render(view) { views.push(view); },
    dispose() {},
  });

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(`${source}\n// isolated harness ${++controllerImportNumber}`).toString('base64')}`;
  const { mountProjectLibrary } = await import(moduleUrl);
  const app = await mountProjectLibrary({
    container: {},
    getSnapshot: () => structuredClone(current),
    setSnapshot: value => { current = structuredClone(value); setCalls.push(structuredClone(value)); },
    newSnapshot: () => structuredClone(current),
    liveRecovery,
    canApplyExternal,
    isBusy: () => false,
  });

  return {
    app, views, setCalls, timers,
    get snapshot() { return structuredClone(current); },
    set snapshot(value) { current = structuredClone(value); },
    set now(value) { now = value; },
    async fire(delay) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `expected a scheduled timer at ${delay}ms`);
      timers.delete(entry[0]);
      return entry[1].callback();
    },
  };
}

test('live recovery keeps newly authored defaults instead of restoring the saved recipe', async t => {
  const saved = { parameters: { scene: 'older-saved-scene' } };
  const authored = { parameters: { scene: 'newly-authored-default' } };
  const env = await harness(t, { initial: record('p1', 1, saved), defaults: authored, liveRecovery: true });
  assert.deepEqual(env.snapshot, authored);
  assert.deepEqual(env.setCalls, [], 'live recovery must not apply the disk snapshot');
});

test('external updates preserve manual edits until applied, then later edits save against the incoming revision', async t => {
  const original = { parameters: { scene: 'starter', amount: 1 } };
  const incoming = { parameters: { scene: 'starter', amount: 2 } };
  const manual = { parameters: { scene: 'starter', amount: 99 } };
  const laterEdit = { parameters: { scene: 'starter', amount: 3 } };
  let gets = 0, savedBody;
  const env = await harness(t, {
    initial: record('p1', 1, original),
    canApplyExternal: () => false,
    fetch: async (url, options = {}) => {
      if (url.endsWith('/save')) {
        savedBody = JSON.parse(options.body);
        return response({ record: record('p1', 3, savedBody.snapshot) });
      }
      gets++;
      return response({ token: 'token', projects: [], active: gets === 1 ? record('p1', 1, original) : record('p1', 2, incoming) });
    },
  });

  env.snapshot = manual;
  await env.fire(1800);
  assert.deepEqual(env.snapshot, manual, 'polling must keep local manual edits');
  assert.match(env.views.at(-1).message, /Local edits are kept/);

  // Simulate the user choosing Apply latest in the live-update UI.
  env.snapshot = incoming;
  await env.fire(1800);
  assert.deepEqual(env.snapshot, incoming);

  env.snapshot = laterEdit;
  await env.fire(400); // observe the edit and start the debounce window
  env.now = 1500;
  await env.fire(400); // autosave after the debounce window
  await Promise.resolve();
  assert.equal(savedBody?.revision, 2, 'the post-apply save must use the incoming revision');
  assert.deepEqual(savedBody?.snapshot, laterEdit);
  assert.deepEqual(env.snapshot, laterEdit);
});

test('a delayed old poll response cannot revert a newer snapshot saved while the GET was pending', async t => {
  const oldSnapshot = { parameters: { scene: 'starter', amount: 1 } };
  const newerSnapshot = { parameters: { scene: 'starter', amount: 2 } };
  let delayedResolve, postSeen = false, pollGets = 0;
  const env = await harness(t, {
    initial: record('p1', 1, oldSnapshot),
    fetch: async (url, options = {}) => {
      if (url.endsWith('/save')) {
        postSeen = true;
        return response({ record: record('p1', 2, JSON.parse(options.body).snapshot) });
      }
      pollGets++;
      if (pollGets === 1) return response({ token: 'token', projects: [], active: record('p1', 1, oldSnapshot) });
      return new Promise(resolve => { delayedResolve = resolve; });
    },
  });

  const delayedPoll = env.fire(1800);
  await Promise.resolve();
  assert.equal(typeof delayedResolve, 'function', 'poll should be waiting on the old GET');
  env.snapshot = newerSnapshot;
  await env.app.save(true);
  assert.equal(postSeen, true);
  delayedResolve(response({ token: 'token', projects: [], active: record('p1', 1, oldSnapshot) }));
  await delayedPoll;
  assert.deepEqual(env.snapshot, newerSnapshot);
  assert.equal(env.app.getSnapshotHash(), 'hash-2');
});
