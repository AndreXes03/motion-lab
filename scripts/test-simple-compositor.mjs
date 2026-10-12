#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, rm, symlink, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import ffprobe from 'ffprobe-static';
import { validateCompositePlan, blendRgba, sourceFramePath, prepareComposite, compositeFrame, compositeSequence, encodeComposite } from './lib/simple-compositor.mjs';

const temp = await mkdtemp(path.join(os.tmpdir(), 'motion-lab-compositor-'));
const assetsRoot = path.join(temp, 'assets');
await mkdir(assetsRoot);
const writePng = (name, data, width = 2, height = 2) => sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toFile(path.join(assetsRoot, name));
const rgba = (...color) => Buffer.from([...color, ...color, ...color, ...color]);
const raw = image => sharp(image).ensureAlpha().raw().toBuffer();
const base = layers => ({ version: 1, colorSpace: 'srgb', width: 2, height: 2, fps: 4, frameCount: 4, layers });
const image = (id, name, rest = {}) => ({ id, source: { type: 'image', path: name }, ...rest });
const sequence = (id, name, rest = {}) => ({ id, source: { type: 'sequence', path: name, startFrame: 1, fps: 2 }, ...rest });
const probe = file => {
  const result = spawnSync(ffprobe.path, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
try {
  await writePng('background.png', rgba(20, 40, 80, 255));
  await writePng('red-000001.png', rgba(255, 0, 0, 128));
  await writePng('red-000002.png', rgba(0, 255, 0, 128));
  await writePng('mask.png', rgba(128, 128, 128, 255));
  const hiddenRgba = Buffer.from([90, 40, 200, 0, 25, 80, 120, 128, 255, 200, 7, 255, 0, 0, 0, 255]);
  await writePng('identity.png', hiddenRgba);

  // Identity must preserve every pixel, including RGB hidden under zero alpha.
  const identity = await prepareComposite({ plan: base([image('identity', 'identity.png')]), assetsRoot });
  assert.deepEqual(await raw(await compositeFrame(identity, 0)), hiddenRgba);
  // Straight alpha over, layer ordering, independent layer opacity and luminance mask.
  assert.deepEqual(blendRgba(rgba(0, 0, 255, 255), rgba(255, 0, 0, 128)), rgba(128, 0, 127, 255));
  const masked = await prepareComposite({ plan: base([image('background', 'background.png'), sequence('overlay', 'red-%06d.png', { opacity: 0.5, mask: { type: 'image', path: 'mask.png' } })]), assetsRoot });
  assert.deepEqual(await raw(await compositeFrame(masked, 0)), rgba(50, 35, 70, 255));
  // Different source fps deterministically holds nearest previous frame; no missing-frame fallback.
  assert.deepEqual([0, 1, 2, 3].map(frame => sourceFramePath(masked.plan.layers[1].source, frame, 0, 4)), ['red-000001.png', 'red-000001.png', 'red-000002.png', 'red-000002.png']);
  assert.deepEqual(await raw(await compositeFrame(masked, 2)), rgba(17, 67, 70, 255));
  const range = await prepareComposite({ plan: base([image('background', 'background.png'), sequence('overlay', 'red-%06d.png', { startFrame: 1, endFrame: 3 })]), assetsRoot });
  assert.deepEqual(await raw(await compositeFrame(range, 0)), rgba(20, 40, 80, 255));
  assert.deepEqual(await raw(await compositeFrame(range, 1)), rgba(138, 20, 40, 255));
  assert.deepEqual(await raw(await compositeFrame(range, 3)), rgba(20, 40, 80, 255));
  // One stop exposure changes neutral 64 to 90 using linear light; alpha remains untouched.
  assert.deepEqual(blendRgba(rgba(0, 0, 0, 0), rgba(64, 64, 64, 255), { adjustments: { exposure: 1, contrast: 1, saturation: 1 } }), rgba(90, 90, 90, 255));
  const grade = await prepareComposite({ plan: base([image('grade', 'background.png', { adjustments: { saturation: 0 } })]), assetsRoot });
  assert.deepEqual(await raw(await compositeFrame(grade, 0)), rgba(39, 39, 39, 255));
  const glow = await prepareComposite({ plan: base([image('glow', 'background.png', { glow: { intensity: 0.1, threshold: 0 } })]), assetsRoot });
  const glowPixels = await raw(await compositeFrame(glow, 0));
  assert(glowPixels[2] > 80);
  assert.equal(glowPixels[3], 255);

  const plan = base([image('background', 'background.png'), sequence('overlay', 'red-%06d.png')]);
  for (const invalid of [
    { ...plan, width: 5000 }, { ...plan, fps: 0 }, { ...plan, frameCount: 18001 },
    { ...plan, colorSpace: 'linear' }, { ...plan, typo: true }, { ...plan, layers: [] },
    base([image('a', '../outside.png')]), base([image('a', '/outside.png')]),
    base([image('a', 'background.png', { opacity: 2 })]),
    base([image('a', 'background.png', { glow: { intensity: 1 } })]),
    base([image('a', 'background.png', { adjustments: { exposure: 10 } })]),
    base([image('a', 'background.png', { endFrame: 0 })]),
    base([image('a', 'background.png'), image('a', 'background.png')]),
    base([{ id: 'bad', source: { type: 'sequence', path: 'red-%d.png' } }]),
  ]) assert.throws(() => validateCompositePlan(invalid));
  await assert.rejects(prepareComposite({ plan: base([sequence('missing', 'missing-%06d.png')]), assetsRoot }), /ENOENT/);
  await writePng('wrong-size.png', rgba(0, 0, 0, 255), 1, 4);
  await assert.rejects(prepareComposite({ plan: base([image('wrong', 'wrong-size.png')]), assetsRoot }), /2x2/);
  const outside = path.join(temp, 'outside.png');
  await writeFile(outside, await readFile(path.join(assetsRoot, 'background.png')));
  await symlink(outside, path.join(assetsRoot, 'escape.png'));
  await assert.rejects(prepareComposite({ plan: base([image('escape', 'escape.png')]), assetsRoot }), /escapes/);

  const progress = [];
  const composition = await compositeSequence({ plan, assetsRoot, outputRoot: path.join(temp, 'composite'), onProgress: p => progress.push(p.frame) });
  assert.deepEqual(progress, [1, 2, 3, 4]);
  assert.deepEqual(await raw(path.join(composition.outputRoot, 'frame-000003.png')), rgba(10, 148, 40, 255));
  assert.equal(JSON.parse(await readFile(path.join(composition.outputRoot, 'composition.json'))).complete, true);
  await assert.rejects(compositeSequence({ plan, assetsRoot, outputRoot: composition.outputRoot }), /EEXIST/);
  const rejectedOutput = path.join(temp, 'rejected');
  await assert.rejects(compositeSequence({ plan: base([sequence('missing', 'missing-%06d.png')]), assetsRoot, outputRoot: rejectedOutput }), /ENOENT/);
  await assert.rejects(readFile(path.join(rejectedOutput, 'composition.json')), /ENOENT/);
  await encodeComposite({ composition, output: path.join(temp, 'silent.mp4') });
  const silent = probe(path.join(temp, 'silent.mp4'));
  assert.equal(silent.streams.filter(s => s.codec_type === 'audio').length, 0);
  assert.equal(silent.streams[0].nb_frames, '4');
  assert.equal(silent.streams[0].r_frame_rate, '4/1');
  assert.equal(silent.streams[0].width, 2);
  assert.equal(silent.streams[0].color_space, 'bt709');
  assert.equal(silent.streams[0].color_transfer, 'iec61966-2-1');
  assert(Math.abs(Number(silent.format.duration) - 1) < 0.02);
  await assert.rejects(encodeComposite({ composition, output: path.join(temp, 'silent.mp4') }), /already exists/);
  const transparent = await compositeSequence({ plan: base([image('transparent', 'identity.png')]), assetsRoot, outputRoot: path.join(temp, 'transparent') });
  await assert.rejects(encodeComposite({ composition: transparent, output: path.join(temp, 'transparent.mp4') }), /opaque/);
  // Explicit audio only. A short supplied track is padded, never shortens the picture.
  const pcm = Buffer.alloc(44 + 4800 * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(48000, 24); pcm.writeUInt32LE(96000, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(pcm.length - 44, 40);
  const audio = path.join(temp, 'approved.wav');
  await writeFile(audio, pcm);
  await encodeComposite({ composition, output: path.join(temp, 'audio.mp4'), audio });
  const encoded = probe(path.join(temp, 'audio.mp4'));
  assert.equal(encoded.streams.filter(s => s.codec_type === 'audio').length, 1);
  assert.equal(encoded.streams.find(s => s.codec_type === 'video').nb_frames, '4');
  assert(Math.abs(Number(encoded.format.duration) - 1) < 0.05);
  console.log('Simple compositor: alpha, identity, mask, grading, glow, timing, bounded assets, cancellation-free sequence, H.264 and explicit audio passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
