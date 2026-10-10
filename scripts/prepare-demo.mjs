#!/usr/bin/env node
// Install an already muxed local master. Technical validation is not visual approval.
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile,lstat,mkdir,mkdtemp,open,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EXPECTED={pulse:{duration:13.9,frames:417},camera:{duration:15.4,frames:462}};
const MAX_BYTES=100*1024*1024;
const usage='node scripts/prepare-demo.mjs --film pulse|camera --video master.mp4 --version v12 --temporal-samples 24 --poster-time 7.8';

export function parseArgs(args){
 const keys=new Set(['film','video','version','temporal-samples','poster-time']),options={};
 for(let i=0;i<args.length;i+=2){
  const key=args[i]?.replace(/^--/,'');
  if(!args[i]?.startsWith('--')||!keys.has(key)||args[i+1]===undefined||options[key]!==undefined)throw Error(`Invalid or duplicate argument. Usage: ${usage}`);
  options[key]=args[i+1];
 }
 for(const key of keys)if(options[key]===undefined)throw Error(`Missing --${key}. Usage: ${usage}`);
 if(!Object.hasOwn(EXPECTED,options.film))throw Error('--film must be pulse or camera');
 options.version=options.version.trim();
 if(!options.version||options.version.length>160||/[\x00-\x1f]/.test(options.version))throw Error('--version must be a nonempty printable string (up to 160 characters)');
 options.temporalSamples=Number(options['temporal-samples']);options.posterTime=Number(options['poster-time']);
 if(!/^\d+$/.test(options['temporal-samples'])||!Number.isInteger(options.temporalSamples)||options.temporalSamples<1||options.temporalSamples>64)throw Error('--temporal-samples must be an integer from 1 to 64');
 if(!options['poster-time'].trim()||!Number.isFinite(options.posterTime)||options.posterTime<0||options.posterTime>=EXPECTED[options.film].duration)throw Error('--poster-time must be inside the film duration');
 if(!options.video.trim())throw Error('--video must name a local file');
 options.video=path.resolve(options.video);return options;
}
function run(binary,args){return new Promise((resolve,reject)=>{
 const child=spawn(binary,args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>{stderr=(stderr+x).slice(-12000);});
 child.on('error',reject);child.on('close',code=>code===0?resolve(stdout):reject(Error(`${path.basename(binary)} failed (${code}): ${stderr.trim()}`)));
});}
const fraction=s=>{const[n,d=1]=String(s).split('/').map(Number);return n/d;};
export function validateProbe(probe,film,bytes){
 const expected=EXPECTED[film];if(!expected)throw Error('Unknown film');
 if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>=MAX_BYTES)throw Error('Master must be nonempty and smaller than 100 MiB');
 const videos=probe.streams?.filter(s=>s.codec_type==='video')??[],audios=probe.streams?.filter(s=>s.codec_type==='audio')??[];
 if(videos.length!==1||audios.length!==1)throw Error('Master must contain exactly one video and one audio stream');
 const[v]=videos,[a]=audios;
 if(v.codec_name!=='h264'||a.codec_name!=='aac')throw Error('Master requires H.264 video and AAC audio');
 if(!String(probe.format?.format_name).split(',').some(x=>x==='mov'||x==='mp4'))throw Error('Master must already be muxed into an MP4 container');
 if(v.width!==1920||v.height!==1080)throw Error('Master must be 1920×1080');
 if(![v.avg_frame_rate,v.r_frame_rate].every(x=>Math.abs(fraction(x)-30)<1e-6))throw Error('Master must be 30 fps');
 if(Number(v.nb_read_frames)!==expected.frames)throw Error(`Decoded frame count must be ${expected.frames}`);
 const durations=[Number(v.duration),Number(a.duration),Number(probe.format?.duration)];
 if(!durations.every(x=>Number.isFinite(x)&&Math.abs(x-expected.duration)<=1/30+1e-6))throw Error(`Video, audio and container duration must be ${expected.duration} s within one frame`);
 return {width:v.width,height:v.height,fps:30,duration:Number(v.duration),framecount:Number(v.nb_read_frames),videoCodec:v.codec_name,audioCodec:a.codec_name};
}
async function sha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function exists(file){try{return await lstat(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}

export async function prepareDemo(options,{root=ROOT,ffmpeg=ffmpegPath,probeBinary=ffprobe.path}={}){
 // Revalidate programmatic calls through the same contract as CLI calls.
 const o=parseArgs(['--film',options.film,'--video',options.video,'--version',options.version,'--temporal-samples',String(options.temporalSamples??options['temporal-samples']),'--poster-time',String(options.posterTime??options['poster-time'])]);
 const source=await stat(o.video);if(!source.isFile()||source.size<=0||source.size>=MAX_BYTES)throw Error('Source must be a regular, nonempty file smaller than 100 MiB');
 const backupsRoot=path.join(root,'renders','demo-backups');await mkdir(backupsRoot,{recursive:true});
 const stage=await mkdtemp(path.join(backupsRoot,'.prepare-'));
 const demo=path.join(root,'demo'),names=[`${o.film}-1080.mp4`,`${o.film}-poster.jpg`,'render-manifest.json'];
 const stagedVideo=path.join(stage,names[0]),lockPath=path.join(backupsRoot,'.prepare-demo.lock');
 let lock,backupDir;const replaced=[],oldFiles=new Map();
 try{
  // Copy first: probe, decode, poster and hash all describe this immutable staged input.
  await copyFile(o.video,stagedVideo);
  const bytes=(await stat(stagedVideo)).size;
  const probe=JSON.parse(await run(probeBinary,['-v','error','-count_frames','-show_streams','-show_format','-of','json',stagedVideo]));
  const metadata=validateProbe(probe,o.film,bytes);
  await run(ffmpeg,['-hide_banner','-nostdin','-v','error','-xerror','-err_detect','explode','-i',stagedVideo,'-map','0:v:0','-map','0:a:0','-f','null','-']);
  const poster=path.join(stage,names[1]);
  await run(ffmpeg,['-hide_banner','-nostdin','-v','error','-xerror','-y','-i',stagedVideo,'-ss',String(o.posterTime),'-frames:v','1','-an','-q:v','2',poster]);
  if(!(await stat(poster)).size)throw Error('Poster extraction produced an empty file');
  const entry={film:o.film.toUpperCase(),file:`demo/${names[0]}`,poster:`demo/${names[1]}`,sha256:await sha256(stagedVideo),bytes,...metadata,temporalSamples:o.temporalSamples,version:o.version,posterTime:o.posterTime};
  try{lock=await open(lockPath,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Another demo preparation holds the lock; retry after it finishes');throw e;}
  await lock.writeFile(JSON.stringify({pid:process.pid,film:o.film,startedAt:new Date().toISOString()})+'\n');
  let previous={files:[]};
  const manifestPath=path.join(demo,names[2]);
  if(await exists(manifestPath))previous=JSON.parse(await readFile(manifestPath,'utf8'));
  if(!previous||typeof previous!=='object'||Array.isArray(previous)||!Array.isArray(previous.files)||previous.files.some(x=>!x||typeof x!=='object'||typeof x.film!=='string'))throw Error('Existing render-manifest.json has an unsupported structure');
  const matches=previous.files.filter(x=>x.film.toLowerCase()===o.film);if(matches.length>1)throw Error('Existing manifest has duplicate entries for this film');
  // Migrate the legacy global version onto existing entries, then version each film.
  const files=previous.files.map(x=>({...x,...(!x.version&&previous.version?{version:previous.version}:{})}));
  const index=files.findIndex(x=>x.film.toLowerCase()===o.film);if(index<0)files.push(entry);else files[index]=entry;
  const manifest={...previous,schemaVersion:2,files};delete manifest.version;delete manifest.approved;delete manifest.visualApproval;
  await writeFile(path.join(stage,names[2]),JSON.stringify(manifest,null,2)+'\n');
  // Fail before any replacement if a destination is a directory or symlink.
  for(const name of names){const info=await exists(path.join(demo,name));if(info&&!info.isFile())throw Error(`Destination is not a regular file: ${name}`);oldFiles.set(name,!!info);}
  await mkdir(demo,{recursive:true});
  backupDir=path.join(backupsRoot,`${new Date().toISOString().replaceAll(':','-')}-${o.film}-${randomUUID().slice(0,8)}`);await mkdir(backupDir);
  for(const name of names)if(oldFiles.get(name))await copyFile(path.join(demo,name),path.join(backupDir,name));
  await writeFile(path.join(backupDir,'backup.json'),JSON.stringify({film:o.film,version:o.version,files:names.filter(n=>oldFiles.get(n)),createdAt:new Date().toISOString()},null,2)+'\n');
  // Same-filesystem rename is atomic per file. Manifest is the final commit marker.
  for(const name of names){await rename(path.join(stage,name),path.join(demo,name));replaced.push(name);}
  return {status:'prepared',film:o.film,entry,backupDirectory:backupDir,uploaded:false};
 }catch(error){
  const failures=[];
  for(const name of replaced.reverse())try{
   const target=path.join(demo,name);
   if(oldFiles.get(name)){const restore=path.join(stage,`restore-${name}`);await copyFile(path.join(backupDir,name),restore);await rename(restore,target);}else await rm(target,{force:true});
  }catch(e){failures.push(`${name}: ${e.message}`);}
  if(failures.length)throw Error(`${error.message}; rollback incomplete: ${failures.join('; ')}. Backups: ${backupDir}`);
  throw error;
 }finally{
  if(lock){await lock.close();await rm(lockPath,{force:true});}
  await rm(stage,{recursive:true,force:true});
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await prepareDemo(parseArgs(process.argv.slice(2))),null,2));}
 catch(error){console.error(`prepare-demo: ${error.message}`);process.exitCode=1;}
}
