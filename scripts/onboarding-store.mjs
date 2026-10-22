import {lstat, mkdir, readFile, writeFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const steps = ['explore', 'edit', 'render'];
const queues = new Map();
const initial = () => ({version: 1, seen: false, completed: []});
function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['version','seen','completed'].includes(key)) ||
      value.version !== 1 || typeof value.seen !== 'boolean' ||
      !Array.isArray(value.completed) || value.completed.some(step => !steps.includes(step))) {
    throw Error('Invalid getting-started progress.');
  }
  return {version: 1, seen: value.seen, completed: steps.filter(step => value.completed.includes(step))};
}
async function location(root) {
  const dir = path.join(root, '.motion-cache');
  await mkdir(dir, {recursive: true});
  if (!(await lstat(dir)).isDirectory()) throw Error('Getting-started storage must be a local directory.');
  const file = path.join(dir, 'onboarding.json');
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.size > 4096) throw Error('Invalid getting-started storage.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return file;
}
export async function readOnboarding(root) {
  const file = await location(root);
  try { return validate(JSON.parse(await readFile(file, 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return initial(); throw error; }
}
export function updateOnboarding(root, update) {
  const incoming = validate(update);
  const operation = (queues.get(root) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const previous = await readOnboarding(root);
    const state = validate({version: 1, seen: previous.seen || incoming.seen,
      completed: [...previous.completed, ...incoming.completed]});
    const file = await location(root), temporary = file + '.' + randomUUID() + '.tmp';
    try { await writeFile(temporary, JSON.stringify(state), {mode: 0o600, flag: 'wx'}); await rename(temporary, file); }
    finally { await rm(temporary, {force: true}); }
    return state;
  });
  queues.set(root, operation);
  operation.finally(() => { if (queues.get(root) === operation) queues.delete(root); }).catch(() => {});
  return operation;
}
