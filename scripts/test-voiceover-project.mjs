import assert from 'node:assert/strict';
import {mkdtemp,realpath,mkdir,writeFile,readFile,copyFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {encodeWav} from '../src/engine/sound-design.js';
import {saveProject,exportProject,importProject,readProject} from './project-library-store.mjs';
const run=promisify(execFile),root=await realpath(await mkdtemp(path.join(tmpdir(),'framevolve-voice-project-')));
try{
 for(const file of ['scripts/voiceover.mjs','scripts/audio-assets.mjs','src/engine/audio-track.js','src/engine/narration.js','src/engine/voice-edit.js']){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await copyFile(new URL('../'+file,import.meta.url),path.join(root,file));}
 await symlink(path.resolve('node_modules'),path.join(root,'node_modules'));await writeFile(path.join(root,'package.json'),'{"type":"module","version":"test"}');
 const wave=Float32Array.from({length:96000},(_,i)=>.1*Math.sin(i/48000*440*Math.PI*2));await writeFile(path.join(root,'voice.wav'),Buffer.from(encodeWav([wave,wave],48000)));
 const original={schemaVersion:2,config:{fps:30,duration:10},parameters:{scene:'procedural',sound:{music:.35},audio:{version:1,tracks:[]}}};await writeFile(path.join(root,'original.json'),JSON.stringify(original));
 await writeFile(path.join(root,'edit.json'),JSON.stringify([{from:'w1',to:'w2',pauseAfter:2}]));
 await writeFile(path.join(root,'words.json'),JSON.stringify({words:[{text:'An',start:.1,end:.3},{text:'idea',start:.3,end:.8}]}));await writeFile(path.join(root,'cues.json'),JSON.stringify([{id:'idea',from:'w1',to:'w2',label:'Show an idea',super:'Your idea'}]));
 const args=[path.join(root,'scripts/voiceover.mjs'),'--recipe',path.join(root,'original.json'),'--audio',path.join(root,'voice.wav'),'--timing',path.join(root,'words.json'),'--edit',path.join(root,'edit.json'),'--cues',path.join(root,'cues.json'),'--out',path.join(root,'narrated.json')];
 const {stdout}=await run(process.execPath,args);const report=JSON.parse(stdout),recipe=JSON.parse(await readFile(path.join(root,'narrated.json'),'utf8'));assert.equal(recipe.parameters.sound.music,.35);assert.ok(report.voiceEnd>2);assert.ok(Math.abs(report.cues[0].start-2/30)<1e-8);assert.equal(recipe.parameters.audio.tracks[0].clips[0].pauseAfter,2);assert.equal(report.cues[0].super,'Your idea');assert.deepEqual(JSON.parse(await readFile(path.join(root,'original.json'),'utf8')),original);
 await assert.rejects(run(process.execPath,args),/EEXIST/);
 const saved=await saveProject(root,{name:'Narrated project',snapshot:recipe}),portable=await exportProject(root,saved.id),fresh=path.join(root,'destination');await mkdir(fresh);
 const restored=await importProject(fresh,portable),read=await readProject(fresh,restored.id);assert.deepEqual(read.snapshot.parameters.audio,recipe.parameters.audio);assert.ok(Object.keys(read.files).some(p=>p.endsWith('.audio')),'Portable project includes the voice source');
 console.log('Voiceover project passed: real CLI import, intact original/music, timed cues, overwrite protection and portable voice+timing round trip.');
}finally{await rm(root,{recursive:true,force:true});}
