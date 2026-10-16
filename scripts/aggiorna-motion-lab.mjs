#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, openSync, closeSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(script), '..');

export function checkNode(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw Error(`Serve Node.js >=22.12; versione attuale: ${version}. Aggiorna Node e riprova.`);
  }
}

export function isMotionLabRemote(remote) {
  try {
    const normalized = remote.startsWith('git@github.com:')
      ? `ssh://git@github.com/${remote.slice('git@github.com:'.length)}` : remote;
    const url = new URL(normalized);
    return ['https:', 'ssh:'].includes(url.protocol) && url.hostname === 'github.com'
      && !url.port && !url.search && !url.hash && !url.password
      && (url.protocol === 'ssh:' ? url.username === 'git' : !url.username)
      && url.pathname.replace(/\.git$/, '').toLowerCase() === '/andrexes03/motion-lab';
  } catch { return false; }
}

export function parseArguments(args) {
  if (!args.length) return { root: defaultRoot };
  if (args.length === 2 && args[0] === '--repo' && path.isAbsolute(args[1])) return { root: args[1] };
  throw Error('Uso: node aggiorna-motion-lab.mjs [--repo /percorso/assoluto/motion-lab]');
}

export function updateMotionLab({ root = defaultRoot, log = console.log } = {}) {
  checkNode();
  root = realpathSync(root);
  const run = (command, args, { capture = true } = {}) => {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
    if (result.error) throw Error(`Impossibile eseguire ${command}: ${result.error.message}`);
    if (result.status !== 0) throw Error(`${command} non riuscito (${result.status}). ${capture ? result.stderr.trim() : 'Leggi il messaggio qui sopra e riprova dopo aver risolto il problema.'}`);
    return capture ? result.stdout.trim() : '';
  };
  const git = (...args) => run('git', args);
  if (realpathSync(git('rev-parse', '--show-toplevel')) !== root) throw Error('Avvia lo script dalla copia completa di Motion Lab.');
  const remotes = git('config', '--get-all', 'remote.origin.url').split('\n');
  if (remotes.length !== 1 || !isMotionLabRemote(remotes[0])) {
    throw Error('Il remote origin deve identificare GitHub AndreXes03/motion-lab. Nessun aggiornamento eseguito.');
  }
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') {
    throw Error('Serve il branch main. Controlla git status e salva il tuo lavoro prima di passare a main; poi riprova.');
  }
  const requireClean = () => {
    const status = git('status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none');
    if (status) throw Error(`Ci sono modifiche locali o file non tracciati: ${JSON.stringify(status)}\nControlla git status. Conserva e riconcilia questi file con il tuo agente prima di riprovare. Non vengono eseguiti stash, reset o pulizie automatiche.`);
  };
  const gitPath = name => path.resolve(root, git('rev-parse', '--git-path', name));
  for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG', 'index.lock']) {
    if (existsSync(gitPath(name))) throw Error('È in corso un’operazione Git. Completala con il tuo agente prima di aggiornare.');
  }
  requireClean();
  const lockPath = gitPath('motion-lab-update.lock');
  let lock;
  try { lock = openSync(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw Error(`Un aggiornamento è già attivo, oppure è rimasto il blocco ${lockPath}. Se il processo precedente è terminato, chiedi al tuo agente di verificare il blocco.`);
  }
  try {
    const dependenciesHash = () => {
      const hash = createHash('sha256');
      for (const name of ['package.json', 'package-lock.json', '.npmrc']) {
        hash.update(name).update('\0');
        const file = path.join(root, name);
        hash.update(existsSync(file) ? readFileSync(file) : '<assente>').update('\0');
      }
      return hash.digest('hex');
    };
    const before = git('rev-parse', 'HEAD');
    const beforeHash = dependenciesHash();
    const statePath = gitPath('motion-lab-install.json');
    let state;
    if (existsSync(statePath)) {
      try { state = JSON.parse(readFileSync(statePath, 'utf8')); }
      catch { throw Error(`Stato installazione illeggibile: ${statePath}. Chiedi al tuo agente di verificarlo prima di aggiornare.`); }
      if (state.version !== 1 || typeof state.completedHash !== 'string' || typeof state.pending !== 'boolean' || typeof state.nodeAbi !== 'string') throw Error('Stato installazione non valido. Chiedi al tuo agente di verificarlo.');
    } else state = { version: 1, completedHash: beforeHash, nodeAbi: process.versions.modules, pending: true };
    const saveState = () => {
      const temporary = `${statePath}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(state) + '\n');
      // Rename atomico: lo stato precedente resta valido se il processo si interrompe.
      renameSync(temporary, statePath);
    };
    log('Motion Lab: controllo di origin/main…');
    git('fetch', '--no-tags', '--no-recurse-submodules', 'origin', 'refs/heads/main:refs/remotes/origin/main');
    requireClean();
    const [ahead] = git('rev-list', '--left-right', '--count', 'HEAD...refs/remotes/origin/main').split(/\s+/).map(Number);
    if (ahead) throw Error('main contiene commit locali assenti da origin/main oppure è divergente. Chiedi al tuo agente di riconciliarli; nessun reset, push o merge di riconciliazione viene eseguito.');
    git('merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main');
    saveState(); // Conserva la firma precedente anche se il processo si interrompe dopo il fast-forward.
    git('merge', '--ff-only', '--no-edit', 'refs/remotes/origin/main');
    const after = git('rev-parse', 'HEAD');
    const currentHash = dependenciesHash();
    const install = !existsSync(path.join(root, 'node_modules')) || state.pending || state.completedHash !== currentHash || state.nodeAbi !== process.versions.modules;
    if (install) {
      state.pending = true;
      saveState();
      log('Installazione dipendenze con npm ci… Se fallisce, risolvi la causa e avvia di nuovo questo aggiornamento.');
      run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], { capture: false });
      state = { version: 1, completedHash: currentHash, nodeAbi: process.versions.modules, pending: false };
      saveState();
    }
    const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    log(`Motion Lab ${version} · main · ${after.slice(0, 12)} · Node ${process.versions.node}`);
    log(`${before === after ? 'Codice già aggiornato' : `Aggiornato ${before.slice(0, 12)} → ${after.slice(0, 12)}`}; dipendenze ${install ? 'installate' : 'invariate'}.`);
    log('renders/, outputs/ e gli asset ignorati da Git non si sincronizzano: scaricali separatamente dal cloud.');
    return { before, after, installed: install };
  } finally {
    closeSync(lock);
    rmSync(lockPath);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  try { updateMotionLab(parseArguments(process.argv.slice(2))); }
  catch (error) { console.error(`\nAggiornamento interrotto: ${error.message}`); process.exitCode = 1; }
}
