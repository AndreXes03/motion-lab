import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, realpath, symlink } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checkNode, HEALTH_PATH, parseArgs, paths } from './launch-studio.mjs';
import { installerArgs, installLauncher } from './install-mac-launcher.mjs';

const helper = fileURLToPath(new URL('./launch-studio.mjs', import.meta.url));
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;

async function freePort() {
  const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}

async function command(root, port, action = 'start', source = helper) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [source, action, '--repo', root, '--port', String(port), '--no-open'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', text => stdout += text); child.stderr.on('data', text => stderr += text);
    child.once('error', reject); child.once('close', code => resolve({ code, stdout, stderr }));
  });
}

async function fixture(t) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'motion-launch-')));
  const root = path.join(base, "Repo Mac con spazi e 'apostrofo'");
  await mkdir(path.join(root, 'node_modules/vite'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), '{"name":"motion-lab","type":"module"}');
  await writeFile(path.join(root, 'index.html'), '<h1>Motion Lab fixture</h1>'); await writeFile(path.join(root, 'vite.config.js'), 'export default {};');
  await writeFile(path.join(root, 'node_modules/vite/package.json'), '{"name":"vite","type":"module","main":"fake.mjs"}');
  await writeFile(path.join(root, 'node_modules/vite/fake.mjs'), `
import http from 'node:http';
export async function createServer(options) {
 const middleware=[];
 const server=http.createServer((req,res)=>{
  let i=0; const next=()=>{const fn=middleware[i++];if(fn)fn(req,res,next);else{res.statusCode=200;res.end('<h1>Motion Lab fixture</h1>');}};next();
 });
 const api={middlewares:{use(fn){middleware.push(fn);}}};
 for(const plugin of options.plugins) plugin.configureServer?.(api);
 return {listen(){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.server.port,options.server.host,resolve);});},close(){return new Promise(resolve=>server.close(resolve));}};
}
`);
  await mkdir(path.join(root,'public/brand'),{recursive:true});await writeFile(path.join(root,'public/brand/framevolve.icns'),'test-icon');
  await mkdir(path.join(root,'licenses/legacy'),{recursive:true});await writeFile(path.join(root,'LICENSE'),'Framevolve Free Use License');await writeFile(path.join(root,'licenses/legacy/MIT.txt'),'Legacy MIT notice');
  const port = await freePort();
  t.after(async () => {
    try { await command(root, port, 'stop'); } finally { await rm(base, { recursive: true, force: true }); }
  });
  return { base, root, port };
}

test('Node e argomenti: requisiti espliciti e percorsi assoluti', () => {
  checkNode('22.12.0'); checkNode('24.0.0'); assert.throws(() => checkNode('22.11.0')); assert.throws(() => checkNode('20.19.0'));
  assert.equal(parseArgs(['--repo', '/tmp/repo', '--no-open']).open, false);
  assert.equal(parseArgs(['status', '--port', '4194']).action, 'status');
  for (const args of [['--repo', 'relativa'], ['--port', '0'], ['--port', 'abc'], ['--update']]) assert.throws(() => parseArgs(args));
  assert.throws(() => installerArgs(['--destination', 'relativa']));
  const destination = path.join(os.tmpdir(), 'Motion Lab.app');
  assert.equal(installerArgs(['--destination', destination]).port, 4173);
  assert.equal(installerArgs(['--destination', destination, '--port', '4198']).port, 4198);
  for (const port of ['0', '65536', 'abc', '4198.5']) assert.throws(() => installerArgs(['--destination', destination, '--port', port]));
  if (process.platform !== 'darwin') assert.throws(() => installerArgs([]), /user Applications/);
});

test('lifecycle detached: start, health della root, riuso stesso PID, stop e nuovo avvio', async t => {
  const f = await fixture(t);
  const first = await command(f.root, f.port); assert.equal(first.code, 0, first.stderr); assert.match(first.stdout, /started/);
  const a = JSON.parse(await readFile(paths(f.root, f.port).state));
  const health = await (await fetch(`http://127.0.0.1:${f.port}${HEALTH_PATH}`)).json(); assert.equal(health.root, f.root); assert.equal(health.pid, a.pid);
  assert.equal((await command(f.root, f.port, 'status')).code, 0);
  const second = await command(f.root, f.port); assert.equal(second.code, 0, second.stderr); assert.match(second.stdout, /reused/);
  assert.equal(JSON.parse(await readFile(paths(f.root, f.port).state)).pid, a.pid);
  const stop = await command(f.root, f.port, 'stop'); assert.equal(stop.code, 0, stop.stderr); assert.match(stop.stdout, /stopped/);
  assert.match((await command(f.root, f.port, 'status')).stdout, /No healthy launcher/);
  await assert.rejects(fetch(`http://127.0.0.1:${f.port}${HEALTH_PATH}`));
  const third = await command(f.root, f.port); assert.equal(third.code, 0, third.stderr); assert.notEqual(JSON.parse(await readFile(paths(f.root, f.port).state)).instance, a.instance);
});

