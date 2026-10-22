import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import {importAudioAsset} from './audio-assets.mjs';
import {renderTimelineAudio,validateTimelineAudioAssets} from './native/audio.mjs';
import {normalizeAudioTracks,audioTrackGain} from '../src/engine/audio-track.js';
const execute=promisify(execFile),run=async(command,args)=>{await execute(command,args,{maxBuffer:8*1024*1024});};
const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-native-audio-'));
const decode=async(file,name)=>{const raw=path.join(root,name);await run(ffmpeg,['-v','error','-y','-i',file,'-f','f32le','-acodec','pcm_f32le',raw]);const bytes=await readFile(raw);return new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));};
try{
 const source=path.join(root,'tone.wav');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','aevalsrc=0.3*sin(2*PI*480*t)|0.2*sin(2*PI*720*t):s=48000:d=2','-c:a','pcm_f32le',source]);
 const playlist=path.join(root,'list.ffconcat');await writeFile(playlist,`ffconcat version 1.0\nfile '${source}'\n`);await assert.rejects(importAudioAsset(root,createReadStream(playlist),{name:'Indirect audio'}),/playlists|Command failed/);
 const asset=await importAudioAsset(root,createReadStream(source),{name:'Stereo test tone'});
 const audio=normalizeAudioTracks({version:1,tracks:[{id:'tone',assetId:asset.assetId,sourceStart:.15,timelineStart:.25,duration:1,volume:.7,fadeIn:.6,fadeOut:.6}]});await validateTimelineAudioAssets(root,audio);
 const input=await decode(source,'source.f32');
 for(const [name,start,duration] of [['full',0,1.5],['partial',.6,.4]]){
  const destination=path.join(root,`${name}.wav`);assert.equal(await renderTimelineAudio({root,audio,start,duration,destination,run}),destination);
  const output=await decode(destination,`${name}.f32`);assert.equal(output.length,Math.round(duration*48000)*2,'Exact stereo frame-clock duration');
  const {stdout}=await execute(ffprobe.path,['-v','error','-show_entries','format=duration','-of','json',destination]);assert.ok(Math.abs(Number(JSON.parse(stdout).format.duration)-duration)<1/48000);
  let maxError=0;for(let i=0;i<output.length/2;i++){const time=start+i/48000,gain=audioTrackGain(audio.tracks[0],time),sourceFrame=Math.round((audio.tracks[0].sourceStart+time-audio.tracks[0].timelineStart)*48000);for(let channel=0;channel<2;channel++){const expected=gain?(input[sourceFrame*2+channel]??0)*gain:0;maxError=Math.max(maxError,Math.abs(output[i*2+channel]-expected));}}
  assert.ok(maxError<.00002,`${name} sample timing, gain and overlapping fades match audioTrackGain: ${maxError}`);
 }
 await assert.rejects(validateTimelineAudioAssets(root,{version:1,tracks:[{...audio.tracks[0],sourceStart:1.8}]}),/beyond its source/);
 console.log('Native audio passed: real FFmpeg stereo tone, source cut, timeline delay, overlapping fades, partial interval, exact duration and source bounds.');
}finally{await rm(root,{recursive:true,force:true});}
