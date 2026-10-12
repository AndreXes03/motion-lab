import path from 'node:path';
import { realpath, stat, mkdir, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';

const LIMITS = Object.freeze({ width: 4096, height: 4096, pixels: 16777216, frames: 18000, layers: 16 });
const fail = message => { throw new Error(message); };
const object = (value, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
};
const keys = (value, allowed, name) => {
  object(value, name);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`Unknown ${name}.${key}`);
};
const number = (value, fallback, min, max, name, integer = false) => {
  const n = value === undefined ? fallback : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) fail(`Invalid ${name}`);
  return n;
};
export function relativeAssetPath(value, name = 'asset path') {
  if (typeof value !== 'string' || !value || value.length > 1024 || path.isAbsolute(value) || value.includes('\\') || value.includes('\0') || value.split('/').some(part => part === '..' || part === '' || part === '.')) fail(`${name} must be a bounded relative path without traversal`);
  return value;
}
function sourcePlan(source, fps, name) {
  keys(source, ['type', 'path', 'startFrame', 'fps'], name);
  if (!['image', 'sequence'].includes(source.type)) fail(`${name}.type must be image or sequence`);
  relativeAssetPath(source.path, `${name}.path`);
  if (source.type === 'sequence' && (source.path.match(/%06d/g)?.length !== 1 || source.path.replace('%06d', '').includes('%'))) fail(`${name}.path must contain exactly one %06d token`);
  if (source.type === 'image' && (source.path.includes('%') || source.startFrame !== undefined || source.fps !== undefined)) fail(`${name}: image sources have no frame token, startFrame or fps`);
  if (!source.path.toLowerCase().endsWith('.png')) fail(`${name}: only sRGB PNG inputs are supported`);
  return source.type === 'image' ? { type: 'image', path: source.path } : {
    type: 'sequence', path: source.path,
    startFrame: number(source.startFrame, 1, 0, 1000000, `${name}.startFrame`, true),
    fps: number(source.fps, fps, 1, 120, `${name}.fps`),
  };
}

/** Validate a separate, executable plan. Rendering strategy metadata is not this plan. */
export function validateCompositePlan(input) {
  keys(input, ['version', 'colorSpace', 'width', 'height', 'fps', 'frameCount', 'layers'], 'plan');
  if (input.version !== 1 || input.colorSpace !== 'srgb') fail('Composition requires version 1 and colorSpace "srgb"; linear EXR is unsupported');
  const width = number(input.width, undefined, 1, LIMITS.width, 'width', true);
  const height = number(input.height, undefined, 1, LIMITS.height, 'height', true);
  if (width * height > LIMITS.pixels) fail('Composition pixel limit exceeded');
  const fps = number(input.fps, undefined, 1, 120, 'fps');
  const frameCount = number(input.frameCount, undefined, 1, LIMITS.frames, 'frameCount', true);
  if (!Array.isArray(input.layers) || !input.layers.length || input.layers.length > LIMITS.layers) fail(`Composition needs 1-${LIMITS.layers} layers`);
  const ids = new Set();
  const layers = input.layers.map((layer, index) => {
    const name = `layers[${index}]`;
    keys(layer, ['id', 'source', 'startFrame', 'endFrame', 'opacity', 'adjustments', 'mask', 'glow'], name);
    if (typeof layer.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(layer.id) || ids.has(layer.id)) fail(`${name}.id must be unique and contain only letters, digits, _ or -`);
    ids.add(layer.id);
    const startFrame = number(layer.startFrame, 0, 0, frameCount - 1, `${name}.startFrame`, true);
    const endFrame = number(layer.endFrame, frameCount, startFrame + 1, frameCount, `${name}.endFrame`, true);
    const adjustments = layer.adjustments ?? {};
    keys(adjustments, ['exposure', 'contrast', 'saturation'], `${name}.adjustments`);
    const glow = layer.glow ?? {};
    keys(glow, ['intensity', 'radius', 'threshold'], `${name}.glow`);
    return {
      id: layer.id, source: sourcePlan(layer.source, fps, `${name}.source`), startFrame, endFrame,
      opacity: number(layer.opacity, 1, 0, 1, `${name}.opacity`),
      adjustments: {
        exposure: number(adjustments.exposure, 0, -4, 4, `${name}.exposure`),
        contrast: number(adjustments.contrast, 1, 0, 3, `${name}.contrast`),
        saturation: number(adjustments.saturation, 1, 0, 3, `${name}.saturation`),
      },
      mask: layer.mask === undefined ? undefined : sourcePlan(layer.mask, fps, `${name}.mask`),
      glow: {
        intensity: number(glow.intensity, 0, 0, 0.5, `${name}.glow.intensity`),
        radius: number(glow.radius, 8, 0.3, 64, `${name}.glow.radius`),
        threshold: number(glow.threshold, 0.8, 0, 1, `${name}.glow.threshold`),
      },
    };
  });
  return { version: 1, colorSpace: 'srgb', width, height, fps, frameCount, layers };
}

