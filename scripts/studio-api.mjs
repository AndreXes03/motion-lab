import {verifyExportDestination} from './export-preflight.mjs';
import {migrateLegacyScene} from '../src/engine/legacy-scene.js';
import {studyControlDefinitions} from '../src/engine/scene-capabilities.js';
import {resolveControlManifest} from '../src/engine/control-catalog.js';
import {validateParameterAnimation} from '../src/engine/parameter-animation.js';
import {validateAuthoredMotion} from '../src/engine/authored-animation.js';
import {validateRenderPlan,resolveRenderPlan} from '../src/engine/render-policy.js';
import {getCyclesCapabilities,buildCyclesCommand} from './cycles/studio.mjs';
import {cyclesComponentManager} from './cycles/component.mjs';
import {getMixedCapabilities,preflightMixed,buildMixedCommand} from './mixed/studio.mjs';
import {sceneConfig,sceneIds,isNewScene} from '../src/scene-registry.js';
import { spawn as nodeSpawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readProject, ROOT, validateLook } from './project-store.mjs';
import { studioProjects } from '../src/engine/project-controls.js';
import { normalizeSound } from '../src/engine/sound-design.js';
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
const ALLOWED_PARAMETERS = new Set(['scene', 'look', 'motion', 'graphics', 'studio', 'display', 'shell', 'knob', 'objectMotion', 'objectEdits', 'review', 'inspect', 'sound', 'animation', 'product', 'sceneControls', 'renderPolicy']);
const LOOK_SECTIONS = {
  camera: new Set(['fov','fovScale','distance','keepSubjectSize']),
  lighting: new Set(['preset', 'key', 'fill', 'rim', 'environment', 'keyPosition', 'keyTarget', 'rimPosition', 'keyAngle', 'keyPenumbra', 'keyColor', 'rimColor']),
  surface: new Set(['shellRoughness', 'grainScale']),
  post: new Set(['dofEnabled','dofAuto','dofFocus','dofStrength','dofMaxBlur','exposure', 'bloomStrength', 'bloomThreshold', 'bloomRadius', 'aberrationPx', 'grain', 'grainSize', 'vignette', 'lensDistortion', 'aoIntensity', 'shutterAngle', 'antialias','colorContrast','colorSaturation']),
  motion: new Set(['amount'])
};
// Vite reloads authored schemas while the server stays alive. Render ownership
// and reservations must survive module reloads and remain isolated per repository.
const stateKey = Symbol.for('framevolve.studio-render-states');
const renderStates = globalThis[stateKey] ??= new Map();
if (!renderStates.has(ROOT)) renderStates.set(ROOT, { jobs: new Map(), activeRenderId: null, persistedJobsLoaded: false });
const processState = renderStates.get(ROOT);
const { jobs } = processState;
processState.nativeThumbnailActive ??= false;
let cyclesProbe,cyclesProbeAt=0;
let skiaProbe;
async function nativeSkiaCapabilities(){
  if(process.platform!=='darwin'||process.arch!=='arm64')return {available:false,scenes:[],reason:'Native Skia is available only on macOS Apple silicon.'};
  if(!skiaProbe)skiaProbe=(async()=>{
    try{const {createNativeCanvas}=await import('./native/canvas.mjs');const canvas=createNativeCanvas(1,1);if(!canvas.getContext('2d'))throw Error('Canvas 2D context is unavailable.');canvas.dispose();return {available:true,scenes:['procedural'],device:'CPU'};}
    catch(error){return {available:false,scenes:[],reason:`Native Skia could not load or allocate its CPU canvas (${error.message}). Install or repair the local Skia component, then retry; no renderer fallback will run for an explicit Skia selection.`};}
  })();
  return skiaProbe;
}
async function rendererCapabilities(){
  if(!cyclesProbe||Date.now()-cyclesProbeAt>60000){cyclesProbeAt=Date.now();cyclesProbe=getCyclesCapabilities({root:ROOT});}
  const [cycles,mixed,skia]=await Promise.all([cyclesProbe,getMixedCapabilities({root:ROOT}),nativeSkiaCapabilities()]);
  return {threejs:{available:true},skia,cycles,mixed};
}

