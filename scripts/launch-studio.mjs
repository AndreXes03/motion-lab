#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

import {updateStudio} from './studio-update.mjs';

const SELF = fileURLToPath(import.meta.url);
export const HEALTH_PATH = '/__motion_lab_launcher_health';
const APP = 'motion-lab-local-launcher-v1';

export function checkNode(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw Error(`Node.js >=22.12 is required; found ${version}. Run Setup Framevolve.command to install a compatible runtime.`);
}

export function parseArgs(args) {
  const options = { action: 'start', root: path.resolve(path.dirname(SELF), '..'), port: 4173, open: true };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (i === 0 && ['start', 'status', 'stop', '--serve'].includes(arg)) options.action = arg;
    else if (arg === '--no-open') options.open = false;
    else if (['--repo', '--port', '--instance'].includes(arg)) {
      const value = args[++i]; if (!value) throw Error(`Missing value for ${arg}.`);
      if (arg === '--repo') { if (!path.isAbsolute(value)) throw Error('--repo requires an absolute path.'); options.root = value; }
      else if (arg === '--port') { options.port = Number(value); if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) throw Error('Invalid port (1024–65535).'); }
      else options.instance = value;
    } else throw Error('Usage: launch-studio.mjs [start|status|stop] [--repo /absolute/path] [--port 4173] [--no-open]');
  }
  if (options.action === '--serve' && !options.instance) throw Error('Missing service identifier.');
  return options;
}

export async function validateRepo(root, dependencies = false) {
  checkNode(); root = await realpath(root);
  let pkg;
  try { pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); }
  catch { throw Error(`Invalid repository: ${root}. Use --repo with the Framevolve repository root.`); }
  if (pkg.name !== 'motion-lab') throw Error('The selected folder is not a Framevolve repository.');
  for (const file of ['index.html', 'vite.config.js']) {
    try { if (!(await stat(path.join(root, file))).isFile()) throw Error(); }
    catch { throw Error(`Missing ${file}: select the complete Framevolve repository root.`); }
  }
  if (dependencies) {
    try { await stat(path.join(root, 'node_modules/vite/package.json')); }
    catch { throw Error('Dependencies are missing. Run Setup Framevolve.command, or npm ci in the repository, then try again.'); }
  }
  return root;
}

export function paths(root, port) {
  const cache = path.join(root, '.motion-cache');
  return { cache, state: path.join(cache, `launcher-${port}.json`), log: path.join(cache, `launcher-${port}.log`), lock: path.join(cache, `launcher-${port}.lock`) };
}

async function readState(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw Error(`Cannot read launcher state: ${file}. Check it before restarting.`); }
}

function health(port) {
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port, path: HEALTH_PATH, timeout: 500 }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; if (body.length > 16384) request.destroy(); });
      response.on('error', () => resolve(null));
      response.on('end', () => { try { resolve(response.statusCode === 200 ? JSON.parse(body) : null); } catch { resolve(null); } });
    });
    request.on('timeout', () => request.destroy()); request.on('error', () => resolve(null));
  });
}

async function ownedHealth(root, port) {
  const state = await readState(paths(root, port).state), result = await health(port);
  return state && result?.app === APP && result.root === root && result.port === port && result.instance === state.instance && result.pid === state.pid && Number.isInteger(result.pid) && result.pid > 1 ? result : null;
}

async function portAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function waitFor(check, timeout = 15000) {
  const deadline = Date.now() + timeout;
  do { const value = await check(); if (value) return value; await delay(80); } while (Date.now() < deadline);
  return null;
}

async function serve({ root, port, instance }) {
  root = await validateRepo(root, true);
  const files = paths(root, port), identity = { app: APP, root, port, instance, pid: process.pid };
  const require = createRequire(path.join(root, 'package.json'));
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  const server = await createServer({ root, cacheDir: path.join(files.cache, 'vite-launcher'), server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{ name: 'motion-lab-launcher-health', configureServer(vite) {
    vite.middlewares.use((request, response, next) => {
      if (request.url !== HEALTH_PATH) return next();
      if (request.method !== 'GET') { response.statusCode = 405; response.end(); return; }
      response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(identity));
    });
  }}], logLevel: 'info' });
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    await server.close();
    if ((await readState(files.state))?.instance === instance) await rm(files.state, { force: true });
    process.exitCode = 0;
  };
  process.on('SIGTERM', () => stop().catch(error => { console.error(error); process.exitCode = 1; }));
  process.on('SIGINT', () => stop().catch(error => { console.error(error); process.exitCode = 1; }));
  await server.listen();
  const temporary = `${files.state}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(identity) + '\n', { mode: 0o600 }); await rename(temporary, files.state);
  console.log(`Framevolve ready: http://127.0.0.1:${port}/ · ${root}`);
}