/** Output indices are zero based; file sequence indices default to one based. */
export function sourceFramePath(source, outputFrame, layerStartFrame, outputFps) {
  if (source.type === 'image') return source.path;
  const frame = source.startFrame + Math.floor((outputFrame - layerStartFrame) * source.fps / outputFps + 1e-9);
  return source.path.replace('%06d', String(frame).padStart(6, '0'));
}
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
};
export async function resolveCompositeAsset(assetsRoot, relative) {
  relativeAssetPath(relative);
  const root = await realpath(assetsRoot);
  const target = await realpath(path.resolve(root, relative));
  if (!inside(root, target)) fail(`Asset escapes its root: ${relative}`);
  if (!(await stat(target)).isFile()) fail(`Asset is not a regular file: ${relative}`);
  return target;
}
const clamp = n => Math.min(1, Math.max(0, n));
const linear = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const encoded = v => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
const identity = a => a.exposure === 0 && a.contrast === 1 && a.saturation === 1;

function adjustRgb(data, adjustment) {
  if (identity(adjustment)) return data;
  const result = Buffer.from(data);
  const gain = 2 ** adjustment.exposure;
  for (let i = 0; i < result.length; i += 4) {
    let r = result[i] / 255, g = result[i + 1] / 255, b = result[i + 2] / 255;
    if (adjustment.exposure !== 0) { r = encoded(clamp(linear(r) * gain)); g = encoded(clamp(linear(g) * gain)); b = encoded(clamp(linear(b) * gain)); }
    r = (r - 0.5) * adjustment.contrast + 0.5;
    g = (g - 0.5) * adjustment.contrast + 0.5;
    b = (b - 0.5) * adjustment.contrast + 0.5;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    result[i] = Math.round(clamp(luminance + (r - luminance) * adjustment.saturation) * 255);
    result[i + 1] = Math.round(clamp(luminance + (g - luminance) * adjustment.saturation) * 255);
    result[i + 2] = Math.round(clamp(luminance + (b - luminance) * adjustment.saturation) * 255);
  }
  return result;
}

/** Straight-alpha, display-referred sRGB over. Identity settings retain input pixels exactly. */
export function blendRgba(bottom, top, { opacity = 1, mask, adjustments = { exposure: 0, contrast: 1, saturation: 1 } } = {}) {
  if (bottom.length !== top.length || bottom.length % 4 || (mask && mask.length !== top.length)) fail('RGBA input buffers must have matching dimensions');
  const result = Buffer.from(bottom), adjusted = adjustRgb(top, adjustments);
  for (let i = 0; i < result.length; i += 4) {
    const maskCoverage = mask ? (0.2126 * mask[i] + 0.7152 * mask[i + 1] + 0.0722 * mask[i + 2]) / 255 * mask[i + 3] / 255 : 1;
    const sourceAlpha = adjusted[i + 3] / 255 * opacity * maskCoverage;
    if (sourceAlpha === 0) continue;
    const destAlpha = result[i + 3] / 255;
    const alpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
    for (let channel = 0; channel < 3; channel++) result[i + channel] = Math.round((adjusted[i + channel] * sourceAlpha + result[i + channel] * destAlpha * (1 - sourceAlpha)) / alpha);
    result[i + 3] = Math.round(alpha * 255);
  }
  return result;
}

