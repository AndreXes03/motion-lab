import { spawn as nodeSpawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readProject, ROOT, validateLook } from './project-store.mjs';
import { studioProjects } from '../src/engine/project-controls.js';
import { config } from '../src/config.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIR, 'cli.mjs');
const VERSION_DIR = path.join(ROOT, 'project', 'versions');
const RENDER_DIR = path.join(ROOT, 'renders', 'studio');
const DOWNLOAD_DIR = path.join(homedir(), 'Downloads');
const downloadPath = (id, ext) => path.join(DOWNLOAD_DIR, `Motion-Lab-${id}${ext}`);
async function publishDownload(job) {
  await mkdir(DOWNLOAD_DIR, { recursive: true });
  const destination = downloadPath(job.id, job.extension);
  if (job.outputPath !== destination) await copyFile(job.outputPath, destination, 1);
  job.outputPath = destination;
  job.destination = 'downloads';
}
const MAX_BODY = 2 * 1024 * 1024;
const MAX_JSON_DEPTH = 32;
const ALLOWED_PARAMETERS = new Set(['scene', 'look', 'motion', 'graphics', 'studio', 'display', 'shell', 'knob', 'objectMotion', 'review', 'inspect']);
const LOOK_SECTIONS = {
  camera: new Set(['fov']),
  lighting: new Set(['preset', 'key', 'fill', 'rim', 'environment', 'keyPosition', 'keyTarget', 'rimPosition', 'keyAngle', 'keyPenumbra', 'keyColor', 'rimColor']),
  surface: new Set(['shellRoughness', 'grainScale']),
  post: new Set(['exposure', 'bloomStrength', 'bloomThreshold', 'bloomRadius', 'aberrationPx', 'grain', 'grainSize', 'vignette', 'lensDistortion', 'aoIntensity', 'shutterAngle', 'antialias']),
  motion: new Set(['amount'])
};
const jobs = new Map();
let activeRenderId = null;
let persistedJobsLoaded = false;

function apiError(status, message) { const error = new Error(message); error.status = status; return error; }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function finiteTree(value, label = 'value', depth = 0) {
  if (depth > MAX_JSON_DEPTH) throw new Error(`${label} exceeds the maximum nesting depth`);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${label} must contain only finite numbers`);
  if (Array.isArray(value)) { if (value.length > 10000) throw new Error(`${label} is too large`); value.forEach((item, i) => finiteTree(item, `${label}[${i}]`, depth + 1)); }
  else if (isRecord(value)) { for (const [key, item] of Object.entries(value)) { if (key.length > 120) throw new Error(`${label} has an oversized key`); finiteTree(item, `${label}.${key}`, depth + 1); } }
  else if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${label} contains an unsupported value`);
}
function merge(base, patch) {
  if (!isRecord(base) || !isRecord(patch)) return structuredClone(patch);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) out[key] = isRecord(value) && isRecord(out[key]) ? merge(out[key], value) : structuredClone(value);
  return out;
}

