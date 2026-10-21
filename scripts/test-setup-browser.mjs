import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { startSetup } from './setup-mac.mjs';
import { playwright } from './browser-runtime.mjs';
const setup = await startSetup({ open: false, operations: { run: async () => {}, installLauncher: async () => {} } });
let browser;
try {
  browser = await playwright().chromium.launch({ executablePath: playwright().chromium.executablePath(), headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(setup.url);
  await page.locator('#next:enabled').waitFor();
  await page.locator('input[value="codex"]').check();
  await page.locator('#agent-options').waitFor({ state: 'visible' });
  assert.match(await page.locator('#provider-docs').getAttribute('href'), /openai.com/);
  await page.locator('input[value="other"]').check();
  await mkdir('outputs/setup-check', { recursive: true });
  await page.screenshot({ path: 'outputs/setup-check/01-agent.png', fullPage: true });
  await page.locator('#next').click();
  await page.locator('#step2').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'outputs/setup-check/02-browser.png', fullPage: true });
  await page.locator('input[value="chromium"]').check();
  await page.locator('#prepare').click();
  await page.locator('#step3').waitFor({ state: 'visible', timeout: 30000 });
  await page.screenshot({ path: 'outputs/setup-check/03-ready.png', fullPage: true });
  await page.locator('#change').click();
  await page.waitForTimeout(1500); // A state refresh must not send Back straight to the last step.

  await page.locator('#step1').waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'outputs/setup-check/03-narrow.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Setup UI: provider choices, navigation, CSP, narrow layout and screenshots passed.');
} finally { await browser?.close(); await new Promise(resolve => setup.server.close(resolve)); }
