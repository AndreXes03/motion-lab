import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const setupFile = (root = ROOT) => path.join(root, '.motion-cache', 'setup.json');
export async function readSetup(root = ROOT) {
  try { return JSON.parse(await readFile(setupFile(root), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw Error('Setup settings could not be read. Run npm run setup to repair them.'); }
}
export async function saveSetup(settings, root = ROOT) {
  const file = setupFile(root);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify({ ...settings, version: 1 }, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, file);
}
export async function executable(file) {
  if (!file || !path.isAbsolute(file)) return false;
  try { await access(file, constants.X_OK); return true; } catch { return false; }
}
export function chromeExecutable(file) {
  return file?.endsWith('.app') ? path.join(file, 'Contents/MacOS/Google Chrome') : file;
}
export async function findChrome({ home = os.homedir(), env = process.env, candidates } = {}) {
  const paths = candidates ?? [env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')];
  for (const candidate of paths) { const file = chromeExecutable(candidate); if (await executable(file)) return file; }
  return null;
}
export function playwright(root = ROOT) {
  return createRequire(path.join(root, 'package.json'))('playwright');
}
export async function resolveBrowser({ root = ROOT, env = process.env, settings, chrome, managedPath } = {}) {
  // Explicit overrides fail visibly instead of silently selecting a different browser.
  const override = env.FRAMEVOLVE_BROWSER_PATH || env.CHROME_PATH;
  if (override) {
    const file = chromeExecutable(override);
    if (!await executable(file)) throw Error(`Browser override is not executable: ${file}. Correct FRAMEVOLVE_BROWSER_PATH / CHROME_PATH, or run npm run setup.`);
    return { executablePath: file, kind: 'custom' };
  }
  settings ??= await readSetup(root);
  const preference = settings.browser?.kind ?? 'auto';
  if (preference === 'chrome') {
    const file = settings.browser.path ? chromeExecutable(settings.browser.path) : await findChrome();
    if (await executable(file)) return { executablePath: file, kind: 'chrome' };
    throw Error('Your selected Chrome is no longer available. Run npm run setup to locate Chrome or install Chromium.');
  }
  chrome ??= await findChrome();
  if (preference === 'auto' && chrome) return { executablePath: chrome, kind: 'chrome' };
  managedPath ??= playwright(root).chromium.executablePath();
  if (await executable(managedPath)) return { executablePath: managedPath, kind: 'chromium' };
  throw Error('No rendering browser is ready. Run npm run setup and choose existing Chrome or Install Chromium. For a manual Chromium install: npx playwright install chromium.');
}
export async function browserLaunchOptions(options = {}) {
  const browser = await resolveBrowser(options);
  return { executablePath: browser.executablePath };
}