function validateMotion(motion, allowedTracks) {
  if (!isRecord(motion) || !isRecord(motion.tracks)) throw new Error('motion must be an object with a tracks map');
  if (Object.keys(motion).some(key => !['name', 'cuts', 'tracks'].includes(key))) throw new Error('motion contains unsupported fields');
  if (motion.cuts !== undefined) {
    if (!Array.isArray(motion.cuts) || motion.cuts.length > 1000) throw new Error('motion.cuts must be an array of at most 1000 cut times');
    for (const cut of motion.cuts) {
      const time = typeof cut === 'number' ? cut : isRecord(cut) ? (cut.time ?? cut.t) : NaN;
      if (!Number.isFinite(time) || time < 0 || time > config.duration) throw new Error(`Every motion cut must be a finite time from 0 to ${config.duration} seconds`);
    }
  }
  const tracks = Object.entries(motion.tracks);
  if (tracks.length > 100) throw new Error('motion has too many tracks');
  for (const [name, keys] of tracks) {
    if (!allowedTracks.has(name)) throw new Error(`Unsupported motion track: ${name}`);
    if (!name || name.length > 120 || !Array.isArray(keys) || keys.length > 1000) throw new Error(`Invalid motion track: ${name}`);
    let previous = -Infinity;
    for (const key of keys) {
      if (!isRecord(key) || Object.keys(key).some(k => !['t', 'value', 'ease'].includes(k)) || !Number.isFinite(key.t) || key.t < 0 || key.t > 10 || key.t < previous || key.value === undefined) throw new Error(`Invalid key in motion track ${name}`);
      finiteTree(key.value, `motion.${name}.value`);
      const vector = ['camera.position', 'camera.target'].includes(name) || (!name.endsWith('.z') && name !== 'camera.roll');
      if (vector ? (!Array.isArray(key.value) || key.value.length !== 3 || !key.value.every(Number.isFinite)) : (typeof key.value !== 'number' || !Number.isFinite(key.value))) throw new Error(`Invalid value in motion track ${name}`);
      if (key.ease !== undefined && !['linear', 'smooth', 'hold', 'in', 'out', 'inOut'].includes(key.ease)) throw new Error(`Invalid easing in motion track ${name}`);
      previous = key.t;
    }
  }
  return motion;
}

function validateStudioMeta(studio, scene) {
  if (studio === undefined) return undefined;
  if (!isRecord(studio) || Object.keys(studio).some(k => !['values', 'preset'].includes(k))) throw new Error('studio must contain only values and preset');
  const project = studioProjects.find(p => p.id === scene);
  if (!project) throw new Error(`Unsupported scene: ${scene}`);
  const presetId = studio.preset ?? 'original';
  if (typeof presetId !== 'string' || !project.presets.some(p => p.id === presetId)) throw new Error(`Unknown preset for ${scene}`);
  const values = studio.values ?? {};
  if (!isRecord(values)) throw new Error('studio.values must be an object');
  const controls = new Map(project.controls.map(c => [c.id, c]));
  for (const [key, value] of Object.entries(values)) {
    const control = controls.get(key);
    if (!control) throw new Error(`Unknown studio control: ${key}`);
    if (control.type === 'range' && (typeof value !== 'number' || !Number.isFinite(value) || value < control.min || value > control.max)) throw new Error(`studio.values.${key} is outside its allowed range`);
    if (control.type === 'color' && (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))) throw new Error(`studio.values.${key} must be a hex color`);
    if (control.type === 'text' && (typeof value !== 'string' || value.length > 22)) throw new Error(`studio.values.${key} must be text up to 22 characters`);
  }
  return { values: structuredClone(values), preset: presetId };
}

