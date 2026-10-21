import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { ROOT, playwright } from './browser-runtime.mjs';
import { authScript, ensureLauncher, startSetup } from './setup-mac.mjs';

test('agent command quotes spaces, apostrophes and shell metacharacters', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'framevolve-agent-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'agent.command');
  await writeFile(script, authScript("/tmp/a 'quote' $(not-a-command)", "/tmp/agent 'quoted'"));
  assert.equal(spawnSync('/bin/sh', ['-n', script]).status, 0);
  assert.match(await readFile(script, 'utf8'), /docs\/FOUNDER_START.md/);
});
test('setup rerun reuses matching shortcut; foreign shortcut is preserved', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'framevolve-shortcut-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const destination = path.join(root, 'Framevolve.app');
  const info = path.join(destination, 'Contents/Resources/installation.json');
  await mkdir(path.dirname(info), { recursive: true });
  const { realpath } = await import('node:fs/promises');
  await writeFile(info, JSON.stringify({ repository: root, node: await realpath(process.execPath), setupVersion: 1 }));
  assert.equal(await ensureLauncher(root, destination), destination);
  await writeFile(info, JSON.stringify({ repository: os.tmpdir(), node: process.execPath }));
  await assert.rejects(ensureLauncher(root, destination), /existing Framevolve app/);
  assert.ok(await readFile(info));
});
test('local setup API enforces token, host, origin and provider allowlist; retry works', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'framevolve-setup-'));
  let setup;
  t.after(async () => { if (setup) await new Promise(resolve => setup.server.close(resolve)); await rm(root, { recursive: true, force: true }); });
  await writeFile(path.join(root, 'package.json'), '{"name":"motion-lab","type":"module"}');
  await symlink(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  let failInstall = true, launched = 0;
  setup = await startSetup({ root, open: false, operations: {
    run: async (command, args) => { if (args.includes('install') && failInstall) throw Error('Simulated interrupted download'); },
    installLauncher: async () => {}, launch: async () => { launched++; return { url: 'http://127.0.0.1:4173/' }; }, openStudio: async () => {}
  } });
  const { origin, hash } = new URL(setup.url);
  const headers = { 'x-framevolve-setup': hash.slice(1), origin, 'content-type': 'application/json' };
  const post = (route, body = {}, override = {}) => fetch(origin + '/api/' + route, { method: 'POST', headers: { ...headers, ...override }, body: JSON.stringify(body) });
  assert.equal((await fetch(origin + '/api/state')).status, 403);
  assert.equal((await post('provider', { provider: 'codex' }, { origin: 'https://example.com' })).status, 403);
  assert.equal((await post('provider', { provider: 'codex' }, { host: 'evil.example' })).status, 403);
  assert.equal((await post('provider', { provider: 'constructor' })).status, 400);
  assert.equal((await post('provider', { provider: 'other' })).status, 200);
  assert.equal((await post('finish')).status, 400);
  assert.equal(launched, 0);
  assert.equal((await post('prepare', { browser: 'chromium' })).status, 200);
  const wait = async () => { const deadline = Date.now() + 30000; while (setup.state.busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(setup.state.busy, false); };
  await wait();
  assert.match(setup.state.error, /interrupted/); assert.equal(setup.state.ready, false);
  // CI downloads Chromium before this test. Real browser launch/WebGL check, no account login.
  failInstall = false;
  assert.equal((await post('prepare', { browser: 'chromium' })).status, 200);
  await wait(); assert.equal(setup.state.error, ''); assert.equal(setup.state.ready, true);
  assert.equal((JSON.parse(await readFile(path.join(root, '.motion-cache/setup.json'), 'utf8'))).browser.kind, 'chromium');
  assert.equal((await post('finish')).status, 200); await wait(); assert.equal(launched, 1);
});
