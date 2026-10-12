import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import { ROOT } from './project-store.mjs';
import { validateRenderSettings, validateStudioParameters } from './studio-api.mjs';
import { validateLook } from './project-store.mjs';
import { readFile, rm, stat } from 'node:fs/promises';

const validParameters = {
  scene: 'procedural',
  look: { post: { grain: 0.012, grainSize: 1.4, antialias: true } },
  graphics: { title: 'MOTION', accent: '#ff5a24', density: 6, speed: 1 },
  animation: {version:1,enabled:true,rate:1,tracks:{speed:[{t:0,value:.5,ease:'linear'},{t:4,value:2,ease:'linear'}]}},
  studio: { values: { title: 'MOTION', accent: '#ff5a24', density: 6, speed: 1 }, preset: 'original', controlManifest:{version:1,scene:'procedural',controls:['title','accent','density','speed']} }
};

const normalized = await validateStudioParameters(validParameters);
assert.equal(normalized.scene, 'procedural');
assert.ok(normalized.look && normalized.motion?.tracks);
await assert.rejects(() => validateStudioParameters({ ...validParameters, destination: '/tmp/anything' }), /Unsupported parameter/);
await assert.rejects(() => validateStudioParameters({ ...validParameters, scene: 'unknown' }), /scene must be/);
await assert.rejects(() => validateStudioParameters({ ...validParameters, graphics: { density: 999 } }), /density must/);
await assert.rejects(() => validateStudioParameters({ ...validParameters, studio: { values: { density: 999 }, preset: 'original' } }), /outside its allowed range/);
await assert.rejects(() => validateStudioParameters({ ...validParameters, look: { post: { antialias: 'yes' } } }), /antialias must be boolean/);
await assert.rejects(() => validateStudioParameters({ ...validParameters, motion: { cuts: [{}] } }), /cut must be/);
assert.deepEqual(validateRenderSettings('preview'), { width: 960, height: 540, fps: 30, format: 'mp4', bitrateMbps: 8, temporalSamples: 8 });
assert.deepEqual(validateRenderSettings('export'), { width: 1920, height: 1080, fps: 30, format: 'mp4', bitrateMbps: 35, temporalSamples: 24 });
assert.deepEqual(validateRenderSettings('export', { width: 1280, height: 720, fps: 50, format: 'webm', bitrateMbps: 36, temporalSamples: 12 }), { width: 1280, height: 720, fps: 50, format: 'webm', bitrateMbps: 36, temporalSamples: 12 });
assert.equal(validateRenderSettings('export', { format: 'prores', bitrateMbps: 180 }).bitrateMbps, null);
assert.throws(() => validateRenderSettings('export', { width: 1921 }), /even/);
assert.throws(() => validateRenderSettings('export', { width: 3840, height: 2160, fps: 30, temporalSamples: 65 }), /temporalSamples/);
assert.deepEqual(validateRenderSettings('frame', { width: 1280, height: 720, fps: 30, temporalSamples: 2 }), { width: 1280, height: 720, fps: 30, temporalSamples: 2 });
assert.throws(() => validateRenderSettings('frame', { width: 1280, format: 'webm' }), /only width/);
assert.throws(() => validateRenderSettings('export', { fps: 29.97 }), /fps/);
const compatibleLook = structuredClone(normalized.look);
compatibleLook.post.grain = 0.08;
compatibleLook.post.grainSize = 3;
assert.equal(validateLook(compatibleLook), compatibleLook);
compatibleLook.post.grainSize = 3.01;
assert.throws(() => validateLook(compatibleLook), /grainSize/);

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
let createdVersion, jobId;
let outputPath, sidecarPath, renderSnapshotPath;
try {
  await server.listen();
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  const request = (route, body) => fetch(`${base}/api/studio${route}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  let response = await request('');
  assert.equal(response.status, 200);
  const initial = await response.json();
  assert.ok(Array.isArray(initial.versions) && Array.isArray(initial.jobs));
  assert.equal(initial.outputDirectory, path.join(homedir(), 'Downloads'));

  response = await request('/render', { kind: 'preview', time: 0, parameters: validParameters, settings: { width: 1001 } });
  assert.equal(response.status, 400, 'invalid render settings are rejected before a job is created');

  response = await request('/versions', { name: 'API test snapshot', parameters: validParameters });
  assert.equal(response.status, 201);
  createdVersion = await response.json();
  assert.match(createdVersion.id, /^[a-f0-9-]{36}$/);
  assert.equal(createdVersion.name, 'API test snapshot');
  response = await request(`/versions/${createdVersion.id}`);
  assert.equal(response.status, 200);
  const versionResponse = await response.json();
  assert.equal(versionResponse.snapshot.parameters.scene, 'procedural');
  assert.ok(versionResponse.snapshot.parameters.look);
  assert.deepEqual(versionResponse.snapshot.parameters.animation,normalized.animation);
  assert.deepEqual(versionResponse.snapshot.parameters.studio.controlManifest,normalized.studio.controlManifest);

  response = await request('/render', { kind: 'frame', time: 2, parameters: validParameters });
  assert.equal(response.status, 202);
  jobId = (await response.json()).id;
  outputPath = path.join(ROOT, 'renders', 'studio', `${jobId}.png`);
  const publishedPath = path.join(homedir(), 'Downloads', `Motion-Lab-${jobId}.png`);
  sidecarPath = `${outputPath}.project.json`;
  const manifestPath = `${outputPath}.job.json`;
  renderSnapshotPath = path.join(ROOT, 'renders', 'studio', `.${jobId}.snapshot.json`);

  response = await request('/render', { kind: 'frame', time: 2, parameters: validParameters });
  assert.equal(response.status, 409, 'only one render may be active');

  let job;
  const deadline = Date.now() + 120_000;
  do {
    await delay(500);
    response = await request(`/jobs/${jobId}`);
    assert.equal(response.status, 200);
    job = await response.json();
  } while (job.status === 'running' && Date.now() < deadline);
  assert.equal(job.status, 'completed', job.error || 'frame job did not complete');
  assert.equal(job.progress, 100);
  assert.equal(job.url, `/api/studio/jobs/${jobId}/file`);
  assert.equal(job.downloadUrl, `/api/studio/jobs/${jobId}/download`);
  assert.equal(job.filename, `Motion-Lab-${jobId}.png`);
  assert.equal(job.outputPath, publishedPath);
  assert.equal(job.destination, 'downloads');
  assert.ok((await stat(outputPath)).size > 1000, 'frame output exists');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.status, 'completed');
  assert.deepEqual(manifest.settings, validateRenderSettings('frame'));
  assert.equal(manifest.sourceHash, manifest.sourceHashAfter);
  assert.deepEqual(JSON.parse(await readFile(sidecarPath,'utf8')).parameters.animation,normalized.animation);
  const fileResponse = await fetch(`${base}${job.url}`);
  assert.equal(fileResponse.status, 200, `render output is served by Vite: ${await fileResponse.text()}`);
  assert.match(fileResponse.headers.get('content-disposition'), /^inline;/);
  const framePreview = await fetch(`${base}${job.previewUrl}`);
  assert.equal(framePreview.status, 200);
  assert.match(framePreview.headers.get('content-type'), /image\/png/, 'completed frame preview returns the original full-resolution PNG');
  const downloadResponse = await fetch(`${base}${job.downloadUrl}`);
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /^attachment;/);

  const list = await request('').then(r => r.json());
  assert.ok(list.versions.some(v => v.id === createdVersion.id));
  assert.ok(list.jobs.some(j => j.id === jobId && j.status === 'completed'));

  // Load the API module in a fresh instance to model a viewer restart and
  // verify that completed jobs are recovered from their disk manifest.
  const fresh = await import(`./studio-api.mjs?restart-test=${Date.now()}`);
  let revealedPath = null;
  const persistedApi = fresh.createStudioApi({ revealFn: async job => { revealedPath = job.outputPath; } });
  const persistedServer = createHttpServer((req, res) => persistedApi(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => persistedServer.listen(0, '127.0.0.1', resolve));
  try {
    const persistedBase = `http://127.0.0.1:${persistedServer.address().port}`;
    const recovered = await fetch(`${persistedBase}/studio`).then(r => r.json());
    const restoredJob = recovered.jobs.find(candidate => candidate.id === jobId);
    assert.equal(restoredJob.status, 'completed');
    assert.equal(restoredJob.outputPath, publishedPath);
    assert.equal(restoredJob.filename, `Motion-Lab-${jobId}.png`);
    assert.equal(restoredJob.downloadUrl, `/api/studio/jobs/${jobId}/download`);
    assert.equal(recovered.outputDirectory, path.join(homedir(), 'Downloads'));
    let revealResponse = await fetch(`${persistedBase}/studio/jobs/${jobId}/reveal`, { method: 'POST' });
    assert.equal(revealResponse.status, 200);
    assert.equal(revealedPath, publishedPath);
    revealResponse = await fetch(`${persistedBase}/studio/jobs/${'f'.repeat(36)}/reveal`, { method: 'POST' });
    assert.equal(revealResponse.status, 404, 'reveal accepts only a completed job id, not an arbitrary path');
  } finally {
    await new Promise(resolve => persistedServer.close(resolve));
  }
  console.log(JSON.stringify({ type: 'test-result', validators: 'passed', versionApi: 'passed', renderJob: job.status, persistence: 'passed', reveal: 'passed', output: job.url }));
} finally {
  await server.close();
  if (createdVersion) await rm(path.join(ROOT, 'project', 'versions', `${createdVersion.id}.json`), { force: true });
  if (outputPath) for (const file of [outputPath, `${outputPath}.progress.jpg`, path.join(homedir(), 'Downloads', `Motion-Lab-${jobId}.png`), sidecarPath, `${outputPath}.job.json`, renderSnapshotPath]) await rm(file, { force: true });
}