function apiError(status, message) { const error = new Error(message); error.status = status; return error; }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function finiteTree(value, label = 'value', depth = 0) {
  if (depth > MAX_JSON_DEPTH) throw new Error(`${label} exceeds the maximum nesting depth`);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${label} must contain only finite numbers`);
  if (Array.isArray(value)) { if (value.length > 10000) throw new Error(`${label} is too large`); value.forEach((item, i) => finiteTree(item, `${label}[${i}]`, depth + 1)); }
  else if (isRecord(value)) { for (const [key, item] of Object.entries(value)) { if (['__proto__','constructor','prototype'].includes(key)) throw new Error(`${label} contains an unsafe key`); if (key.length > 120) throw new Error(`${label} has an oversized key`); finiteTree(item, `${label}.${key}`, depth + 1); } }
  else if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${label} contains an unsupported value`);
}
function merge(base, patch) {
  if (!isRecord(base) || !isRecord(patch)) return structuredClone(patch);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) out[key] = isRecord(value) && isRecord(out[key]) ? merge(out[key], value) : structuredClone(value);
  return out;
}

function validateMotion(motion, allowedTracks, duration=config.duration) {
  // This field is the legacy OBJECTS source document, retained in every recipe.
  // A shorter function-authored scene does not shorten those unused source keys.
  return validateAuthoredMotion(motion,{allowedTracks,duration:10,cutDuration:duration});
}

function validateStudioMeta(studio, scene, look) {
  if (studio === undefined) return undefined;
  if (!isRecord(studio) || Object.keys(studio).some(k => !['values', 'preset', 'lookOverrides', 'controlManifest'].includes(k))) throw new Error('studio contains unsupported fields');
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
  const overrides=studio.lookOverrides??{};
  if(!isRecord(overrides)||Object.entries(overrides).some(([section,fields])=>!LOOK_SECTIONS[section]||!isRecord(fields)||Object.keys(fields).some(key=>!LOOK_SECTIONS[section].has(key))))throw new Error('Unsupported look override');
  validateLook(merge(look,overrides));
  return { values: structuredClone(values), preset: presetId, lookOverrides:structuredClone(overrides), ...(studio.controlManifest===undefined?{}:{controlManifest:resolveControlManifest(studio.controlManifest,scene)}) };
}

