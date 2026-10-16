#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const DEFAULT_GALLERY_BASE = 'https://andrexes03.github.io/motion-lab/demo/';
export const DEMO_MEDIA = [
  'procedural.mp4', 'objects-in-play.mp4', 'pop-motion.mp4',
  'contact-sheet.png', 'procedural-contact-sheet.png', 'pop-contact-sheet.png',
  'pulse-poster.jpg', 'camera-poster.jpg', 'dot-poster.jpg', 'pop-hero.jpg', 'replay-poster.jpg',
  'ui-tools.jpg', 'ui-motion-groups.jpg', 'photorealism.jpg',
];

export function galleryBase(value = DEFAULT_GALLERY_BASE) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('DEMO_GALLERY_MEDIA_BASE deve essere una directory HTTPS senza credenziali, query o frammenti.');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function siteOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('DEMO_SITE_ORIGIN deve essere una sola origine HTTP(S), senza percorso o credenziali.');
  return url.origin;
}

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function landingHtml(source, { mediaBase, origin, commit, builtAt }) {
  let html = source.replace(/\s*<link rel="canonical"[^>]*>/g, '').replace(/\s*<meta property="og:url"[^>]*>/g, '');
  const image = origin ? `${origin}/demo/pulse-poster.jpg` : '/demo/pulse-poster.jpg';
  html = html.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(image)}">`);
  const tags = [
    `<meta name="motion-lab-gallery-media-base" content="${escapeHtml(mediaBase)}">`,
    `<meta name="motion-lab-source-commit" content="${escapeHtml(commit)}">`,
    `<meta name="motion-lab-built-at" content="${escapeHtml(builtAt)}">`,
  ];
  if (origin) tags.push(`<link rel="canonical" href="${escapeHtml(origin)}/">`, `<meta property="og:url" content="${escapeHtml(origin)}/">`);
  html = html.replace('</head>', `  ${tags.join('\n  ')}\n</head>`);
  // The initial download link must work even before the gallery JavaScript starts.
  return html.replace('href="../demo/pulse-1080.mp4"', `href="${escapeHtml(new URL('pulse-1080.mp4', mediaBase).href)}"`);
}

export async function inventory(directory, relative = '') {
  const files = [];
  for (const name of (await readdir(path.join(directory, relative))).sort()) {
    const file = path.join(relative, name), info = await lstat(path.join(directory, file));
    if (info.isSymbolicLink()) throw Error(`Link simbolico non ammesso nel pacchetto: ${file}`);
    if (info.isDirectory()) files.push(...await inventory(directory, file));
    else if (info.isFile()) {
      if (info.size >= MAX_ASSET_BYTES) throw Error(`Asset troppo grande (deve essere <25 MiB): ${file}`);
      files.push({ path: file.split(path.sep).join('/'), bytes: info.size });
    }
  }
  return files;
}

export async function assembleDemo({ root = ROOT, directory, mediaBase = DEFAULT_GALLERY_BASE, origin = null, commit, dirty, builtAt = new Date().toISOString() }) {
  mediaBase = galleryBase(mediaBase); origin = siteOrigin(origin);
  if (!(await lstat(path.join(directory, 'studio/index.html'))).isFile()) throw Error('Manca la build Studio.');
  await mkdir(path.join(directory, 'demo'), { recursive: true });
  for (const name of DEMO_MEDIA) {
    const source = path.join(root, 'demo', name);
    if (!(await lstat(source)).isFile()) throw Error(`Media non regolare: ${name}`);
    await cp(source, path.join(directory, 'demo', name));
  }
  for (const name of ['site.css', 'site.js']) await cp(path.join(root, 'showcase', name), path.join(directory, name));
  const html = landingHtml(await readFile(path.join(root, 'showcase/index.html'), 'utf8'), { mediaBase, origin, commit, builtAt });
  await writeFile(path.join(directory, 'index.html'), html);
  const files = await inventory(directory);
  const info = { schemaVersion: 1, commit, dirty, builtAt, node: process.versions.node, publicDemo: true, studioBase: '/studio/', galleryMediaBase: mediaBase, siteOrigin: origin, files };
  await writeFile(path.join(directory, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
  return info;
}

export async function buildDemo() {
  const mediaBase = galleryBase(process.env.DEMO_GALLERY_MEDIA_BASE);
  const origin = siteOrigin(process.env.DEMO_SITE_ORIGIN);
  const git = args => {
    const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error('Impossibile leggere la provenienza Git del build. Usa un checkout completo.');
    return result.stdout.trim();
  };
  const commit = git(['rev-parse', '--verify', 'HEAD^{commit}']);
  const dirty = Boolean(git(['status', '--porcelain', '--untracked-files=all']));
  await mkdir(path.join(ROOT, '.motion-cache'), { recursive: true });
  const staging = await mkdtemp(path.join(ROOT, '.motion-cache/demo-package-'));
  const output = path.join(ROOT, 'dist-demo'), previous = path.join(staging, 'previous');
  const directory = path.join(staging, 'site');
  let keepStaging = false;
  try {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--', '--base=/studio/', `--outDir=${path.join(directory, 'studio')}`], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_PUBLIC_DEMO: 'true' } });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(`Build Studio fallita (${result.status ?? result.signal}). Il pacchetto precedente è conservato.`);
    const info = await assembleDemo({ directory, mediaBase, origin, commit, dirty });
    let hadPrevious = false;
    try { await rename(output, previous); hadPrevious = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(directory, output); }
    catch (error) {
      if (hadPrevious) {
        try { await rename(previous, output); }
        catch { keepStaging = true; throw Error(`Ripristino del pacchetto non riuscito. La copia precedente è conservata in ${previous}.`); }
      }
      throw error;
    }
    console.log(JSON.stringify({ output, commit, dirty, files: info.files.length + 1, galleryMediaBase: mediaBase, siteOrigin: origin }));
  } finally { if (!keepStaging) await rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildDemo(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
