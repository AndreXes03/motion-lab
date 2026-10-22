import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { ROOT } from './browser-runtime.mjs';
import { authScript, ensureLauncher, nativeProductionSupported, startSetup } from './setup-mac.mjs';

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
  let failInstall = true, launched = 0, downloads = 0, browserChecks = 0, nativeChecks = 0;
  setup = await startSetup({ root, open: false, operations: {
    findChrome: async () => null,
    verifyBrowser: async ({browser}) => { assert.ok(['chrome','chromium'].includes(browser.kind)); browserChecks++; },
    verifyNative: async checkRoot => { assert.equal(checkRoot, root); nativeChecks++; },
    run: async (command, args) => { if (args.includes('install')) { downloads++; if (failInstall) throw Error('Simulated interrupted download'); } },
    installLauncher: async () => {}, launch: async () => { launched++; return { url: 'http://127.0.0.1:4173/' }; }, openStudio: async () => {}
  } });
  const { origin, hash } = new URL(setup.url);
  const headers = { 'x-framevolve-setup': hash.slice(1), origin, 'content-type': 'application/json' };
  const post = (route, body = {}, override = {}) => fetch(origin + '/api/' + route, { method: 'POST', headers: { ...headers, ...override }, body: JSON.stringify(body) });
  assert.equal((await fetch(origin + '/api/state')).status, 403);
  assert.equal((await post('provider', { provider: 'codex' }, { origin: 'https://example.com' })).status, 403);
  const wrongHost = await new Promise((resolve, reject) => {
    const request = http.request(origin + '/api/provider', { method: 'POST', headers: { ...headers, host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end(JSON.stringify({ provider: 'codex' }));
  });
  assert.equal(wrongHost, 403);
  assert.equal((await post('provider', { provider: 'constructor' })).status, 400);
  assert.equal((await post('provider', { provider: 'other' })).status, 200);
  assert.equal((await post('install', { provider: 'constructor', browser: 'auto' })).status, 400);
  assert.equal((await post('install', { provider: 'other', browser: 'unknown' })).status, 400);
  assert.equal(setup.state.feedbackMemory, false);
  assert.equal((await post('memory', { enabled: 'yes' })).status, 400);
  assert.equal((await post('memory', { enabled: true })).status, 200);
  assert.equal(setup.state.feedbackMemory, true);
  assert.equal((await post('memory', { enabled: false })).status, 200);
  assert.equal((await post('finish')).status, 400);
  assert.equal(launched, 0);
  assert.equal((await post('install', { provider: 'other', browser: 'auto' })).status, 200);
  const wait = async () => { const deadline = Date.now() + 30000; while (setup.state.busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(setup.state.busy, false); };
  await wait();
  assert.match(setup.state.error, /interrupted/); assert.equal(setup.state.ready, false);
  // API behavior uses an injected browser probe; the real browser check remains in setup.
  failInstall = false;
  assert.equal((await post('install', { provider: 'other', browser: 'auto' })).status, 200);
  await wait(); assert.equal(setup.state.error, ''); assert.equal(setup.state.ready, true);
  assert.equal((JSON.parse(await readFile(path.join(root, '.motion-cache/setup.json'), 'utf8'))).browser.kind, 'chromium');
  assert.equal(launched, 1, 'combined install opens Studio automatically');
  assert.equal(downloads, 2, 'automatic mode falls back to Chromium');
  // Use an executable fixture to exercise Chrome selection without a runner app.
  setup.state.chrome = path.join(root,'fake-chrome');
  await writeFile(setup.state.chrome, '#!/bin/sh\nexit 0\n', {mode:0o700});
  assert.equal((await post('install', { provider: 'claude', browser: 'auto' })).status, 200);
  await wait(); assert.equal(setup.state.error, ''); assert.equal(setup.state.browser, 'chrome');
  assert.equal(downloads, 2, 'existing Chrome avoids a browser download');
  assert.equal((await post('install', { provider: 'other', browser: 'chromium' })).status, 200);
  await wait(); assert.equal(setup.state.error, ''); assert.equal(setup.state.browser, 'chromium');
  assert.equal(downloads, 3, 'explicit Chromium overrides detected Chrome');
  assert.equal(browserChecks, 3, 'each successful setup checks its selected browser');
  if (nativeProductionSupported()) {
    assert.equal((await post('install', { provider: 'other', browser: 'native' })).status, 200);
    await wait(); assert.equal(setup.state.browser, 'native'); assert.equal(nativeChecks, 1);
    assert.equal(downloads, 3, 'native production does not download a rendering browser');
    assert.equal(browserChecks, 3, 'native production does not probe a rendering browser');
  } else assert.equal((await post('install', { provider: 'other', browser: 'native' })).status, 400);
  assert.equal((await post('finish')).status, 200); await wait(); assert.equal(launched, nativeProductionSupported() ? 5 : 4);
  assert.equal((await post('provider', { provider: 'codex' })).status, 200, 'optional agent setup remains available after Studio opens');
  assert.equal((await post('close')).status, 200);
});