export async function validateStudioParameters(input) {
  if (!isRecord(input)) throw new Error('parameters must be a JSON object');
  finiteTree(input, 'parameters');
  input = migrateLegacyScene(input);
  for (const key of Object.keys(input)) if (!ALLOWED_PARAMETERS.has(key)) throw new Error(`Unsupported parameter: ${key}`);
  const scene = input.scene ?? 'objects';
  if (!sceneIds.includes(scene)) throw new Error('scene must be '+sceneIds.join(', '));
  const defaults = await Promise.all([readProject('look'), readProject('motion')]);
  const look = merge(defaults[0], input.look ?? {});
  if (!isRecord(look) || Object.entries(look).some(([section, values]) => !LOOK_SECTIONS[section] || !isRecord(values) || Object.keys(values).some(key => !LOOK_SECTIONS[section].has(key)))) throw new Error('look contains unsupported sections or fields');
  try { validateLook(look); } catch (error) { throw new Error(`Invalid look: ${error.message}`); }
  const motion = merge(defaults[1], input.motion ?? {});
  validateMotion(motion, new Set(Object.keys(defaults[1].tracks)),sceneConfig(scene).duration);

  const normalized = { ...structuredClone(input), scene, look, motion };
  if(input.animation!==undefined)normalized.animation=validateParameterAnimation(input.animation,scene);
  if(input.renderPolicy!==undefined)normalized.renderPolicy=validateRenderPlan(input.renderPolicy);
  if(input.sceneControls!==undefined){
    const definitions=studyControlDefinitions[scene];if(!definitions||!isRecord(input.sceneControls))throw new Error('sceneControls is unsupported for this scene');
    for(const [id,value]of Object.entries(input.sceneControls)){const c=definitions.find(c=>c.id===id);if(!c||!Number.isFinite(value)||value<c.min||value>c.max)throw new Error('Invalid scene control: '+id);}
  }
  if(input.product!==undefined){
    if(scene!=='starter'||!isRecord(input.product))throw new Error('product is only supported for starter');
    const ranges={fov:[45,95],fisheye:[0,.6],keyStrength:[.3,2],fill:[0,.4]};
    for(const [key,value]of Object.entries(input.product)){
      if(['accent','shell'].includes(key)){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Invalid product color: '+key);}
      else{const bounds=ranges[key];if(!bounds||!Number.isFinite(value)||value<bounds[0]||value>bounds[1])throw new Error('Invalid product parameter: '+key);}
    }
  }
  if(input.sound !== undefined)normalized.sound=normalizeSound(input.sound);
  if (input.graphics !== undefined) {
    if (!['procedural','pop'].includes(scene) || !isRecord(input.graphics) || Object.keys(input.graphics).some(k => !['title', 'accent', 'density', 'speed', ...(scene==='pop'?['cameraMotion','fisheye']:[])].includes(k))) throw new Error('graphics is only supported for procedural and pop scenes');
    const g = input.graphics;
    if (g.fisheye !== undefined && (typeof g.fisheye !== 'number' || !Number.isFinite(g.fisheye) || g.fisheye < 0 || g.fisheye > .6)) throw new Error('graphics.fisheye must be 0..0.6');
    if (g.cameraMotion !== undefined && (typeof g.cameraMotion !== 'number' || !Number.isFinite(g.cameraMotion) || g.cameraMotion < 0 || g.cameraMotion > 1)) throw new Error('graphics.cameraMotion must be 0..1');
    if (g.title !== undefined && (typeof g.title !== 'string' || g.title.length > 22)) throw new Error('graphics.title must be text up to 22 characters');
    if (g.accent !== undefined && (typeof g.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(g.accent))) throw new Error('graphics.accent must be a hex color');
    if (g.density !== undefined && (!Number.isInteger(g.density) || g.density < 4 || g.density > 18)) throw new Error('graphics.density must be an integer from 4 to 18');
    if (g.speed !== undefined && (typeof g.speed !== 'number' || !Number.isFinite(g.speed) || g.speed < 0.25 || g.speed > 2.5)) throw new Error('graphics.speed must be 0.25..2.5');
  }
  if (input.shell !== undefined && (typeof input.shell !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.shell))) throw new Error('shell must be a hex color');
  if (input.knob !== undefined && (typeof input.knob !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.knob))) throw new Error('knob must be a hex color');
  if (input.display !== undefined && (typeof input.display !== 'string' || input.display.length > 22)) throw new Error('display must be text up to 22 characters');
  if (input.objectMotion !== undefined && (typeof input.objectMotion !== 'number' || !Number.isFinite(input.objectMotion) || input.objectMotion < 0 || input.objectMotion > 2)) throw new Error('objectMotion must be 0..2');
  if (input.review !== undefined && (scene !== 'objects' || !['beauty', 'clean', 'clay', 'normals'].includes(input.review))) throw new Error('review is only supported for the OBJECTS scene');
  if (input.inspect !== undefined && (!isRecord(input.inspect) || Object.keys(input.inspect).some(k => !['object', 'yaw'].includes(k)) || scene !== 'objects' || !['device.root', 'objects.emblem', 'objects.kinetic'].includes(input.inspect.object) || (input.inspect.yaw !== undefined && (!Number.isFinite(input.inspect.yaw) || Math.abs(input.inspect.yaw) > 180)))) throw new Error('Invalid inspect parameter');
  if(input.objectEdits!==undefined){
    if(!isRecord(input.objectEdits))throw new Error('objectEdits must be an object');
    for(const [id,edits]of Object.entries(input.objectEdits)){
      if(scene!=='objects'||!['device.root','objects.emblem','objects.kinetic'].includes(id)||!isRecord(edits))throw new Error('Unsupported object edit');
      const ranges={x:[-5,5],y:[-5,5],z:[-5,5],yaw:[-180,180],scale:[.25,2]};
      for(const [key,value]of Object.entries(edits)){const range=ranges[key];if(!range||!Number.isFinite(value)||value<range[0]||value>range[1])throw new Error('Invalid object edit: '+id+'.'+key);}
    }
  }
  const studio = validateStudioMeta(input.studio, scene, look);
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
  await walk(path.join(ROOT,'scripts','cycles'));
  await walk(path.join(ROOT,'scripts','native'));
  await walk(path.join(ROOT,'scripts','mixed'));
  await walk(path.join(ROOT,'scripts','lib'));
  for (const file of ['index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'scripts/cli.mjs', 'scripts/project-store.mjs','scripts/cycles.mjs','scripts/mixed-studio.mjs']) await addFile(path.join(ROOT, file));
  return hash.digest('hex');
}

function jobManifest(job) {
  return {
    id: job.id, kind: job.kind, purpose: job.purpose ?? 'export', scene: job.scene, status: job.status,
    progress: job.progress, frames: job.frames, total: job.total, phase: job.phase, samples: job.samples, totalSamples: job.totalSamples,
    createdAt: job.createdAt, startedAt: job.startedAt,
    finishedAt: job.finishedAt, time: job.time, sourceHash: job.sourceHash,
    sourceHashAfter: job.sourceHashAfter ?? null, error: job.error, backend:job.backend,device:job.device,deviceName:job.deviceName,cancelRequested:job.cancelRequested,
    parameters: job.parameters, settings: job.settings ?? null, destination: job.destination, engine:job.engine??'threejs', rendererSelection:job.rendererSelection??null
  };
}

async function writeJobManifest(job) {
  const temporary = `${job.manifestPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(jobManifest(job), null, 2)}\n`);
  await rename(temporary, job.manifestPath);
}

