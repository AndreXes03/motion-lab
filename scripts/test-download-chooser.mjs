import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.zip': 'application/zip', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    name = name.replace(/^\/motion-lab\//, '/');
    if (name.startsWith('/downloads/')) name = 'outputs' + name;
    else if (name.startsWith('/studio/')) name = 'dist/' + name.slice(8);
    else if (name === '/' || name === '/index.html') name = 'showcase/index.html';
    else if (['/site.js', '/site.css'].includes(name)) name = 'showcase' + name;
    const file = path.resolve(root, '.' + (name.startsWith('/') ? name : '/' + name));
    if (!file.startsWith(root + path.sep)) throw Error('Path rejected');
    const body = await readFile(file.endsWith('/') ? file + 'index.html' : file);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.statusCode = 404; res.end('missing'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await page.route(/\.(mp4|gif|jpe?g|png)(\?|$)/, route => route.abort());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const pathname of ['/motion-lab/', '/showcase/index.html']) {
    await page.goto(origin + pathname);
    const opener = page.locator('[data-open-downloads]').first();
    await opener.click(); assert.equal(await page.locator('#downloads').evaluate(el => el.open), true);
    assert.equal(await page.locator('#downloads button[autofocus]').evaluate(el => document.activeElement === el), true);
    const links = page.locator('[data-download-file]');
    assert.equal(await links.count(), 3);
    for (const link of await links.all()) {
      const response = await page.request.get(new URL(await link.getAttribute('href'), page.url()).href);
      assert.equal(response.status(), 200); assert.equal(response.headers()['content-type'], 'application/zip');
      assert.equal((await response.body()).readUInt32LE(), 0x04034b50);
    }
    for (let step = 0; step < 10; step++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#downloads').evaluate(el => el.contains(document.activeElement)), true);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#downloads').evaluate(el => el.open), false);
    assert.equal(await opener.evaluate(el => document.activeElement === el), true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/motion-lab/');
  await page.getByRole('button', { name: 'Download for macOS' }).click();
  const box = await page.locator('#downloads').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390);
  const last = page.locator('[data-download-file]').last(); await last.scrollIntoViewIfNeeded(); assert.ok(await last.isVisible());
  await page.getByRole('button', { name: 'Close downloads' }).click();
  assert.equal(await page.locator('#downloads').evaluate(el => el.open), false);
  assert.deepEqual(errors, []);
  await mkdir(path.join(root, 'outputs/downloads-check'), { recursive: true });
  await page.getByRole('button', { name: 'Download for macOS' }).click();
  await page.screenshot({ path: path.join(root, 'outputs/downloads-check/mobile.png') });
  console.log('Chooser PASS: root + showcase paths, 3 real ZIP downloads, focus trap/return, Escape, mobile fit and close; no page errors.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
