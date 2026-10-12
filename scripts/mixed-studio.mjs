#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMixedSnapshot, runMixedJob } from './mixed/studio.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kind = process.argv[2];
if (!['frame', 'preview', 'export'].includes(kind)) throw Error('Use mixed-studio.mjs frame|preview|export --snapshot FILE --out FILE [--audio PROJECT_RELATIVE_FILE]');
const options = {};
for (let i = 3; i < process.argv.length; i += 2) {
  if (!['--snapshot', '--out', '--audio', '--audio-offset'].includes(process.argv[i]) || process.argv[i + 1] === undefined || Object.hasOwn(options, process.argv[i])) throw Error('Invalid mixed job arguments');
  options[process.argv[i]] = process.argv[i + 1];
}
if (!options['--snapshot'] || !options['--out']) throw Error('Mixed job requires --snapshot and --out');
const controller = new AbortController();
process.once('SIGINT', () => controller.abort(Error('Mixed job cancelled')));
process.once('SIGTERM', () => controller.abort(Error('Mixed job cancelled')));
try {
  const snapshot = await readMixedSnapshot(root, options['--snapshot']);
  if (snapshot.command !== kind) throw Error('Mixed snapshot command does not match invocation');
  const result = await runMixedJob({ root, snapshot, outputPath: options['--out'], audioPath: options['--audio'], audioOffset: options['--audio-offset'] === undefined ? undefined : Number(options['--audio-offset']), signal: controller.signal, onEvent: event => console.log(JSON.stringify(event)) });
  if (kind === 'frame') console.log(JSON.stringify({ type: 'complete', ...result }));
} catch (error) {
  console.error(JSON.stringify({ type: 'error', message: error.message }));
  process.exitCode = controller.signal.aborted ? 130 : 1;
}
