import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, truncate, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assembleDemo, DEMO_MEDIA, DEFAULT_GALLERY_BASE, galleryBase, inventory, landingHtml, MAX_ASSET_BYTES, ROOT, siteOrigin } from './build-demo.mjs';

const source = '<head><link rel="canonical" href="https://old.example/"><meta property="og:url" content="https://old.example/"><meta property="og:image" content="https://old.example/poster.jpg"></head><a href="../demo/pulse-1080.mp4">Film</a>';
const provenance = { commit: 'a'.repeat(40), dirty: false, builtAt: '2026-10-16T12:00:00.000Z' };

test('origini e sorgente galleria: default pubblico, HTTPS e nessuna credenziale', () => {
  assert.equal(galleryBase(), DEFAULT_GALLERY_BASE);
  assert.equal(galleryBase('https://media.example/films'), 'https://media.example/films/');
  for (const value of ['http://media.example/', 'https://token@media.example/', 'https://media.example/?key=abc']) assert.throws(() => galleryBase(value));
  assert.equal(siteOrigin(), null); assert.equal(siteOrigin('https://demo.example/'), 'https://demo.example');
  assert.equal(siteOrigin('http://127.0.0.1:4196'), 'http://127.0.0.1:4196');
  for (const value of ['https://demo.example/subpath', 'https://token@demo.example/', 'javascript:alert(1)', 'https://demo.example/?a=b']) assert.throws(() => siteOrigin(value));
});

test('metadati solo nella copia landing: canonical opzionale e provenienza', () => {
  const defaults = landingHtml(source, { ...provenance, origin: null, mediaBase: DEFAULT_GALLERY_BASE });
  assert.doesNotMatch(defaults, /rel="canonical"|property="og:url"|old.example/);
  assert.match(defaults, /content="\/demo\/pulse-poster.jpg"/);
  assert.match(defaults, /https:\/\/andrexes03.github.io\/motion-lab\/demo\/pulse-1080.mp4/);
  assert.match(defaults, new RegExp(provenance.commit)); assert.match(defaults, /motion-lab-built-at/);
  const custom = landingHtml(source, { ...provenance, origin: 'https://demo.example', mediaBase: 'https://media.example/' });
  assert.match(custom, /rel="canonical" href="https:\/\/demo.example\/"/);
  assert.match(custom, /property="og:url" content="https:\/\/demo.example\/"/);
  assert.match(custom, /https:\/\/demo.example\/demo\/pulse-poster.jpg/);
  assert.match(source, /old.example/);
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-demo-')); t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'package');
  for (const folder of ['demo', 'showcase', 'package/studio/assets']) await mkdir(path.join(root, folder), { recursive: true });
  for (const name of DEMO_MEDIA) await writeFile(path.join(root, 'demo', name), name);
  await writeFile(path.join(root, 'demo/replay-1080.mp4'), 'must not be copied');
  await writeFile(path.join(root, 'demo/private-reference.png'), 'must not be copied');
  for (const [name, text] of [['index.html', source], ['site.js', '// gallery'], ['site.css', 'body{}']]) await writeFile(path.join(root, 'showcase', name), text);
  await writeFile(path.join(directory, 'studio/index.html'), '<script src="/studio/assets/app.js"></script>');
  await writeFile(path.join(directory, 'studio/assets/app.js'), '// public build');
  return { root, directory };
}

test('packaging: whitelist media, Studio, manifest e sorgenti intatti', async t => {
  const f = await fixture(t);
  const info = await assembleDemo({ ...f, ...provenance });
  const paths = (await inventory(f.directory)).map(file => file.path);
  assert.deepEqual(paths.filter(file => file.startsWith('demo/')).sort(), DEMO_MEDIA.map(name => 'demo/' + name).sort());
  assert.deepEqual(paths.filter(file => file.endsWith('.mp4')).sort(), ['demo/objects-in-play.mp4', 'demo/pop-motion.mp4', 'demo/procedural.mp4']);
  assert.equal(info.commit, provenance.commit); assert.equal(info.dirty, false); assert.equal(info.publicDemo, true); assert.equal(info.studioBase, '/studio/');
  assert.equal(info.galleryMediaBase, DEFAULT_GALLERY_BASE);
  assert.equal(await readFile(path.join(f.root, 'showcase/index.html'), 'utf8'), source);
  assert.equal(JSON.parse(await readFile(path.join(f.directory, 'build-info.json'))).files.length, paths.length - 1);
});

test('packaging fallisce se manca un media o la build Studio', async t => {
  const f = await fixture(t); await rm(path.join(f.directory, 'studio/index.html'));
  await assert.rejects(assembleDemo({ ...f, ...provenance }), /ENOENT/);
  await writeFile(path.join(f.directory, 'studio/index.html'), 'studio'); await rm(path.join(f.root, 'demo', DEMO_MEDIA[0]));
  await assert.rejects(assembleDemo({ ...f, ...provenance }), /ENOENT/);
});

test('ogni asset deve essere strettamente sotto 25 MiB; link simbolici bloccati', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-demo-size-')); t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'large.mp4'); await writeFile(file, ''); await truncate(file, MAX_ASSET_BYTES);
  await assert.rejects(inventory(root), /troppo grande/);
  await rm(file); await symlink('/etc/hosts', path.join(root, 'outside')); await assert.rejects(inventory(root), /simbolico/);
});

test('pacchetto reale: media minimi, base Studio e metadati coerenti', async () => {
  const directory = path.join(ROOT, 'dist-demo');
  const info = JSON.parse(await readFile(path.join(directory, 'build-info.json'), 'utf8'));
  const files = await inventory(directory);
  assert.match(info.commit, /^[a-f0-9]{40}$/); assert.equal(typeof info.dirty, 'boolean');
  assert.equal(info.publicDemo, true); assert.equal(info.studioBase, '/studio/');
  assert.deepEqual(files.filter(file => file.path.endsWith('.mp4')).map(file => file.path).sort(), ['demo/objects-in-play.mp4', 'demo/pop-motion.mp4', 'demo/procedural.mp4']);
  assert.deepEqual(info.files, files.filter(file => file.path !== 'build-info.json'));
  const html = await readFile(path.join(directory, 'studio/index.html'), 'utf8'); assert.match(html, /\/studio\/assets\//);
  const landing = await readFile(path.join(directory, 'index.html'), 'utf8');
  assert.match(landing, /Blender installed/); assert.match(landing, /motion-lab-gallery-media-base/);
  assert.equal(landing.includes('rel="canonical"'), Boolean(info.siteOrigin));
});
