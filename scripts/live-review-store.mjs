import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const liveFile = root => path.join(root, '.motion-cache/live-review.json');
export function validateReview(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.tasks) || value.tasks.length > 100) throw Error('Invalid feedback checklist.');
  const ids = new Set();
  for (const task of value.tasks) {
    if (!task || typeof task.id !== 'string' || !/^[\w-]{1,60}$/.test(task.id) || ids.has(task.id) || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 240 || !['todo','doing','done','blocked'].includes(task.status)) throw Error('Each feedback needs a unique id, title and valid status.');
    ids.add(task.id);
  }
  if (!['idle','editing','ready','blocked'].includes(value.phase)) throw Error('Invalid review phase.');
  if (value.snapshot && (!value.snapshot.parameters || typeof value.snapshot.parameters.scene !== 'string')) throw Error('Recipe needs parameters.scene.');
  return value;
}
export async function readReview(root) {
  try { const raw = await readFile(liveFile(root), 'utf8'); if (raw.length > 2 * 1024 * 1024) throw Error('Live recipe is too large.'); return validateReview(JSON.parse(raw)); }
  catch (error) { if (error.code === 'ENOENT') return { version: 1, phase: 'idle', tasks: [], checkpoint: null }; throw error; }
}
export async function writeReview(root, value) {
  validateReview(value);
  const raw = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw Error('Live recipe is too large.');
  const file = liveFile(root), temporary = file + '.' + randomUUID() + '.tmp';
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(temporary, raw, { mode: 0o600 }); await rename(temporary, file);
  return value;
}
export function updateReview(previous, action, { task: id, tasks, snapshot, label } = {}) {
  const next = structuredClone(previous);
  if (action === 'plan') {
    next.tasks = tasks.map(task => ({ ...task, status: task.status ?? 'todo' })); next.phase = 'idle'; next.currentTask = null;
  } else {
    const task = next.tasks.find(t => t.id === id);
    if (id && !task) throw Error('Unknown feedback id. Add it to the plan first.');
    if (action === 'begin') { if (task) task.status = 'doing'; next.phase = 'editing'; next.currentTask = id ?? null; }
    else if (action === 'publish') { next.phase = 'ready'; next.checkpoint = randomUUID(); if (snapshot) next.snapshot = snapshot; }
    else if (action === 'done') { if (!task) throw Error('Choose --task.'); if (task.status !== 'doing' || next.phase !== 'ready' || next.currentTask !== id) throw Error('Publish and verify this feedback before marking it done.'); task.status = 'done'; }
    else if (action === 'block') { if (task) task.status = 'blocked'; next.phase = 'blocked'; }
    else throw Error('Unknown review command.');
    next.label = label ?? task?.title ?? 'Scene updated';
  }
  next.updatedAt = new Date().toISOString(); return validateReview(next);
}
