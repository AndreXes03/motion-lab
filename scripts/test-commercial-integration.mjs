import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {createStudioApi, validateStudioParameters} from './studio-api.mjs';
import {ROOT} from './project-store.mjs';
import {createCommercialBrief} from '../src/engine/commercial-brief.js';
import {createControlManifest} from '../src/engine/control-catalog.js';
import {migrateLegacyScene} from '../src/engine/legacy-scene.js';
import {sceneConfig} from '../src/scene-registry.js';

// No renderer or external server: exercise the same validation and disk-backed
// version endpoints as local Studio. Remove only the UUID created by this test.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
const commercial = createCommercialBrief({
  brand: {name: 'bax.', tagline: 'Built at bax.'},
  copy: {headline: 'Meet bax. Your next workspace.', url: 'https://bax.example/product'},
  assets: {logo: {name: 'bax.logo.png', src: png}, screenshots: [{name: 'bax.screen.png', src: png}]}
});
const manifest = createControlManifest('launch');
assert(manifest.controls.includes('typeScale') && manifest.controls.includes('motionStrength'));
const input = {
  scene: 'launch', commercial,
  sceneControls: {typeScale: 1.1, motionStrength: .7},
  studio: {values: {typeScale: 1.1, motionStrength: .7}, preset: 'original', controlManifest: manifest},
  animation: {version: 1, tracks: {typeScale: [{t: 0, value: .9, ease: 'linear'}, {t: 24, value: 1.1, ease: 'linear'}]}}
};
const untouched = structuredClone(input);
const validated = await validateStudioParameters(input);
assert.deepEqual(input, untouched, 'Server validation must not mutate caller state');
assert.deepEqual(validated.commercial, commercial, 'Legacy migration must not rewrite user copy or embedded asset names');
assert.deepEqual(validated.studio.controlManifest, manifest);
assert.equal(validated.animation.tracks.typeScale.at(-1).t, 24);
assert.equal(validated.sceneControls.typeScale, 1.1);
assert.equal(sceneConfig('launch').duration, commercial.duration, 'Preview, brief and server share one timeline duration');
assert.deepEqual((await validateStudioParameters({scene: 'launch'})).commercial, createCommercialBrief());
assert.deepEqual((await validateStudioParameters(JSON.parse(JSON.stringify(validated)))).commercial, commercial);
await assert.rejects(() => validateStudioParameters({scene: 'pulse', commercial}), /commercial is only supported for launch/);
await assert.rejects(() => validateStudioParameters({scene: 'launch', commercial: {...commercial, duration: 30}}), /duration/);
await assert.rejects(() => validateStudioParameters({...input, sceneControls: {typeScale: 999}}), /Invalid scene control/);
await assert.rejects(() => validateStudioParameters({...input, animation: {version: 1, tracks: {typeScale: [{t: 25, value: 1}]}}}), /within scene duration/);
const legacy = migrateLegacyScene({scene: 'bax', objectEdits: {'bax.shell': {x: 1}}, commercial});
assert.equal(legacy.scene, 'objects');
assert(legacy.objectEdits['objects.shell']);
assert.deepEqual(legacy.commercial, commercial, 'Legacy identifier migration leaves commercial brand, URL and asset data unchanged');

const api = createStudioApi({spawnFn: () => {throw new Error('This test must not invoke a render');}});
const server = createServer((req, res) => api(req, res, () => {res.statusCode = 404; res.end();}));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/studio`;
const request = (route, body) => fetch(base + route, body === undefined ? {} : {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
});
let createdId;
try {
  let response = await request('/versions', {name: 'Commercial integration test', parameters: input});
  const created = await response.json();
  if (response.status === 201) createdId = created.id;
  assert.equal(response.status, 201, created.error);
  assert.match(createdId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(created.parameters.commercial, commercial);

  // Simulate edits after Save: the stored version must retain its own snapshot.
  input.commercial.copy.headline = 'Later unsaved edit';
  response = await request(`/versions/${createdId}`);
  assert.equal(response.status, 200);
  const {snapshot} = await response.json();
  assert.deepEqual(snapshot.parameters.commercial, untouched.commercial);
  assert.deepEqual(snapshot.parameters.studio.controlManifest, manifest);
  assert.deepEqual(snapshot.parameters.animation, validated.animation);
  const stored = JSON.parse(await readFile(path.join(ROOT, 'project/versions', `${createdId}.json`), 'utf8'));
  assert.deepEqual(stored.parameters.commercial.assets, untouched.commercial.assets, 'Exact embedded asset data persists on disk');
  assert.deepEqual((await validateStudioParameters(snapshot.parameters)).commercial, untouched.commercial, 'Saved version can be restored through the server contract');

  response = await request('/versions', {name: 'Reject unsupported brief', parameters: {scene: 'pulse', commercial}});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /only supported for launch/);
  console.log(JSON.stringify({passed: true, checks: ['launch server defaults', 'strict scene and timing contract', 'editable controls and animation', 'legacy copy preservation', 'POST/GET saved version', 'embedded asset disk persistence', 'snapshot isolation']}));
} finally {
  await new Promise(resolve => server.close(resolve));
  if (createdId && /^[a-f0-9-]{36}$/.test(createdId)) await rm(path.join(ROOT, 'project/versions', `${createdId}.json`), {force: true});
}
