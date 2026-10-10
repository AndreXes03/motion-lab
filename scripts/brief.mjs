#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(path.join(ROOT, file), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};

try {
  const [{ config }, motion, look, references] = await Promise.all([
    import('../src/config.js'),
    readJson('project/motion.json', {}),
    readJson('project/look.json', {}),
    readJson('project/references.json', [])
  ]);
  process.stdout.write(`${JSON.stringify({
    type: 'motion-lab-brief',
    project: {
      id: config.id,
      title: config.title,
      duration: config.duration,
      fps: config.fps,
      width: config.width,
      height: config.height,
      palette: config.palette,
      text: config.text,
      camera: config.camera,
      look: config.look,
      beats: config.beats
    },
    motion,
    look,
    references
  })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ type: 'error', message: error.message })}\n`);
  process.exitCode = 1;
}
