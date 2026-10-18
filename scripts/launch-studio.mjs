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
  if (major < 22 || (major === 22 && minor < 12)) throw Error(`Serve Node.js >=22.12; attuale ${version}. Aggiorna Node e reinstalla il launcher se il percorso cambia.`);
}

export function parseArgs(args) {
  const options = { action: 'start', root: path.resolve(path.dirname(SELF), '..'), port: 4173, open: true };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (i === 0 && ['start', 'status', 'stop', '--serve'].includes(arg)) options.action = arg;
    else if (arg === '--no-open') options.open = false;
    else if (['--repo', '--port', '--instance'].includes(arg)) {
      const value = args[++i]; if (!value) throw Error(`Manca il valore di ${arg}.`);
      if (arg === '--repo') { if (!path.isAbsolute(value)) throw Error('--repo richiede un percorso assoluto.'); options.root = value; }
      else if (arg === '--port') { options.port = Number(value); if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) throw Error('Porta non valida (1024–65535).'); }
      else options.instance = value;
    } else throw Error('Uso: launch-studio.mjs [start|status|stop] [--repo /percorso/assoluto] [--port 4173] [--no-open]');
  }
  if (options.action === '--serve' && !options.instance) throw Error('Identificativo del servizio mancante.');
  return options;
}

export async function validateRepo(root, dependencies = false) {
  checkNode(); root = await realpath(root);
  let pkg;
  try { pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); }
  catch { throw Error(`Repository non valido: ${root}. Usa --repo con la radice di Motion Lab.`); }
  if (pkg.name !== 'motion-lab') throw Error('La cartella indicata non è Motion Lab.');
  for (const file of ['index.html', 'vite.config.js']) {
    try { if (!(await stat(path.join(root, file))).isFile()) throw Error(); }
    catch { throw Error(`Manca ${file}: indica la radice completa di Motion Lab.`); }
  }
  if (dependencies) {
    try { await stat(path.join(root, 'node_modules/vite/package.json')); }
    catch { throw Error('Dipendenze mancanti. Esegui npm ci nella repo, poi riprova. Se usi una copia ZIP, installale prima del primo avvio.'); }
  }
  return root;
}

export function paths(root, port) {
  const cache = path.join(root, '.motion-cache');
  return { cache, state: path.join(cache, `launcher-${port}.json`), log: path.join(cache, `launcher-${port}.log`), lock: path.join(cache, `launcher-${port}.lock`) };
}

async function readState(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw Error(`Stato launcher illeggibile: ${file}. Verificalo prima di riavviare.`); }
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
  console.log(`Motion Lab pronto: http://127.0.0.1:${port}/ · ${root}`);
}

export async function launch(options) {
  const root = await validateRepo(options.root);
  const { port, action } = options, files = paths(root, port), url = `http://127.0.0.1:${port}/`;
  if (action === '--serve') return serve({ ...options, root });
  if (action === 'status') {
    const running = await ownedHealth(root, port);
    console.log(running ? `Studio attivo: ${url} · PID ${running.pid} · ${root}` : 'Nessuna istanza sana di questo launcher per la repo e porta indicate.');
    return { running: Boolean(running), pid: running?.pid };
  }
  if (action === 'stop') {
    const running = await ownedHealth(root, port);
    if (!running) { console.log('Nessuna istanza propria da fermare. Altri processi non vengono toccati.'); return { stopped: false }; }
    process.kill(running.pid, 'SIGTERM');
    if (!await waitFor(async () => !await ownedHealth(root, port), 5000)) throw Error(`Studio non si è fermato. Controlla ${files.log}; nessun arresto forzato eseguito.`);
    console.log('Studio fermato.'); return { stopped: true };
  }
  if (options.open && process.platform !== 'darwin') throw Error('Apertura browser prevista su macOS. Per i test usa --no-open.');
  await mkdir(files.cache, { recursive: true });
  let running = await ownedHealth(root, port), reused = Boolean(running), locked = false;
  let updates;
  if(running){
    let active;
    try{const response=await fetch(`http://127.0.0.1:${port}/api/studio`,{signal:AbortSignal.timeout(1500)});if(!response.ok)throw Error();const data=await response.json();active=(data.jobs??[]).some(job=>['running','queued'].includes(job.status));}
    catch{active=true;}
    if(active)updates={state:'busy',note:'Aggiornamento rimandato: Studio sta lavorando o il suo stato non è verificabile.'};
  }
  updates ??= options.update===false?{state:'not-requested'}:await updateStudio({root});
  if(updates.lock){if(!await waitFor(async()=>{try{await stat(updates.lock);return false;}catch{return true;}},15000))throw Error('Aggiornamento ancora in corso; riprova tra poco.');updates=await updateStudio({root});}
  if(updates.state==='updated'||updates.installed){
    if(running){process.kill(running.pid,'SIGTERM');if(!await waitFor(async()=>!await ownedHealth(root,port),5000))throw Error('Riavvio dopo aggiornamento non confermato.');running=null;reused=false;}
  }
  await validateRepo(root,true);
  if (!running) {
    try { await mkdir(files.lock); locked = true; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      running = await waitFor(() => ownedHealth(root, port)); reused = Boolean(running);
      if (!running) throw Error(`Avvio già in corso oppure lock residuo: ${files.lock}. Verifica il processo precedente prima di rimuoverlo.`);
    }
    if (locked) {
      try {
        running = await ownedHealth(root, port); reused = Boolean(running);
        if (!running) {
          if (!await portAvailable(port)) throw Error(`Porta ${port} occupata da un altro servizio o da un'altra repo. Chiudilo oppure usa --port con una porta libera. Nessun processo è stato fermato.`);
          const instance = randomUUID(), fd = openSync(files.log, 'a', 0o600);
          let child;
          try {
            child = spawn(process.execPath, [SELF, '--serve', '--repo', root, '--port', String(port), '--instance', instance], { cwd: root, detached: true, stdio: ['ignore', fd, fd], env: { ...process.env, VITE_PUBLIC_DEMO: 'false', PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}` } });
            await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); child.unref();
          } finally { closeSync(fd); }
          running = await waitFor(async () => {
            const result = await ownedHealth(root, port);
            if (result?.instance === instance) return result;
            if (child.exitCode !== null || child.signalCode !== null) throw Error(`Avvio Vite fallito. Controlla ${files.log}.`);
            return null;
          });
          if (!running) {
            child.kill('SIGTERM');
            throw Error(`Avvio non confermato entro 15 secondi. Controlla ${files.log}.`);
          }
        }
      } finally { await rm(files.lock, { recursive: true, force: true }); }
    }
  }
  if (options.open) {
    const result = spawnSync('/usr/bin/open', [url], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error(`Studio pronto su ${url}, ma il browser non si è aperto. Apri l'indirizzo manualmente.`);
  }
  console.log(`${reused ? 'Studio riutilizzato' : 'Studio avviato'}: ${url} · PID ${running.pid} · log ${files.log}`);
  return { running: true, reused, pid: running.pid, url, updates };
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(SELF)) {
  try { await launch(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(`Motion Lab: ${error.message}`); process.exitCode = 1; }
}
