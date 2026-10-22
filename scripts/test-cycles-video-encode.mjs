import {videoEncodeArgs} from './video-encode.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import ffmpeg from 'ffmpeg-static';import ffprobe from 'ffprobe-static';import sharp from 'sharp';import {sequenceVideoArgs,assertAudioCoverage} from './cycles/video-encode.mjs';
const run=promisify(execFile),dir=await fs.mkdtemp(path.join(os.tmpdir(),'framevolve-audio-tail-'));
try{
 const image=await sharp({create:{width:32,height:32,channels:3,background:'#ef7800'}}).png().toBuffer();
 for(let i=1;i<=360;i++)await fs.writeFile(path.join(dir,`frame-${String(i).padStart(6,'0')}.png`),image);
 const audio=path.join(dir,'source.wav'),out=path.join(dir,'movie.mp4');
 await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=12',audio]);
 await run(ffmpeg,sequenceVideoArgs({sequence:dir,fps:30,count:360,audioPath:audio,out}));
 const probe=JSON.parse((await run(ffprobe.path,['-v','error','-show_streams','-of','json',out])).stdout);
 assert.equal(Number(probe.streams.find(s=>s.codec_type==='video').nb_frames),360);assertAudioCoverage(probe,12);
 // A muxed AAC track existing is insufficient: reject the actual V12 failure.
 assert.throws(()=>assertAudioCoverage({streams:[{codec_type:'audio',duration:'14.954'}]},22),/truncated/);
 await run(ffmpeg,['-v','error','-ss','11.5','-i',out,'-map','0:a:0','-f','null','-']);
 // Main CLI regression: AAC packet rounding must never drop frame 300.
 const nativeDir=path.join(dir,'native');await fs.mkdir(nativeDir);for(let i=1;i<=300;i++)await fs.writeFile(path.join(nativeDir,`frame-${String(i).padStart(6,'0')}.png`),image);
 const nativeAudio=path.join(dir,'native.wav'),nativeOut=path.join(dir,'native.mp4');await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=10',nativeAudio]);
 const nativeArgs=videoEncodeArgs({frameDir:nativeDir,target:nativeOut,fps:30,format:'mp4',bitrateMbps:1,audioPath:nativeAudio,frameCount:300});assert.ok(!nativeArgs.includes('-shortest'));assert.equal(nativeArgs[nativeArgs.indexOf('-t')+1],'10');await run(ffmpeg,nativeArgs);
 const nativeProbe=JSON.parse((await run(ffprobe.path,['-v','error','-show_streams','-of','json',nativeOut])).stdout);const nativeVideo=nativeProbe.streams.find(s=>s.codec_type==='video');assert.equal(Number(nativeVideo.nb_frames),300);assert.equal(Number(nativeVideo.duration),10);assertAudioCoverage(nativeProbe,10);
 console.log('Cycles audio tail and CLI 300-frame/10-second AAC export passed; truncated tracks rejected.');
}finally{await fs.rm(dir,{recursive:true,force:true});}
