#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './build-demo.mjs';

if (!existsSync(path.join(ROOT, 'dist-demo/index.html'))) {
  console.error('Prima esegui npm run build:demo.'); process.exitCode = 1;
} else {
  // Vite preview serves MIME types, HEAD and byte ranges for the included MP4s.
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--outDir', 'dist-demo', '--base=/', '--host', '127.0.0.1', '--port', '4196', '--strictPort'], { cwd: ROOT, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
}