export async function launch(options) {
  const root = await validateRepo(options.root);
  const { port, action } = options, files = paths(root, port), url = `http://127.0.0.1:${port}/`;
  if (action === '--serve') return serve({ ...options, root });
  if (action === 'status') {
    const running = await ownedHealth(root, port);
    console.log(running ? `Studio running: ${url} · PID ${running.pid} · ${root}` : 'No healthy launcher instance for this repository and port.');
    return { running: Boolean(running), pid: running?.pid };
  }
  if (action === 'stop') {
    const running = await ownedHealth(root, port);
    if (!running) { console.log('No owned instance to stop. Other processes are left running.'); return { stopped: false }; }
    process.kill(running.pid, 'SIGTERM');
    if (!await waitFor(async () => !await ownedHealth(root, port), 5000)) throw Error(`Studio did not stop. Check ${files.log}; no process was forcibly stopped.`);
    console.log('Studio stopped.'); return { stopped: true };
  }
  if (options.open && process.platform !== 'darwin') throw Error('Automatic browser opening is supported on macOS. Use --no-open for tests.');
  await mkdir(files.cache, { recursive: true });
  let running = await ownedHealth(root, port), reused = Boolean(running), locked = false;
  let updates;
  if(running){
    let active;
    try{const response=await fetch(`http://127.0.0.1:${port}/api/studio`,{signal:AbortSignal.timeout(1500)});if(!response.ok)throw Error();const data=await response.json();active=(data.jobs??[]).some(job=>['running','queued'].includes(job.status));}
    catch{active=true;}
    if(active)updates={state:'busy',note:'Update postponed: Studio is busy or its status could not be verified.'};
  }
  updates ??= options.update===false?{state:'not-requested'}:await updateStudio({root});
  if(updates.lock){if(!await waitFor(async()=>{try{await stat(updates.lock);return false;}catch{return true;}},15000))throw Error('An update is still running; try again shortly.');updates=await updateStudio({root});}
  if(updates.state==='updated'||updates.installed){
    if(running){process.kill(running.pid,'SIGTERM');if(!await waitFor(async()=>!await ownedHealth(root,port),5000))throw Error('Restart after update could not be confirmed.');running=null;reused=false;}
  }
  await validateRepo(root,true);
  if (!running) {
    try { await mkdir(files.lock); locked = true; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      running = await waitFor(() => ownedHealth(root, port)); reused = Boolean(running);
      if (!running) throw Error(`Startup is already in progress or a lock remains: ${files.lock}. Check the previous process before removing it.`);
    }
    if (locked) {
      try {
        running = await ownedHealth(root, port); reused = Boolean(running);
        if (!running) {
          if (!await portAvailable(port)) throw Error(`Port ${port} is in use by another service or another repository. Close it or choose a free --port. No process was stopped.`);
          const instance = randomUUID(), fd = openSync(files.log, 'a', 0o600);
          let child;
          try {
            child = spawn(process.execPath, [SELF, '--serve', '--repo', root, '--port', String(port), '--instance', instance], { cwd: root, detached: true, stdio: ['ignore', fd, fd], env: { ...process.env, VITE_PUBLIC_DEMO: 'false', PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}` } });
            await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); child.unref();
          } finally { closeSync(fd); }
          running = await waitFor(async () => {
            const result = await ownedHealth(root, port);
            if (result?.instance === instance) return result;
            if (child.exitCode !== null || child.signalCode !== null) throw Error(`Vite startup failed. Check ${files.log}.`);
            return null;
          });
          if (!running) {
            child.kill('SIGTERM');
            throw Error(`Startup was not confirmed within 15 seconds. Check ${files.log}.`);
          }
        }
      } finally { await rm(files.lock, { recursive: true, force: true }); }
    }
  }
  if (options.open) {
    const result = spawnSync('/usr/bin/open', [url], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error(`Studio is ready at ${url}, but the browser did not open. Open the address manually.`);
  }
  console.log(`${reused ? 'Studio reused' : 'Studio started'}: ${url} · PID ${running.pid} · log ${files.log}`);
  return { running: true, reused, pid: running.pid, url, updates };
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(SELF)) {
  try { await launch(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(`Framevolve: ${error.message}`); process.exitCode = 1; }
}
