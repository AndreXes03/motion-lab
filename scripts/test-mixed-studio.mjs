#!/usr/bin/env node
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm, access, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import ffprobe from 'ffprobe-static';
import { preflightMixed, runMixedJob, buildMixedCommand, readMixedSnapshot } from './mixed/studio.mjs';
import { createHash } from 'node:crypto';
import { navyGradientRgba } from './lib/gradient-background.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'motion-lab-mixed-studio-'));
const assets = path.join(root, 'assets');
await mkdir(assets);
const png = (name, color) => sharp({ create: { width: 4, height: 4, channels: 4, background: color } }).png().toFile(path.join(assets, name));
try {
  await png('base.png', { r: 10, g: 20, b: 30, alpha: 1 });
  await png('overlay.png', { r: 210, g: 120, b: 30, alpha: 0.5 });
  const plan = { version: 1, colorSpace: 'srgb', width: 4, height: 4, fps: 4, frameCount: 4, layers: [
    { id: 'base', source: { type: 'image', path: 'assets/base.png' } },
    { id: 'overlay', source: { type: 'image', path: 'assets/overlay.png' } },
  ] };
  await writeFile(path.join(assets, 'plan.json'), JSON.stringify(plan));
  const policy = { version: 1, renderer: 'mixed', source: 'agent', composite: { enabled: true, planFile: 'assets/plan.json' } };
  const snapshot = { command: 'export', config: { width: 4, height: 4, fps: 4, duration: 1 }, width: 4, height: 4, fps: 4, settings: { format: 'mp4' }, parameters: { renderPolicy: policy } };
  const prepared = await preflightMixed({ root, policy, settings: snapshot.settings, kind: 'export', duration: 1 });
  assert.equal(prepared.plan.frameCount, 4);
  assert.equal((await preflightMixed({ root, policy, kind: 'frame', time: 0.5 })).frame, 2);
  await assert.rejects(preflightMixed({ root, policy, settings: { width: 8 } }), /width must match/);
  await assert.rejects(preflightMixed({ root, policy, settings: { fps: 30 } }), /fps must match/);
  await assert.rejects(preflightMixed({ root, policy, settings: { format: 'webm' } }), /MP4/);
  await assert.rejects(preflightMixed({ root, policy, duration: 2 }), /frame count/);
  await assert.rejects(preflightMixed({ root, policy, kind: 'frame', time: 2 }), /outside/);
  const controller = new AbortController();
  controller.abort(Error('cancel proof'));
  await assert.rejects(runMixedJob({ root, snapshot, outputPath: 'renders/cancel.mp4', signal: controller.signal }), /cancel proof/);
  await assert.rejects(access(path.join(root, 'renders/cancel.mp4')), /ENOENT/);
  const midController = new AbortController();
  await assert.rejects(runMixedJob({ root, snapshot, outputPath: 'renders/mid-cancel.mp4', signal: midController.signal, onEvent: event => { if (event.type === 'frame') midController.abort(Error('mid-frame cancellation')); } }), /mid-frame cancellation/);
  await access(path.join(root, 'renders/mid-cancel.mp4.mixed/frame-000001.png'));
  await assert.rejects(access(path.join(root, 'renders/mid-cancel.mp4.mixed/composition.json')), /ENOENT/);
  await assert.rejects(access(path.join(root, 'renders/mid-cancel.mp4')), /ENOENT/);
  await assert.rejects(runMixedJob({ root, snapshot, outputPath: '../outside.mp4' }), /relative path/);
  await assert.rejects(runMixedJob({ root, snapshot, outputPath: 'assets/not-an-output.mp4' }), /renders/);
  const events = [];
  const movie = await runMixedJob({ root, snapshot, outputPath: 'renders/mixed.mp4', onEvent: event => events.push(event) });
  const pixels = await sharp(path.join(movie.frameDirectory, 'frame-000001.png')).raw().toBuffer();
  assert.deepEqual([...pixels.subarray(0, 4)], [110, 70, 30, 255]);
  assert.deepEqual(events.filter(event => event.type === 'frame').map(event => event.frames), [1, 2, 3, 4]);
  assert(events.some(event => event.phase === 'encoding'));
  const metadata = spawnSync(ffprobe.path, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', movie.outputPath], { encoding: 'utf8' });
  assert.equal(metadata.status, 0);
  const probed = JSON.parse(metadata.stdout);
  assert.equal(probed.streams[0].nb_frames, '4');
  assert.equal(probed.streams[0].width, 4);
  assert(Math.abs(Number(probed.format.duration) - 1) < 0.02);
  await assert.rejects(runMixedJob({ root, snapshot, outputPath: 'renders/mixed.mp4' }), /already exists/);
  const frame = await runMixedJob({ root, snapshot: { ...snapshot, command: 'frame', time: 0.75 }, outputPath: 'renders/frame.png' });
  assert.equal(frame.sourceFrame, 3);
  assert.deepEqual([...((await sharp(frame.outputPath).raw().toBuffer()).subarray(0, 4))], [110, 70, 30, 255]);
  let changedSource = false;
  const immutable = await runMixedJob({ root, snapshot, outputPath: 'renders/immutable.mp4', onEvent: async event => {
    if (event.type === 'frame' && !changedSource) {
      changedSource = true;
      await png('overlay.png', { r: 0, g: 255, b: 0, alpha: 1 });
    }
  } });
  for (let i = 1; i <= 4; i++) assert.deepEqual([...((await sharp(path.join(immutable.frameDirectory, `frame-${String(i).padStart(6, '0')}.png`)).raw().toBuffer()).subarray(0, 4))], [110, 70, 30, 255]);
  const frozenManifest = JSON.parse(await readFile(path.join(immutable.inputDirectory, '.motion-lab-inputs.json'), 'utf8'));
  assert.equal(frozenManifest.complete, true);
  assert.equal(frozenManifest.files.length, 2);
  assert.notEqual(frozenManifest.files.find(file => file.path === 'assets/overlay.png').sha256, createHash('sha256').update(await readFile(path.join(assets, 'overlay.png'))).digest('hex'));
  const wav = Buffer.alloc(44 + 4800 * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  await writeFile(path.join(assets, 'approved.wav'), wav);
  const withAudio = await runMixedJob({ root, snapshot, outputPath: 'renders/frozen-audio.mp4', audioPath: 'assets/approved.wav', onEvent: async event => {
    if (event.type === 'frame' && event.frame === 1) await writeFile(path.join(assets, 'approved.wav'), 'changed original audio after freezing');
  } });
  const audioProbe = JSON.parse(spawnSync(ffprobe.path, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', withAudio.outputPath], { encoding: 'utf8' }).stdout);
  assert.equal(audioProbe.streams.filter(stream => stream.codec_type === 'audio').length, 1);
  assert(Math.abs(Number(audioProbe.format.duration) - 1) < 0.05);
  assert.deepEqual(await readFile(path.join(withAudio.inputDirectory, 'assets/approved.wav')), wav);
  await writeFile(path.join(assets, 'approved.wav'), wav);
  const audioPolicy = { ...policy, composite: { ...policy.composite, audioFile: 'assets/approved.wav', audioOffset: 0.02 } };
  const audioReady = await preflightMixed({ root, policy: audioPolicy });
  assert.equal(audioReady.audioPath, 'assets/approved.wav');
  assert.equal(audioReady.audioOffset, 0.02);
  assert.equal(audioReady.audioMetadata.bytes, wav.length);
  const policyMovie = await runMixedJob({ root, snapshot: { ...snapshot, parameters: { renderPolicy: audioPolicy } }, outputPath: 'renders/policy-audio.mp4' });
  const policyProbe = JSON.parse(spawnSync(ffprobe.path, ['-v', 'error', '-show_streams', '-of', 'json', policyMovie.outputPath], { encoding: 'utf8' }).stdout);
  assert.equal(policyProbe.streams.filter(stream => stream.codec_type === 'audio').length, 1);
  assert.deepEqual(await readFile(path.join(policyMovie.inputDirectory, 'assets/approved.wav')), wav);
  await writeFile(path.join(assets, 'malformed.wav'), 'this is not an audio file');
  const malformedPolicy = { ...policy, composite: { ...policy.composite, audioFile: 'assets/malformed.wav' } };
  await assert.rejects(preflightMixed({ root, policy: malformedPolicy }), /Invalid mixed audio source/);
  await assert.rejects(runMixedJob({ root, snapshot: { ...snapshot, parameters: { renderPolicy: malformedPolicy } }, outputPath: 'renders/malformed-sound.mp4' }), /Invalid mixed audio source/);
  await assert.rejects(access(path.join(root, 'renders/malformed-sound.mp4.inputs')), /ENOENT/);
  const silentPolicy = { ...policy, composite: { ...policy.composite, audioFile: 'renders/mixed.mp4' } };
  await assert.rejects(preflightMixed({ root, policy: silentPolicy }), /actual audio stream/);
  await assert.rejects(preflightMixed({ root, policy: { ...audioPolicy, composite: { ...audioPolicy.composite, audioOffset: 1 } } }), /outside/);
  // An explicitly selected CLI/adapter track overrides a stale prepared-policy track.
  const overridden = await preflightMixed({ root, policy: malformedPolicy, audioPath: 'assets/approved.wav', audioOffset: 0 });
  assert.equal(overridden.audioPath, 'assets/approved.wav');
  const escaped = await mkdtemp(path.join(os.tmpdir(), 'motion-lab-mixed-escaped-'));
  try {
    await symlink(escaped, path.join(root, 'renders/escape'));
    await assert.rejects(runMixedJob({ root, snapshot, outputPath: 'renders/escape/out.mp4' }), /escapes/);
    await symlink(path.join(escaped, 'outside.json'), path.join(assets, 'escape.json'));
    await writeFile(path.join(escaped, 'outside.json'), JSON.stringify(snapshot));
    await assert.rejects(readMixedSnapshot(root, 'assets/escape.json'), /escapes/);
  } finally { await rm(escaped, { recursive: true, force: true }); }
  const command = buildMixedCommand({ kind: 'export', snapshotPath: 'snapshot.json', outputPath: 'renders/out.mp4', root, audioPath: 'assets/approved.wav' });
  assert(command.args.includes('--audio'));
  assert.throws(() => buildMixedCommand({ kind: 'export', root, audioPath: '../secret.wav' }), /relative path/);
  const gradient = navyGradientRgba(4, 4);
  assert.equal(gradient.length, 64);
  assert.deepEqual(gradient, navyGradientRgba(4, 4));
  for (let i = 3; i < gradient.length; i += 4) assert.equal(gradient[i], 255);
  assert.throws(() => navyGradientRgba(4, 4, { navy: 'blue' }), /#RRGGBB/);
  console.log('Mixed Studio adapter: prepared plan, immutable byte/hash inputs, source mutation, pixel blending, frame/video dispatch, progress, cancellation, bounds, duration, output/snapshot safety and deterministic gradient passed.');
} finally { await rm(root, { recursive: true, force: true }); }
