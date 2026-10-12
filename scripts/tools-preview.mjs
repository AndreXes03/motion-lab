#!/usr/bin/env node
import {chromium} from 'playwright';
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sceneConfig} from '../src/scene-registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
const baseUrl = flag('url') ?? 'http://127.0.0.1:4194/';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewport = {width: 1600, height: 1000};

async function openStudio(browser, panel, outputName) {
  const page = await browser.newPage({viewport, deviceScaleFactor: 2, reducedMotion: 'reduce'});
  const url = new URL('/', baseUrl);
  url.searchParams.set('scene', 'bax');
  url.searchParams.set('panel', panel);
  await page.goto(url.href, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.motion?.ready);
  await page.evaluate(() => window.motion.ready);
  await page.waitForSelector(panel === 'motion' ? '#motion-control' : '#control-scope');
  await page.evaluate(() => window.motionPreview?.whenIdle());
  await page.evaluate(() => document.fonts?.ready);
  await page.locator('#preview-quality').selectOption('sharp');
  await page.locator('#seek').evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }, Math.round(8.8 * sceneConfig('bax').fps));

  if (panel === 'motion') {
    await page.locator('#motion-control').selectOption('group:camera');
    await page.locator('#motion-window').selectOption('3');
    await page.locator('#motion-native-section').waitFor();
  } else {
    const category = flag('category') ?? 'all';
    await page.locator(`#tool-categories button[data-category="${category}"]`).click();
    await page.locator('#inspector-look').evaluate(element => {
      for (const panel of element.querySelectorAll('details.catalog-group')) {
        if (!panel.hidden && !panel.open) panel.open = true;
      }
    });
  }

  await page.evaluate(() => window.motionPreview?.whenIdle());
  await page.locator('.direction').evaluate(element => { element.scrollTop = 0; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const fullPath = path.join(root, 'demo', outputName);
  const image = await page.screenshot({type: 'png'});
  await sharp(image).jpeg({quality: 91, mozjpeg: true}).toFile(fullPath);
  await page.close();
  return fullPath;
}

await mkdir(path.join(root, 'demo'), {recursive: true});
const browser = await chromium.launch({executablePath: chromePath, headless: true, args: ['--disable-gpu-sandbox']});
try {
  const outputs = [
    await openStudio(browser, 'look', 'ui-tools.jpg'),
    await openStudio(browser, 'motion', 'ui-motion-groups.jpg')
  ];
  console.log(JSON.stringify({outputs, note: 'Original camera keys and evaluated movement are shown; no project or recipe was saved.'}));
} finally {
  await browser.close();
}
