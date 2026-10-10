#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'project', 'references.json');
const ASSET_DIR = path.join(ROOT, 'project', 'references');
const ROLES = new Set(['look', 'camera', 'elements']);
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov']);

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function referenceId(value) { return `ref_${hash(value).slice(0, 16)}`; }
function validateRole(role) {
  if (!ROLES.has(role)) throw new Error(`role must be one of: ${[...ROLES].join(', ')}`);
}
async function readManifest() {
  try {
    const parsed = JSON.parse(await readFile(MANIFEST, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Reference manifest must be a JSON array');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
async function writeManifest(entries) {
  await mkdir(path.dirname(MANIFEST), { recursive: true });
  const temporary = `${MANIFEST}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  await rename(temporary, MANIFEST);
}

export async function addReference({ file, role, note = '' }) {
  validateRole(role);
  if (!file) throw new Error('file is required');
  const sourcePath = path.resolve(file);
  const extension = path.extname(sourcePath).toLowerCase();
  if (!EXTENSIONS.has(extension)) throw new Error('file type must be png, jpg, webp, mp4, or mov');
  const bytes = await readFile(sourcePath);
  const id = referenceId(bytes);
  const entries = await readManifest();
  const existing = entries.find(item => item.id === id);
  if (existing) return existing;

  await mkdir(ASSET_DIR, { recursive: true });
  const filename = `${id}-${path.basename(sourcePath)}`;
  const assetPath = path.join(ASSET_DIR, filename);
  await copyFile(sourcePath, assetPath);
  const entry = {
    id,
    kind: extension === '.mp4' || extension === '.mov' ? 'video' : 'image',
    role,
    note: String(note),
    filename,
    addedAt: new Date().toISOString()
  };
  try { await writeManifest([...entries, entry]); }
  catch (error) { await rm(assetPath, { force: true }); throw error; }
  return entry;
}

export async function addLink({ url, role, note = '' }) {
  validateRole(role);
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('url must be a valid http(s) URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('url must use http or https');
  const normalizedUrl = parsed.href;
  const id = referenceId(normalizedUrl);
  const entries = await readManifest();
  const existing = entries.find(item => item.id === id);
  if (existing) return existing;
  const entry = { id, kind: 'link', role, note: String(note), url: normalizedUrl, addedAt: new Date().toISOString() };
  await writeManifest([...entries, entry]);
  return entry;
}

export async function listReferences() {
  return readManifest();
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${path.basename(bin)} exited ${code}: ${stderr.trim()}`)));
  });
}

async function probeVideo(file) {
  if (!ffprobe?.path) throw new Error('ffprobe-static executable is unavailable');
  const output = await run(ffprobe.path, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,duration,avg_frame_rate:format=duration', '-of', 'json', file]);
  const result = JSON.parse(output);
  const stream = result.streams?.[0];
  if (!stream) throw new Error('No video stream found in reference');
  const duration = Number(stream.duration ?? result.format?.duration);
  const frameRate = (() => { const [n, d = 1] = (stream.avg_frame_rate ?? '0/1').split('/').map(Number); return n / d; })();
  const totalFrames = Number(stream.nb_frames) || Math.round(duration * frameRate);
  if (!Number.isFinite(totalFrames) || totalFrames < 6) throw new Error('Video must contain at least six frames to build a contact sheet');
  return { width: Number(stream.width), height: Number(stream.height), duration, frameRate, totalFrames };
}

export async function createReferenceSheet({ id, out }) {
  if (!id) throw new Error('id is required');
  if (!out) throw new Error('out is required');
  const entries = await readManifest();
  const entry = entries.find(item => item.id === id);
  if (!entry) throw new Error(`Unknown reference id: ${id}`);
  if (entry.kind === 'link') throw new Error('Linked references have no local media to sheet');
  const sourcePath = path.join(ASSET_DIR, entry.filename);
  const target = path.resolve(out);
  await mkdir(path.dirname(target), { recursive: true });
  if (entry.kind === 'image') {
    await copyFile(sourcePath, target);
    return { id, path: target, passthrough: true };
  }
  if (!ffmpegPath) throw new Error('ffmpeg-static executable is unavailable');
  const video = await probeVideo(sourcePath);
  const indices = Array.from({ length: 6 }, (_, i) => Math.round(i * (video.totalFrames - 1) / 5));
  const select = `select=${indices.map(index => `eq(n\\,${index})`).join('+')}`;
  const filter = `${select},scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2,tile=3x2`;
  await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath, '-vf', filter, '-frames:v', '1', '-an', target]);
  return { id, path: target, passthrough: false, samples: 6, source: video };
}

function parse(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (!tokens[index + 1] || tokens[index + 1].startsWith('--')) throw new Error(`Missing value for --${key}`);
    options[key] = tokens[++index];
  }
  return { command, options };
}
async function main() {
  const { command, options } = parse(process.argv.slice(2));
  let result;
  if (command === 'add') result = await addReference({ file: options.file, role: options.role, note: options.note });
  else if (command === 'link') result = await addLink({ url: options.url, role: options.role, note: options.note });
  else if (command === 'list') result = await listReferences();
  else if (command === 'sheet') result = await createReferenceSheet({ id: options.id, out: options.out });
  else throw new Error('Use add --file --role [--note], link --url --role [--note], list, or sheet --id --out');
  process.stdout.write(`${JSON.stringify({ type: command === 'list' ? 'references' : 'complete', result })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stdout.write(`${JSON.stringify({ type: 'error', message: error.message })}\n`);
    process.exitCode = 1;
  });
}
