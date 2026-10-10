#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts', 'cli.mjs');
const WIDTH = 960;
const HEIGHT = 540;
const LABEL_HEIGHT = 44;

function emit(type, payload = {}) { process.stdout.write(`${JSON.stringify({ type, ...payload })}\n`); }
function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--') || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Expected an option and value near ${token}`);
    options[token.slice(2)] = argv[++i];
  }
  const looks = String(options.looks ?? '').split(',').map(v => v.trim()).filter(Boolean);
  if (looks.length < 2) throw new Error('--looks requires at least two comma-separated JSON recipe paths');
  if (!options.out) throw new Error('--out is required');
  const time = Number(options.time ?? 0);
  if (!Number.isFinite(time) || time < 0) throw new Error('--time must be a nonnegative number');
  return { looks, time, out: path.resolve(options.out) };
}
function escapeXml(text) {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function renderFrame(recipe, time, tempFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'frame', '--out', tempFile, '--time', String(time), '--width', String(WIDTH), '--height', String(HEIGHT), '--parameters', JSON.stringify({ look: recipe })], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(stderr.trim() || stdout.trim() || `Frame renderer exited ${code}`));
      try {
        const records = stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
        const failure = records.find(record => record.type === 'error');
        if (failure) return reject(new Error(failure.message));
        resolve(records.at(-1));
      } catch (error) { reject(new Error(`Could not read renderer response: ${error.message}`)); }
    });
  });
}
async function main() {
  const { looks, time, out } = parse(process.argv.slice(2));
  const recipes = [];
  for (const value of looks) {
    const recipePath = path.resolve(value);
    const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
    if (!recipe || Array.isArray(recipe) || typeof recipe !== 'object') throw new Error(`Look recipe must be a JSON object: ${recipePath}`);
    recipes.push({ recipePath, label: path.basename(recipePath), recipe });
  }
  const outDir = path.dirname(out);
  await mkdir(outDir, { recursive: true });
  const base = path.join(outDir, path.basename(out, path.extname(out)));
  const variantPaths = recipes.map((_, index) => `${base}.variant-${index}.png`);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'motion-look-review-'));
  try {
    const results = [];
    for (let index = 0; index < recipes.length; index++) {
      const tempFile = path.join(tempDir, `variant-${index}.png`);
      const recipe = recipes[index];
      const render = await renderFrame(recipe.recipe, time, tempFile);
      await rename(tempFile, variantPaths[index]);
      results.push({ index, recipe: recipe.recipePath, variant: variantPaths[index], render });
    }

    const columns = Math.min(2, recipes.length);
    const rows = Math.ceil(recipes.length / columns);
    const cellHeight = HEIGHT + LABEL_HEIGHT;
    const composites = [];
    for (let index = 0; index < recipes.length; index++) {
      const left = (index % columns) * WIDTH;
      const top = Math.floor(index / columns) * cellHeight;
      const titleSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${LABEL_HEIGHT}"><rect width="100%" height="100%" fill="#15191f"/><text x="18" y="29" fill="#f2f4f8" font-family="Arial,sans-serif" font-size="17">${escapeXml(recipes[index].label)}</text></svg>`);
      composites.push({ input: titleSvg, left, top });
      composites.push({ input: variantPaths[index], left, top: top + LABEL_HEIGHT });
    }
    const width = columns * WIDTH;
    const height = rows * cellHeight;
    await sharp({ create: { width, height, channels: 3, background: '#15191f' } }).composite(composites).png().toFile(out);
    emit('complete', { path: out, time, size: { width, height }, variants: results, selection: null });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
main().catch(error => { emit('error', { message: error.message }); process.exitCode = 1; });
