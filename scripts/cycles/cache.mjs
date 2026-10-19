import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
export const isSourceArtifact=filename=>!filename.split(path.sep).includes('__pycache__')&&!/\.py[co]$/.test(filename)&&!/(^|\/)project\/references\/music(?:\/|$)/.test(filename.split(path.sep).join('/'));
export async function hashFile(filename){const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);return hash.digest('hex');}
export async function sourceDigest(directory){
 const hash=createHash('sha256');
 async function file(relative){
  const filename=path.join(directory,relative),info=await stat(filename);
  hash.update(JSON.stringify([relative.split(path.sep).join('/'),info.size]));
  for await(const chunk of createReadStream(filename))hash.update(chunk);
 }
 async function visit(relative){
  let entries;try{entries=await readdir(path.join(directory,relative),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
   const name=path.join(relative,entry.name);if(!isSourceArtifact(name))continue;
   if(entry.isDirectory())await visit(name);else if(!entry.isSymbolicLink())await file(name);
  }
 }
 for(const folder of ['src','project','public','scripts/cycles'])await visit(folder);
 for(const name of ['scripts/cycles.mjs','scripts/music-assets.mjs','package.json','package-lock.json'])await file(name);
 return hash.digest('hex');
}
