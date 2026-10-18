#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, copyFile, cp, lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
export const SOURCE_URL = 'https://github.com/AndreXes03/motion-lab.git';
export const SOURCE_COMMIT = 'f39f2eaa725e3ea5ee83b8b78862274c21a0b84a';
export const VARIANTS = ['studio', 'codex', 'claude'];
const self = fileURLToPath(import.meta.url);
const exists = async file => { try { await lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
export function checkNode(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (major < 22 || major === 22 && minor < 12) throw Error('Serve Node.js >=22.12. Installa Node da nodejs.org e riprova.');
}
async function defaultRun(command, args, cwd) {
  try { return (await exec(command, args, { cwd, timeout: 600000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout.trim(); }
  catch (error) { throw Error(command + ' non riuscito: ' + String(error.stderr || error.message).slice(-1800)); }
}
async function findCommand(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const file = path.join(dir, name);
    try { await access(file, 1); return await realpath(file); } catch {}
  }
  if (name === 'codex') {
    const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
    try { await access(bundled, 1); return bundled; } catch {}
  }
  throw Error('Manca ' + name + '. Installalo prima di riprovare; nessun client viene installato automaticamente.');
}
async function backup(file) {
  if (!await exists(file)) return null;
  const target = file + '.motion-lab-backup-' + Date.now() + '-' + process.pid;
  await copyFile(file, target, 1);
  return target;
}
export async function mergeClaude(file, entry) {
  let current = {}, original = null;
  if (await exists(file)) {
    if (!(await lstat(file)).isFile()) throw Error('Config Claude deve essere un file regolare.');
    original = await readFile(file, 'utf8'); current = JSON.parse(original);
  }
  if (!current || Array.isArray(current) || typeof current !== 'object' ||
      current.mcpServers && (Array.isArray(current.mcpServers) || typeof current.mcpServers !== 'object')) throw Error('Config Claude non valida; file preservato.');
  if (Object.hasOwn(current.mcpServers || {}, 'motion-lab')) throw Error('Claude ha già motion-lab: nessuna sostituzione. Usa il backup/config esistente e configura manualmente la nuova installazione.');
  const saved = await backup(file);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.motion-lab-' + process.pid + '.tmp';
  await writeJson(temporary, { ...current, mcpServers: { ...current.mcpServers, 'motion-lab': entry } });
  // Refuse an external edit during installation instead of overwriting it.
  if (original !== null && await readFile(file, 'utf8') !== original || original === null && await exists(file)) throw Error('Config Claude modificata durante installazione; nessuna sostituzione. Snippet conservato.');
  await rename(temporary, file);
  return saved;
}
export function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i], value = args[++i];
    if (!['--variant', '--destination', '--applications-dir', '--claude-config', '--port'].includes(key) || !value) throw Error('Uso: install.mjs --variant studio|codex|claude [--destination /nuova/cartella] [--applications-dir /Applications] [--claude-config /config.json] [--port 4198]');
    options[{ '--variant': 'variant', '--destination': 'destination', '--applications-dir': 'applications', '--claude-config': 'claudeConfig', '--port': 'port' }[key]] = value;
  }
  return options;
}
export async function install(options, deps = {}) {
  checkNode();
  const platform = deps.platform ?? process.platform, home = deps.home ?? os.homedir(), run = deps.run ?? defaultRun, find = deps.find ?? findCommand;
  if (platform !== 'darwin') throw Error('Questa beta è solo macOS. Nessuna installazione Windows/Linux.');
  const variant = options.variant;
  if (!VARIANTS.includes(variant)) throw Error('Variante non valida.');
  const port = Number(options.port ?? 4198);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Porta richiesta: 1024–65535.');
  const destination = options.destination ?? path.join(home, 'Applications/Motion Lab', variant);
  const applications = options.applications ?? path.join(home, 'Applications');
  const claudeConfig = options.claudeConfig ?? path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json');
  for (const value of [destination, applications, claudeConfig]) if (!path.isAbsolute(value)) throw Error('Usa percorsi assoluti.');
  if (await exists(destination)) throw Error('Destinazione già esistente: ' + destination + '. Nulla viene sovrascritto. Scegli --destination /nuova/cartella.');
  const app = path.join(applications, 'Motion Lab ' + variant + '.app');
  if (await exists(app)) throw Error('Launcher già esistente: ' + app + '. Scegli una nuova --applications-dir.');
  const git = await find('git'), npm = await find('npm');
  await run(git, ['--version']); await run(npm, ['--version']);
  if (!await (deps.chromeAvailable ? deps.chromeAvailable() : exists('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))) throw Error('Serve Google Chrome in /Applications per i render locali. Installalo e riprova.');
  let codex;
  if (variant === 'codex') {
    codex = await find('codex');
    await run(codex, ['plugin', 'marketplace', 'add', '--help']);
    await run(codex, ['plugin', 'add', '--help']);
    // An existing registration is not silently replaced.
    const list = await run(codex, ['plugin', 'list', '--json']);
    if (/\bmotion-lab\b/.test(list)) throw Error('Codex contiene già motion-lab. Conservato: configura la nuova copia manualmente o rimuovi consapevolmente la precedente registrazione.');
  }
  if (variant === 'claude') {
    if (!await (deps.claudeAvailable ? deps.claudeAvailable() : Promise.all([exists('/Applications/Claude.app'), exists(path.join(home, 'Applications/Claude.app'))]).then(results => results.some(Boolean)))) throw Error('Claude Desktop non trovato. Installalo prima; non viene dichiarata una configurazione riuscita.');
    if (await exists(claudeConfig)) {
      const current = await json(claudeConfig);
      if (Object.hasOwn(current.mcpServers || {}, 'motion-lab')) throw Error('Claude ha già motion-lab; configurazione preservata.');
    }
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(destination); // Exclusive reservation; never reuses another checkout.
  const root = path.join(destination, 'repository'), statusFile = path.join(destination, 'installation.json');
  const sourceCommit = deps.sourceCommit ?? SOURCE_COMMIT, sourceURL = deps.sourceURL ?? SOURCE_URL;
  const state = { schemaVersion: 1, variant, sourceCommit, repository: root, port, status: 'installing' };
  await writeJson(statusFile, state);
  let stage = 'source';
  try {
    await mkdir(root);
    await run(git, ['init', root]);
    await run(git, ['-C', root, 'remote', 'add', 'origin', sourceURL]);
    await run(git, ['-C', root, 'fetch', '--depth=2', '--no-tags', 'origin', sourceCommit]);
    await run(git, ['-C', root, 'checkout', '-b', 'motion-lab-beta', 'FETCH_HEAD']);
    if (await run(git, ['-C', root, 'rev-parse', 'HEAD']) !== sourceCommit) throw Error('Commit scaricato diverso dal pin; installazione fermata.');
    stage = 'dependencies';
    await run(npm, ['ci'], root);
    if (!await exists(path.join(root, 'node_modules/vite/package.json'))) throw Error('Dipendenze Studio incomplete.');
    let plugin;
    if (variant !== 'studio') {
      plugin = path.join(destination, 'plugin');
      await cp(path.join(root, 'plugins/motion-lab'), plugin, { recursive: true });
      await run(npm, ['ci'], plugin);
      if (!await exists(path.join(plugin, 'node_modules/@modelcontextprotocol/sdk/package.json'))) throw Error('Dipendenze MCP incomplete.');
    }
    stage = 'launcher';
    await mkdir(applications, { recursive: true });
    await run(process.execPath, [path.join(root, 'scripts/install-mac-launcher.mjs'), '--repo', root, '--destination', app, '--port', String(port)], root);
    if (!await exists(path.join(app, 'Contents/MacOS/MotionLabLauncher'))) throw Error('Launcher non creato.');
    state.launcher = app;
    if (plugin) {
      const entry = { command: await realpath(process.execPath), args: [path.join(plugin, 'server.mjs'), '--repo', root, '--port', String(port)] };
      await writeJson(path.join(destination, 'mcp-snippet.json'), { mcpServers: { 'motion-lab': entry } });
      stage = 'client';
      if (variant === 'claude') state.configBackup = await mergeClaude(claudeConfig, entry);
      else {
        const marketplace = path.join(destination, 'marketplace');
        await mkdir(path.join(marketplace, '.agents/plugins'), { recursive: true });
        await mkdir(path.join(marketplace, 'plugins'), { recursive: true });
        await cp(plugin, path.join(marketplace, 'plugins/motion-lab'), { recursive: true });
        // Absolute paths keep the SDK dependencies/runtime independent of the host's plugin cache.
        await writeJson(path.join(marketplace, 'plugins/motion-lab/mcp.json'), { mcpServers: { 'motion-lab': { type: 'stdio', ...entry } } });
        await writeJson(path.join(marketplace, '.agents/plugins/marketplace.json'), { name: 'motion-lab-beta', interface: { displayName: 'Motion Lab Download Beta' }, plugins: [{ name: 'motion-lab', source: { source: 'local', path: './plugins/motion-lab' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }] });
        state.configBackup = await backup(deps.codexConfigFile ?? path.join(process.env.CODEX_HOME || path.join(home, '.codex'), 'config.toml'));
        await run(codex, ['plugin', 'marketplace', 'add', marketplace, '--json']);
        await run(codex, ['plugin', 'add', 'motion-lab@motion-lab-beta', '--json']);
        const installed = JSON.parse(await run(codex, ['plugin', 'list', '--marketplace', 'motion-lab-beta', '--json']));
        if (!Array.isArray(installed.installed) || !installed.installed.some(p => p?.name === 'motion-lab' && p.marketplaceName === 'motion-lab-beta' && p.installed === true && p.enabled === true)) throw Error('Codex non conferma il plugin installato e abilitato nel marketplace corretto. Controlla registrazione e backup; Studio resta disponibile.');
      }
    }
    state.status = 'installed'; await writeJson(statusFile, state);
    return state;
  } catch (error) {
    state.status = 'failed'; state.stage = stage; state.error = error.message;
    await writeJson(statusFile, state);
    throw Error('Installazione incompleta (' + stage + '): ' + error.message + '\nFile preservati in ' + destination + '. Nessun reset, pulizia o retry automatico. Stato: ' + statusFile);
  }
}
if (process.argv[1] && await realpath(process.argv[1]) === await realpath(self)) {
  try {
    const result = await install(parseArgs(process.argv.slice(2)));
    console.log('Installazione riuscita: ' + result.launcher + '\nFai doppio clic sul launcher per aprire Studio nel browser. Nessun aggiornamento automatico.\n' + (result.variant === 'studio' ? '' : 'Riavvia il client e verifica i sei tool MCP; una conversazione nativa non è verificata dall’installer.'));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
