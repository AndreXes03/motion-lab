import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmod,mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {normalizeCyclesOptions} from './options.mjs';
import {sourceDigest} from './cache.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const temp=await mkdtemp(path.join(os.tmpdir(),'cycles-resume-'));
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function invoke(args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'scripts/cycles.mjs'),...args],{cwd:root});let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);child.on('error',reject);child.on('close',code=>resolve({code,output}));});}
try{
 const blender=path.join(temp,'blender'),out=path.join(temp,'proof.png'),directory=out+'.cycles',frozen=path.join(directory,'source');
 await writeFile(blender,'#!/bin/sh\nexit 88\n');await chmod(blender,0o755);
 await mkdir(path.join(frozen,'scripts'),{recursive:true});await mkdir(path.join(directory,'frames'),{recursive:true});
 for(const folder of ['src','project','public','scripts/cycles'])await symlink(path.join(root,folder),path.join(frozen,folder),'dir');
 for(const file of ['package.json','package-lock.json','scripts/cycles.mjs','scripts/music-assets.mjs'])await symlink(path.join(root,file),path.join(frozen,file));
 const input={command:'frame',out,width:64,height:64,samples:1,resume:'on'},options=normalizeCyclesOptions(input),sourceHash=await sourceDigest(root);
 const fingerprint=createHash('sha256').update(stable({...options,resume:false,out:null,workers:1,blender,sourceHash,audioHash:null})).digest('hex');
 await writeFile(path.join(directory,'recipe.json'),JSON.stringify({fingerprint,baked:true}));
 await writeFile(path.join(directory,'export-report.json'),JSON.stringify({source:'test-cached-scene',meshes:3}));
 await writeFile(out+'.job.json',JSON.stringify({fingerprint,device:'CPU'}));
 await sharp({create:{width:64,height:64,channels:3,background:'#123456'}}).png().toFile(path.join(directory,'frames/frame-000001.png'));
 const result=await invoke(['frame','--out',out,'--width','64','--height','64','--samples','1','--resume','on','--blender',blender]);
 assert.equal(result.code,0,result.output);
 const manifest=JSON.parse(await readFile(out+'.job.json','utf8'));assert.equal(manifest.status,'complete');assert.equal(manifest.device,'CPU');assert.equal(manifest.sourceReport.meshes,3);assert.equal(manifest.frames,1);
 assert.equal((await sharp(out).metadata()).width,64);
 // Tampering with the frozen root must block a resume even with valid PNGs.
 await rm(path.join(frozen,'package.json'));await writeFile(path.join(frozen,'package.json'),'{}');
 const invalid=await invoke(['frame','--out',out,'--width','64','--height','64','--samples','1','--resume','on','--blender',blender]);
 assert.equal(invalid.code,1);assert.match(invalid.output,/Frozen Cycles source is incomplete or changed/);
 console.log('Cycles completed-frame resume preserves provenance and rejects altered frozen source (no Blender render required)');
}finally{await rm(temp,{recursive:true,force:true});}