async function readRgba(file, width, height) {
  const image = sharp(file, { limitInputPixels: LIMITS.pixels });
  const metadata = await image.metadata();
  if (metadata.width !== width || metadata.height !== height || (metadata.pages ?? 1) !== 1) fail(`Input dimensions must match ${width}x${height}: ${file}`);
  // Inputs must already have the same display transform. Tagged profiles are converted to sRGB.
  return image.toColourspace('srgb').ensureAlpha().raw().toBuffer();
}
async function applyGlow(data, width, height, settings) {
  if (settings.intensity === 0) return data;
  const highlights = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const brightness = Math.max(data[i], data[i + 1], data[i + 2]) / 255;
    const coverage = clamp((brightness - settings.threshold) / Math.max(1e-6, 1 - settings.threshold)) * data[i + 3] / 255;
    for (let c = 0; c < 3; c++) highlights[i + c] = Math.round(data[i + c] * coverage);
    highlights[i + 3] = 255;
  }
  const blurred = await sharp(highlights, { raw: { width, height, channels: 4 } }).blur(settings.radius).raw().toBuffer();
  const result = Buffer.from(data);
  // Glow remains inside this layer's alpha. Separate authored glow layers can extend the silhouette.
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) result[i + c] = Math.round(Math.min(255, data[i + c] + blurred[i + c] * settings.intensity));
  return result;
}

/** Validate all referenced files before touching output. Missing frames never silently hold. */
export async function prepareComposite({ plan: input, assetsRoot }) {
  const plan = validateCompositePlan(input), files = new Map();
  for (let frame = 0; frame < plan.frameCount; frame++) for (const layer of plan.layers) {
    if (frame < layer.startFrame || frame >= layer.endFrame || layer.opacity === 0) continue;
    for (const source of [layer.source, layer.mask].filter(Boolean)) {
      const relative = sourceFramePath(source, frame, layer.startFrame, plan.fps);
      if (files.has(relative)) continue;
      const file = await resolveCompositeAsset(assetsRoot, relative);
      const metadata = await sharp(file, { limitInputPixels: LIMITS.pixels }).metadata();
      if (metadata.format !== 'png' || metadata.depth !== 'uchar' || metadata.width !== plan.width || metadata.height !== plan.height || (metadata.pages ?? 1) !== 1) fail(`Expected one 8-bit ${plan.width}x${plan.height} PNG frame: ${relative}`);
      files.set(relative, file);
    }
  }
  return { plan, files, assetsRoot: await realpath(assetsRoot) };
}

export async function compositeFrame(prepared, frame) {
  const { plan, files } = prepared;
  number(frame, undefined, 0, plan.frameCount - 1, 'output frame', true);
  let result = Buffer.alloc(plan.width * plan.height * 4);
  for (const layer of plan.layers) {
    if (frame < layer.startFrame || frame >= layer.endFrame || layer.opacity === 0) continue;
    const source = sourceFramePath(layer.source, frame, layer.startFrame, plan.fps);
    let pixels = await readRgba(files.get(source), plan.width, plan.height);
    const mask = layer.mask ? await readRgba(files.get(sourceFramePath(layer.mask, frame, layer.startFrame, plan.fps)), plan.width, plan.height) : undefined;
    pixels = adjustRgb(pixels, layer.adjustments);
    pixels = await applyGlow(pixels, plan.width, plan.height, layer.glow);
    // The first identity layer can be copied, including hidden RGB under zero alpha.
    if (layer === plan.layers[0] && layer.opacity === 1 && !mask) result = pixels;
    else result = blendRgba(result, pixels, { opacity: layer.opacity, mask });
  }
  return sharp(result, { raw: { width: plan.width, height: plan.height, channels: 4 } }).png().toBuffer();
}

