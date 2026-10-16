import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checkNode, isMotionLabRemote, parseArguments } from './aggiorna-motion-lab.mjs';

const updater = fileURLToPath(new URL('./aggiorna-motion-lab.mjs', import.meta.url));
const canonical = 'https://github.com/AndreXes03/motion-lab.git';
const baseEnv = { ...process.env, GIT_ALLOW_PROTOCOL: 'file', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
delete baseEnv.NODE_TEST_CONTEXT;

function fixture(t) {
  const base = mkdtempSync(path.join(os.tmpdir(), 'motion-lab-update-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const bare = path.join(base, 'remote.git'), author = path.join(base, 'author'), repo = path.join(base, 'copia Mac con spazi');
  const git = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, env: baseEnv, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const identity = cwd => { git(cwd, 'config', 'user.name', 'Update test'); git(cwd, 'config', 'user.email', 'test@example.invalid'); };
  git(base, 'init', '--bare', '--initial-branch=main', bare);
  git(base, 'init', '--initial-branch=main', author); identity(author);
  writeFileSync(path.join(author, '.gitignore'), 'node_modules/\nrenders/\noutputs/\n');
  writeFileSync(path.join(author, 'package.json'), JSON.stringify({ name: 'motion-lab', version: '1.0.0', private: true }));
  writeFileSync(path.join(author, 'package-lock.json'), JSON.stringify({ name: 'motion-lab', version: '1.0.0', lockfileVersion: 3, packages: {} }));
  writeFileSync(path.join(author, 'scene.txt'), 'originale\n');
  git(author, 'add', '.'); git(author, 'commit', '-m', 'Initial'); git(author, 'remote', 'add', 'origin', bare); git(author, 'push', '-u', 'origin', 'main');
  git(base, 'clone', bare, repo); identity(repo);
  git(repo, 'config', 'remote.origin.url', canonical);
  git(repo, 'config', `url.${bare}.insteadOf`, canonical);
  const bin = path.join(base, 'bin'); mkdirSync(bin);
  const npm = path.join(bin, 'npm');
  writeFileSync(npm, `#!${process.execPath}\nconst fs=require('node:fs'),p=require('node:path');const root=process.env.MOTION_LAB_TEST_ROOT;fs.appendFileSync(p.join(root,'npm-calls'),JSON.stringify(process.argv.slice(2))+'\\n');fs.mkdirSync(p.join(process.cwd(),'node_modules'),{recursive:true});while(fs.existsSync(p.join(root,'hold-install')))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);if(fs.existsSync(p.join(root,'fail-install')))process.exit(42);\n`);
  chmodSync(npm, 0o755);
  const env = { ...baseEnv, PATH: `${bin}${path.delimiter}${process.env.PATH}`, MOTION_LAB_TEST_ROOT: base };
  const update = () => spawnSync(process.execPath, [updater, '--repo', repo], { cwd: base, env, encoding: 'utf8' });
  const ok = () => { const r = update(); assert.equal(r.status, 0, r.stderr); return r; };
  const calls = () => existsSync(path.join(base, 'npm-calls')) ? readFileSync(path.join(base, 'npm-calls'), 'utf8').trim().split('\n').length : 0;
  const publish = (file, text) => { writeFileSync(path.join(author, file), text); git(author, 'add', file); git(author, 'commit', '-m', `Change ${file}`); git(author, 'push', 'origin', 'main'); return git(author, 'rev-parse', 'HEAD'); };
  return { base, repo, author, bare, git, identity, update, ok, calls, publish, env, state: path.join(repo, '.git', 'motion-lab-install.json') };
}

test('Node, remote e argomenti: accetta solo repository e percorsi previsti', () => {
  checkNode('22.12.0'); checkNode('24.0.0');
  assert.throws(() => checkNode('22.11.0'), />=22.12/);
  assert.throws(() => checkNode('20.19.0'));
  for (const url of [canonical, 'git@github.com:AndreXes03/motion-lab.git', 'ssh://git@github.com/AndreXes03/motion-lab']) assert.equal(isMotionLabRemote(url), true);
  for (const url of ['https://github.com/other/motion-lab', 'https://github.com.evil/AndreXes03/motion-lab', 'https://token@github.com/AndreXes03/motion-lab', canonical + '?x=1', '/tmp/remote']) assert.equal(isMotionLabRemote(url), false);
  assert.equal(parseArguments(['--repo', '/tmp/copia Mac']).root, '/tmp/copia Mac');
  assert.throws(() => parseArguments(['--repo', 'relativo']));
  assert.throws(() => parseArguments(['--force']));
});

test('aggiornamento clean fast-forward, installazione iniziale e nessuna reinstallazione inutile', t => {
  const f = fixture(t); f.ok(); assert.equal(f.calls(), 1);
  mkdirSync(path.join(f.repo, 'renders')); writeFileSync(path.join(f.repo, 'renders', 'locale.png'), 'preservare');
  f.git(f.author, 'branch', 'altro-branch'); f.git(f.author, 'push', 'origin', 'altro-branch');
  const head = f.publish('scene.txt', 'nuova scena\n');
  f.ok(); assert.equal(f.git(f.repo, 'rev-parse', 'HEAD'), head); assert.equal(f.calls(), 1);
  assert.equal(f.git(f.repo, 'branch', '-r').includes('altro-branch'), false);
  assert.equal(readFileSync(path.join(f.repo, 'renders', 'locale.png'), 'utf8'), 'preservare');
  f.ok(); assert.equal(f.calls(), 1); assert.equal(f.git(f.repo, 'status', '--porcelain'), '');
  assert.deepEqual(JSON.parse(readFileSync(path.join(f.base, 'npm-calls'), 'utf8').trim()), ['ci', '--no-audit', '--no-fund']);
});

test('modifiche tracked, staged e untracked bloccano e vengono preservate', t => {
  const f = fixture(t); const before = f.git(f.repo, 'rev-parse', 'HEAD'); f.publish('scene.txt', 'remoto\n');
  writeFileSync(path.join(f.repo, 'scene.txt'), 'locale\n');
  assert.match(f.update().stderr, /modifiche locali/);
  f.git(f.repo, 'add', 'scene.txt'); assert.match(f.update().stderr, /modifiche locali/);
  assert.equal(readFileSync(path.join(f.repo, 'scene.txt'), 'utf8'), 'locale\n');
  assert.equal(f.git(f.repo, 'rev-parse', 'HEAD'), before); assert.equal(f.calls(), 0);
  // Ripristino esplicito del solo fixture per verificare il caso untracked.
  f.git(f.repo, 'restore', '--staged', 'scene.txt'); f.git(f.repo, 'restore', 'scene.txt');
  writeFileSync(path.join(f.repo, 'LICENZA-LOCALE.txt'), 'non pubblicare');
  assert.match(f.update().stderr, /file non tracciati/);
  assert.equal(readFileSync(path.join(f.repo, 'LICENZA-LOCALE.txt'), 'utf8'), 'non pubblicare');
});

test('branch errato, HEAD detached e remote errato non modificano il checkout', t => {
  const f = fixture(t); f.git(f.repo, 'switch', '-c', 'work'); assert.match(f.update().stderr, /branch main/);
  f.git(f.repo, 'switch', '--detach'); assert.match(f.update().stderr, /branch main/);
  f.git(f.repo, 'switch', 'main'); f.git(f.repo, 'config', 'remote.origin.url', 'https://github.com/other/repo.git');
  assert.match(f.update().stderr, /remote origin/); assert.equal(f.calls(), 0);
});

test('divergenza e commit locali sono bloccati senza reset o push', t => {
  const f = fixture(t); writeFileSync(path.join(f.repo, 'locale.txt'), 'locale'); f.git(f.repo, 'add', '.'); f.git(f.repo, 'commit', '-m', 'Local only');
  const local = f.git(f.repo, 'rev-parse', 'HEAD'); assert.match(f.update().stderr, /commit locali/);
  const remote = f.publish('scene.txt', 'remoto divergente\n');
  assert.match(f.update().stderr, /divergente/); assert.equal(f.git(f.repo, 'rev-parse', 'HEAD'), local);
  assert.equal(f.git(f.bare, 'rev-parse', 'main'), remote); assert.equal(f.calls(), 0);
});

test('dipendenze cambiate e recupero npm ci fallito allo stesso commit', t => {
  const f = fixture(t); f.ok();
  const pkg = JSON.parse(readFileSync(path.join(f.author, 'package.json'), 'utf8')); pkg.version = '1.1.0';
  const remote = f.publish('package.json', JSON.stringify(pkg));
  writeFileSync(path.join(f.base, 'fail-install'), 'fail');
  assert.notEqual(f.update().status, 0); assert.equal(f.git(f.repo, 'rev-parse', 'HEAD'), remote);
  assert.equal(JSON.parse(readFileSync(f.state)).pending, true); assert.equal(f.calls(), 2);
  rmSync(path.join(f.base, 'fail-install')); f.ok(); assert.equal(f.calls(), 3);
  assert.equal(JSON.parse(readFileSync(f.state)).pending, false); f.ok(); assert.equal(f.calls(), 3);
  f.publish('package-lock.json', '{"lockfileVersion":3,"packages":{},"name":"motion-lab","version":"1.1.0"}');
  f.ok(); assert.equal(f.calls(), 4);
});

test('node_modules mancante, ABI Node e configurazione npm richiedono installazione', t => {
  const f = fixture(t); f.ok(); rmSync(path.join(f.repo, 'node_modules'), { recursive: true }); f.ok(); assert.equal(f.calls(), 2);
  const state = JSON.parse(readFileSync(f.state)); state.nodeAbi = 'vecchia'; writeFileSync(f.state, JSON.stringify(state));
  f.ok(); assert.equal(f.calls(), 3);
  f.publish('.npmrc', 'fund=false\n'); f.ok(); assert.equal(f.calls(), 4);
});

test('operazioni Git in corso e lock bloccano un secondo aggiornamento', t => {
  const f = fixture(t);
  for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'index.lock']) {
    const file = path.join(f.repo, '.git', name); writeFileSync(file, 'in corso');
    assert.match(f.update().stderr, /operazione Git/); rmSync(file);
  }
  for (const name of ['rebase-merge', 'rebase-apply', 'sequencer']) {
    const dir = path.join(f.repo, '.git', name); mkdirSync(dir);
    assert.match(f.update().stderr, /operazione Git/); rmSync(dir, { recursive: true });
  }
  const lock = path.join(f.repo, '.git', 'motion-lab-update.lock'); writeFileSync(lock, 'attivo');
  assert.match(f.update().stderr, /aggiornamento è già attivo/); assert.equal(existsSync(lock), true); assert.equal(f.calls(), 0);
});

test('modifiche e untracked nei submodule sono rilevati anche se ignore=all', t => {
  const f = fixture(t);
  f.git(f.repo, '-c', 'protocol.file.allow=always', 'submodule', 'add', f.bare, 'modulo');
  f.git(f.repo, 'commit', '-am', 'Local submodule fixture');
  f.git(f.repo, 'config', 'submodule.modulo.ignore', 'all');
  const file = path.join(f.repo, 'modulo', 'scene.txt'); writeFileSync(file, 'modifica submodule');
  assert.match(f.update().stderr, /modifiche locali/);
  f.git(path.join(f.repo, 'modulo'), 'restore', 'scene.txt'); writeFileSync(path.join(f.repo, 'modulo', 'non-tracciato'), 'preservare');
  assert.match(f.update().stderr, /file non tracciati/); assert.equal(f.calls(), 0);
});

test('due processi reali: il secondo non installa mentre il primo detiene il lock', async t => {
  const f = fixture(t), hold = path.join(f.base, 'hold-install'); writeFileSync(hold, 'attendi');
  const first = spawn(process.execPath, [updater, '--repo', f.repo], { cwd: f.base, env: f.env, stdio: 'ignore' });
  const done = new Promise(resolve => first.once('exit', (code, signal) => resolve({ code, signal })));
  t.after(() => { if (first.exitCode === null) first.kill('SIGKILL'); });
  try {
    for (let i = 0; i < 150 && f.calls() === 0; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(f.calls(), 1, 'Il primo processo deve raggiungere npm');
    const second = f.update(); assert.notEqual(second.status, 0); assert.match(second.stderr, /aggiornamento è già attivo/);
    assert.equal(f.calls(), 1);
  } finally { rmSync(hold, { force: true }); }
  assert.deepEqual(await done, { code: 0, signal: null });
});

test('fetch fallito lascia HEAD, file e installazione invariati', t => {
  const f = fixture(t), before = f.git(f.repo, 'rev-parse', 'HEAD');
  f.git(f.repo, 'config', '--unset-all', `url.${f.bare}.insteadOf`);
  // Il solo protocollo file è abilitato: nessuna richiesta di rete può partire.
  const result = f.update(); assert.notEqual(result.status, 0); assert.match(result.stderr, /git non riuscito/);
  assert.equal(f.git(f.repo, 'rev-parse', 'HEAD'), before); assert.equal(f.calls(), 0);
  assert.equal(existsSync(path.join(f.repo, '.git', 'motion-lab-update.lock')), false);
});

test('launcher Mac: aggiorna prima di avviare; nessun viewer se update fallisce', t => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'motion-lab-launch-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin'); mkdirSync(bin);
  const trace = path.join(root, 'trace');
  for (const command of ['node', 'npm']) {
    const file = path.join(bin, command);
    writeFileSync(file, `#!/bin/sh\nprintf '%s\\n' '${command}' >> "$MOTION_LAB_LAUNCH_LOG"\nexit ${command === 'node' ? '"${MOTION_LAB_UPDATE_STATUS:-0}"' : '0'}\n`);
    chmodSync(file, 0o755);
  }
  for (const name of ['Aggiorna Motion Lab.command', 'Avvia Motion Lab.command']) {
    const file = path.join(root, name);
    writeFileSync(file, readFileSync(new URL(`../${name}`, import.meta.url)));
    assert.equal(spawnSync('bash', ['-n', file]).status, 0);
    for (const status of ['0', '7']) {
      rmSync(trace, { force: true });
      const result = spawnSync('bash', [file], { cwd: os.tmpdir(), encoding: 'utf8', env: { ...baseEnv, PATH: `${bin}${path.delimiter}${process.env.PATH}`, MOTION_LAB_LAUNCH_LOG: trace, MOTION_LAB_UPDATE_STATUS: status } });
      assert.equal(result.status, Number(status), result.stderr);
      assert.equal(readFileSync(trace, 'utf8'), name.startsWith('Avvia') && status === '0' ? 'node\nnpm\n' : 'node\n');
      if (name.startsWith('Avvia') && status !== '0') assert.match(result.stdout, /Studio non avviato/);
    }
  }
});
