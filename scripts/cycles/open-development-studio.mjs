#!/usr/bin/env node
// Local, already-built runtime only. Does not download code or change Gatekeeper.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from '../launch-studio.mjs';
import {probeNative} from './standalone/runtime.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.env.FRAMEVOLVE_CYCLES_DIR ||= path.resolve(root, '../outputs/cycles-native/install');
try {
  const runtime = await probeNative();
  console.log('Cycles standalone ready: ' + runtime.devices.map(device => device.name).join(', '));
  await launch({root, port:4190, action:'start', open:true, update:false});
} catch (error) {
  console.error('Framevolve Cycles: ' + error.message);
  process.exitCode = 1;
}
