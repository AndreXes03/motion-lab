import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import { ROOT } from './project-store.mjs';
import { createStudioApi, validateRenderSettings, validateStudioParameters } from './studio-api.mjs';
import { validateLook } from './project-store.mjs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import {importAudioAsset} from './audio-assets.mjs';
import {encodeWav} from '../src/engine/sound-design.js';
import {appDemoExample} from '../src/engine/app-demo.js';

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
const temporaryArtifacts = [];
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

  // Saving versions resolves the normalized scene's duration, including custom
  // App Demo timing, independently of the render endpoint's local variables.
  const frequency=200+Number.parseInt(randomUUID().slice(0,4),16);
  const wave=Float32Array.from({length:96000},(_,i)=>.1*Math.sin(i/48000*frequency*Math.PI*2));
  const asset=await importAudioAsset(ROOT,[Buffer.from(encodeWav([wave,wave],48000))],{name:'Version API test voice'});
  temporaryArtifacts.push(path.join(ROOT,'project/audio',`${asset.assetId}.audio`),path.join(ROOT,'project/audio',`${asset.assetId}.json`));
  const voice={id:'voice',assetId:asset.assetId,name:'Test voice',role:'voiceover',duration:2,timelineStart:5};
  const audio=(overrides={})=>({version:2,tracks:[{...voice,...overrides}]});
  const demo=duration=>({...structuredClone(appDemoExample),slides:appDemoExample.slides.map(s=>({...s,duration}))});
  const versionCases=[
    ['default scene',{},201],
    ['procedural without audio',{scene:'procedural'},201],
    ['starter without audio',{scene:'starter'},201],
    ['voice fits procedural',{scene:'procedural',audio:audio()},201],
    ['voice exceeds starter',{scene:'starter',audio:audio()},400],
    ['disabled voice',{scene:'starter',audio:audio({enabled:false})},201],
    ['silent voice',{scene:'starter',audio:audio({volume:0})},201],
    ['music may outlast scene',{scene:'starter',audio:audio({role:'music'})},201],
    ['default App Demo',{scene:'appdemo',audio:audio({timelineStart:15})},201],
    ['extended App Demo',{scene:'appdemo',appDemo:demo(6),audio:audio({timelineStart:21})},201],
    ['short App Demo rejects long voice',{scene:'appdemo',appDemo:demo(3),audio:audio({timelineStart:14})},400]
  ];
  for(const [name,parameters,status] of versionCases){
    const response=await request('/versions',{name,parameters});
    const saved=await response.json();
    assert.equal(response.status,status,`${name}: ${JSON.stringify(saved)}`);
    if(status===400){assert.match(saved.error,/Extend the film or trim the voice/);continue;}
    temporaryArtifacts.push(path.join(ROOT,'project/versions',`${saved.id}.json`));
    const restored=await request(`/versions/${saved.id}`);
    assert.equal(restored.status,200);
    assert.deepEqual((await restored.json()).snapshot.parameters,saved.parameters,`${name}: version round trip`);
    assert.equal(saved.parameters.scene,parameters.scene??'objects');
    if(parameters.audio)assert.deepEqual(saved.parameters.audio,await validateStudioParameters(parameters).then(p=>p.audio));
  }

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
  assert.equal(response.status, 202, response.status===202?undefined:await response.clone().text());
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
  // Simulate a new process, rather than a live schema reload which retains this map.
  globalThis[Symbol.for('framevolve.studio-render-states')]?.delete(ROOT);
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

  // A synchronous child-process launch failure must become a visible terminal
  // job and release the one-render reservation for a subsequent request.
  const api = createStudioApi({
    capabilitiesFn: async () => ({ threejs: { available: true }, skia: { available: true, scenes: ['procedural'], device: 'CPU' } }),
    skiaCapabilitiesFn: async () => ({ available: true, scenes: ['procedural'], device: 'CPU' }),
    nativeRendererFactory: async () => ({ renderPng: async () => Buffer.from('native-thumbnail') }),
    componentManager: { status: async () => ({ busy: false }) },
    spawnFn: () => { throw new Error('simulated spawn failure'); }
  });
  const apiServer = createHttpServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve));
  try {
    const apiBase = `http://127.0.0.1:${apiServer.address().port}/studio`;
    const thumbnailRequest = (parameters, width = 64, height = 64) => fetch(`${apiBase}/thumbnail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parameters, time: 0, width, height }) });
    let thumbnailResponse = await thumbnailRequest({ scene: 'procedural' });
    assert.equal(thumbnailResponse.status, 200);
    assert.equal(thumbnailResponse.headers.get('content-type'), 'image/png');
    assert.equal(await thumbnailResponse.text(), 'native-thumbnail');
    thumbnailResponse = await thumbnailRequest({ scene: 'objects' });
    assert.equal(thumbnailResponse.status, 400, 'native thumbnails reject non-procedural scenes');
    thumbnailResponse = await thumbnailRequest({ scene: 'procedural' }, 641, 360);
    assert.equal(thumbnailResponse.status, 400, 'native thumbnail dimensions are bounded');
    const renderRequest = () => fetch(`${apiBase}/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'frame', time: 0, parameters: { ...validParameters, renderPolicy: { renderer: 'threejs', source: 'user' } } }) });
    let launchResponse = await renderRequest();
    assert.equal(launchResponse.status, 202);
    let launchId = (await launchResponse.json()).id;
    temporaryArtifacts.push(path.join(ROOT, 'renders', 'studio', `${launchId}.png.job.json`), path.join(ROOT, 'renders', 'studio', `.${launchId}.snapshot.json`));
    let launchJob = await fetch(`${apiBase}/jobs/${launchId}`).then(r => r.json());
    assert.equal(launchJob.status, 'failed');
    assert.match(launchJob.error, /simulated spawn failure/);
    launchResponse = await renderRequest();
    assert.equal(launchResponse.status, 202, 'a failed process launch releases the render slot');
    launchId = (await launchResponse.json()).id;
    temporaryArtifacts.push(path.join(ROOT, 'renders', 'studio', `${launchId}.png.job.json`), path.join(ROOT, 'renders', 'studio', `.${launchId}.snapshot.json`));
    launchJob = await fetch(`${apiBase}/jobs/${launchId}`).then(r => r.json());
    assert.equal(launchJob.status, 'failed');
  } finally {
    await new Promise(resolve => apiServer.close(resolve));
  }

  // A fresh module state turns a persisted in-flight job into a visible
  // interrupted result when the local service has stopped.
  const interruptedId = randomUUID();
  const interruptedManifest = path.join(ROOT, 'renders', 'studio', `${interruptedId}.png.job.json`);
  temporaryArtifacts.push(interruptedManifest);
  await mkdir(path.dirname(interruptedManifest), { recursive: true });
  await writeFile(interruptedManifest, `${JSON.stringify({
    id: interruptedId, kind: 'frame', purpose: 'export', scene: 'procedural', status: 'running',
    progress: 34, frames: 0, total: 1, phase: 'rendering', samples: 0, totalSamples: 1,
    createdAt: new Date().toISOString(), time: 0, settings: { width: 64, height: 64, fps: 30, temporalSamples: 1 },
    destination: 'renders', engine: 'threejs', parameters: {}
  }, null, 2)}\n`);
  globalThis[Symbol.for('framevolve.studio-render-states')]?.delete(ROOT);
  const restarted = await import(`./studio-api.mjs?interrupted-test=${Date.now()}`);
  const restartApi = restarted.createStudioApi();
  const restartServer = createHttpServer((req, res) => restartApi(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => restartServer.listen(0, '127.0.0.1', resolve));
  try {
    const recovered = await fetch(`http://127.0.0.1:${restartServer.address().port}/studio`).then(r => r.json());
    const interrupted = recovered.jobs.find(candidate => candidate.id === interruptedId);
    assert.equal(interrupted.status, 'failed');
    assert.match(interrupted.error, /Viewer stopped before this render finished/);
  } finally {
    await new Promise(resolve => restartServer.close(resolve));
  }
  console.log(JSON.stringify({ type: 'test-result', validators: 'passed', versionApi: 'passed', renderJob: job.status, persistence: 'passed', reveal: 'passed', output: job.url }));
} finally {
  await server.close();
  if (createdVersion) await rm(path.join(ROOT, 'project', 'versions', `${createdVersion.id}.json`), { force: true });
  if (outputPath) for (const file of [outputPath, `${outputPath}.progress.jpg`, path.join(homedir(), 'Downloads', `Motion-Lab-${jobId}.png`), sidecarPath, `${outputPath}.job.json`, renderSnapshotPath]) await rm(file, { force: true });
  for (const file of temporaryArtifacts) await rm(file, { force: true });
}