export async function validateStudioParameters(input) {
  if (!isRecord(input)) throw new Error('parameters must be a JSON object');
  finiteTree(input, 'parameters');
  for (const key of Object.keys(input)) if (!ALLOWED_PARAMETERS.has(key)) throw new Error(`Unsupported parameter: ${key}`);
  const scene = input.scene ?? 'bax';
  if (!['bax', 'procedural'].includes(scene)) throw new Error('scene must be bax or procedural');
  const defaults = await Promise.all([readProject('look'), readProject('motion')]);
  const look = merge(defaults[0], input.look ?? {});
  if (!isRecord(look) || Object.entries(look).some(([section, values]) => !LOOK_SECTIONS[section] || !isRecord(values) || Object.keys(values).some(key => !LOOK_SECTIONS[section].has(key)))) throw new Error('look contains unsupported sections or fields');
  try { validateLook(look); } catch (error) { throw new Error(`Invalid look: ${error.message}`); }
  const motion = merge(defaults[1], input.motion ?? {});
  validateMotion(motion, new Set(Object.keys(defaults[1].tracks)));

  const normalized = { ...structuredClone(input), scene, look, motion };
  if (input.graphics !== undefined) {
    if (scene !== 'procedural' || !isRecord(input.graphics) || Object.keys(input.graphics).some(k => !['title', 'accent', 'density', 'speed'].includes(k))) throw new Error('graphics is only supported for the procedural scene');
    const g = input.graphics;
    if (g.title !== undefined && (typeof g.title !== 'string' || g.title.length > 22)) throw new Error('graphics.title must be text up to 22 characters');
    if (g.accent !== undefined && (typeof g.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(g.accent))) throw new Error('graphics.accent must be a hex color');
    if (g.density !== undefined && (!Number.isInteger(g.density) || g.density < 4 || g.density > 18)) throw new Error('graphics.density must be an integer from 4 to 18');
    if (g.speed !== undefined && (typeof g.speed !== 'number' || !Number.isFinite(g.speed) || g.speed < 0.25 || g.speed > 2.5)) throw new Error('graphics.speed must be 0.25..2.5');
  }
  if (input.shell !== undefined && (typeof input.shell !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.shell))) throw new Error('shell must be a hex color');
  if (input.knob !== undefined && (typeof input.knob !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.knob))) throw new Error('knob must be a hex color');
  if (input.display !== undefined && (typeof input.display !== 'string' || input.display.length > 22)) throw new Error('display must be text up to 22 characters');
  if (input.objectMotion !== undefined && (typeof input.objectMotion !== 'number' || !Number.isFinite(input.objectMotion) || input.objectMotion < 0 || input.objectMotion > 2)) throw new Error('objectMotion must be 0..2');
  if (input.review !== undefined && (scene !== 'bax' || !['beauty', 'clean', 'clay', 'normals'].includes(input.review))) throw new Error('review is only supported for the BAX scene');
  if (input.inspect !== undefined && (!isRecord(input.inspect) || Object.keys(input.inspect).some(k => !['object', 'yaw'].includes(k)) || scene !== 'bax' || !['device.root', 'bax.emblem', 'bax.kinetic'].includes(input.inspect.object) || (input.inspect.yaw !== undefined && (!Number.isFinite(input.inspect.yaw) || Math.abs(input.inspect.yaw) > 180)))) throw new Error('Invalid inspect parameter');
  const studio = validateStudioMeta(input.studio, scene);
  if (studio) normalized.studio = studio;
  return normalized;
}

