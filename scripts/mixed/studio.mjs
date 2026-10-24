import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { access, readFile, realpath, stat, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { validateRenderPlan } from '../../src/engine/render-policy.js';
import {hasVoiceover} from '../../src/engine/voiceover.js';
import { prepareComposite, compositeFrame, compositeSequence, encodeComposite, relativeAssetPath, resolveCompositeAsset } from '../lib/simple-compositor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const within = (root, target) => { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };

export async function validateMixedAudio({ root, audioPath, audioOffset = 0, signal }) {
  if (!Number.isFinite(audioOffset) || audioOffset < 0 || audioOffset > 7200) throw Error('Invalid mixed audio offset');
  if (audioPath === undefined || audioPath === null) {
    if (audioOffset !== 0) throw Error('Mixed audio offset requires an explicit audio source');
    return undefined;
  }
  const file = await resolveCompositeAsset(root, audioPath);
  const info = await stat(file);
  if (info.size < 1 || info.size > 2 * 1024 ** 3) throw Error('Mixed audio must be a nonempty local file of at most 2 GiB');
  const metadata = await new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'wav,mp3,aac,flac,ogg,aiff,mov,matroska,webm', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type,codec_name,duration:format=duration', '-of', 'json', file];
    const child = spawn(ffprobe.path, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    let output = '', errors = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 15000);
    child.stdout.on('data', data => {
      output += data.toString();
      if (output.length > 65536) { child.kill('SIGTERM'); reject(Error('Mixed audio probe exceeded output limit')); }
    });
    child.stderr.on('data', data => { errors = (errors + data.toString()).slice(-8192); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut) return reject(Error('Mixed audio probe timed out'));
      if (code !== 0) return reject(Error(`Invalid mixed audio source: ${errors.trim() || 'media probe failed'}`));
      try { resolve(JSON.parse(output)); } catch { reject(Error('Invalid mixed audio probe response')); }
    });
  });
  if (!metadata.streams?.some(stream => stream.codec_type === 'audio' && stream.codec_name)) throw Error('Mixed audio source must contain an actual audio stream');
  const streamDuration = Number(metadata.streams[0]?.duration);
  const duration = Number.isFinite(streamDuration) && streamDuration > 0 ? streamDuration : Number(metadata.format?.duration);
  if (Number.isFinite(duration) && duration > 0 && audioOffset >= duration) throw Error('Mixed audio offset is outside the supplied track');
  return { path: audioPath, file, bytes: info.size, duration: Number.isFinite(duration) ? duration : null, offset: audioOffset };
}
export async function getMixedCapabilities({ root = ROOT } = {}) {
  try {
    await access(path.join(root, 'scripts/mixed-studio.mjs'));
    if (!ffmpeg) throw Error('No local FFmpeg executable');
    await access(ffmpeg);
    await access(ffprobe.path);
    return { available: true, requiresPlan: true, formats: ['png', 'mp4'], reason: 'Local compositor available. A prepared frame plan is validated before every job.' };
  } catch { return { available: false, reason: 'The local mixed compositor is unavailable.' }; }
}

/** Every input is relative to the project root. The policy never supplies an arbitrary asset root. */
export async function preflightMixed({ root = ROOT, policy, settings = {}, kind = 'export', time = 0, duration, audioPath, audioOffset, signal }) {
  if (!['frame', 'preview', 'export'].includes(kind)) throw Error('Unsupported mixed job kind');
  const normalized = validateRenderPlan(policy);
  if (!normalized.composite.enabled || !normalized.composite.planFile) throw Error('Mixed jobs require an enabled compositing plan');
  if (kind !== 'frame' && settings.format !== undefined && settings.format !== 'mp4') throw Error('Mixed jobs currently export MP4 video or PNG frames');
  const assetsRoot = await realpath(root);
  const planFile = await resolveCompositeAsset(assetsRoot, normalized.composite.planFile);
  if ((await stat(planFile)).size > 1024 * 1024) throw Error('Mixed compositing plan exceeds 1 MiB');
  if (signal?.aborted) throw signal.reason ?? Error('Mixed job cancelled');
  const input = JSON.parse(await readFile(planFile, 'utf8'));
  const prepared = await prepareComposite({ plan: input, assetsRoot });
  if (signal?.aborted) throw signal.reason ?? Error('Mixed job cancelled');
  for (const field of ['width', 'height', 'fps']) if (settings[field] !== undefined && settings[field] !== prepared.plan[field]) throw Error(`Mixed ${field} must match the prepared plan (${prepared.plan[field]}); render matching layer inputs first`);
  if (kind !== 'frame' && duration !== undefined && Math.round(duration * prepared.plan.fps) !== prepared.plan.frameCount) throw Error('Mixed frame count must match the selected scene duration and frame rate');
  if (!Number.isFinite(time) || time < 0 || time > prepared.plan.frameCount / prepared.plan.fps) throw Error('Mixed frame time is outside the prepared timeline');
  const selectedAudioPath = audioPath === undefined ? normalized.composite.audioFile ?? undefined : audioPath;
  const selectedAudioOffset = audioOffset === undefined ? normalized.composite.audioOffset ?? 0 : audioOffset;
  const audio = await validateMixedAudio({ root: assetsRoot, audioPath: selectedAudioPath, audioOffset: selectedAudioOffset, signal });
  return { ...prepared, planFile, audioPath: audio?.path, audioOffset: selectedAudioOffset, audioMetadata: audio, frame: Math.min(prepared.plan.frameCount - 1, Math.floor(time * prepared.plan.fps + 1e-9)) };
}

