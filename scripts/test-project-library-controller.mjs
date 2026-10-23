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

async function harness(t, { initial, fetch, defaults = initial?.snapshot, liveRecovery = false, canApplyExternal = () => true, chooseScene = async () => null, confirmExport = async () => false, newSnapshot, onProjectCopied = () => {} } = {}) {
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
  const timers = new Map(), setCalls = [], views = [];let actions;
  Date.now = () => now;
  globalThis.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = fetch || (async () => response({ token: 'token', projects: [], active: initial }));
  globalThis.__projectLibraryTestUI = input => {actions=input.actions;return {
    actions,chooseScene,confirmExport,
    render(view) { views.push(view); },
    dispose() {},
  };};

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(`${source}\n// isolated harness ${++controllerImportNumber}`).toString('base64')}`;
  const { mountProjectLibrary } = await import(moduleUrl);
  const app = await mountProjectLibrary({
    container: {},
    getSnapshot: () => structuredClone(current),
    setSnapshot: value => { current = structuredClone(value); setCalls.push(structuredClone(value)); },
    newSnapshot: newSnapshot || (() => structuredClone(current)),
    liveRecovery,
    canApplyExternal,
    onProjectCopied,
    isBusy: () => false,
  });

  return {
    app, views, setCalls, timers, actions,
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
  assert.match(env.views.at(-1).message, /New changes available/);

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


test('canceling the example choice leaves editor, undo integration and server untouched', async t => {
 const original={parameters:{scene:'starter',amount:7}};let gets=0,builds=0;
 const env=await harness(t,{initial:record('p1',1,original),chooseScene:async()=>null,fetch:async()=>{gets++;return response({token:'token',projects:[],active:record('p1',1,original)});}});
 const applies=env.setCalls.length;
 assert.equal(await env.app.chooseScene('procedural','Procedural',()=>{builds++;return {parameters:{scene:'procedural'}};}),false);
 assert.equal(builds,0);assert.equal(gets,1);assert.equal(env.setCalls.length,applies);assert.deepEqual(env.snapshot,original);
});

test('example replacement applies only after checkpoint transaction succeeds and exposes its recovery copy',async t=>{
 const original={parameters:{scene:'starter',amount:7}},next={parameters:{scene:'procedural'}};let resolveScene,sceneBody;
 const env=await harness(t,{initial:record('p1',1,original),chooseScene:async()=>({mode:'replace'}),fetch:async(url,options={})=>{
  if(url.endsWith('/save'))return response({record:record('p1',1,original)});
  if(url.endsWith('/scene')){sceneBody=JSON.parse(options.body);return new Promise(resolve=>{resolveScene=resolve;});}
  return response({token:'token',projects:[],active:record('p1',1,original)});
 }});
 const change=env.app.chooseScene('procedural','Procedural',()=>structuredClone(next));
 for(let i=0;i<10&&!resolveScene;i++)await Promise.resolve();
 assert.equal(typeof resolveScene,'function');assert.deepEqual(env.snapshot,original);assert.equal(sceneBody.mode,'replace');assert.equal(sceneBody.revision,1);
 resolveScene(response({record:record('p1',2,next),checkpoint:{...record('copy1',1,original),name:'Test project · before Procedural'}}));
 assert.equal(await change,true);assert.deepEqual(env.snapshot,next);assert.ok(env.views.at(-1).projects.some(project=>project.id==='copy1'));
});

test('a rejected example change preserves editor state',async t=>{
 const original={parameters:{scene:'starter'}},next={parameters:{scene:'procedural'}};
 const env=await harness(t,{initial:record('p1',1,original),newSnapshot:()=>structuredClone(next),chooseScene:async()=>({mode:'new',name:'Example'}),fetch:async(url)=>{
  if(url.endsWith('/save'))return response({record:record('p1',1,original)});
  if(url.endsWith('/scene'))return {ok:false,status:409,json:async()=>({error:'Concurrent edit'})};
  if(url.endsWith('/new'))return response({record:record('p2',1,next)});
  return response({token:'token',projects:[],active:record('p1',1,original)});
 }});
 await assert.rejects(env.app.chooseScene('procedural','Procedural',()=>next),/Concurrent edit/);assert.deepEqual(env.snapshot,original);
});

test('pure New project applies its fresh procedural snapshot after creation',async t=>{
 const original={parameters:{scene:'starter'}},next={parameters:{scene:'procedural'}};
 const second=await harness(t,{initial:record('p1',1,original),newSnapshot:()=>structuredClone(next),fetch:async(url)=>url.endsWith('/new')?response({record:record('p2',1,next)}):url.endsWith('/save')?response({record:record('p1',1,original)}):response({token:'token',projects:[],active:record('p1',1,original)})});
 await second.actions.newProject('Fresh');assert.deepEqual(second.snapshot,next);assert.equal(second.app.getActiveId(),'p2');
});

test('portable export cancellation reviews preflight without starting a download',async t=>{
 const original={parameters:{scene:'starter'}},routes=[];let review;
 const env=await harness(t,{initial:record('p1',1,original),confirmExport:async value=>{review=value;return false;},fetch:async(url)=>{
  routes.push(url);if(url.endsWith('/save'))return response({record:record('p1',1,original)});
  if(url.endsWith('/preflight'))return response({id:'p1',revision:1,files:[{path:'project/audio/local.audio'}],warnings:[{reference:'https://example.com/music.wav'}]});
  return response({token:'token',projects:[],active:record('p1',1,original)});
 }});
 assert.equal(await env.actions.exportProject(),null);assert.equal(review.revision,1);assert.equal(review.warnings.length,1);assert.ok(!routes.some(route=>route.endsWith('/export')));
});


for(const staleError of [false,true])test(`save copy preserves edits and resumes autosave despite an old ${staleError?'failed':'successful'} poll`,async t=>{
 const original={parameters:{scene:'starter',amount:1}},incoming={parameters:{scene:'starter',amount:2}},manual={parameters:{scene:'starter',amount:99}};
 let gets=0,resolvePoll,copyBody,savedBody,copied;
 const env=await harness(t,{initial:record('p1',1,original),canApplyExternal:()=>false,onProjectCopied:value=>{copied=value;},fetch:async(url,options={})=>{
  if(url.endsWith('/save-copy')){copyBody=JSON.parse(options.body);return response({record:record('copy',1,copyBody.snapshot),reloadRequired:false});}
  if(url.endsWith('/save')){savedBody=JSON.parse(options.body);return response({record:record('copy',2,savedBody.snapshot)});}
  if(++gets>2)return new Promise(resolve=>{resolvePoll=resolve;});
  return response({token:'token',projects:[],active:record('p1',gets,gets===1?original:incoming)});
 }});
 env.snapshot=manual;await env.fire(1800);assert.equal(env.views.at(-1).conflict,true);
 const oldPoll=env.fire(1800);await Promise.resolve();
 const restores=env.setCalls.length;await env.actions.saveCopy('My recovered edits');
 assert.equal(copyBody.sourceId,'p1');assert.deepEqual(copyBody.snapshot,manual);assert.ok(copyBody.copyId);
 assert.equal(savedBody,undefined,'copy never calls the conflicting save');assert.equal(env.app.getActiveId(),'copy');assert.equal(env.views.at(-1).conflict,false);
 assert.deepEqual(copied,manual);assert.equal(env.setCalls.length,restores,'preserves Undo and playhead by not restoring the editor');
 resolvePoll(staleError?{ok:false,status:409,json:async()=>({error:'Old project conflict'})}:response({token:'token',projects:[],active:record('p1',2,incoming)}));await oldPoll;
 assert.equal(env.views.at(-1).conflict,false,'old-project response cannot lock the new copy');
 env.snapshot={parameters:{scene:'starter',amount:100}};await env.fire(400);env.now=1500;await env.fire(400);
 for(let i=0;i<6;i++)await Promise.resolve();
 assert.equal(savedBody.activeId,'copy');assert.equal(savedBody.snapshot.parameters.amount,100);assert.deepEqual(env.snapshot,savedBody.snapshot);
});

test('a failed copy keeps the conflict and draft, and retries the same request id',async t=>{
 const original={parameters:{scene:'starter',amount:1}},manual={parameters:{scene:'starter',amount:99}};const copies=[];let drafts=[];
 const env=await harness(t,{initial:record('p1',1,original),fetch:async(url,options={})=>{
  if(url.endsWith('/save-copy')){copies.push(JSON.parse(options.body));if(copies.length===1)throw Error('Connection lost');return response({record:record('copy',1,manual),reloadRequired:false});}
  if(url.endsWith('/save'))return {ok:false,status:409,json:async()=>({error:'Newer saved changes'})};
  return response({token:'token',projects:[],active:record('p1',1,original)});
 }});
 globalThis.sessionStorage.setItem=(key,value)=>{if(key==='framevolve-session-draft')drafts.push(JSON.parse(value));};
 env.snapshot=manual;await assert.rejects(env.app.save(true),/Newer saved changes/);
 await assert.rejects(env.actions.saveCopy('Recovery'),/Connection lost/);
 assert.equal(env.views.at(-1).conflict,true);assert.deepEqual(env.snapshot,manual);assert.deepEqual(drafts.at(-1).snapshot,manual);
 await env.fire(400);assert.equal(copies.length,1,'autosave must stay blocked until recovery succeeds');
 await env.actions.saveCopy('Recovery');assert.deepEqual(copies[0],copies[1]);assert.equal(env.app.getActiveId(),'copy');
});

test('a source switch saves edits made during copy before reloading the persisted copy',async t=>{
 const original={parameters:{scene:'loop',amount:1}},manual={parameters:{scene:'loop',amount:99}},later={parameters:{scene:'loop',amount:100}};
 const priorLocation=globalThis.location;t.after(()=>{globalThis.location=priorLocation;});let redirected,resolveCopy,savedBody;
 globalThis.location={href:'http://localhost:4212/?scene=loop',replace:url=>{redirected=url;}};
 const env=await harness(t,{initial:record('p1',1,original),fetch:async(url,options={})=>{
  if(url.endsWith('/save-copy'))return new Promise(resolve=>{resolveCopy=resolve;});
  if(url.endsWith('/save')){savedBody=JSON.parse(options.body);return response({record:record('copy',2,savedBody.snapshot)});}
  return response({token:'token',projects:[],active:record('p1',1,original)});
 }});
 env.snapshot=manual;const saving=env.actions.saveCopy('Recovered');await Promise.resolve();env.snapshot=later;
 resolveCopy(response({record:record('copy',1,manual),reloadRequired:true}));await saving;
 assert.equal(savedBody.activeId,'copy');assert.deepEqual(savedBody.snapshot,later);assert.match(redirected,/scene=loop/);assert.equal(env.app.isSwitching(),true);
});
