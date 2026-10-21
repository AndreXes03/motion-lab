#!/usr/bin/env node
import { access, chmod, copyFile, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, validateRepo } from './launch-studio.mjs';

const SELF = fileURLToPath(import.meta.url);
const quote = text => "'" + text.replaceAll("'", "'\\''") + "'";

export function installerArgs(args) {
  const options = { root: path.resolve(path.dirname(SELF), '..'), destination: path.join(os.homedir(), 'Applications/Framevolve.app'), port: 4173 };
  let explicitDestination = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i], value = args[++i];
    if (arg === '--port') { options.port = parseArgs(['--port', value]).port; continue; }
    if (!['--repo', '--destination'].includes(arg) || !value || !path.isAbsolute(value)) throw Error('Usage: install-mac-launcher.mjs [--repo /absolute/repo] [--destination /folder/Framevolve.app] [--port 4173]');
    if (arg === '--repo') options.root = value;
    else { options.destination = value; explicitDestination = true; }
  }
  if (process.platform !== 'darwin' && !explicitDestination) throw Error('On non-macOS systems use --destination for tests; the user Applications folder is not modified.');
  return options;
}

export async function installLauncher({ root, destination, port = 4173 }) {
  port = parseArgs(['--port', String(port)]).port;
  root = await validateRepo(root, true);
  if (!path.isAbsolute(destination) || path.extname(destination) !== '.app') throw Error('--destination must be an absolute path ending in .app.');
  try { await access(destination); throw Error(`Already exists: ${destination}. Keep the existing launcher or choose another --destination.`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const node = await realpath(process.execPath), helper = path.join(path.dirname(SELF), 'launch-studio.mjs');
  const temporary = `${destination}.install-${process.pid}`;
  const resources = path.join(temporary, 'Contents/Resources'), executable = path.join(temporary, 'Contents/MacOS/MotionLabLauncher');
  const installedHelper = path.join(destination, 'Contents/Resources/launch-studio.mjs');
  const cache = path.join(root, '.motion-cache'), log = path.join(cache, 'launcher-app.log');
  try {
    await mkdir(resources, { recursive: true }); await mkdir(path.dirname(executable), { recursive: true });
    await copyFile(helper, path.join(resources, 'launch-studio.mjs'));
    await copyFile(path.join(path.dirname(SELF),'studio-update.mjs'),path.join(resources,'studio-update.mjs'));
    await copyFile(path.join(root,'public/brand/framevolve.icns'),path.join(resources,'Framevolve.icns'));
    await copyFile(path.join(root,'LICENSE'),path.join(resources,'LICENSE'));
    await copyFile(path.join(root,'licenses/legacy/MIT.txt'),path.join(resources,'LEGACY-MIT.txt'));
    await writeFile(path.join(temporary, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleName</key><string>Framevolve</string><key>CFBundleIconFile</key><string>Framevolve.icns</string><key>CFBundleIdentifier</key><string>org.motionlab.local-launcher</string><key>CFBundleExecutable</key><string>MotionLabLauncher</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSUIElement</key><true/></dict></plist>\n`);
    const shell = `#!/bin/sh\n/bin/mkdir -p ${quote(cache)} || exit 1\n${quote(node)} ${quote(path.join(root,'scripts/mac-start.mjs'))} --repo ${quote(root)} --port ${port} >> ${quote(log)} 2>&1\nresult=$?\nif [ "$result" -ne 0 ]; then\n  detail=$(/usr/bin/tail -n 8 ${quote(log)})\n  /usr/bin/osascript - "$detail" <<'APPLESCRIPT'\non run argv\n  display alert "Framevolve could not start" message (item 1 of argv) as critical\nend run\nAPPLESCRIPT\nfi\nexit "$result"\n`;
    await writeFile(executable, shell); await chmod(executable, 0o755);
    await writeFile(path.join(resources, 'installation.json'), JSON.stringify({ schemaVersion: 1, setupVersion: 1, repository: root, node, helper: installedHelper, port, log, installedAt: new Date().toISOString() }, null, 2) + '\n');
    await rename(temporary, destination);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  console.log(`Launcher installed: ${destination}\nRepo: ${root}\nNode: ${node}\nStudio: http://127.0.0.1:${port}/\nDouble-click to open Studio. Checks origin/main on launch and preserves local edits.`);
  return { destination, root, node, port };
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(SELF)) {
  try { await installLauncher(installerArgs(process.argv.slice(2))); }
  catch (error) { console.error(`Installation stopped: ${error.message}`); process.exitCode = 1; }
}