async function safeOutput(root, outputPath) {
  const rootPath = await realpath(root);
  const absolute = path.resolve(rootPath, outputPath);
  const relative = path.relative(rootPath, absolute);
  relativeAssetPath(relative, 'mixed output');
  if (!relative.startsWith(`renders${path.sep}`)) throw Error('Mixed Studio output must be inside project renders/');
  // Check the nearest existing ancestor before mkdir; a symlink must never redirect writes.
  let ancestor = path.dirname(absolute);
  while (true) {
    try { const canonical = await realpath(ancestor); if (!within(rootPath, canonical)) throw Error('Mixed output escapes the project'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
  }
  await mkdir(path.dirname(absolute), { recursive: true });
  if (!within(rootPath, await realpath(path.dirname(absolute)))) throw Error('Mixed output escapes the project');
  try { await access(absolute); throw Error('Mixed output already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return absolute;
}

async function sha256(file, signal) {
  const hash = createHash('sha256');
  const stream = createReadStream(file, { signal });
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

/** Copy every validated input before composition. Rendering uses these bytes only. */
export async function freezeMixedInputs({ prepared, destination, audioPath, signal, onEvent }) {
  if (signal?.aborted) throw signal.reason ?? Error('Mixed job cancelled');
  await mkdir(destination, { recursive: false });
  const inputs = new Map(prepared.files);
  if (audioPath !== undefined) {
    relativeAssetPath(audioPath, 'mixed audio');
    inputs.set(audioPath, await resolveCompositeAsset(prepared.assetsRoot, audioPath));
  }
  const manifest = [];
  for (const [relative, original] of inputs) {
    if (signal?.aborted) throw signal.reason ?? Error('Mixed job cancelled');
    // Revalidate canonical paths immediately before reading; keep the bounded asset root.
    if (await resolveCompositeAsset(prepared.assetsRoot, relative) !== original) throw Error(`Mixed input changed its resolved path during freezing: ${relative}`);
    const before = await sha256(original, signal);
    const frozen = path.join(destination, relative);
    await mkdir(path.dirname(frozen), { recursive: true });
    await copyFile(original, frozen, constants.COPYFILE_EXCL);
    const after = await sha256(original, signal);
    const copied = await sha256(frozen, signal);
    if (before !== after || before !== copied) throw Error(`Mixed input changed during freezing: ${relative}`);
    manifest.push({ path: relative, sha256: copied, bytes: (await stat(frozen)).size });
    await onEvent?.({ type: 'progress', phase: 'freezing', files: manifest.length, totalFiles: inputs.size, percent: inputs.size ? 5 * manifest.length / inputs.size : 0, frames: 0 });
  }
  await writeFile(path.join(destination, '.motion-lab-plan.json'), JSON.stringify(prepared.plan, null, 2) + '\n', { flag: 'wx' });
  await writeFile(path.join(destination, '.motion-lab-inputs.json'), JSON.stringify({ version: 1, complete: true, colorSpace: 'srgb', files: manifest, audioPath: audioPath ?? null }, null, 2) + '\n', { flag: 'wx' });
  const frozenPrepared = await prepareComposite({ plan: prepared.plan, assetsRoot: destination });
  return { prepared: frozenPrepared, audio: audioPath === undefined ? undefined : path.join(destination, audioPath), inputDirectory: destination, hashes: manifest };
}

/** Runs only prepared layers. It never launches Blender or the Three.js renderer. */
export async function runMixedJob({ root = ROOT, snapshot, outputPath, audioPath, audioOffset, onEvent, signal }) {
  if (!snapshot || typeof snapshot !== 'object') throw Error('Mixed job requires a frozen snapshot');
  const kind = snapshot.command;
  if(kind!=='frame'&&hasVoiceover(snapshot.parameters?.audio))throw Error('Use Three.js, Native 2D or Cycles for voiceover mixing. Mixed needs a separately prepared soundtrack.');
  const settings = { ...(snapshot.settings ?? {}), width: snapshot.width ?? snapshot.config?.width, height: snapshot.height ?? snapshot.config?.height, fps: snapshot.fps ?? snapshot.config?.fps };
  const event = value => onEvent?.(value);
  await event({ type: 'progress', phase: 'freezing', frames: 0, percent: 0 });
  const prepared = await preflightMixed({ root, policy: snapshot.parameters?.renderPolicy, settings, kind, time: snapshot.time ?? 0, duration: snapshot.config?.duration, audioPath, audioOffset, signal });
  const destination = await safeOutput(root, outputPath);
  if (kind === 'frame' && !destination.endsWith('.png')) throw Error('Mixed frame output must end in .png');
  if (kind !== 'frame' && !destination.endsWith('.mp4')) throw Error('Mixed video output must end in .mp4');
  const start = performance.now();
  const frozen = await freezeMixedInputs({ prepared, destination: `${destination}.inputs`, audioPath: prepared.audioPath, signal, onEvent: event });
  // Recheck the immutable copy. The original may have changed between probe and freeze.
  if (frozen.audio) await validateMixedAudio({ root: frozen.inputDirectory, audioPath: prepared.audioPath, audioOffset: prepared.audioOffset, signal });
  const immutable = frozen.prepared;
  if (kind === 'frame') {
    if (signal?.aborted) throw signal.reason ?? Error('Mixed job cancelled');
    await writeFile(destination, await compositeFrame(immutable, prepared.frame), { flag: 'wx' });
    await event({ type: 'frame', phase: 'rendering', frame: 1, frames: 1, total: 1, percent: 99, previewFrame: 1 });
    return { complete: true, outputPath: destination, sourceFrame: prepared.frame, frameCount: 1, inputDirectory: frozen.inputDirectory, elapsedMs: performance.now() - start };
  }
  const composition = await compositeSequence({ plan: immutable.plan, assetsRoot: immutable.assetsRoot, outputRoot: `${destination}.mixed`, signal, onProgress: p => event({ type: 'frame', phase: 'rendering', frame: p.frame, frames: p.frame, total: p.frameCount, percent: 5 + 85 * p.frame / p.frameCount, previewFrame: p.frame }) });
  await event({ type: 'progress', phase: 'encoding', frames: composition.frameCount, total: composition.frameCount, percent: 95 });
  const movie = await encodeComposite({ composition, output: destination, audio: frozen.audio, audioOffset: prepared.audioOffset, signal });
  const result = { complete: true, ...movie, outputPath: destination, frameDirectory: composition.outputRoot, inputDirectory: frozen.inputDirectory, elapsedMs: performance.now() - start };
  await event({ type: 'complete', ...result });
  return result;
}

export function buildMixedCommand({ kind, snapshotPath, outputPath, root = ROOT, audioPath, audioOffset }) {
  if (!['frame', 'preview', 'export'].includes(kind)) throw Error('Unsupported mixed job kind');
  const args = [path.join(root, 'scripts/mixed-studio.mjs'), kind, '--snapshot', snapshotPath, '--out', outputPath];
  if (audioPath !== undefined) args.push('--audio', relativeAssetPath(audioPath, 'mixed audio'));
  if (audioOffset !== undefined) {
    if (!Number.isFinite(audioOffset) || audioOffset < 0 || audioOffset > 7200) throw Error('Invalid audio offset');
    args.push('--audio-offset', String(audioOffset));
  }
  return { command: process.execPath, args, cwd: root };
}

export async function readMixedSnapshot(root, snapshotPath) {
  const assetsRoot = await realpath(root);
  const relative = path.isAbsolute(snapshotPath) ? path.relative(assetsRoot, snapshotPath) : snapshotPath;
  const file = await resolveCompositeAsset(assetsRoot, relative);
  if ((await stat(file)).size > 2 * 1024 * 1024) throw Error('Mixed snapshot exceeds 2 MiB');
  return JSON.parse(await readFile(file, 'utf8'));
}
