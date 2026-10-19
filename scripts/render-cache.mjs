import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readdir, readFile, writeFile, rename, rm, open} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createReadStream} from 'node:fs';

const hash = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);

// Content, rather than modification times: restoring an older file cannot reuse stale frames.
export async function sourceFingerprint(root) {
  const digest = createHash('sha256');
  async function addFile(relative, optional = false) {
    let size;
    try { const file = await open(path.join(root, relative)); try { size = (await file.stat()).size; } finally { await file.close(); } }
    catch (error) { if (optional && error.code === 'ENOENT') { digest.update(stable([relative, null])); return; } throw error; }
    // Length-delimited names and contents avoid ambiguous concatenations. Stream
    // large asset files instead of retaining a second full copy in Node memory.
    digest.update(stable([relative.split(path.sep).join('/'), size]));
    for await (const chunk of createReadStream(path.join(root, relative))) digest.update(chunk);
  }
  async function visit(relative) {
    let entries;
    try { entries = await readdir(path.join(root, relative), {withFileTypes:true}); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (!['project/history','project/versions'].includes(name.split(path.sep).join('/'))) await visit(name);
      } else await addFile(name);
    }
  }
  for (const folder of ['src','project','public']) await visit(folder);
  for (const file of ['scripts/cli.mjs','scripts/cli-frame.mjs','scripts/render-cache.mjs','scripts/atomic-output.mjs','index.html','vite.config.js','package.json','package-lock.json']) await addFile(file, true);
  return digest.digest('hex');
}

export async function openFrameCache(root, recipe, {resume = false, keepFrames = false} = {}) {
  const key = hash(stable({...recipe, cacheVersion:2}));
  const directory = resume ? path.join(root, '.motion-cache', 'renders', key)
    : await mkdtemp(path.join(root, '.motion-frames-'));
  await mkdir(directory, {recursive:true});
  const lockPath = path.join(directory, 'lock.json');
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = JSON.parse(await readFile(lockPath, 'utf8'));
    if (!Number.isInteger(previous.pid) || previous.pid <= 0) throw Error('Invalid render lock; inspect '+lockPath);
    try { process.kill(previous.pid, 0); }
    catch (probeError) {
      if (probeError.code !== 'ESRCH') throw probeError;
      await rm(lockPath); lock = await open(lockPath, 'wx');
    }
    if (!lock) throw Error('Matching render is already running (PID '+previous.pid+').');
  }
  try {
    await lock.writeFile(JSON.stringify({pid:process.pid}));
    await lock.close();
    await writeFile(path.join(directory,'recipe.json'), stable(recipe));
  } catch (error) {
    await lock.close().catch(() => {});
    if (!resume) await rm(directory,{recursive:true,force:true});
    else await rm(lockPath,{force:true});
    throw error;
  }
  const filename = index => path.join(directory, `frame-${String(index+1).padStart(6,'0')}.png`);
  let closed = false;
  return {
    directory,
    async read(index) {
      if (!resume) return null;
      try {
        const png = await readFile(filename(index));
        // Decode alone does not detect all mutations to a same-sized valid PNG.
        const checksum = await readFile(filename(index)+'.sha256','utf8');
        if (hash(png) !== checksum) return null;
        // Decode the complete PNG: a truncated file must be rendered again.
        const image = sharp(png), info = await image.metadata();
        if (info.format !== 'png' || info.width !== recipe.width || info.height !== recipe.height) return null;
        await image.stats();
        return info.width === recipe.width && info.height === recipe.height ? png : null;
      } catch (error) {
        if (error.code && error.code !== 'ENOENT') throw error;
        return null;
      }
    },
    async write(index, png) {
      const target = filename(index), temp = target+'.tmp-'+process.pid;
      const checksum = target+'.sha256', checksumTemp = checksum+'.tmp-'+process.pid;
      try {
        await writeFile(temp, png); await writeFile(checksumTemp,hash(png));
        await rename(temp,target); await rename(checksumTemp,checksum);
      } finally {
        await rm(temp,{force:true}); await rm(checksumTemp,{force:true});
      }
    },
    async close(success) {
      if (closed) return;
      closed = true;
      // Keep recoverable work on failure, remove successful temporary frames by default.
      if (!resume || (success && !keepFrames)) await rm(directory,{recursive:true,force:true});
      else await rm(lockPath,{force:true});
    }
  };
}
