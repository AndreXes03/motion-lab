import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './build-demo.mjs';

const base = 'http://127.0.0.1:4196/';
const packageInfo = JSON.parse(await readFile(path.join(ROOT, 'dist-demo/build-info.json'), 'utf8'));
const output = path.join(ROOT, 'outputs/sites-demo-review'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [], localFailures = [], apiCalls = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) localFailures.push({ url: response.url(), status: response.status() }); });
  page.on('request', request => { if (/\/api\//.test(new URL(request.url()).pathname)) apiCalls.push(request.url()); });
  // Gallery film URLs are inspected; smoke checks never download the remote films.
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await page.goto(base); await page.locator('.hero-film-poster').waitFor();
  await page.waitForFunction(() => document.querySelector('.hero-film-poster').complete && document.querySelector('.hero-film-poster').naturalWidth > 0);
  const films = { pulse: 'pulse-1080', camera: 'camera-1080', dot: 'dot-1080', pop: 'pop-motion', replay: 'replay-1080' };
  for (const [id, file] of Object.entries(films)) {
    await page.locator(`#film-${id}`).click();
    const url = await page.locator('#demo-player').getAttribute('src');
    assert.match(url, new RegExp(`${file}\\.mp4`)); assert.equal(new URL(url).origin, new URL(packageInfo.galleryMediaBase).origin);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(output, 'landing-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  // Viewport emulation and responsive styles settle asynchronously in Chromium.
  // A persistent overflow still fails this bounded check.
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 5000 });
  await page.screenshot({ path: path.join(output, 'landing-mobile.png') });
  for (const name of ['procedural.mp4', 'objects-in-play.mp4', 'pop-motion.mp4']) {
    const range = await fetch(base + 'demo/' + name, { headers: { Range: 'bytes=0-63' } });
    assert.equal(range.status, 206); assert.match(range.headers.get('content-type'), /video\/mp4/); assert.match(range.headers.get('content-range'), /^bytes 0-63\//); assert.equal((await range.arrayBuffer()).byteLength, 64);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + 'studio/?scene=procedural&render=1');
  await page.waitForFunction(() => window.motionPreview && window.motionRender); await page.evaluate(() => window.motionPreview.whenIdle());
  assert.equal(await page.locator('#scene').inputValue(), 'procedural');
  await page.locator('#export-dock').evaluate(element => element.open = true);
  assert.match(await page.locator('.render-policy-local-requirement').textContent(), /Blender installed/);
  await page.getByLabel('Renderer', { exact: true }).selectOption('cycles');
  assert.match(await page.locator('.render-policy-status').textContent(), /Browser video/);
  assert.equal(await page.locator('#render-final').isEnabled(), true, 'La scelta Cycles nella ricetta deve preservare il renderer video separato del browser.');
  assert.match(await page.locator('#render-final').textContent(), /^Export (MP4|WEBM)/i);
  assert.equal(await page.locator('#render-preview').isHidden(), true);
  await page.locator('#export-dock').evaluate(element => element.open = false);
  const proof = await page.evaluate(async () => {
    const hash = () => { let value = 2166136261; for (const channel of document.querySelector('#renderCanvas').getContext('2d').getImageData(0, 0, 384, 216).data) value = Math.imul(value ^ channel, 16777619); return value >>> 0; };
    const frame = async time => { await window.motion.render(time, { width: 384, height: 216, parameters: { scene: 'procedural' } }); return hash(); };
    return [await frame(1), await frame(3), await frame(1)];
  });
  assert.equal(proof[0], proof[2]); assert.notEqual(proof[0], proof[1]);
  await page.screenshot({ path: path.join(output, 'studio-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.motionPreview.whenIdle());
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 5000 });
  await page.screenshot({ path: path.join(output, 'studio-mobile.png') });
  assert.deepEqual(errors, []); assert.deepEqual(localFailures, []); assert.deepEqual(apiCalls, []);
  console.log(JSON.stringify({ passed: true, landing: true, galleryURLs: 5, remoteFilmsDownloaded: false, studioProcedural: true, deterministic: true, mobile: true, videoRange: true, noLocalAPI: true }));
} finally { await browser.close(); }
