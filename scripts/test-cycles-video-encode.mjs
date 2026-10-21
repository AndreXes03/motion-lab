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
 console.log('Sequence export retains audio through the final frame; truncated tracks rejected.');
}finally{await fs.rm(dir,{recursive:true,force:true});}
