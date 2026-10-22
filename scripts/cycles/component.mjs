/** Optional, pinned Rendering Cycles packages. Framevolve never installs Blender. */
import {createHash, randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runFile = promisify(execFile);
import {createReadStream, constants} from 'node:fs';
import {access, chmod, lstat, mkdir, open, readFile, readdir, rename, rm, statfs, writeFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertSessionIdle} from '../session-checkpoints.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const cyclesComponentHome = () => path.join(os.homedir(), 'Library', 'Application Support', 'Framevolve', 'components', 'cycles');
const safeVersion = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value) && !['.', '..'].includes(value);
const fail = (code, message) => Object.assign(Error(message), {code});
async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function installedPackage(directory, entry) {
 for (const [name, mode] of [['framevolve-cycles', constants.X_OK], ['color/config.ocio', constants.R_OK]]) {
  const file = path.join(directory, name); if (!(await lstat(file)).isFile()) throw Error(`Invalid component file: ${name}`); await access(file, mode);
 }
 if (entry) {
  const executable = path.join(directory, 'framevolve-cycles');
  // A downloaded component keeps normal macOS quarantine. Never clear or bypass it.
  try {await runFile('/usr/bin/xattr', ['-p', 'com.apple.quarantine', directory]);}
  catch(error) {if(error.code !== 1)throw error;await runFile('/usr/bin/xattr', ['-w', '-r', 'com.apple.quarantine', `0083;${Math.floor(Date.now()/1000).toString(16)};Framevolve;${randomUUID()}`, directory]);}
  await runFile('/usr/bin/codesign', ['--verify', '--deep', '--strict', executable]);
  const signature = await runFile('/usr/bin/codesign', ['-dv', '--verbose=4', executable]);
  if (!signature.stderr.split('\n').includes('TeamIdentifier=' + entry.teamId)) throw Error('Rendering Cycles signing identity does not match the pinned release');
  await runFile('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose', executable]);
  const probe = await runFile(executable, ['--probe'], {timeout:20000, maxBuffer:64000});
  const line = probe.stdout.split('\n').find(value => value.startsWith('MOTION_CYCLES '));
  const details = JSON.parse(line?.slice(14) || '{}');
  if (details.protocol !== entry.protocol || details.revision !== entry.revision || details.backend !== 'cycles-standalone' || !Array.isArray(details.devices) || !details.devices.some(device => device.type === 'CPU')) throw Error('Rendering Cycles self-check failed');
 }
}
// Accept only ordinary tar files/directories. Release packages must dereference library
// symlinks when assembled; archive links, PAX paths and special devices are rejected.
async function unpack(archive, destination, maxBytes) {
 const input = createReadStream(archive).pipe(createGunzip());
 let buffer = Buffer.alloc(0), file, remaining = 0, padding = 0, total = 0, entries = 0, ended = false;
 try {
  for await (const chunk of input) {
   buffer = Buffer.concat([buffer, chunk]);
   while (true) {
    if (remaining) { const count = Math.min(remaining, buffer.length); if (!count) break; await file.write(buffer.subarray(0, count)); buffer = buffer.subarray(count); remaining -= count; if (remaining) break; await file.close(); file = null; }
    if (padding) {const count = Math.min(padding, buffer.length); buffer = buffer.subarray(count); padding -= count; if (padding) break;}
    if (buffer.length < 512) break;
    const header = buffer.subarray(0, 512); buffer = buffer.subarray(512);
    if (header.every(byte => byte === 0)) { ended = true; if (buffer.some(byte => byte !== 0)) throw Error('Data after archive end'); continue; }
    if (ended) throw Error('Data after archive end');
    if (++entries > 20000) throw Error('Component archive contains too many entries');
    const string = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const stored = Number.parseInt(string(148, 8).trim(), 8); let checksum = 0; for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
    if (checksum !== stored) throw Error('Invalid archive checksum');
    const name = [string(345, 155), string(0, 100)].filter(Boolean).join('/').replace(/^\.\//, '');
    if ((name === '.' || name === '') && string(156,1) === '5') continue;
    if (!name || name.includes('\\') || name.startsWith('/') || name.split('/').some(part => part === '..') || name.includes('\ufffd')) throw Error('Unsafe archive path');
    const target = path.resolve(destination, name); if (!target.startsWith(destination + path.sep)) throw Error('Unsafe archive path');
    const type = string(156, 1), sizeText = string(124, 12).trim(); if (!/^[0-7]+$/.test(sizeText)) throw Error('Invalid archive file size');
    const size = Number.parseInt(sizeText, 8); total += size; if (!Number.isSafeInteger(size) || total > maxBytes) throw Error('Component exceeds its declared installed size');
    if (type === '5') { if (size) throw Error('Invalid archive directory'); await mkdir(target, {recursive: true, mode: 0o755}); continue; }
    if (type !== '' && type !== '0') throw Error('Unsupported archive entry; component links and special files are prohibited');
    await mkdir(path.dirname(target), {recursive: true, mode: 0o755}); file = await open(target, 'wx', 0o644);
    const mode = Number.parseInt(string(100, 8).trim(), 8); await chmod(target, mode & 0o111 ? 0o755 : 0o644);
    remaining = size; padding = (512 - size % 512) % 512; if (!size) {await file.close(); file = null;}
   }
  }
  if (file || remaining || padding || !ended || buffer.some(byte => byte !== 0)) throw Error('Incomplete component archive');
 } finally { await file?.close(); input.destroy(); }
}
export function createCyclesComponentManager({root = ROOT, componentHome = cyclesComponentHome(), platform = process.platform, arch = process.arch, fetchFn = globalThis.fetch, validateInstalled = installedPackage, beforeChange = () => assertSessionIdle(root, {allowEditing:true})} = {}) {
 let operation = {phase: 'idle', busy: false, progress: 0, error: null};
 const manifestFile = path.join(root, 'native/cycles/releases.json'), lockFile = path.join(root, 'native/cycles/lock.json');
 async function release() {
  const [manifest, lock] = await Promise.all([json(manifestFile), json(lockFile)]);
  if (manifest.protocol !== 1 || !Array.isArray(manifest.releases)) throw Error('Invalid Cycles release manifest');
  const entry = manifest.releases.find(item => item.platform === `${platform}-${arch}` && item.protocol === lock.protocol && item.revision === lock.revision && item.version === lock.version);
  if (!entry) return {lock, reason: manifest.unavailableReason || 'No signed and tested Rendering Cycles release is available for this computer.'};
  if (!safeVersion(entry.version) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || !Number.isSafeInteger(entry.installedBytes) || entry.installedBytes <= 0 || entry.format !== 'tar.gz' || entry.signed !== true || entry.notarized !== true || entry.tested !== true || entry.channel !== 'stable' || !/^[A-Z0-9]{10}$/.test(entry.teamId) || !Array.isArray(entry.validatedScenes) || !['pulse', 'loop'].every(scene => entry.validatedScenes.includes(scene))) throw Error('Cycles release is not a signed, notarized, tested and pinned stable package');
  const url = new URL(entry.url); if (url.protocol !== 'https:' || url.username || url.password) throw Error('Cycles packages require a pinned HTTPS URL');
  return {lock, entry};
 }
 async function current() {
  let value;
  try {value = await json(path.join(componentHome, 'current.json'));} catch(error) {if(error.code==='ENOENT')return null;return {invalid:true,reason:error.message};}
  try {if (!safeVersion(value.version) || value.protocol !== 1 || !/^[a-f0-9]{40}$/.test(value.revision)) throw Error('Invalid component receipt'); await validateInstalled(path.join(componentHome, value.version)); return value;}
  catch(error){return {invalid:true,version:value?.version,reason:'Rendering Cycles installation is incomplete. Remove it and retry. ' + error.message};}
 }
 async function status() {
  const [available, installed] = await Promise.all([release(), current()]);
  let externalBusy = false;
  try {const owner = await json(path.join(componentHome, '.operation-lock/owner.json')); if (Number.isInteger(owner.pid) && owner.pid > 0) {try {process.kill(owner.pid, 0); externalBusy = true;} catch (error) {if (error.code !== 'ESRCH') externalBusy = true;}}} catch {}
  const busy = operation.busy || externalBusy;
  let hasFiles=!!installed;try{hasFiles ||= (await readdir(componentHome)).some(name=>safeVersion(name)&&!name.startsWith('.'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const compatible = !!installed && !installed.invalid && installed.protocol === available.lock.protocol && installed.revision === available.lock.revision && installed.version === available.lock.version;
  return {...operation, busy, installed, compatible, availableRelease: available.entry ? {version: available.entry.version, bytes: available.entry.bytes, installedBytes: available.entry.installedBytes} : null, canInstall: !!available.entry && !compatible && !busy, canUpdate: !!available.entry && !!installed && !compatible && !busy, canRemove: hasFiles && !busy, reason: operation.error || (!compatible ? installed?.reason || available.reason || 'Install Rendering Cycles to enable this optional engine.' : ''), componentHome};
 }
 async function withLock(task) {
  if (operation.busy) throw fail('BUSY', 'A Rendering Cycles component operation is already running.');
  operation = {phase: 'preparing', busy: true, progress: 0, error: null};
  const lockDir = path.join(componentHome, '.operation-lock'); let ownsLock = false;
  try {
   await mkdir(componentHome, {recursive: true});
   try {await mkdir(lockDir); ownsLock = true;} catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner; try {owner = await json(path.join(lockDir, 'owner.json'));} catch {}
    if (!Number.isInteger(owner?.pid) || owner.pid <= 0) throw fail('BUSY', 'Another component operation may be running. Reopen Framevolve after it finishes.');
    let alive = true; try {process.kill(owner.pid, 0);} catch (probe) {if (probe.code === 'ESRCH') alive = false;}
    if (alive) throw fail('BUSY', 'A Rendering Cycles component operation is already running.');
    await rm(lockDir, {recursive: true, force: true}); await mkdir(lockDir); ownsLock = true;
   }
   await writeFile(path.join(lockDir, 'owner.json'), JSON.stringify({pid: process.pid}));
   // Stages are private to this component. A terminated download can safely retry.
   for (const name of await readdir(componentHome)) if (name.startsWith('.stage-')) await rm(path.join(componentHome, name), {recursive: true, force: true});
   await beforeChange();
   return await task();
  } catch (error) {operation.phase = 'failed'; operation.error = error.message; throw error;}
  finally {operation.busy = false; if (ownsLock) await rm(lockDir, {recursive: true, force: true});}
 }
 async function install() {return withLock(async () => {
  const {entry, lock, reason} = await release(); if (!entry) throw fail('UNAVAILABLE', reason);
  const existing = await current(); if (existing && !existing.invalid && existing.protocol === lock.protocol && existing.revision === lock.revision && existing.version === lock.version) {operation.phase = 'ready'; operation.progress = 1; return {reused: true, installed: existing};}
  const target = path.join(componentHome, entry.version);
  try {
   const saved = await json(path.join(target, 'component.json'));
   if (saved.protocol !== entry.protocol || saved.revision !== entry.revision || saved.sha256 !== entry.sha256) throw Error('Existing component package does not match the pinned release. Remove Rendering Cycles, then retry.');
   await validateInstalled(target, entry);
   const receipt = {protocol:lock.protocol, revision:lock.revision, version:entry.version, validatedScenes:entry.validatedScenes};
   const temporary = path.join(componentHome, '.current-' + randomUUID()); await writeFile(temporary, JSON.stringify(receipt)); await rename(temporary, path.join(componentHome, 'current.json'));
   operation.phase = 'ready'; operation.progress = 1; return {reused:true, installed:receipt};
  } catch (error) {if (error.code !== 'ENOENT') throw error;}
  const disk = await statfs(componentHome); if (Number(disk.bavail) * Number(disk.bsize) < entry.bytes + entry.installedBytes + 64 * 1024 * 1024) throw fail('STORAGE', 'Not enough free storage for Rendering Cycles. Free space and retry.');
  const stage = path.join(componentHome, '.stage-' + randomUUID()); await mkdir(stage); const archive = path.join(stage, 'package.tar.gz'), directory = path.join(stage, 'component'); await mkdir(directory);
  try {
   operation.phase = 'downloading';
   const signal = AbortSignal.timeout(30 * 60 * 1000);
   let response, downloadUrl = new URL(entry.url);
   for (let hop = 0; hop <= 5; hop++) {
    if (downloadUrl.protocol !== 'https:' || downloadUrl.username || downloadUrl.password) throw Error('Component redirect requires an HTTPS URL without credentials');
    response = await fetchFn(downloadUrl.href, {redirect:'manual', signal});
    if (![301,302,303,307,308].includes(response.status)) break;
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (!location || hop === 5) throw Error('Component download has an invalid or excessive redirect chain');
    downloadUrl = new URL(location, downloadUrl);
   }
   if (!response.ok || !response.body) throw Error(`Rendering Cycles download failed (${response.status}). Check your connection and retry.`);
   const declared = response.headers.get('content-length'); if (declared && Number(declared) !== entry.bytes) throw Error('Component download size does not match the pinned release');
   const hash = createHash('sha256'); let downloaded = 0;
   const source = Readable.from((async function* () {for await (const chunk of response.body) { downloaded += chunk.length; if (downloaded > entry.bytes) throw Error('Component download exceeds pinned size'); hash.update(chunk); operation.progress = downloaded / entry.bytes; yield chunk; }})());
   const handle = await open(archive, 'wx'); try {await pipeline(source, handle.createWriteStream());} finally {await handle.close();}
   operation.phase = 'verifying'; if (downloaded !== entry.bytes || hash.digest('hex') !== entry.sha256) throw Error('Rendering Cycles SHA-256 verification failed. Retry the download.');
   operation.phase = 'installing'; await unpack(archive, directory, entry.installedBytes); await validateInstalled(directory, entry);
   const receipt = {protocol: lock.protocol, revision: lock.revision, version: entry.version, validatedScenes: entry.validatedScenes};
   await writeFile(path.join(directory, 'component.json'), JSON.stringify({...receipt, sha256: entry.sha256, installedAt: new Date().toISOString()}));
   try {await lstat(target); throw Error('An incomplete or incompatible component version already exists. Remove Rendering Cycles, then retry.');} catch (error) {if (error.code !== 'ENOENT') throw error;}
   await rename(directory, target);
   const receiptFile = path.join(componentHome, '.current-' + randomUUID()); await writeFile(receiptFile, JSON.stringify(receipt)); await rename(receiptFile, path.join(componentHome, 'current.json'));
   operation.phase = 'ready'; operation.progress = 1; return {installed: receipt, reused: false};
  } finally {await rm(stage, {recursive: true, force: true});}
 });}
 async function remove() {return withLock(async () => {
  operation.phase = 'removing'; await rm(path.join(componentHome, 'current.json'), {force: true});
  for (const name of await readdir(componentHome)) if (safeVersion(name) && !name.startsWith('.')) {const directory = path.join(componentHome, name); if ((await lstat(directory)).isDirectory()) await rm(directory, {recursive: true, force: true});}
  operation.phase = 'idle'; operation.progress = 0; return {removed: true};
 });}
 return {status, install, update: install, remove};
}
const managers = globalThis[Symbol.for('framevolve.cycles-components')] ??= new Map();
export function cyclesComponentManager(root = ROOT) {if (!managers.has(root)) managers.set(root, createCyclesComponentManager({root})); return managers.get(root);}
export const getCyclesComponentStatus = options => cyclesComponentManager(options?.root).status();
export const installCyclesComponent = options => cyclesComponentManager(options?.root).install();
export const removeCyclesComponent = options => cyclesComponentManager(options?.root).remove();