async function loadPersistedJobs() {
  if (processState.persistedJobsLoaded) return;
  await mkdir(RENDER_DIR, { recursive: true });
  const entries = await readdir(RENDER_DIR, { withFileTypes: true });
  for (const entry of entries) {
    const match = entry.isFile() && entry.name.match(/^([a-f0-9-]{36})\.(png|mp4|webm|mov)\.job\.json$/);
    if (!match || jobs.has(match[1])) continue;
    const [, id, ext] = match;
    try {
      const record = JSON.parse(await readFile(path.join(RENDER_DIR, entry.name), 'utf8'));
      if (record.id !== id || !['frame', 'preview', 'export'].includes(record.kind) || !['completed', 'failed', 'running', 'cancelling', 'cancelled'].includes(record.status)) continue;
      const outputPath = record.destination === 'downloads' ? downloadPath(id, `.${ext}`) : path.join(RENDER_DIR,...(record.engine==='cycles'?['cycles']:[]), `${id}.${ext}`);
      const output = await stat(outputPath).catch(() => null);
      let status = record.status;
      let error = record.error ?? null;
      if (status === 'running' || status === 'cancelling') {
        status = 'failed';
        error = 'Viewer stopped before this render finished.';
      } else if (status === 'completed' && !output?.isFile()) {
        status = 'failed';
        error = 'Render file is missing from the output folder.';
      }
      const job = {
        id, kind: record.kind, purpose: record.purpose ?? 'export', scene: record.scene, status,
        progress: status === 'completed' ? 100 : Math.max(0, Math.min(99, Number(record.progress) || 0)),
        frames: Math.max(0, Number(record.frames) || (status === 'completed' ? (record.kind === 'frame' ? 1 : sceneConfig(record.scene??'objects').duration * (record.settings?.fps ?? config.fps)) : 0)),
        total: Math.max(1, Number(record.total) || (record.kind === 'frame' ? 1 : sceneConfig(record.scene??'objects').duration * (record.settings?.fps ?? config.fps))),
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
        backend:record.backend,device:record.device,deviceName:record.deviceName,parameters: record.parameters ?? {}, settings: record.settings ?? null, engine:record.engine??'threejs', rendererSelection:record.rendererSelection??null
      };
      if (job.status === 'completed' && job.destination !== 'downloads' && job.purpose !== 'viewport') {
        try { await publishDownload(job); await writeJobManifest(job); }
        catch { /* Keep historical files accessible if Downloads is unavailable. */ }
      }
      jobs.set(id, job);
      if (status !== record.status) await writeJobManifest(job);
    } catch { /* Ignore malformed manifests; never trust paths from their contents. */ }
  }
  processState.persistedJobsLoaded = true;
}

