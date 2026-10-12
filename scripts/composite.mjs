#!/usr/bin/env node
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { compositeSequence, encodeComposite, prepareComposite } from './lib/simple-compositor.mjs';

const help = 'Use node scripts/composite.mjs --plan plan.json --assets assets-directory --out new-directory [--encode true] [--audio approved.wav] [--audio-offset seconds] [--check true]';
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i], value = process.argv[i + 1];
  if (!['--plan', '--assets', '--out', '--encode', '--audio', '--audio-offset', '--check'].includes(flag) || value === undefined || Object.hasOwn(options, flag)) throw new Error(help);
  options[flag] = value;
}
if (!options['--plan'] || !options['--assets'] || (!options['--out'] && options['--check'] !== 'true')) throw new Error(help);
for (const flag of ['--encode', '--check']) if (options[flag] !== undefined && !['true', 'false'].includes(options[flag])) throw new Error(`${flag} expects true or false`);
if (options['--audio'] && options['--encode'] !== 'true') throw new Error('--audio requires --encode true');
if (options['--audio-offset'] && !options['--audio']) throw new Error('--audio-offset requires --audio');
const audioOffset = Number(options['--audio-offset'] ?? 0);
if (!Number.isFinite(audioOffset) || audioOffset < 0 || audioOffset > 7200) throw new Error('Invalid --audio-offset');
const planFile = path.resolve(options['--plan']);
if ((await stat(planFile)).size > 1024 * 1024) throw new Error('Composition plan exceeds 1 MiB');
const plan = JSON.parse(await readFile(planFile, 'utf8'));
const assetsRoot = path.resolve(options['--assets']);
if (options['--check'] === 'true') {
  const prepared = await prepareComposite({ plan, assetsRoot });
  console.log(JSON.stringify({ valid: true, width: prepared.plan.width, height: prepared.plan.height, fps: prepared.plan.fps, frameCount: prepared.plan.frameCount, referencedFiles: prepared.files.size }));
} else {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort(new Error('Composition cancelled')));
  process.once('SIGTERM', () => controller.abort(new Error('Composition cancelled')));
  const composition = await compositeSequence({ plan, assetsRoot, outputRoot: options['--out'], signal: controller.signal, onProgress: progress => {
    if (progress.frame === 1 || progress.frame === progress.frameCount || progress.frame % 25 === 0) console.log(JSON.stringify({ stage: 'compositing', ...progress }));
  } });
  const video = options['--encode'] === 'true' ? await encodeComposite({ composition, output: path.join(composition.outputRoot, 'video.mp4'), audio: options['--audio'], audioOffset, signal: controller.signal }) : undefined;
  console.log(JSON.stringify({ complete: true, output: composition.outputRoot, elapsedMs: composition.elapsedMs, video }));
}
