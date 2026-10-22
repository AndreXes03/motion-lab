import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { findChrome, resolveBrowser, saveSetup, readSetup } from './browser-runtime.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'framevolve-browser-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const chrome = path.join(root, "User Apps/Google Chrome.app/Contents/MacOS/Google Chrome");
  const managedPath = path.join(root, 'Chromium');
  for (const file of [chrome, managedPath]) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, '#!/bin/sh\nexit 0\n', { mode: 0o755 }); }
  return { root, chrome, managedPath, env: {}, settings: {} };
}
test('system/user/custom paths with spaces are found; non-executable files are rejected', async t => {
  const f = await fixture(t);
  assert.equal(await findChrome({ candidates: ['/missing', f.chrome] }), f.chrome);
  await chmod(f.chrome, 0o644);
  assert.equal(await findChrome({ candidates: [f.chrome] }), null);
});
test('explicit browser overrides win and missing overrides fail clearly', async t => {
  const f = await fixture(t);
  assert.equal((await resolveBrowser({ ...f, env: { FRAMEVOLVE_BROWSER_PATH: f.managedPath, CHROME_PATH: '/missing' } })).executablePath, f.managedPath);
  await assert.rejects(resolveBrowser({ ...f, env: { CHROME_PATH: '/missing' } }), /override.*npm run setup/);
});
test('auto uses Chrome then Chromium; selected Chromium stays selected', async t => {
  const f = await fixture(t);
  assert.equal((await resolveBrowser(f)).kind, 'chrome');
  assert.equal((await resolveBrowser({ ...f, chrome: '' })).kind, 'chromium');
  assert.equal((await resolveBrowser({ ...f, settings: { browser: { kind: 'chromium' } } })).kind, 'chromium');
  await assert.rejects(resolveBrowser({ ...f, chrome: '', managedPath: '/missing' }), /Install Chromium/);
});
test('saved Chrome preference fails with recovery if moved, rather than silently changing engines', async t => {
  const f = await fixture(t);
  await saveSetup({ provider: 'other', browser: { kind: 'chrome', path: f.chrome } }, f.root);
  assert.equal((await readSetup(f.root)).provider, 'other');
  assert.equal((await resolveBrowser({ root: f.root, env: {} })).executablePath, f.chrome);
  await rm(f.chrome);
  await assert.rejects(resolveBrowser({ root: f.root, env: {} }), /locate Chrome or install Chromium/);
  await writeFile(path.join(f.root, '.motion-cache/setup.json'), '{bad');
  await assert.rejects(readSetup(f.root), /repair/);
});
test('native setup keeps legacy browser requirement explicit', async t => {
  const f = await fixture(t);
  await assert.rejects(resolveBrowser({ ...f, settings: { browser: { kind: 'native' } } }), /still needs a rendering browser/);
});
test('documented quick-start recipe exists and parses', async () => {
  const recipe = JSON.parse(await readFile(new URL('../demo/pop-motion.project.json', import.meta.url), 'utf8'));
  assert.equal(recipe.parameters.scene, 'pop');
});
