import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {authoredSceneAudio} from './authored-audio.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'authored-loop-'));
try{
 assert.deepEqual(await authoredSceneAudio(root,'loop'),{audio:null});
 const samples=4800,data=Buffer.alloc(44+samples*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(48000,24);data.writeUInt32LE(96000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples*2,40);
 const dir=path.join(root,'public','local-preview');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'score.mp3'),data);await writeFile(path.join(dir,'loop-audio.json'),JSON.stringify({scene:'loop',url:'/local-preview/score.mp3'}));
 const first=await authoredSceneAudio(root,'loop');assert.deepEqual(first.sound,{enabled:false,music:0});assert.match(first.audio.tracks[0].assetId,/^[a-f0-9]{64}$/);assert.equal(first.audio.tracks[0].enabled,true);
 await rm(path.join(root,'public'),{recursive:true});assert.deepEqual(await authoredSceneAudio(root,'loop'),first);
 console.log('Authored LOOP migrates once to managed assets and reloads without legacy files or doubled synthesized sound.');
}finally{await rm(root,{recursive:true,force:true});}
