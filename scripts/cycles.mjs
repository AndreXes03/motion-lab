#!/usr/bin/env node
import {browserLaunchOptions} from './browser-runtime.mjs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access,cp,mkdir,readFile,readdir,writeFile,open,rm,copyFile,symlink,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import sharp from 'sharp';
import {normalizeCyclesOptions,parseCyclesArgs,adaptations} from './cycles/options.mjs';
import {findBlender} from './cycles/studio.mjs';
import {gradePixels} from './cycles/finish.mjs';
import {composeLoopFrame} from './cycles/loop-compose.mjs';
import {sampleRuntimeSound,renderProceduralAudio} from './cycles/audio.mjs';
import {sequenceVideoArgs,assertAudioCoverage} from './cycles/video-encode.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const hash=v=>createHash('sha256').update(v).digest('hex');
const emit=(type,value={})=>console.log(JSON.stringify({type,...value}));
const exists=async p=>{try{await access(p);return true;}catch(e){if(e.code!=='ENOENT')throw e;return false;}};
let browser,server,lockPath,manifestPath,manifest,interrupted=false,ownsLock=false;const children=new Set();
async function updateManifest(patch){Object.assign(manifest,patch);const temp=manifestPath+'.tmp';await writeFile(temp,JSON.stringify(manifest,null,2));await rename(temp,manifestPath);}
async function stop(){interrupted=true;for(const child of children)child.kill('SIGTERM');await browser?.close();await server?.close();}
for(const [signal,code] of [['SIGINT',130],['SIGTERM',143]])process.once(signal,async()=>{await stop();if(manifest)await updateManifest({status:'cancelled',completedAt:new Date().toISOString()});if(ownsLock&&lockPath)await rm(lockPath,{force:true});process.exit(code);});
async function run(program,args,{cwd=ROOT,env=process.env,onEvent}={}){
 return new Promise((resolve,reject)=>{const child=spawn(program,args,{cwd,env});children.add(child);let stdout='',stderr='',pending='';child.stdout.on('data',d=>{stdout=(stdout+d).slice(-64000);pending+=d;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){if(line.startsWith('MOTION_CYCLES ')){try{onEvent?.(JSON.parse(line.slice(14)));}catch(e){child.kill('SIGTERM');reject(e);}}}});child.stderr.on('data',d=>{stderr=(stderr+d).slice(-64000);});child.on('error',reject);child.on('close',code=>{children.delete(child);if(code!==0||interrupted)reject(Error(stderr.slice(-4000)||stdout.slice(-4000)||'Process stopped'));else resolve(stdout);});});
}
async function sourceDigest(directory){const chunks=[];async function visit(relative){for(const entry of (await readdir(path.join(directory,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=path.join(relative,entry.name);if(entry.isDirectory())await visit(name);else if(!entry.isSymbolicLink())chunks.push(name,await readFile(path.join(directory,name)));}}for(const folder of ['src','project','public','scripts/cycles'])if(await exists(path.join(directory,folder)))await visit(folder);for(const name of ['scripts/cycles.mjs','scripts/browser-runtime.mjs','package-lock.json'])chunks.push(name,await readFile(path.join(directory,name)));return hash(Buffer.concat(chunks.map(x=>typeof x==='string'?Buffer.from(x):x)));}
async function freeze(destination){await mkdir(destination,{recursive:true});for(const folder of ['src','project','public','scripts/cycles'])if(await exists(path.join(ROOT,folder)))await cp(path.join(ROOT,folder),path.join(destination,folder),{recursive:true});for(const file of ['package.json','package-lock.json','scripts/cycles.mjs','scripts/browser-runtime.mjs'])await copyFile(path.join(ROOT,file),path.join(destination,file));await symlink(path.join(ROOT,'node_modules'),path.join(destination,'node_modules'),'dir');await writeFile(path.join(destination,'cycles-bake.html'),'<!doctype html><meta charset="utf-8"><title>Motion Lab Cycles bake</title>');}
async function bake(directory,frozen,options){
 for(const folder of ['baked','frames','geometries'])await mkdir(path.join(directory,folder),{recursive:true});
 server=await createServer({root:frozen,configFile:false,cacheDir:path.join(directory,'vite-cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});await server.listen();
 browser=await chromium.launch({...await browserLaunchOptions(),headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('saveBake',async(name,contents)=>{if(!/^(scene\.json|export-report\.json|baked\/snapshot_\d{4,}\.json|geometries\/\d+\.json)$/.test(name))throw Error('Unexpected bake path');await writeFile(path.join(directory,name),contents);});
 await page.exposeFunction('reportBake',value=>emit('progress',value));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/cycles-bake.html`);
 const report=await page.evaluate(async options=>(await import('/scripts/cycles/bake-browser.js')).bakeScene(options),options);
 if(options.command!=='frame'&&!options.audio&&options.parameters.sound?.enabled)await writeFile(path.join(directory,'sound-telemetry.json'),JSON.stringify(await sampleRuntimeSound(page,options.parameters)));
 if(errors.length)throw Error(errors.join('\n'));await browser.close();browser=null;await server.close();server=null;return report;
}
async function validFrame(filename,options){try{const info=await sharp(filename).raw().toBuffer({resolveWithObject:true});return info.info.width===options.width&&info.info.height===options.height&&(options.background!=='transparent'||info.info.channels===4);}catch{return false;}}
async function finishFrames(directory,options,frozen){
 let sequence=path.join(directory,'frames');
 if(options.finish==='display'&&options.scene!=='loop'){
  const {evaluateParameterAnimation}=await import(pathToFileURL(path.join(frozen,'src/engine/parameter-animation.js')).href);
  const looks=Array.from({length:options.count},(_,i)=>evaluateParameterAnimation(options.parameters,options.command==='frame'?options.time:options.start+i/options.fps).look?.post??{});
  if(looks.some(look=>(look.colorContrast??1)!==1||(look.colorSaturation??1)!==1)){
   sequence=path.join(directory,'display');await mkdir(sequence,{recursive:true});
   for(let i=0;i<options.count;i++){const name=`frame-${String(i+1).padStart(6,'0')}.png`,raw=path.join(directory,'frames',name);if((looks[i].colorContrast??1)===1&&(looks[i].colorSaturation??1)===1){await copyFile(raw,path.join(sequence,name));continue;}
    const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});gradePixels(data,looks[i],info.channels);await sharp(data,{raw:info}).png().toFile(path.join(sequence,name));
   }
  }
 }

 // LOOP: composite authored Canvas overlays on the actual Cycles beauty frames.
 if(options.scene==='loop'){
  const base=directory.includes('progressive-')?path.dirname(directory):directory;
  const destination=path.join(directory,'hybrid');await mkdir(destination,{recursive:true});
  for(let i=0;i<options.count;i++){
   const index=options.command==='frame'?1:i*2;
   const snap=JSON.parse(await readFile(path.join(base,'baked',`snapshot_${String(index).padStart(4,'0')}.json`),'utf8'));
   const name=`frame-${String(i+1).padStart(6,'0')}.png`;
   if(snap.graphicOnly){await sharp(Buffer.from(snap.overlay.split(',')[1],'base64')).resize(options.width,options.height).png().toFile(path.join(destination,name));}
   else{const composed=await composeLoopFrame({background:options.background==='transparent'?null:Buffer.from(snap.background.split(',')[1],'base64'),beauty:path.join(sequence,name),overlay:Buffer.from(snap.overlay.split(',')[1],'base64'),glassPanel:snap.glassPanel,width:options.width,height:options.height,optics:{aberrationPx:options.parameters.sceneControls?.renderAberration??1,glowStrength:.035*(options.parameters.sceneControls?.bloomStrength??1),glowRadiusPx:2,glowThreshold:.78}});await writeFile(path.join(destination,name),composed);}
  }
  if(options.finish==='display'){
   const {evaluateParameterAnimation}=await import(pathToFileURL(path.join(frozen,'src/engine/parameter-animation.js')).href);
   for(let i=0;i<options.count;i++){
    const look=evaluateParameterAnimation(options.parameters,options.command==='frame'?options.time:options.start+i/options.fps).look?.post??{};
    if((look.colorContrast??1)===1&&(look.colorSaturation??1)===1)continue;
    const filename=path.join(destination,`frame-${String(i+1).padStart(6,'0')}.png`),{data,info}=await sharp(filename).ensureAlpha().raw().toBuffer({resolveWithObject:true});gradePixels(data,look,info.channels);await sharp(data,{raw:info}).png().toFile(filename+'.tmp');await rename(filename+'.tmp',filename);
   }
  }
  return destination;
 }
 // PULSE crisp titles are rendered independently; this never invokes the Three.js raster pipeline.
 if(options.composite==='titles'){
  const {default:ffmpegExecutable}=await import('ffmpeg-static');
  const alpha="if(lt(t,12.7),0,if(lt(t,13.2),pow((t-12.7)/0.5,2)*(3-2*(t-12.7)/0.5),1))";
  const filter=`drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='MOTION LAB':fontsize=${25*options.height/1080}:fontcolor=0xf4f3df:x=(w-tw)/2:y=${956*options.height/1080}:alpha='${alpha}',drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='OPEN SOURCE. FULL VOLUME.':fontsize=${16*options.height/1080}:fontcolor=0xf4f3df:x=(w-tw)/2:y=${1000*options.height/1080}:alpha='${alpha}'`;
  await mkdir(path.join(directory,'composite'),{recursive:true});
  // Shift ffmpeg timestamps so short ranges/frame proofs retain the film's absolute title clock.
  await run(ffmpegExecutable,['-y','-v','error','-framerate',String(options.fps),'-start_number','1','-i',path.join(sequence,'frame-%06d.png'),'-vf',`setpts=PTS+${options.command==='frame'?options.time:options.start}/TB,${filter},setpts=PTS-STARTPTS`,'-frames:v',String(options.count),path.join(directory,'composite/frame-%06d.png')]);
  return path.join(directory,'composite');
 }
 return sequence;
}
async function main(){
 const input=parseCyclesArgs(process.argv.slice(2));const snapshot=input.snapshot?JSON.parse(await readFile(input.snapshot,'utf8')):{};const options=normalizeCyclesOptions(input,snapshot);const blender=await findBlender(input.blender);
 const directory=options.out+'.cycles';manifestPath=options.out+'.job.json';await mkdir(path.dirname(options.out),{recursive:true});
 if(await exists(options.out)&&!options.resume)throw Error('Output already exists; choose a new --out or matching --resume on');
 const sourceHash=await sourceDigest(ROOT), fingerprint=hash(stable({...options,resume:false,out:null,workers:1,blender,sourceHash}));
 await mkdir(directory,{recursive:true});lockPath=path.join(directory,'lock.json');let lock;
 try{lock=await open(lockPath,'wx');}catch(e){if(e.code!=='EEXIST')throw e;const prior=JSON.parse(await readFile(lockPath,'utf8'));if(!Number.isInteger(prior.pid)||prior.pid<1)throw Error('Invalid existing Cycles lock; inspect output directory');try{process.kill(prior.pid,0);throw Error('Matching output is already rendering');}catch(probe){if(probe.code!=='ESRCH')throw probe;}await rm(lockPath);lock=await open(lockPath,'wx');}
 ownsLock=true;await lock.writeFile(JSON.stringify({pid:process.pid}));await lock.close();
 const recipePath=path.join(directory,'recipe.json');let baked=false;if(options.resume&&await exists(options.out)&&!await exists(recipePath))throw Error('Cannot resume an existing output without its matching Cycles recipe cache');
 if(await exists(recipePath)){const recipe=JSON.parse(await readFile(recipePath,'utf8'));if(!options.resume||recipe.fingerprint!==fingerprint)throw Error('Existing Cycles cache does not match this source and recipe. Choose a fresh output path.');baked=recipe.baked===true;}
 const frozen=path.join(directory,'source');
 manifest={schemaVersion:1,engine:'cycles',status:'running',path:options.out,sourceHash,fingerprint,sourceSnapshot:frozen,settings:options,adaptations,createdAt:new Date().toISOString(),frames:0,total:options.count};await updateManifest({phase:'freezing'});emit('progress',{phase:'freezing',percent:0});
 await writeFile(options.out+'.project.json',JSON.stringify({schemaVersion:2,command:options.command,parameters:options.parameters,settings:{...options},config:{scene:options.scene,duration:options.sceneDuration,width:options.width,height:options.height,fps:options.fps},start:options.start,end:options.start+options.duration,time:options.time},null,2));
 if(!baked){if(await exists(frozen))await rm(frozen,{recursive:true});await freeze(frozen);if(await sourceDigest(frozen)!==sourceHash)throw Error('Scene source changed while freezing; retry using a fresh output path');await writeFile(recipePath,JSON.stringify({fingerprint,baked:false}));await updateManifest({phase:'baking'});const sourceReport=await bake(directory,frozen,options);await updateManifest({sourceReport});await writeFile(recipePath,JSON.stringify({fingerprint,baked:true}));}
 const pending=[];let completed=0;for(let frame=1;frame<=options.count;frame++){if(options.resume&&await validFrame(path.join(directory,'frames',`frame-${String(frame).padStart(6,'0')}.png`),options))completed++;else pending.push(frame);}
 const started=Date.now();await updateManifest({phase:'rendering',frames:completed});
 let manifestWrites=Promise.resolve(),previewWrites=Promise.resolve();
 const publishPreview=async event=>{
  if(!options.progressive||![1,2].includes(event.stage))return;
  const previewDir=path.join(directory,'progressive-'+event.stage);await mkdir(path.join(previewDir,'frames'),{recursive:true});
  await copyFile(path.join(directory,'preview-raw-'+event.stage+'.png'),path.join(previewDir,'frames','frame-000001.png'));
  const sequence=await finishFrames(previewDir,{...options,width:event.width,height:event.height,count:1},frozen);
  const destination=path.join(directory,'preview-stage-'+event.stage+'.png');await copyFile(path.join(sequence,'frame-000001.png'),destination+'.part');await rename(destination+'.part',destination);
  emit('preview',{stage:event.stage,width:event.width,height:event.height,samples:event.samples,phase:'refining',percent:25+event.stage*15});
 };
 const jobs=Array.from({length:Math.min(options.workers,pending.length)},(_,worker)=>pending.filter((_,i)=>i%options.workers===worker));
 await Promise.all(jobs.map((frames,worker)=>run(blender,['--background','--factory-startup','--python',path.join(frozen,'scripts/cycles/render.py')],{cwd:directory,env:{...process.env,MOTION_CYCLES_DIR:directory,MOTION_CYCLES_WORKER:String(worker),MOTION_CYCLES_FRAMES:JSON.stringify(frames)},onEvent:event=>{if(event.type==='preview'){previewWrites=previewWrites.then(()=>publishPreview(event));previewWrites.catch(()=>{});}else if(event.type==='frame'){completed++;emit('frame',{...event,frames:completed,total:options.count,percent:20+Math.floor(completed/options.count*70)});manifestWrites=manifestWrites.then(()=>updateManifest({frames:completed,device:event.device,percent:20+Math.floor(completed/options.count*70)}));}else emit(event.type,event);}})));
 await manifestWrites;await previewWrites;
 for(let frame=1;frame<=options.count;frame++)if(!await validFrame(path.join(directory,'frames',`frame-${String(frame).padStart(6,'0')}.png`),options))throw Error('Incomplete or invalid Cycles frame '+frame);
 await updateManifest({phase:'encoding'});emit('progress',{phase:'encoding',frames:completed,total:options.count,percent:92});const sequence=await finishFrames(directory,options,frozen),temporary=options.out+'.part'+path.extname(options.out);
 let audioPath=options.audio,audioOffset=options.start;
 if(options.command!=='frame'&&!audioPath&&options.parameters.sound?.enabled){
  const audio=await renderProceduralAudio({frozenRoot:frozen,telemetryPath:path.join(directory,'sound-telemetry.json'),destination:path.join(directory,'procedural-sound.wav'),parameters:options.parameters,start:options.start,duration:options.count/options.fps});audioPath=audio.path;audioOffset=0;await updateManifest({audio});
 }else if(audioPath)await updateManifest({audio:{kind:'explicit-source',path:audioPath}});
 if(options.command==='frame')await copyFile(path.join(sequence,'frame-000001.png'),temporary);
 else if(options.sequenceOnly){await writeFile(temporary,JSON.stringify({schemaVersion:1,engine:'cycles',sequence:path.join(sequence,'frame-%06d.png'),startFrame:1,width:options.width,height:options.height,fps:options.fps,frameCount:options.count,alpha:options.background==='transparent',colorSpace:'srgb',finish:options.finish,audio:audioPath,audioStart:audioOffset,adaptations},null,2));}
 else{
  await run(ffmpeg,sequenceVideoArgs({sequence,fps:options.fps,count:options.count,audioPath,audioOffset,out:temporary}));
  const probe=JSON.parse(await run(ffprobe.path,['-v','error','-show_streams','-show_format','-of','json',temporary]));const video=probe.streams.find(s=>s.codec_type==='video');
  if(audioPath){const sourceAudio=JSON.parse(await run(ffprobe.path,['-v','error','-show_streams','-show_format','-of','json',audioPath]));const track=sourceAudio.streams.find(s=>s.codec_type==='audio');const available=Number(track?.duration??sourceAudio.format.duration)-audioOffset;assertAudioCoverage(probe,Math.min(options.count/options.fps,Math.max(0,available)));}
  if(video.width!==options.width||video.height!==options.height||Number(video.nb_frames)!==options.count)throw Error('Encoded Cycles video metadata mismatch');await run(ffmpeg,['-v','error','-i',temporary,'-f','null','-']);await updateManifest({validation:{completeDecode:true,probe}});
 }
 await rename(temporary,options.out);await updateManifest({status:'complete',phase:'complete',frames:options.count,percent:100,renderWallSeconds:(Date.now()-started)/1000,completedAt:new Date().toISOString()});emit('complete',{path:options.out,width:options.width,height:options.height,fps:options.fps,frames:options.count,duration:options.command==='frame'?0:options.count/options.fps,manifestPath,engine:'cycles',adaptations});
}
try{await main();}catch(error){for(const child of children)child.kill('SIGTERM');if(manifest)await updateManifest({status:'error',phase:'error',error:error.message}).catch(()=>{});emit('error',{message:error.message});console.error(error.stack);process.exitCode=1;}finally{await browser?.close();await server?.close();if(ownsLock&&lockPath)await rm(lockPath,{force:true});}
