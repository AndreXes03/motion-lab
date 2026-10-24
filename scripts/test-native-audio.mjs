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
import {musicDucking,musicGainAt,voiceMixSample} from '../src/engine/voiceover.js';
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
 // Preview/native master parity: an already mastered generated bed gets no second gain.
 const base=path.join(root,'base.wav');await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','aevalsrc=0.1|0.1:s=48000:d=1.5','-c:a','pcm_f32le',base]);
 for(const [name,sound,expected]of [['half',{master:.4},.05],['muted',{master:.8,muted:true},0]]){
  const destination=path.join(root,`global-${name}.wav`);await renderTimelineAudio({root,audio,sound,start:0,duration:1.5,destination,baseAudio:base,baseMastered:false,run});
  const output=await decode(destination,`global-${name}.f32`);assert.ok(Math.abs(output[0]-expected)<.00001,`${name} explicit-source master`);
  const reference=await decode(path.join(root,'full.wav'),`reference-${name}.f32`),ratio=name==='half'?.5:0;
  for(let i=0;i<output.length;i++)assert.ok(Math.abs(output[i]-(reference[i]+.1)*ratio)<.00002,`${name} imported and explicit audio share one master`);
 }
 const destination=path.join(root,'already-mastered.wav');await renderTimelineAudio({root,audio,sound:{master:.4},start:0,duration:1.5,destination,baseAudio:base,run});
 const mastered=await decode(destination,'already-mastered.f32');assert.ok(Math.abs(mastered[0]-.1)<.00001,'Generated base never receives double master gain');
 await assert.rejects(validateTimelineAudioAssets(root,{version:1,tracks:[{...audio.tracks[0],sourceStart:1.8}]}),/beyond its source/);
 const vo=normalizeAudioTracks({version:2,tracks:[{id:'voice',assetId:asset.assetId,role:'voiceover',duration:1,sourceStart:.1,timelineStart:.25,volume:1.7,narration:{version:1,source:'manual',text:'test tone',segments:[{id:'w1',text:'test tone',start:.2,end:.6}],cues:[]}},{id:'music',assetId:asset.assetId,duration:1.5,volume:1.8,role:'music'}]});
 for(const [label,start,duration]of [['vo-full',0,1.5],['vo-partial',.4,.5]]){
  const destination=path.join(root,label+'.wav');await renderTimelineAudio({root,audio:vo,start,duration,destination,run});const output=await decode(destination,label+'.f32'),regions=musicDucking(vo);let error=0;
  for(let i=0;i<output.length/2;i++){const t=start+i/48000;for(let c=0;c<2;c++){let expected=0;for(const track of vo.tracks){const gain=audioTrackGain(track,t),frame=Math.round((track.sourceStart+t-track.timelineStart)*48000);expected+=(gain?input[frame*2+c]*gain:0)*(track.role==='music'?musicGainAt(regions,t):1);}error=Math.max(error,Math.abs(output[i*2+c]-voiceMixSample(expected)));}}assert.ok(error<.00002,`${label} voice, music envelope and peak ceiling match preview sample math: ${error}`);
 }
 console.log('Native audio passed: trim/fade/master, full and partial VO mix, measured-word ducking, final ceiling and exact sample parity.');
}finally{await rm(root,{recursive:true,force:true});}