function safeId(id) { return typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id); }
function safeName(value) {
  if (typeof value !== 'string') throw new Error('name must be text');
  const name = value.trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('name must contain 1 to 80 printable characters');
  return name;
}
export function validateRenderSettings(kind, input) {
  if (kind === 'frame') {
    const settings = { width: config.width, height: config.height, fps: config.fps, temporalSamples: 1, ...(input ?? {}) };
    if (!isRecord(settings) || (input !== undefined && (!isRecord(input) || Object.keys(input).some(key => !['width', 'height', 'fps', 'temporalSamples'].includes(key))))) throw new Error('frame settings may contain only width, height, fps, and temporalSamples');
    if (!Number.isInteger(settings.width) || !Number.isInteger(settings.height) || settings.width < 2 || settings.height < 2 || settings.width > 3840 || settings.height > 3840 || settings.width * settings.height > 8294400) throw new Error('frame settings width and height must be positive, within 3840 and 8,294,400 pixels');
    if (![24, 25, 30, 50, 60].includes(settings.fps)) throw new Error('frame settings.fps must be 24, 25, 30, 50, or 60');
    if (!Number.isInteger(settings.temporalSamples) || settings.temporalSamples < 1 || settings.temporalSamples > 64) throw new Error('frame settings.temporalSamples must be an integer from 1 to 64');
    return settings;
  }
  if (!['preview', 'export'].includes(kind)) throw new Error('Unknown render kind');
  const base = kind === 'preview'
    ? { width: 960, height: 540, fps: 30, format: 'mp4', bitrateMbps: 8, temporalSamples: 8 }
    : { width: 1920, height: 1080, fps: 30, format: 'mp4', bitrateMbps: 35, temporalSamples: 24 };
  if (input === undefined) return base;
  if (!isRecord(input) || Object.keys(input).some(key => !['width', 'height', 'fps', 'format', 'bitrateMbps', 'temporalSamples'].includes(key))) throw new Error('settings must contain only width, height, fps, format, bitrateMbps, and temporalSamples');
  const settings = { ...base, ...structuredClone(input) };
  if (!Number.isInteger(settings.width) || !Number.isInteger(settings.height) || settings.width < 320 || settings.height < 240 || settings.width > 3840 || settings.height > 2160 || settings.width % 2 !== 0 || settings.height % 2 !== 0 || settings.width * settings.height > 8294400) throw new Error('settings width and height must be even, at least 320×240, within 3840×2160 and 8,294,400 pixels');
  if (![24, 25, 30, 50, 60].includes(settings.fps)) throw new Error('settings.fps must be 24, 25, 30, 50, or 60');
  if (!['mp4', 'webm', 'prores'].includes(settings.format)) throw new Error('settings.format must be mp4, webm, or prores');
  if (!Number.isInteger(settings.temporalSamples) || settings.temporalSamples < 1 || settings.temporalSamples > 64) throw new Error('settings.temporalSamples must be an integer from 1 to 64');
  if (settings.format === 'prores') settings.bitrateMbps = null;
  else if (typeof settings.bitrateMbps !== 'number' || !Number.isFinite(settings.bitrateMbps) || settings.bitrateMbps < 2 || settings.bitrateMbps > 200) throw new Error('settings.bitrateMbps must be 2..200 for mp4 and webm');
  return settings;
}

function outputExtension(kind, settings) {
  if (kind === 'frame') return '.png';
  return settings.format === 'webm' ? '.webm' : settings.format === 'prores' ? '.mov' : '.mp4';
}

function mimeType(extension) {
  return extension === '.png' ? 'image/png' : extension === '.webm' ? 'video/webm' : extension === '.mov' ? 'video/quicktime' : 'video/mp4';
}
async function readJson(req) {
  let size = 0, raw = '';
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw apiError(413, 'Request body exceeds 2 MB');
    raw += chunk.toString('utf8');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw apiError(400, 'Request body must be valid JSON'); }
}
function send(res, status, data) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