test('due doppio clic contemporanei avviano un solo servizio', async t => {
  const f = await fixture(t);
  const results = await Promise.all([command(f.root, f.port), command(f.root, f.port)]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  assert.equal(results.filter(result => result.stdout.includes('started')).length, 1);
  assert.equal(results.filter(result => result.stdout.includes('reused')).length, 1);
});

test('porta estranea in use: nessun riuso, stop o processo aggiuntivo', async t => {
  const f = await fixture(t), foreign = http.createServer((req, res) => {res.statusCode=404;res.end('foreign');});
  await new Promise(resolve => foreign.listen(f.port, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => foreign.close(resolve)));
  const result = await command(f.root, f.port); assert.equal(result.code, 1); assert.match(result.stderr, /in use/);
  const stop = await command(f.root, f.port, 'stop'); assert.equal(stop.code, 0); assert.match(stop.stdout, /Other processes/);
  assert.equal(await (await fetch(`http://127.0.0.1:${f.port}/`)).text(), 'foreign');
});

test('un servizio Motion Lab di altra root non viene riusato o stopped', async t => {
  const a = await fixture(t), b = await fixture(t);
  assert.equal((await command(a.root, a.port)).code, 0);
  const result = await command(b.root, a.port); assert.equal(result.code, 1); assert.match(result.stderr, /another repository/);
  assert.match((await command(b.root, a.port, 'stop')).stdout, /Other processes/);
  assert.match((await command(a.root, a.port, 'status')).stdout, /Studio running/);
});

test('dipendenze assenti e root sbagliata: errori chiari senza installazione automatica', async t => {
  const f = await fixture(t); await rm(path.join(f.root, 'node_modules'), { recursive: true });
  const missing = await command(f.root, f.port); assert.equal(missing.code, 1); assert.match(missing.stderr, /npm ci/);
  await writeFile(path.join(f.root, 'package.json'), '{"name":"altra-app"}'); assert.match((await command(f.root, f.port)).stderr, /not a Framevolve repository/);
});

test('installer esterno: bundle con spazi, Node/repo assoluti, shell valida e nessun overwrite', async t => {
  const f = await fixture(t), destination = path.join(f.base, "Applications con spazi e 'quote'", 'Motion Lab.app');
  const external = path.join(f.base, 'strumenti revisionati'); await mkdir(external);
  for (const name of ['launch-studio.mjs', 'install-mac-launcher.mjs','studio-update.mjs','zip-update.mjs','update-dialog.mjs']) await writeFile(path.join(external, name), await readFile(new URL(name, import.meta.url)));
  const result = spawnSync(process.execPath, [path.join(external, 'install-mac-launcher.mjs'), '--repo', f.root, '--destination', destination, '--port', String(f.port)], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const executable = path.join(destination, 'Contents/MacOS/MotionLabLauncher');
  assert.equal((await stat(executable)).mode & 0o111, 0o111); assert.equal(spawnSync('/bin/sh', ['-n', executable]).status, 0);
  const config = JSON.parse(await readFile(path.join(destination, 'Contents/Resources/installation.json')));
  assert.equal(config.repository, f.root); assert.equal(path.isAbsolute(config.node), true);
  assert.equal(config.port, f.port);
  const shell = await readFile(executable, 'utf8'); assert.equal(shell.includes('Terminal.app'), false); assert.equal(shell.includes('npm ci'), false); assert.equal(shell.includes('git fetch'), false);
  assert.equal(shell.includes(`--port ${f.port} >>`), true);
  assert.match(await readFile(path.join(destination, 'Contents/Info.plist'), 'utf8'), /<string>APPL<\/string>/);
  assert.equal(await readFile(path.join(destination,'Contents/Resources/LICENSE'),'utf8'),'Framevolve Free Use License');
  assert.equal(await readFile(path.join(destination,'Contents/Resources/LEGACY-MIT.txt'),'utf8'),'Legacy MIT notice');
  const copied = path.join(destination, 'Contents/Resources/launch-studio.mjs');
  const launch = await command(f.root, f.port, 'start', copied); assert.equal(launch.code, 0, launch.stderr);
  await assert.rejects(installLauncher({root:f.root,destination}), /Already exists/);
});

test('entry CLI tramite symlink e directory alias: avvio e installazione realmente eseguiti', async t => {
  const f = await fixture(t);
  const launcherAlias = path.join(f.base, 'launcher alias.mjs');
  const scriptsAlias = path.join(f.base, 'directory alias');
  const repoAlias = path.join(f.base, 'repo alias');
  await symlink(helper, launcherAlias);
  await symlink(path.dirname(helper), scriptsAlias, 'dir');
  await symlink(f.root, repoAlias, 'dir');
  const started = await command(repoAlias, f.port, 'start', launcherAlias);
  assert.equal(started.code, 0, started.stderr); assert.match(started.stdout, /Studio started/);
  assert.equal(JSON.parse(await readFile(paths(f.root, f.port).state)).root, f.root);
  const destination = path.join(f.base, 'Applications alias test', 'Motion Lab.app');
  const installed = spawnSync(process.execPath, [path.join(scriptsAlias, 'install-mac-launcher.mjs'), '--repo', repoAlias, '--destination', destination, '--port', String(f.port)], { env, encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stderr); assert.match(installed.stdout, /Launcher installed/);
  const info = JSON.parse(await readFile(path.join(destination, 'Contents/Resources/installation.json')));
  assert.equal(info.repository, f.root);
  assert.equal(info.port, f.port);
  const stopped = await command(repoAlias, f.port, 'stop', path.join(scriptsAlias, 'launch-studio.mjs'));
  assert.equal(stopped.code, 0, stopped.stderr); assert.match(stopped.stdout, /Studio stopped/);
});