export async function compositeSequence({ plan, assetsRoot, outputRoot, onProgress, signal }) {
  const prepared = await prepareComposite({ plan, assetsRoot });
  const output = path.resolve(outputRoot);
  // Never modify either input assets or existing output directories.
  if (output === prepared.assetsRoot || inside(output, prepared.assetsRoot)) fail('Output directory must not contain input assets');
  await mkdir(output, { recursive: false });
  const start = performance.now();
  for (let frame = 0; frame < prepared.plan.frameCount; frame++) {
    if (signal?.aborted) throw signal.reason ?? new Error('Composition cancelled');
    const file = path.join(output, `frame-${String(frame + 1).padStart(6, '0')}.png`);
    await writeFile(file, await compositeFrame(prepared, frame), { flag: 'wx' });
    await onProgress?.({ frame: frame + 1, frameCount: prepared.plan.frameCount, elapsedMs: performance.now() - start });
  }
  const manifest = { version: 1, complete: true, colorSpace: 'srgb', width: prepared.plan.width, height: prepared.plan.height, fps: prepared.plan.fps, frameCount: prepared.plan.frameCount, elapsedMs: performance.now() - start, plan: prepared.plan };
  await writeFile(path.join(output, 'composition.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return { ...manifest, outputRoot: output, framePattern: path.join(output, 'frame-%06d.png') };
}

function runFfmpeg(args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'], signal });
    let diagnostics = '';
    child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk.toString()).slice(-8192); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`Video encoding failed (${code}): ${diagnostics}`)));
  });
}

/** H.264 needs an opaque composite; transparent output remains available as PNG frames. */
export async function encodeComposite({ composition, output, audio, audioOffset = 0, signal }) {
  const plan = validateCompositePlan(composition.plan);
  if (plan.width % 2 || plan.height % 2) fail('H.264 output dimensions must be even');
  const destination = path.resolve(output);
  if (!destination.toLowerCase().endsWith('.mp4')) fail('Encoded output must end in .mp4');
  try { await access(destination); fail('Encoded output already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  number(audioOffset, 0, 0, 7200, 'audioOffset');
  // Require an opaque bottom layer across the entire timeline. This avoids implicit black matting.
  const bottom = plan.layers[0];
  if (bottom.startFrame !== 0 || bottom.endFrame !== plan.frameCount || bottom.opacity !== 1 || bottom.mask) fail('MP4 requires a full-duration opaque bottom layer');
  for (let frame = 1; frame <= plan.frameCount; frame++) {
    const file = path.join(composition.outputRoot, `frame-${String(frame).padStart(6, '0')}.png`);
    const stats = await sharp(file, { limitInputPixels: LIMITS.pixels }).ensureAlpha().stats();
    if (stats.channels[3].min !== 255) fail('MP4 requires opaque frames; composite over a background first');
  }
  const duration = plan.frameCount / plan.fps;
  const args = ['-hide_banner', '-loglevel', 'error', '-n', '-framerate', String(plan.fps), '-start_number', '1', '-i', path.join(composition.outputRoot, 'frame-%06d.png')];
  if (audio !== undefined) {
    const audioFile = await realpath(audio);
    if (!(await stat(audioFile)).isFile()) fail('Audio input must be a regular local file');
    args.push('-ss', String(audioOffset), '-i', audioFile, '-map', '0:v:0', '-map', '1:a:0', '-af', `apad=whole_dur=${duration}`, '-c:a', 'aac', '-b:a', '192k');
  } else args.push('-map', '0:v:0', '-an');
  args.push('-t', String(duration), '-frames:v', String(plan.frameCount), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', destination);
  await runFfmpeg(args, { signal });
  return { output: destination, duration, frameCount: plan.frameCount, audio: audio !== undefined };
}