function publicJob(job) {
  const { sourceHash, sourceHashAfter, pid, child, logs, snapshotPath, manifestPath, parameters, ...publicFields } = job;
  return {
    ...publicFields,
    previewUrl: job.previewStage ? `/api/studio/jobs/${job.id}/preview?stage=${job.previewStage}` : job.frames > 0 ? `/api/studio/jobs/${job.id}/preview?frame=${job.previewFrame??job.frames}` : null,
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

async function launchJob(job, invocation, spawnFn) {
  job.status = 'running'; job.progress = 0; job.phase = 'rendering'; job.startedAt = new Date().toISOString(); processState.activeRenderId = job.id;
  let child;
  try {
    child = spawnFn(invocation.command, invocation.args, { cwd: invocation.cwd??ROOT, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    job.status = 'failed'; job.phase = 'failed'; job.error = error.message || 'Could not start the render process.';
    job.finishedAt = new Date().toISOString(); job.progress = 0; job.url = null; job.downloadUrl = null;
    processState.activeRenderId = null;
    try { await writeJobManifest(job); }
    catch (manifestError) { job.error += ` Could not write render manifest: ${manifestError.message}`; }
    return;
  }
  job.pid = child.pid; job.child = child;
  let stdout = '', stderr = '', buffer = '';
  const consumeLine = line => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      if (typeof event.backend === 'string') job.backend = event.backend.slice(0,80);
      else if (event.type === 'ready' && typeof event.engine === 'string') job.backend = event.engine.slice(0,80);
      if (typeof event.device === 'string') job.device = event.device.slice(0,80);
      if (typeof event.deviceName === 'string') job.deviceName = event.deviceName.slice(0,200);
      if (job.cancelRequested) return;
      if(event.type==='preview'&&job.purpose==='viewport'&&job.engine==='cycles'&&[1,2].includes(event.stage)){
        job.previewStage=event.stage;job.previewWidth=event.width;job.previewHeight=event.height;job.previewSamples=event.samples;job.phase='refining';job.progress=Math.max(job.progress,Number(event.percent)||0);
      }
      if (['progress','frame'].includes(event.type)) {
        if (Number.isFinite(event.percent)) job.progress = Math.max(job.progress, Math.min(99, event.percent));
        if (Number.isFinite(event.frames)) job.frames = Math.max(job.frames ?? 0, Math.min(job.total, event.frames));
        if (Number.isFinite(event.total)) job.total = Math.max(1, event.total);
        if (Number.isInteger(event.previewFrame)) job.previewFrame = event.previewFrame;
        if(job.engine==='cycles'&&event.type==='frame'&&Number.isInteger(event.frame)&&event.frame>0&&event.frame<=job.total)job.previewFrame=event.frame;
        if (Number.isFinite(event.sample)) job.samples = Math.max(job.samples ?? 0, Math.min(job.totalSamples ?? event.totalSamples ?? 1, event.sample));
        if (Number.isFinite(event.totalSamples)) job.totalSamples = Math.max(1, event.totalSamples);
        if (['sampling', 'rendering', 'encoding','baking','freezing','refining','final'].includes(event.phase)) job.phase = event.phase;
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
    job.status = 'failed'; job.phase = 'failed'; job.error = error.message; job.finishedAt = new Date().toISOString(); job.progress = 0; processState.activeRenderId = null;
  });
  child.on('close', async code => {
    if (buffer) consumeLine(buffer);
    try {
      if (job.cancelRequested) {job.status='cancelled';job.phase='cancelled';job.error='Render cancelled.';job.url=null;job.downloadUrl=null;} else if (code !== 0) {
        job.status = 'failed'; job.phase = 'failed'; job.error ||= stderr.trim() || `Render CLI exited with code ${code}`;
      } else {
        const current = await sourceFingerprint();
        job.sourceHashAfter = current;
        if (current !== job.sourceHash) {
          job.status = 'failed';
          job.phase = 'failed';
          job.error = 'Project sources changed during rendering; the output is not marked complete.';
        } else {
          if (job.purpose !== 'viewport') await publishDownload(job);
          job.status = 'completed'; job.phase = 'completed'; job.progress = 100; job.frames = job.total; job.samples = job.totalSamples; job.url = `/api/studio/jobs/${job.id}/file`;
          job.downloadUrl = `/api/studio/jobs/${job.id}/download`;
        }
      }
    } catch (error) { job.status = 'failed'; job.phase = 'failed'; job.error = error.message; }
    delete job.child;
    job.finishedAt = new Date().toISOString();
    job.logs = stdout.slice(-8000);
    try {
      await writeJobManifest(job);
    } catch (error) {
      job.status = 'failed'; job.url = null; job.error = `Could not write render manifest: ${error.message}`;
    }
    processState.activeRenderId = null;
  });
}

export function createStudioApi({ spawnFn = nodeSpawn, revealFn = revealWithFinder, capabilitiesFn=rendererCapabilities, skiaCapabilitiesFn=nativeSkiaCapabilities, nativeRendererFactory=async parameters => (await import('./native/renderer.mjs')).createNativeRenderer(parameters), componentManager=cyclesComponentManager(ROOT) } = {}) {
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
        const currentJobs = [...jobs.values()].filter(job => job.purpose !== 'viewport').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(publicJob);
        return send(res, 200, { versions, jobs: currentJobs, outputDirectory: DOWNLOAD_DIR });
      }
      if(req.method==='GET'&&route==='/studio/components/cycles')return send(res,200,{component:await componentManager.status()});
      if(req.method==='GET'&&route==='/studio/capabilities')return send(res,200,{capabilities:await capabilitiesFn()});
      if(req.method==='POST'&&route==='/studio/thumbnail'){
        const body=await readJson(req);
        if(!isRecord(body)||Object.keys(body).some(key=>!['parameters','time','width','height'].includes(key)))return send(res,400,{error:'Expected parameters, time, width, and height.'});
        const parameters=await validateStudioParameters(body.parameters);
        if(parameters.scene!=='procedural')return send(res,400,{error:'Native thumbnails currently support the procedural scene only.'});
        const duration=sceneConfig(parameters.scene).duration;
        if(!Number.isFinite(body.time)||body.time<0||body.time>=duration)return send(res,400,{error:`time must be from 0 to less than ${duration} seconds.`});
        if(!Number.isInteger(body.width)||!Number.isInteger(body.height)||body.width<64||body.height<64||body.width>640||body.height>360||body.width*body.height>230400)return send(res,400,{error:'Thumbnail dimensions must be at least 64×64, no larger than 640×360, and at most 230,400 pixels.'});
        if(processState.activeRenderId||processState.nativeThumbnailActive)return send(res,409,{error:'Wait for the active local render or thumbnail to finish.'});
        processState.nativeThumbnailActive=true;
        let renderer;
        try{
          const capability=await skiaCapabilitiesFn();
          if(!capability.available)return send(res,503,{error:capability.reason||'Native Skia is unavailable on this computer.'});
          renderer=await nativeRendererFactory(parameters);
          const image=await renderer.renderPng(body.time,body.width,body.height,parameters,1,config.fps);
          res.statusCode=200;res.setHeader('Content-Type','image/png');res.setHeader('Content-Length',image.length);res.setHeader('Cache-Control','no-store');res.end(image);return;
        }catch(error){return send(res,500,{error:`Native Skia thumbnail failed: ${error.message}. No renderer fallback was attempted.`});}
        finally{try{await renderer?.close?.();}finally{processState.nativeThumbnailActive=false;}}
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
        const stageQuery=new URL(req.url,'http://127.0.0.1').searchParams.get('stage');
        const progressiveStage=stageQuery===null?null:Number(stageQuery);
        if(stageQuery!==null&&(![1,2].includes(progressiveStage)||job.purpose!=='viewport'||job.engine!=='cycles'||progressiveStage>(job.previewStage??0)))return send(res,404,{error:'Progressive frame not ready'});
        const fullFrame = job.kind === 'frame' && job.status === 'completed';
        const cyclesPreview=job.engine==='cycles'&&Number.isInteger(job.previewFrame);
        const mixedPreview=job.engine==='mixed'&&Number.isInteger(job.previewFrame);
        const previewPath = progressiveStage ? path.join(RENDER_DIR,'cycles',`${job.id}${job.extension}.cycles`,`preview-stage-${progressiveStage}.png`) : fullFrame ? job.outputPath : mixedPreview?path.join(RENDER_DIR,`${job.id}${job.extension}.mixed`,`frame-${String(job.previewFrame).padStart(6,'0')}.png`):cyclesPreview?path.join(RENDER_DIR,'cycles',`${job.id}${job.extension}.cycles`,'frames',`frame-${String(job.previewFrame).padStart(6,'0')}.png`):path.join(RENDER_DIR, `${job.id}${job.extension}.progress.jpg`);
        const info = await stat(previewPath).catch(() => null);
        if (!info?.isFile()) return send(res, 404, { error: 'Render preview not ready' });
        res.statusCode = 200;
        res.setHeader('Content-Type', progressiveStage||fullFrame||cyclesPreview||mixedPreview ? 'image/png' : 'image/jpeg');
        res.setHeader('Content-Length', info.size);
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        createReadStream(previewPath).pipe(res);
        return;
      }
      const revealMatch = route.match(/^\/studio\/jobs\/([a-f0-9-]{36})\/reveal$/);
      const cancelMatch = route.match(/^\/studio\/jobs\/([a-f0-9-]{36})\/cancel$/);
      if (req.method === 'POST' && cancelMatch) {
        if (!req.headers.origin || new URL(req.headers.origin).host !== host || req.headers['content-type']?.split(';')[0] !== 'application/json') return send(res,403,{error:'Cancel renders from this Studio tab.'});
        const body=await readJson(req);if(!isRecord(body)||Object.keys(body).length)return send(res,400,{error:'Cancel expects an empty object.'});
        await loadPersistedJobs(); const job=jobs.get(cancelMatch[1]);if(!job)return send(res,404,{error:'Render job not found.'});
        if(['completed','failed','cancelled'].includes(job.status))return send(res,200,publicJob(job));
        if(!job.child)return send(res,409,{error:'This render cannot be cancelled from this Studio instance.'});
        job.cancelRequested=true;job.status='cancelling';job.phase='cancelling';job.child.kill('SIGTERM');
        return send(res,202,publicJob(job));
      }
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
      const componentAction = route.match(/^\/studio\/components\/cycles\/(install|update|authorize|check|remove)$/);
      if (componentAction) {
        if (!req.headers.origin || new URL(req.headers.origin).host !== host || req.headers['content-type']?.split(';')[0] !== 'application/json') return send(res,403,{error:'Use Rendering Cycles controls from this Studio tab.'});
        if (!isRecord(body) || Object.keys(body).length) return send(res,400,{error:'Component actions do not accept package URLs or paths.'});
        if (processState.activeRenderId) return send(res,409,{error:'Wait for the current render to finish before changing Rendering Cycles.'});
        if ((await componentManager.status()).busy) return send(res,409,{error:'A Rendering Cycles component operation is already running.'});
        // Start locally and return immediately; progress is available through GET.
        componentManager[componentAction[1] === 'check' ? 'checkAuthorization' : componentAction[1]]().catch(() => {}).finally(() => {cyclesProbe=null;cyclesProbeAt=0;});
        return send(res,202,{component:await componentManager.status()});
      }
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
        if (!isRecord(body) || Object.keys(body).some(k => !['kind', 'time', 'parameters', 'settings', 'purpose'].includes(k))) return send(res, 400, { error: 'Expected kind, time, parameters, and optional settings' });
        if (!['frame', 'preview', 'export'].includes(body.kind)) return send(res, 400, { error: 'kind must be frame, preview, or export' });
        if (body.purpose !== undefined && (body.purpose !== 'viewport' || body.kind !== 'frame')) return send(res, 400, { error: 'Viewport jobs must be single frames' });
        try{await Promise.any(['checkpoint-restore.json','checkpoint.lock'].map(name=>stat(path.join(ROOT,'.motion-cache',name))));return send(res,409,{error:'Wait for the project restore to finish before rendering.'});}catch(error){if(!(error instanceof AggregateError)||error.errors.some(e=>e.code!=='ENOENT'))throw error;}
        if (processState.activeRenderId||processState.nativeThumbnailActive) return send(res, 409, { error: 'Another local render or native thumbnail is already running' });
        if ((await componentManager.status()).busy) return send(res,409,{error:'Wait for the Rendering Cycles component operation to finish before rendering.'});
        const time = body.time ?? 0;
        const selectedConfig=sceneConfig(body.parameters?.scene??'objects');if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > selectedConfig.duration) return send(res, 400, { error: `time must be a number from 0 to ${selectedConfig.duration} seconds` });
        reservation = `pending:${randomUUID()}`;
        processState.activeRenderId = reservation;
        const parameters = await validateStudioParameters(body.parameters);
        const settings = validateRenderSettings(body.kind, body.settings);if(['dot','replay'].includes(parameters.scene))settings.temporalSamples=1;else if(['pulse','camera'].includes(parameters.scene)&&body.settings?.temporalSamples===undefined)settings.temporalSamples=4;
        const plan=validateRenderPlan(parameters.renderPolicy);
        const needsProbe=plan.renderer!=='threejs'&&(plan.renderer!=='auto'||plan.preferredRenderer!=='threejs'||plan.intent==='photoreal');
        const capabilities=needsProbe?await capabilitiesFn():{threejs:{available:true},skia:await nativeSkiaCapabilities()};
        const selection=resolveRenderPlan(plan,{scene:parameters.scene,kind:body.kind,...settings,duration:selectedConfig.duration,capabilities});
        if(!selection.runnable)throw Error(selection.availability);
        if(selection.selectedRenderer==='cycles'){
          if(body.kind!=='frame'&&settings.format!=='mp4')throw Error('Cycles currently exports MP4 video and PNG frames. Select MP4 or Three.js for WebM/ProRes.');
          if(settings.width<64||settings.height<64)throw Error('Cycles frames require at least 64 × 64 pixels.');
        }
        if(['cycles','mixed'].includes(selection.selectedRenderer)&&body.kind!=='frame')settings.bitrateMbps=null;
        if(selection.selectedRenderer==='mixed')await preflightMixed({root:ROOT,policy:plan,settings,kind:body.kind,time,duration:selectedConfig.duration});
        const id = randomUUID();
        const extension = outputExtension(body.kind, settings);
        const outputDir=path.join(RENDER_DIR,...(selection.selectedRenderer==='cycles'?['cycles']:[]));
        await verifyExportDestination(outputDir);
        if(body.purpose!=='viewport')await verifyExportDestination(DOWNLOAD_DIR);
        const outputPath = path.join(outputDir, `${id}${extension}`);
        const snapshotPath = path.join(RENDER_DIR, `.${id}.snapshot.json`);
        const width = settings?.width ?? config.width;
        const height = settings?.height ?? config.height;
        const fps = settings?.fps ?? config.fps;
        const temporalSamples = settings?.temporalSamples ?? 1;
        const snapshot = { schemaVersion: 2, command: body.kind, config: { ...selectedConfig, width, height, fps }, parameters, width, height, fps, settings, time, start: 0, end: selectedConfig.duration, temporalSamples };
        const sourceHash = await sourceFingerprint();
        await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
        const total = body.kind === 'frame' ? 1 : Math.round(selectedConfig.duration * fps);
        const totalSamples = body.kind === 'frame'&&selection.selectedRenderer==='threejs' ? settings.temporalSamples : 0;
        const job = { id, kind: body.kind, purpose: body.purpose ?? 'export', scene: parameters.scene, status: 'running', progress: 0, frames: 0, total, samples: 0, totalSamples, phase: 'rendering', createdAt: new Date().toISOString(), time, url: null, downloadUrl: null, error: null, extension, settings, sourceHash, outputPath, snapshotPath, manifestPath: path.join(RENDER_DIR,`${id}${extension}.job.json`), parameters,engine:selection.selectedRenderer,rendererSelection:selection };
        jobs.set(id, job);
        await writeJobManifest(job);
        const args = [body.kind, '--out', outputPath, '--snapshot', snapshotPath];
        if (selection.selectedRenderer === 'skia') args.push('--backend', 'native');
        else if (selection.selectedRenderer === 'threejs' && parameters.scene === 'procedural') args.push('--backend', 'browser-reference');
        if (body.kind === 'frame') args.push('--time', String(time), '--width', String(width), '--height', String(height), '--fps', String(fps), '--temporal-samples', String(temporalSamples));
        else args.push('--temporal-samples', String(snapshot.temporalSamples), '--fps', String(fps), '--format', settings.format, ...(settings.bitrateMbps === null ? [] : ['--bitrate-mbps', String(settings.bitrateMbps)]));
        const invocation=selection.selectedRenderer==='mixed'?buildMixedCommand({kind:body.kind,snapshotPath,outputPath,root:ROOT,audioPath:plan.composite.audioFile??undefined,audioOffset:plan.composite.audioOffset}):selection.selectedRenderer==='cycles'?buildCyclesCommand({kind:body.kind,snapshotPath,outputPath,root:ROOT,settings:{width,height,fps,progressive:body.purpose==='viewport',cyclesSamples:plan.cycles.samples,device:plan.cycles.device,workers:plan.cycles.workers,denoise:plan.cycles.denoise,motionBlur:temporalSamples>1,shutter:Math.max(0,Math.min(1,(parameters.look?.post?.shutterAngle??180)/360)),composite:'titles'}}):{command:process.execPath,args:[CLI,...args],cwd:ROOT};
        await launchJob(job, invocation, spawnFn);
        reservation = null;
        return send(res, 202, { id });
      }
      return send(res, 404, { error: 'Unknown studio endpoint' });
    } catch (error) {
      if (reservation && processState.activeRenderId === reservation) processState.activeRenderId = null;
      return send(res, error.status ?? 400, { error: error.message || 'Studio API error' });
    }
  };
}
