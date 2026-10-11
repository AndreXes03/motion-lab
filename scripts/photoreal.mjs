#!/usr/bin/env node
// Optional still renderer. Dependencies stay outside the main application tree.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deps = path.join(root, 'experiments/photoreal/node_modules');
const options = {
  width: 960, height: 720, samples: 128, asset: 'headphones',
  out: 'renders/photoreal-lab/result',
};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  if (!process.argv[i].startsWith('--') || !Object.hasOwn(options, key) || process.argv[i + 1] === undefined) {
    throw Error('Expected --width, --height, --samples, --asset or --out');
  }
  options[key] = ['width', 'height', 'samples'].includes(key)
    ? Number(process.argv[i + 1]) : process.argv[i + 1];
}
for (const key of ['width', 'height', 'samples']) {
  if (!Number.isInteger(options[key]) || options[key] < 1 || options[key] > (key === 'samples' ? 2048 : 4096)) {
    throw Error('Invalid ' + key);
  }
}
if (!['camera', 'turntable', 'headphones'].includes(options.asset)) throw Error('Unsupported asset');
await access(path.join(deps, 'three-gpu-pathtracer')).catch(() => {
  throw Error('Install the optional experiment first: npm ci --prefix experiments/photoreal --ignore-scripts');
});
const output = path.resolve(options.out);
await mkdir(output, { recursive: true });
for (const name of ['raster.png', 'pathtraced.png', 'metrics.json']) {
  try {
    await access(path.join(output, name));
    throw Error('Output exists; choose another --out directory');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
let server, browser;
const stop = async () => {
  await browser?.close();
  await server?.close();
};
process.once('SIGINT', async () => { await stop(); process.exit(130); });
process.once('SIGTERM', async () => { await stop(); process.exit(143); });
try {
  server = await createServer({
    root, configFile: false,
    resolve: {
      dedupe: ['three'],
      alias: {
        'three-gpu-pathtracer': path.join(deps, 'three-gpu-pathtracer/src/index.js'),
        'three-mesh-bvh': path.join(deps, 'three-mesh-bvh/src/index.js'),
        'xatlas-web': path.join(deps, 'xatlas-web/dist/xatlas-web.js'),
        'three/addons': path.join(deps, 'three/examples/jsm'),
        'three': path.join(deps, 'three'),
      },
    },
    server: { hmr: false, host: '127.0.0.1', port: 0 }, logLevel: 'error',
  });
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('console', message => {
    if (message.type() === 'error') { errors.push(message.text()); console.error(message.text()); }
  });
  await page.exposeFunction('saveImage', async (name, data) => {
    if (!['raster', 'pathtraced'].includes(name)) throw Error('Unexpected capture name');
    await writeFile(path.join(output, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
    console.log(JSON.stringify({ saved: name }));
  });
  await page.exposeFunction('reportProgress', value => console.log(JSON.stringify(value)));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/experiments/photoreal/`);
  await page.waitForFunction(() => window.lab, { timeout: 60000 });
  const metrics = await page.evaluate(options => window.lab.render(options), options);
  if (errors.length) throw Error(errors.join('\n'));
  await writeFile(path.join(output, 'metrics.json'), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ complete: true, output, ...metrics }));
} finally {
  await stop();
}
