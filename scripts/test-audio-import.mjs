import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Readable} from 'node:stream';
import {importAudioAsset,resolveAudioAsset,listAudioAssets,MAX_AUDIO_BYTES} from './audio-assets.mjs';
import {createStudioApi} from './studio-api.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-audio-'));
try{
 const samples=4800,data=Buffer.alloc(44+samples*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(48000,24);data.writeUInt32LE(96000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples*2,40);
 const asset=await importAudioAsset(root,Readable.from([data]),{name:'Voice.wav',contentLength:data.length});assert.equal(asset.duration,.1);assert.match(asset.assetId,/^[a-f0-9]{64}$/);assert.equal((await listAudioAssets(root)).length,1);assert.equal((await resolveAudioAsset(root,asset.assetId)).metadata.name,'Voice.wav');
 await assert.rejects(importAudioAsset(root,Readable.from([data]),{contentLength:MAX_AUDIO_BYTES+1}),/100 MB/);await assert.rejects(importAudioAsset(root,Readable.from([Buffer.from('not audio')])),/Command failed|audio/);await assert.rejects(resolveAudioAsset(root,'../outside'),/Invalid/);
 const file=path.join(root,'project','audio',`${asset.assetId}.audio`);await writeFile(file,Buffer.from('changed'));await assert.rejects(resolveAudioAsset(root,asset.assetId),/matches/);await rm(file);await symlink('/etc/hosts',file);await assert.rejects(resolveAudioAsset(root,asset.assetId),/Unsafe/);
 const ui=await readFile(new URL('../src/viewer/main.js',import.meta.url),'utf8');assert.match(ui,/p.audio=soundPanel.getAudio\(\)/);assert.match(ui,/soundPanel.setState\(\{scene:p.scene,sound:p.sound,audio:p.audio\}\)/);const panel=await readFile(new URL('../src/viewer/audio-import-panel.js',import.meta.url),'utf8');for(const field of ['sourceStart','timelineStart','duration','volume','fadeIn','fadeOut'])assert.ok(panel.includes(field));
 const api=createStudioApi();for(const headers of [{host:'localhost:5173',origin:'https://foreign.example','content-type':'application/octet-stream'},{host:'localhost:5173','content-type':'application/octet-stream'}]){let payload;const res={setHeader(){},end(value){payload=JSON.parse(value);}};await api({url:'/studio/audio/assets',method:'POST',headers},res,()=>assert.fail('Unexpected route fallback'));assert.equal(res.statusCode,403);assert.ok(payload.error);}
 console.log('Audio import: actual media, bounds, immutable hashes, path safety and recipe UI wiring passed.');
}finally{await rm(root,{recursive:true,force:true});}
