#!/usr/bin/env node
// Local delivery encode. No gain, loudness normalization, cosmetic effects or uploads.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile,link,lstat,mkdir,mkdtemp,open,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
const usage='node scripts/export-social.mjs --video master.mp4 --out delivery.mp4 --target x|web';
const ratio=s=>{const[n,d=1]=String(s).split('/').map(Number);return n/d;};
function requireThat(ok,message){if(!ok)throw Error(message);}
export function parseArgs(args){
 const o={};for(let i=0;i<args.length;i+=2){const k=args[i]?.slice(2);requireThat(args[i]?.startsWith('--')&&['video','out','target'].includes(k)&&args[i+1]!==undefined&&!Object.hasOwn(o,k),`Invalid arguments. ${usage}`);o[k]=args[i+1];}
 requireThat(o.video?.trim()&&o.out?.trim()&&['x','web'].includes(o.target),usage);
 o.video=path.resolve(o.video);o.out=path.resolve(o.out);requireThat(path.extname(o.out).toLowerCase()==='.mp4','--out must end in .mp4');return o;
}
async function exists(p){try{return await lstat(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function run(bin,args){return new Promise((resolve,reject)=>{const p=spawn(bin,args,{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err=(err+x).slice(-16000));p.on('error',reject);p.on('close',c=>c===0?resolve(out):reject(Error(`${path.basename(bin)} (${c}): ${err.trim()}`)));});}
const probe=async p=>JSON.parse(await run(ffprobe.path,['-v','error','-count_frames','-show_streams','-show_format','-of','json',p]));
async function digest(p){const h=createHash('sha256');for await(const chunk of createReadStream(p))h.update(chunk);return h.digest('hex');}
function streams(p){const v=p.streams.filter(x=>x.codec_type==='video'),a=p.streams.filter(x=>x.codec_type==='audio');requireThat(v.length===1&&a.length===1,'One video stream and one audio stream are required');return {v:v[0],a:a[0]};}
export function planEncode(p,target){
 const {v,a}=streams(p),fps=ratio(v.avg_frame_rate),duration=Number(v.duration),frames=Number(v.nb_read_frames);
 requireThat(Number.isFinite(fps)&&fps>0&&fps<=60&&Math.abs(fps-ratio(v.r_frame_rate))<1e-5,'Source must be CFR at no more than 60 fps');
 requireThat(Number.isFinite(duration)&&duration>0&&Number.isInteger(frames)&&frames>0,'Source duration and decoded frame count are required');
 requireThat(Math.abs(frames/fps-duration)<=1/fps+.001,'Source frame count and duration disagree');
 requireThat(a.channels===2&&Math.abs(Number(a.duration)-duration)<=1/fps+.023,'Source must have stereo audio matching video duration');
 requireThat(!v.sample_aspect_ratio||['1:1','N/A'].includes(v.sample_aspect_ratio),'Bake anamorphic pixels into square pixels before export');
 requireThat(!(v.side_data_list??[]).some(x=>Math.abs(Number(x.rotation)||0)>0),'Bake video rotation into the master before export');
 for(const k of ['color_space','color_transfer','color_primaries','color_range'])requireThat(v[k]&&!['unknown','unspecified','reserved'].includes(v[k]),`Source ${k} is missing; use the explicitly color-managed master`);
 requireThat(!['smpte2084','arib-std-b67'].includes(v.color_transfer),'HDR needs an approved SDR master; automatic tone mapping is not applied');
 const landscape=v.width>=v.height,maxW=landscape?1920:1080,maxH=landscape?1080:1920;
 const scale=Math.min(1,maxW/v.width,maxH/v.height),width=Math.floor(v.width*scale/2)*2,height=Math.floor(v.height*scale/2)*2;
 requireThat(width>=2&&height>=2,'Invalid source dimensions');
 const [n,d=1]=v.avg_frame_rate.split('/').map(Number),halve=target==='x'&&fps>30;
 const outputRate=`${n}/${d*(halve?2:1)}`,outputFps=ratio(outputRate);
 return {sourceFps:fps,fps:outputFps,fpsRational:outputRate,duration,sourceFrames:frames,expectedFrames:Math.round(duration*outputFps),width,height,gop:Math.round(outputFps*2),frameRateReduced:halve,
  sourceColor:{primaries:v.color_primaries,transfer:v.color_transfer,matrix:v.color_space,range:v.color_range},
  filter:`colorspace=all=bt709:range=tv:format=yuv420p,scale=${width}:${height}:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt709:in_range=tv:out_range=tv,setsar=1,fps=${outputRate}:round=near`};
}
async function checkCfr(file,fps){
 const data=JSON.parse(await run(ffprobe.path,['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',file]));
 const pts=data.frames.map(x=>Number(x.best_effort_timestamp_time));requireThat(pts.length>1&&pts.every(Number.isFinite),'Need at least two frames with valid timestamps');
 const period=1/fps,tolerance=Math.max(.00015,period*.003);
 for(let i=1;i<pts.length;i++)requireThat(Math.abs(pts[i]-pts[i-1]-period)<=tolerance,`Variable frame rate detected at decoded frame ${i}`);
 return pts.length;
}
async function mp4Atoms(file){
 const f=await open(file,'r'),size=(await f.stat()).size,atoms=[];let pos=0;
 try{while(pos+8<=size){const b=Buffer.alloc(16);const {bytesRead}=await f.read(b,0,16,pos);requireThat(bytesRead>=8,'Invalid MP4 atom');let n=b.readUInt32BE(0);const type=b.toString('ascii',4,8);if(n===1){requireThat(bytesRead>=16,'Invalid extended MP4 atom');n=Number(b.readBigUInt64BE(8));}if(n===0)n=size-pos;requireThat(Number.isSafeInteger(n)&&n>=8&&pos+n<=size,'Invalid MP4 atom length');atoms.push({type,offset:pos,bytes:n});pos+=n;}requireThat(pos===size,'Unexpected MP4 trailing bytes');return atoms;}finally{await f.close();}
}
export async function exportSocial(options){
 const o=parseArgs(['--video',options.video,'--out',options.out,'--target',options.target]),reportPath=`${o.out}.json`;
 requireThat(!(await exists(o.out))&&!(await exists(reportPath)),'Output or report already exists; choose a new --out (files are never overwritten)');
 requireThat((await stat(o.video)).isFile(),'Input must be a regular file');
 await mkdir(path.dirname(o.out),{recursive:true});const dir=await mkdtemp(path.join(path.dirname(o.out),'.social-export-'));
 const input=path.join(dir,'source.mp4'),encoded=path.join(dir,'encoded.mp4'),json=path.join(dir,'report.json');
 try{
  await copyFile(o.video,input);const source=await probe(input),plan=planEncode(source,o.target);
  requireThat(await checkCfr(input,plan.sourceFps)===plan.sourceFrames,'Timestamp and decoded frame counts disagree');
  const common=['-hide_banner','-nostdin','-v','error','-xerror','-y','-i',input,'-map','0:v:0','-vf',plan.filter,'-c:v','libx264','-preset','slow','-profile:v','high','-pix_fmt','yuv420p','-g',String(plan.gop),'-keyint_min',String(plan.gop),'-sc_threshold','0','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv'];
  const video=o.target==='x'?['-level:v','4.1','-refs','4','-b:v','8M','-maxrate','10M','-bufsize','20M']:['-level:v',plan.fps<=30?'4.1':'4.2','-refs','4','-crf','17','-maxrate','24M','-bufsize','48M'];
  const pass=['-passlogfile',path.join(dir,'x264-pass')];
  if(o.target==='x')await run(ffmpeg,[...common,...video,...pass,'-pass','1','-an','-f','null','-']);
  await run(ffmpeg,[...common,...video,...(o.target==='x'?[...pass,'-pass','2']:[]),'-map','0:a:0','-c:a','aac','-profile:a','aac_low','-ar','48000','-ac','2','-b:a','256k','-map_metadata','-1','-movflags','+faststart',encoded]);
  const result=await probe(encoded),{v,a}=streams(result),duration=Number(v.duration),count=Number(v.nb_read_frames),bytes=(await stat(encoded)).size;
  requireThat(v.codec_name==='h264'&&v.profile==='High'&&v.pix_fmt==='yuv420p'&&v.level===(plan.fps<=30?41:42),'Encoded video profile is incorrect');
  requireThat(v.width===plan.width&&v.height===plan.height&&Math.abs(ratio(v.avg_frame_rate)-plan.fps)<1e-5,'Encoded dimensions or frame rate are incorrect');
  requireThat(Math.abs(count-plan.expectedFrames)<=(plan.frameRateReduced?1:0)&&Math.abs(duration-plan.duration)<=1/plan.fps+.001,'Encoded video frame count or duration changed unexpectedly');
  requireThat(a.codec_name==='aac'&&a.profile==='LC'&&Number(a.sample_rate)===48000&&a.channels===2&&Math.abs(Number(a.duration)-duration)<=1/plan.fps+.023,'Encoded AAC format or duration is incorrect');
  requireThat(v.color_space==='bt709'&&v.color_primaries==='bt709'&&v.color_transfer==='bt709'&&v.color_range==='tv','BT.709 limited-range output tags are missing');
  requireThat(await checkCfr(encoded,plan.fps)===count,'Encoded timestamp/frame count mismatch');
  requireThat(Math.abs(Number(result.format.duration)-duration)<=1/plan.fps+.023,'MP4 container duration does not match video');
  await run(ffmpeg,['-hide_banner','-nostdin','-v','error','-xerror','-err_detect','explode','-i',encoded,'-map','0:v:0','-map','0:a:0','-f','null','-']);
  const atoms=await mp4Atoms(encoded),moov=atoms.find(x=>x.type==='moov'),mdat=atoms.find(x=>x.type==='mdat');requireThat(moov&&mdat&&moov.offset<mdat.offset,'MP4 faststart header is missing');
  const report={target:o.target,input:o.video,output:o.out,inputSha256:await digest(input),sha256:await digest(encoded),bytes,width:v.width,height:v.height,fps:ratio(v.avg_frame_rate),fpsRational:v.avg_frame_rate,duration,framecount:count,video:{codec:v.codec_name,profile:v.profile,level:v.level,pixelFormat:v.pix_fmt,bitrate:Number(v.bit_rate),primaries:v.color_primaries,transfer:v.color_transfer,matrix:v.color_space,range:v.color_range},audio:{codec:a.codec_name,profile:a.profile,sampleRate:Number(a.sample_rate),channels:a.channels,bitrate:Number(a.bit_rate),duration:Number(a.duration),gainFilterApplied:false},encoding:{preset:'slow',passes:o.target==='x'?2:1,...(o.target==='x'?{averageBitrate:8000000,maxrate:10000000,bufsize:20000000}:{crf:17,maxrate:24000000,bufsize:48000000}),gop:plan.gop,sourceColor:plan.sourceColor,frameRateReduced:plan.frameRateReduced},validation:{decoded:true,cfr:true,faststart:true,atoms},uploaded:false};
  await writeFile(json,JSON.stringify(report,null,2)+'\n');
  // Atomic, exclusive hard links prevent overwrite even if another writer races us.
  await link(json,reportPath);
  try{await link(encoded,o.out);}catch(e){const current=await exists(reportPath),ours=await stat(json);if(current?.ino===ours.ino)await rm(reportPath);throw e;}
  return report;
 }finally{await rm(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await exportSocial(parseArgs(process.argv.slice(2))),null,2));}
 catch(e){console.error(`export-social: ${e.message}`);process.exitCode=1;}
}
