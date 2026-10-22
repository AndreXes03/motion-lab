#!/usr/bin/env node
import http from 'node:http';
import { readMemory, setMemoryConsent } from './feedback-memory-store.mjs';
import { spawn, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ROOT, findChrome, chromeExecutable, executable, playwright, readSetup, saveSetup, resolveBrowser } from './browser-runtime.mjs';
import { checkNode, launch } from './launch-studio.mjs';
import { installLauncher } from './install-mac-launcher.mjs';
import { cyclesComponentManager } from './cycles/component.mjs';

const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
export const PROVIDERS = {
  codex: { name: 'OpenAI · Codex', package: '@openai/codex', command: 'codex', docs: 'https://developers.openai.com/codex/cli/' },
  claude: { name: 'Anthropic · Claude Code', package: '@anthropic-ai/claude-code', command: 'claude', docs: 'https://code.claude.com/docs/en/setup' },
  other: { name: 'Another agent / decide later' }
};
const runFile = (command, args, options = {}) => new Promise((resolve, reject) => execFile(command, args, { encoding: 'utf8', ...options }, (error, stdout, stderr) => error ? reject(Error(stderr?.trim() || error.message)) : resolve(stdout.trim())));
export const nativeProductionSupported = (platform = process.platform, arch = process.arch) => platform === 'darwin' && arch === 'arm64';
export async function verifyNativeProduction(root = ROOT) {
  if (!nativeProductionSupported()) throw Error('Native production is currently supported only on Apple Silicon Macs. Choose Chrome or Chromium for this computer.');
  const require = createRequire(path.join(root, 'package.json'));
  const { Canvas } = require('skia-canvas');
  const canvas = new Canvas(2, 2), context = canvas.getContext('2d');
  context.fillStyle = '#25a6d4'; context.fillRect(0, 0, 2, 2);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  if (pixel[0] !== 37 || pixel[1] !== 166 || pixel[2] !== 212 || pixel[3] !== 255) throw Error('Native canvas raster check failed. Retry setup.');
  const png = canvas.toBufferSync('png');
  if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('Native canvas PNG check failed. Retry setup.');
  await runFile(require('ffmpeg-static'), ['-version']);
  await runFile(require('ffprobe-static').path, ['-version']);
}
export function authScript(root, binary) {
  // Paths are shell quoted. The provider owns authentication; no credentials are read here.
  return `#!/bin/sh\nexport PATH=${quote(path.dirname(process.execPath))}:"$PATH"\ncd ${quote(root)} || exit 1\nprintf '%s\\n' 'Sign in if requested, then ask your agent to read docs/FOUNDER_START.md.'\n${quote(binary)}\nresult=$?\nif [ "$result" -ne 0 ]; then printf '%s\\n' 'Agent closed with an error. Return to Framevolve setup to retry or use the official setup guide.'; fi\nprintf '%s\\n' 'Press Return to close.'\nread answer\nexit "$result"\n`;
}
export async function findAgent(id, root = ROOT) {
  const provider = PROVIDERS[id]; if (!provider?.command) return null;
  const locations = [path.join(root, '.motion-cache/agents/bin', provider.command), path.join(os.homedir(), '.local/bin', provider.command), ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean).map(dir => path.resolve(dir, provider.command)), `/opt/homebrew/bin/${provider.command}`, `/usr/local/bin/${provider.command}`];
  for (const file of locations) if (await executable(file)) return file;
  return null;
}
export async function ensureLauncher(root, destination = path.join(os.homedir(), 'Applications/Framevolve.app')) {
  try {
    await access(destination);
    const info = JSON.parse(await readFile(path.join(destination, 'Contents/Resources/installation.json'), 'utf8'));
    if (await realpath(info.repository) === await realpath(root) && info.node === await realpath(process.execPath) && info.setupVersion === 1) return destination;
    throw Error('An existing Framevolve app points to a different installation or an older launcher. Move it aside in Finder, then retry. Your Studio can still be opened from this setup.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // installLauncher itself refuses to overwrite an existing app.
  }
  await installLauncher({ root, destination });
  return destination;
}
export async function startSetup({ root = ROOT, open = true, operations = {} } = {}) {
  checkNode();
  const lock = path.join(root, '.motion-cache/setup.lock');
  await mkdir(path.dirname(lock), { recursive: true });
  try { await mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner; try { owner = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8')); } catch {}
    let running = true;
    if (Number.isInteger(owner?.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); } catch (probe) { if (probe.code === 'ESRCH') running = false; }
    }
    if (running) throw Error('Framevolve setup is already open. Finish or close its Terminal window before starting another setup.');
    await rm(lock, { recursive: true, force: true }); await mkdir(lock);
  }
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
  const release = () => rm(lock, { recursive: true, force: true });
  let settings; try { settings = await readSetup(root); } catch { settings = {}; }
  const componentManager = operations.componentManager ?? cyclesComponentManager(root);
  const componentStatus = () => componentManager.status().catch(error => ({busy:false,canInstall:false,canUpdate:false,canRemove:false,reason:error.message}));
  const token = randomBytes(32).toString('hex');
  const state = { feedbackMemory: (await readMemory(root)).consent.enabled, busy: false, stage: 'welcome', message: '', error: '', ready: false, provider: settings.provider ?? 'other', browser: settings.browser?.kind ?? (nativeProductionSupported() ? 'native' : 'auto'), nativeSupported: nativeProductionSupported(), chrome: await (operations.findChrome ?? findChrome)(), agent: null, log: '', root, launcherWarning: '', cyclesComponent: await componentStatus() };
  const env = { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}` };
  const run = operations.run ?? ((command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), 10 * 60 * 1000);
    const collect = chunk => { state.log = (state.log + chunk.toString()).slice(-6000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error('Installation did not finish. Check your connection and retry. Details are shown below.')); });
  }));
  const job = (stage, task) => {
    if (state.busy) throw Error('A setup step is already running. Please wait.');
    state.busy = true; state.stage = stage; state.error = ''; state.log = '';
    Promise.resolve().then(task).catch(error => { state.error = error.message; }).finally(() => { state.busy = false; });
  };
  const prepare = async body => {
    state.ready = false;
    if (!['native', 'auto', 'chrome', 'chromium'].includes(body.browser) || (body.browser === 'native' && !nativeProductionSupported())) throw Error('Choose a supported production mode for this Mac.');
    const browserChoice = body.browser === 'auto' ? (await executable(chromeExecutable(state.chrome)) ? 'chrome' : 'chromium') : body.browser;
    state.message = 'Preparing Framevolve…';
    // Reuse a complete installation; fresh ZIPs install from the lockfile.
    try { for (const name of ['vite', 'playwright', 'sharp', 'skia-canvas', 'ffmpeg-static', 'ffprobe-static']) createRequire(path.join(root, 'package.json')).resolve(name); }
    catch { await run('npm', ['ci', '--no-audit', '--no-fund']); }
    let browser;
    if (browserChoice === 'native') {
      browser = { kind: 'native' };
    } else if (browserChoice === 'chrome') {
      const file = chromeExecutable(state.chrome);
      if (!await executable(file)) throw Error('Chrome was not found. Choose Locate Chrome, or Install Chromium.');
      browser = { kind: 'chrome', path: file };
    } else {
      state.message = 'Installing Chromium for rendering…';
      const cli = path.join(path.dirname(createRequire(path.join(root, 'package.json')).resolve('playwright/package.json')), 'cli.js');
      await run(process.execPath, [cli, 'install', 'chromium']);
      browser = { kind: 'chromium' };
    }
    state.message = browserChoice === 'native' ? 'Checking native canvas and video encoder…' : 'Checking the browser and video encoder…';
    if (browserChoice === 'native') await (operations.verifyNative ?? verifyNativeProduction)(root);
    else await (operations.verifyBrowser ?? (async () => {
      const selected = await resolveBrowser({ root, settings: { browser }, env: {} });
      const instance = await playwright(root).chromium.launch({ executablePath: selected.executablePath, headless: true });
      try { const page = await instance.newPage(); await page.setContent('<canvas width="8" height="8"></canvas>'); if (!await page.evaluate(() => !!document.querySelector('canvas').getContext('webgl2'))) throw Error('WebGL2 is unavailable. Try another browser or update macOS.'); }
      finally { await instance.close(); }
    }))({browser, root});
    if (browserChoice !== 'native') {
      const require = createRequire(path.join(root, 'package.json'));
      await run(require('ffmpeg-static'), ['-version']);
      await run(require('ffprobe-static').path, ['-version']);
    }
    await mkdir(path.join(root, 'renders'), { recursive: true });
    settings = { ...settings, browser, provider: state.provider, completedAt: new Date().toISOString() };
    await saveSetup(settings, root);
    state.browser = browser.kind; state.ready = true; state.message = 'Framevolve is ready.';
    try { await (operations.installLauncher ?? ensureLauncher)(root); state.launcherWarning = ''; }
    catch (error) { state.launcherWarning = error.message; }
  };
  let origin, expiry;
  const finish = async () => {
    state.message = 'Opening Studio…';
    const result = await (operations.launch ?? launch)({ action: 'start', root, port: 4173, open: false, update: false });
    state.studioUrl = `${result.url}?scene=pop`;
    await (operations.openStudio ?? (url => runFile('/usr/bin/open', [url])))(state.studioUrl);
    state.message = 'Studio is open with the PLAY.EXE demo.';
    // Keep optional agent setup available after Studio opens; never interrupt an active job.
    clearTimeout(expiry);
    const expire = () => { if (state.busy) expiry = setTimeout(expire, 60000).unref(); else server.close(); };
    expiry = setTimeout(expire, 30 * 60 * 1000).unref();
  };
  const server = http.createServer(async (request, response) => {
    const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
    try {
      if (request.headers.host !== new URL(origin).host) return json(403, { error: 'Invalid host.' });
      const url = new URL(request.url, origin);
      response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      if (request.method === 'GET' && ['/', '/setup.js', '/setup.css', '/mark.png', '/logos/codex.svg', '/logos/claude.svg'].includes(url.pathname)) {
        const files = { '/': ['setup/index.html', 'text/html'], '/setup.js': ['setup/setup.js', 'text/javascript'], '/setup.css': ['setup/setup.css', 'text/css'], '/mark.png': ['../public/brand/framevolve-mark.png', 'image/png'] };
        files['/logos/codex.svg'] = ['setup/logos/codex.svg', 'image/svg+xml'];
        files['/logos/claude.svg'] = ['setup/logos/claude.svg', 'image/svg+xml'];
        const [file, type] = files[url.pathname];
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(await readFile(new URL(file, import.meta.url))); return;
      }
      if (request.headers['x-framevolve-setup'] !== token || (request.headers.origin && request.headers.origin !== origin)) return json(403, { error: 'Reopen setup to continue.' });
      if (request.method === 'GET' && url.pathname === '/api/state') { state.feedbackMemory = (await readMemory(root)).consent.enabled; state.cyclesComponent = await componentStatus(); return json(200, state); }
      if (request.method !== 'POST' || request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') return json(403, { error: 'Invalid setup request.' });
      let raw = ''; for await (const chunk of request) { raw += chunk; if (raw.length > 8192) return json(413, { error: 'Request too large.' }); }
      const body = JSON.parse(raw || '{}');
      if (state.busy) return json(409, { error: 'A setup step is still running.' });
      const componentAction = url.pathname.match(/^\/api\/components\/cycles\/(install|update|authorize|check|remove)$/);
      if (componentAction) {
        if (Object.keys(body).length) return json(400,{error:'Component actions do not accept package URLs or paths.'});
        job('cycles', async () => {
          state.message = 'Preparing optional Rendering Cycles…';
          await componentManager[componentAction[1] === 'check' ? 'checkAuthorization' : componentAction[1]]();
          state.cyclesComponent = await componentStatus(); state.message = componentAction[1] === 'remove' ? 'Rendering Cycles removed. Three.js is ready.' : state.cyclesComponent.pendingAuthorization ? 'Rendering Cycles is downloaded and waiting for macOS approval.' : 'Rendering Cycles is ready.';
        });
      } else if (url.pathname === '/api/install') {
        if (!Object.hasOwn(PROVIDERS, body.provider)) return json(400, { error: 'Choose an available agent.' });
        if (!['native', 'auto', 'chrome', 'chromium'].includes(body.browser) || (body.browser === 'native' && !nativeProductionSupported())) return json(400, { error: 'Choose a supported production mode for this Mac.' });
        if (body.feedbackMemory !== undefined && typeof body.feedbackMemory !== 'boolean') return json(400, { error: 'Choose whether to save feedback memory.' });
        if (body.cyclesOptional !== undefined && typeof body.cyclesOptional !== 'boolean') return json(400, { error: 'Choose whether to download Rendering Cycles.' });
        job('install', async () => {
          if (body.feedbackMemory !== undefined) { await setMemoryConsent(root, body.feedbackMemory); state.feedbackMemory = body.feedbackMemory; }
          state.provider = body.provider;
          await prepare(body);
          await finish();
          if (body.cyclesOptional) {
            try {state.message = 'Downloading optional Rendering Cycles…'; await componentManager.install(); state.cyclesComponent = await componentStatus(); state.message = state.cyclesComponent.pendingAuthorization ? 'Framevolve is ready. Rendering Cycles needs your macOS approval.' : 'Framevolve and Rendering Cycles are ready.';}
            catch (error) {state.cyclesComponent = await componentStatus(); state.message = `Framevolve is ready. Optional Rendering Cycles could not be installed: ${error.message}`;}
          }
        });
      } else if (url.pathname === '/api/memory') {
        const memory = await setMemoryConsent(root, body.enabled); state.feedbackMemory = memory.consent.enabled;
      } else if (url.pathname === '/api/provider') {
        if (!Object.hasOwn(PROVIDERS, body.provider)) return json(400, { error: 'Choose an available agent.' });
        state.provider = body.provider; state.agent = await findAgent(body.provider, root);
        settings = { ...settings, provider: body.provider }; await saveSetup(settings, root);
      } else if (url.pathname === '/api/locate') {
        job('browser', async () => {
          const app = await runFile('/usr/bin/osascript', ['-e', 'POSIX path of (choose application with prompt "Choose Google Chrome" as alias)']);
          const file = chromeExecutable(app.replace(/\/$/, ''));
          if (!await executable(file)) throw Error('Select the Google Chrome application, or choose Install Chromium.');
          state.chrome = file;
        });
      } else if (url.pathname === '/api/prepare') job('browser', () => prepare(body));
      else if (url.pathname === '/api/agent') {
        const provider = PROVIDERS[state.provider];
        if (!provider?.command) return json(400, { error: 'Choose Codex or Claude Code first.' });
        job('agent', async () => {
          state.message = `Preparing ${provider.name}…`;
          let binary = await findAgent(state.provider, root);
          if (!binary) {
            await run('npm', ['install', '--global', '--prefix', path.join(root, '.motion-cache/agents'), '--no-audit', '--no-fund', provider.package]);
            binary = await findAgent(state.provider, root);
            if (!binary) throw Error('Agent installation is incomplete. Retry or follow the official setup guide.');
          }
          const script = path.join(root, '.motion-cache', `open-${provider.command}.command`);
          await mkdir(path.dirname(script), { recursive: true });
          await writeFile(script, authScript(root, binary), { mode: 0o700 });
          await (operations.openAgent ?? (file => runFile('/usr/bin/open', ['-a', 'Terminal', file])))(script);
          state.agent = binary; state.message = 'Continue in the agent window. Sign in if requested. You can return here and open Studio at any time.';
        });
      } else if (url.pathname === '/api/finish') {
        if (!state.ready) return json(400, { error: 'Prepare and check a rendering browser first.' });
        job('finish', finish);
      } else if (url.pathname === '/api/close') {
        if (!state.ready) return json(400, { error: 'Finish setup before closing.' });
        json(200, { closed: true }); server.close(); return;
      } else return json(404, { error: 'Unknown setup step.' });
      json(200, state);
    } catch (error) { json(400, { error: error.message }); }
  });
  server.once('close', () => { clearTimeout(expiry); release(); });
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); }
  catch (error) { await release(); throw error; }
  origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/#${token}`;
  console.log(`Framevolve setup: ${url}`);
  if (open) { try { await runFile('/usr/bin/open', [url]); } catch { console.log('Open the setup address above in your browser.'); } }
  return { server, url, state };
}
if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startSetup({ open: !process.argv.includes('--no-open') }).catch(error => { console.error(`Framevolve setup: ${error.message}`); process.exitCode = 1; });
}