async function listVersions() {
  await mkdir(VERSION_DIR, { recursive: true });
  const entries = await readdir(VERSION_DIR, { withFileTypes: true });
  const versions = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try { versions.push(JSON.parse(await readFile(path.join(VERSION_DIR, entry.name), 'utf8'))); } catch { /* ignore incomplete/corrupt files */ }
  }
  return versions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function sourceFingerprint() {
  const hash = createHash('sha256');
  const addFile = async file => { const info = await stat(file).catch(() => null); if (info?.isFile()) { hash.update(path.relative(ROOT, file)); hash.update(await readFile(file)); } };
  const walk = async dir => {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || ['node_modules', 'renders', 'versions', 'history', 'references'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) await addFile(file);
    }
  };
  for (const dir of ['src', 'project']) await walk(path.join(ROOT, dir));
  for (const file of ['index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'scripts/cli.mjs', 'scripts/project-store.mjs']) await addFile(path.join(ROOT, file));
  return hash.digest('hex');
}

function jobManifest(job) {
  return {
    id: job.id, kind: job.kind, scene: job.scene, status: job.status,
    progress: job.progress, frames: job.frames, total: job.total, phase: job.phase, samples: job.samples, totalSamples: job.totalSamples,
    createdAt: job.createdAt, startedAt: job.startedAt,
    finishedAt: job.finishedAt, time: job.time, sourceHash: job.sourceHash,
    sourceHashAfter: job.sourceHashAfter ?? null, error: job.error,
    parameters: job.parameters, settings: job.settings ?? null, destination: job.destination
  };
}

async function writeJobManifest(job) {
  await writeFile(job.manifestPath, `${JSON.stringify(jobManifest(job), null, 2)}\n`);
}

async function loadPersistedJobs() {
  if (persistedJobsLoaded) return;
  await mkdir(RENDER_DIR, { recursive: true });
  const entries = await readdir(RENDER_DIR, { withFileTypes: true });
  for (const entry of entries) {
    const match = entry.isFile() && entry.name.match(/^([a-f0-9-]{36})\.(png|mp4|webm|mov)\.job\.json$/);
    if (!match || jobs.has(match[1])) continue;
    const [, id, ext] = match;
    try {
      const record = JSON.parse(await readFile(path.join(RENDER_DIR, entry.name), 'utf8'));
      if (record.id !== id || !['frame', 'preview', 'export'].includes(record.kind) || !['completed', 'failed', 'running'].includes(record.status)) continue;
      const outputPath = record.destination === 'downloads' ? downloadPath(id, `.${ext}`) : path.join(RENDER_DIR, `${id}.${ext}`);
      const output = await stat(outputPath).catch(() => null);
      let status = record.status;
      let error = record.error ?? null;
      if (status === 'running') {
        status = 'failed';
        error = 'Viewer stopped before this render finished.';
      } else if (status === 'completed' && !output?.isFile()) {
        status = 'failed';
        error = 'Render file is missing from the output folder.';
      }
      const job = {
        id, kind: record.kind, scene: record.scene, status,
        progress: status === 'completed' ? 100 : Math.max(0, Math.min(99, Number(record.progress) || 0)),
        frames: Math.max(0, Number(record.frames) || (status === 'completed' ? (record.kind === 'frame' ? 1 : config.duration * (record.settings?.fps ?? config.fps)) : 0)),
        total: Math.max(1, Number(record.total) || (record.kind === 'frame' ? 1 : config.duration * (record.settings?.fps ?? config.fps))),
        samples: Math.max(0, Number(record.samples) || (status === 'completed' && record.kind === 'frame' ? (record.settings?.temporalSamples ?? 1) : 0)),
        totalSamples: Math.max(0, Number(record.totalSamples) || (record.kind === 'frame' ? (record.settings?.temporalSamples ?? 1) : 0)),
        phase: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : (record.phase || 'rendering'),
        createdAt: record.createdAt, startedAt: record.startedAt,
        finishedAt: record.finishedAt ?? null, time: record.time ?? 0,
        url: status === 'completed' ? `/api/studio/jobs/${id}/file` : null,
        downloadUrl: status === 'completed' ? `/api/studio/jobs/${id}/download` : null,
        error, extension: `.${ext}`, outputPath, destination: record.destination,
        manifestPath: path.join(RENDER_DIR, entry.name),
        sourceHash: record.sourceHash ?? null, sourceHashAfter: record.sourceHashAfter ?? null,
        parameters: record.parameters ?? {}, settings: record.settings ?? null
      };
      if (job.status === 'completed' && job.destination !== 'downloads') {
        try { await publishDownload(job); await writeJobManifest(job); }
        catch { /* Keep historical files accessible if Downloads is unavailable. */ }
      }
      jobs.set(id, job);
      if (status !== record.status) await writeJobManifest(job);
    } catch { /* Ignore malformed manifests; never trust paths from their contents. */ }
  }
  persistedJobsLoaded = true;
}

function publicJob(job) {
  const { sourceHash, sourceHashAfter, pid, logs, snapshotPath, manifestPath, parameters, ...publicFields } = job;
  return {
    ...publicFields,
    previewUrl: job.frames > 0 ? `/api/studio/jobs/${job.id}/preview?frame=${job.previewFrame??job.frames}` : null,
    filename: path.basename(job.outputPath),
    outputPath: job.outputPath
  };
}

function revealWithFinder(job, spawnFn = nodeSpawn) {
  return new Promise((resolve, reject) => {
    const child = spawnFn('/usr/bin/open', ['-R', job.outputPath], { shell: false, windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`Finder reveal exited with code ${code}`)));
  });
}

