import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { startSetup } from './setup-mac.mjs';
import { readMemory, setMemoryConsent } from './feedback-memory-store.mjs';
import { ROOT, playwright } from './browser-runtime.mjs';
const root = await mkdtemp(path.join(os.tmpdir(), 'framevolve-ui-'));
await writeFile(path.join(root, 'package.json'), '{"name":"motion-lab","type":"module"}');
await symlink(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
let launched = 0, installs = [], fail = true;
const setup = await startSetup({ root, open: false, operations: {
  findChrome: async () => null,
  run: async (_command, args) => { installs.push(args); if (fail && args.includes('install')) throw Error('Download interrupted. Please retry.'); },
  installLauncher: async () => {}, launch: async () => { launched++; return { url: 'http://127.0.0.1:4173/' }; }, openStudio: async () => {}
} });
let browser;
try {
  browser = await playwright().chromium.launch({ executablePath: playwright().chromium.executablePath(), headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(setup.url);
  await page.locator('#install:enabled').waitFor();
  assert.equal(await page.locator('#advanced').evaluate(el => el.open), false);
  assert.equal(await page.locator('#browser').inputValue(), process.platform === 'darwin' && process.arch === 'arm64' ? 'native' : 'auto');
  await page.locator('#advanced summary').click();
  await page.locator('#browser').selectOption('auto');
  await page.locator('#advanced summary').click();
  assert.equal(await page.locator('#agent').isVisible(), false);
  assert.equal(await page.locator('#install').evaluate(el => el.getBoundingClientRect().bottom < innerHeight), true);
  assert.equal(await page.locator('.choices img').evaluateAll(images => images.length === 2 && images.every(img => img.complete && img.naturalWidth > 0)), true);
  assert.equal(await page.locator('#feedback-memory').isChecked(), false);
  await page.locator('#feedback-memory').click();
  await page.locator('#memory-notice').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#feedback-memory').isChecked(), false);
  await page.locator('#memory-decline').click();
  assert.equal(await page.locator('#feedback-memory').isChecked(), false);
  await page.locator('#memory-info').click();
  await page.locator('#memory-enable').click();
  assert.equal(await page.locator('#feedback-memory').isChecked(), true);
  await page.locator('input[value="codex"]').check();
  assert.match(await page.locator('#provider-docs').getAttribute('href'), /openai.com/);
  await mkdir('outputs/setup-check', { recursive: true });
  await page.screenshot({ path: 'outputs/setup-check/01-single-screen.png', fullPage: true });
  // One click prepares the default browser and opens Studio; failures stay on this screen.
  await page.locator('#install').click();
  await page.waitForFunction(() => document.querySelector('#error').textContent.includes('interrupted'));
  assert.equal(launched, 0);
  fail = false;
  await page.locator('#install:enabled').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Studio is open') && !document.querySelector('#install').disabled);
  assert.equal(launched, 1);
  assert.equal(setup.state.browser, 'chromium');
  assert.equal(setup.state.provider, 'codex');
  assert.equal(setup.state.feedbackMemory, true);
  assert.equal(installs.some(args => args.includes('--global')), false, 'agent install must wait for explicit Create with AI');
  await page.locator('#agent').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'outputs/setup-check/02-ready.png', fullPage: true });
  // A setup tab left open must not undo a later revocation made in Studio.
  await setMemoryConsent(root, false);
  await page.waitForFunction(() => !document.querySelector('#feedback-memory').checked);
  await page.locator('#install').click();
  await page.waitForFunction(() => !document.querySelector('#install').disabled);
  assert.equal((await readMemory(root)).consent.enabled, false);
  await page.locator('#advanced summary').click();
  await page.locator('#browser').selectOption('chrome');
  assert.equal(await page.locator('#ready').isVisible(), false);
  await page.locator('#locate').waitFor({ state: 'visible' });
  assert.match(await page.locator('#install').textContent(), /Set up/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'outputs/setup-check/03-narrow.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Setup UI: one screen, local logos, automatic Chromium, retry, auto-open, deferred agent setup and narrow layout passed.');
} finally { await browser?.close(); await new Promise(resolve => setup.server.close(resolve)); await rm(root, { recursive: true, force: true }); }
