#!/usr/bin/env node
import { readSetup, resolveBrowser } from './browser-runtime.mjs';
import { launch, parseArgs } from './launch-studio.mjs';
import { startSetup } from './setup-mac.mjs';
const options = parseArgs(process.argv.slice(2));
try {
  let configured = false;
  try { configured = Boolean((await readSetup(options.root)).completedAt); if (configured) await resolveBrowser({ root: options.root }); }
  catch { configured = false; }
  if (configured) await launch(options);
  else await startSetup({ root: options.root });
} catch (error) { console.error(`Framevolve: ${error.message}`); process.exitCode = 1; }