function launchJob(job, snapshotFile, args, spawnFn) {
  job.status = 'running'; job.progress = 0; job.phase = 'rendering'; job.startedAt = new Date().toISOString(); activeRenderId = job.id;
  const child = spawnFn(process.execPath, [CLI, ...args, '--snapshot', snapshotFile], { cwd: ROOT, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  job.pid = child.pid;
  let stdout = '', stderr = '', buffer = '';
  const consumeLine = line => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      if (event.type === 'progress') {
        if (Number.isFinite(event.percent)) job.progress = Math.max(0, Math.min(99, event.percent));
        if (Number.isFinite(event.frames)) job.frames = Math.max(job.frames ?? 0, Math.min(job.total, event.frames));
        if (Number.isFinite(event.total)) job.total = Math.max(1, event.total);
        if (Number.isInteger(event.previewFrame)) job.previewFrame = event.previewFrame;
        if (Number.isFinite(event.sample)) job.samples = Math.max(job.samples ?? 0, Math.min(job.totalSamples ?? event.totalSamples ?? 1, event.sample));
        if (Number.isFinite(event.totalSamples)) job.totalSamples = Math.max(1, event.totalSamples);
        if (['sampling', 'rendering', 'encoding'].includes(event.phase)) job.phase = event.phase;
      }
      if (event.type === 'error') job.error = event.message || 'Render failed';
    } catch { /* CLI diagnostics can include non-JSON lines; retain as logs. */ }
  };
  child.stdout.on('data', chunk => {
    stdout = (stdout + chunk.toString()).slice(-30000);
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? '';
    lines.forEach(consumeLine);
  });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16000); });
  child.on('error', error => {
    job.status = 'failed'; job.phase = 'failed'; job.error = error.message; job.finishedAt = new Date().toISOString(); job.progress = 0; activeRenderId = null;
  });
  child.on('close', async code => {
    if (buffer) consumeLine(buffer);
    try {
      if (code !== 0) {
        job.status = 'failed'; job.phase = 'failed'; job.error ||= stderr.trim() || `Render CLI exited with code ${code}`;
      } else {
        const current = await sourceFingerprint();
        job.sourceHashAfter = current;
        if (current !== job.sourceHash) {
          job.status = 'failed';
          job.phase = 'failed';
          job.error = 'Project sources changed during rendering; the output is not marked complete.';
        } else {
          await publishDownload(job);
          job.status = 'completed'; job.phase = 'completed'; job.progress = 100; job.frames = job.total; job.samples = job.totalSamples; job.url = `/api/studio/jobs/${job.id}/file`;
          job.downloadUrl = `/api/studio/jobs/${job.id}/download`;
        }
      }
    } catch (error) { job.status = 'failed'; job.phase = 'failed'; job.error = error.message; }
    job.finishedAt = new Date().toISOString();
    job.logs = stdout.slice(-8000);
    try {
      await writeJobManifest(job);
    } catch (error) {
      job.status = 'failed'; job.url = null; job.error = `Could not write render manifest: ${error.message}`;
    }
    activeRenderId = null;
  });
}

export function createStudioApi({ spawnFn = nodeSpawn, revealFn = revealWithFinder } = {}) {
  return async function studioApi(req, res, next) {
    const route = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (!route.startsWith('/studio')) return next();
    let reservation = null;
    try {
      const host = req.headers.host;
      if (req.headers.origin && (!host || new URL(req.headers.origin).host !== host)) return send(res, 403, { error: 'Same-origin local requests only' });
      if (!['127.0.0.1', 'localhost', '[::1]'].some(local => host?.startsWith(`${local}:`) || host === local)) return send(res, 403, { error: 'Local requests only' });

      if (req.method === 'GET' && route === '/studio') {
        await loadPersistedJobs();
        const [versions] = await Promise.all([listVersions()]);
        const currentJobs = [...jobs.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(publicJob);
        return send(res, 200, { versions, jobs: currentJobs, outputDirectory: DOWNLOAD_DIR });
      }
      if (req.method === 'GET' && route.startsWith('/studio/versions/')) {
        const id = decodeURIComponent(route.slice('/studio/versions/'.length));
        if (!safeId(id)) return send(res, 400, { error: 'Invalid version id' });
        let snapshot;
        try { snapshot = JSON.parse(await readFile(path.join(VERSION_DIR, `${id}.json`), 'utf8')); }
        catch (error) { return send(res, error.code === 'ENOENT' ? 404 : 500, { error: error.code === 'ENOENT' ? 'Version not found' : error.message }); }
        return send(res, 200, { snapshot });
      }
      const fileMatch = route.match(/^\/studio\/jobs\/([a-f0-9-]{36})\/(file|download)$/);
      if (req.method === 'GET' && fileMatch) {
        await loadPersistedJobs();
        const job = jobs.get(fileMatch[1]);
        if (!job || job.status !== 'completed') return send(res, 404, { error: 'Completed render not found' });
        const info = await stat(job.outputPath).catch(() => null);
        if (!info?.isFile()) return send(res, 404, { error: 'Render file not found' });
        res.statusCode = 200;
        res.setHeader('Content-Type', mimeType(job.extension));
        res.setHeader('Content-Length', info.size);
        res.setHeader('Content-Disposition', `${fileMatch[2] === 'download' ? 'attachment' : 'inline'}; filename="${path.basename(job.outputPath)}"`);
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(job.outputPath).pipe(res);
        return;
      }
      const previewMatch = route.match(/^\/studio\/jobs\/([a-f0-9-]{36})\/preview$/);
      if (req.method === 'GET' && previewMatch) {
        await loadPersistedJobs();
        const job = jobs.get(previewMatch[1]);
        if (!job) return send(res, 404, { error: 'Job not found' });
        const fullFrame = job.kind === 'frame' && job.status === 'completed';
        const previewPath = fullFrame ? job.outputPath : path.join(RENDER_DIR, `${job.id}${job.extension}.progress.jpg`);
        const info = await stat(previewPath).catch(() => null);
        if (!info?.isFile()) return send(res, 404, { error: 'Render preview not ready' });
        res.statusCode = 200;
        res.setHeader('Content-Type', fullFrame ? 'image/png' : 'image/jpeg');
        res.setHeader('Content-Length', info.size);
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        createReadStream(previewPath).pipe(res);
        return;
      }
      const revealMatch = route.match(/^\/studio\/jobs\/([a-f0-9-]{36})\/reveal$/);
      if (req.method === 'POST' && revealMatch) {
        await loadPersistedJobs();
        const job = jobs.get(revealMatch[1]);
        if (!job || job.status !== 'completed') return send(res, 404, { error: 'Completed render not found' });
        const info = await stat(job.outputPath).catch(() => null);
        if (!info?.isFile()) return send(res, 404, { error: 'Render file not found' });
        await revealFn(job);
        return send(res, 200, { id: job.id, filename: path.basename(job.outputPath), outputPath: job.outputPath, revealed: true });
      }
      if (req.method === 'GET' && route.startsWith('/studio/jobs/')) {
        await loadPersistedJobs();
        const id = decodeURIComponent(route.slice('/studio/jobs/'.length));
        if (!safeId(id)) return send(res, 400, { error: 'Invalid job id' });
        const job = jobs.get(id);
        if (!job) return send(res, 404, { error: 'Job not found' });
        return send(res, 200, publicJob(job));
      }
      if (req.method !== 'POST') return send(res, 404, { error: 'Unknown studio endpoint' });

      const body = await readJson(req);
      if (route === '/studio/versions') {
        if (!isRecord(body) || Object.keys(body).some(k => !['name', 'parameters'].includes(k))) return send(res, 400, { error: 'Expected name and parameters' });
        const name = safeName(body.name);
        const parameters = await validateStudioParameters(body.parameters);
        const version = { id: randomUUID(), name, scene: parameters.scene, createdAt: new Date().toISOString(), parameters };
        await mkdir(VERSION_DIR, { recursive: true });
        const target = path.join(VERSION_DIR, `${version.id}.json`);
        const temporary = `${target}.tmp`;
        await writeFile(temporary, `${JSON.stringify(version, null, 2)}\n`, { flag: 'wx' });
        await rename(temporary, target);
        return send(res, 201, version);
      }
      if (route === '/studio/render') {
        if (!isRecord(body) || Object.keys(body).some(k => !['kind', 'time', 'parameters', 'settings'].includes(k))) return send(res, 400, { error: 'Expected kind, time, parameters, and optional settings' });
        if (!['frame', 'preview', 'export'].includes(body.kind)) return send(res, 400, { error: 'kind must be frame, preview, or export' });
        if (activeRenderId) return send(res, 409, { error: 'Another local render is already running' });
        const time = body.time ?? 0;
        if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > config.duration) return send(res, 400, { error: `time must be a number from 0 to ${config.duration} seconds` });
        reservation = `pending:${randomUUID()}`;
        activeRenderId = reservation;
        const parameters = await validateStudioParameters(body.parameters);
        const settings = validateRenderSettings(body.kind, body.settings);
        const id = randomUUID();
        const extension = outputExtension(body.kind, settings);
        await mkdir(RENDER_DIR, { recursive: true });
        const outputPath = path.join(RENDER_DIR, `${id}${extension}`);
        const snapshotPath = path.join(RENDER_DIR, `.${id}.snapshot.json`);
        const width = settings?.width ?? config.width;
        const height = settings?.height ?? config.height;
        const fps = settings?.fps ?? config.fps;
        const temporalSamples = settings?.temporalSamples ?? 1;
        const snapshot = { schemaVersion: 2, command: body.kind, config: { ...config, width, height, fps }, parameters, width, height, fps, settings, time, start: 0, end: config.duration, temporalSamples };
        const sourceHash = await sourceFingerprint();
        await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
        const total = body.kind === 'frame' ? 1 : Math.round(config.duration * fps);
        const totalSamples = body.kind === 'frame' ? settings.temporalSamples : 0;
        const job = { id, kind: body.kind, scene: parameters.scene, status: 'running', progress: 0, frames: 0, total, samples: 0, totalSamples, phase: 'rendering', createdAt: new Date().toISOString(), time, url: null, downloadUrl: null, error: null, extension, settings, sourceHash, outputPath, snapshotPath, manifestPath: `${outputPath}.job.json`, parameters };
        jobs.set(id, job);
        await writeJobManifest(job);
        const args = [body.kind, '--out', outputPath, '--snapshot', snapshotPath];
        if (body.kind === 'frame') args.push('--time', String(time), '--width', String(width), '--height', String(height), '--fps', String(fps), '--temporal-samples', String(temporalSamples));
        else args.push('--temporal-samples', String(snapshot.temporalSamples), '--fps', String(fps), '--format', settings.format, ...(settings.bitrateMbps === null ? [] : ['--bitrate-mbps', String(settings.bitrateMbps)]));
        // launchJob appends --snapshot, so pass all other fixed arguments only.
        args.splice(args.indexOf('--snapshot'), 2);
        launchJob(job, snapshotPath, args, spawnFn);
        reservation = null;
        return send(res, 202, { id });
      }
      return send(res, 404, { error: 'Unknown studio endpoint' });
    } catch (error) {
      if (reservation && activeRenderId === reservation) activeRenderId = null;
      return send(res, error.status ?? 400, { error: error.message || 'Studio API error' });
    }
  };
}
