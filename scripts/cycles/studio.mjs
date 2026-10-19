import {access,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adaptations,supportedScenes} from './options.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function findBlender(explicit, {env=process.env}={}) {
 const configured=explicit??env.BLENDER_PATH;
 const executable=process.platform==='win32'?'blender.exe':'blender';
 const resolveCandidates=value=>path.isAbsolute(value)||value.includes('/')||value.includes('\\')?[path.resolve(value)]:String(env.PATH??'').split(path.delimiter).filter(Boolean).map(folder=>path.resolve(folder,value));
 const candidates=configured?resolveCandidates(configured):[
  ...resolveCandidates(executable),'/Applications/Blender.app/Contents/MacOS/Blender','/usr/bin/blender','/usr/local/bin/blender',
 ];
 for(const candidate of new Set(candidates)){
  try{await access(candidate,constants.X_OK);if((await stat(candidate)).isFile())return candidate;}catch{}
 }
 if(configured)throw Error('Configured Blender executable is unavailable or not executable: '+configured);
 throw Error('Install Blender locally or set BLENDER_PATH. Cycles is optional and is not installed by Motion Lab.');
}
export async function getCyclesCapabilities({root=ROOT,blenderPath}={}) {
 try{
  const executable=await findBlender(blenderPath);
  const details=await new Promise((resolve,reject)=>{
   const child=spawn(executable,['--background','--factory-startup','--python-exit-code','1','--python',path.join(ROOT,'scripts/cycles/probe.py')],{cwd:root});let output='',errors='';
   const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Blender device probe timed out'));},20000);
   child.stdout.on('data',d=>output=(output+d).slice(-64000));child.stderr.on('data',d=>errors=(errors+d).slice(-64000));
   child.on('error',e=>{clearTimeout(timer);reject(e);});
   child.on('close',code=>{
    clearTimeout(timer);
    try{
     const row=output.split('\n').find(x=>x.startsWith('MOTION_CYCLES '));
     if(code!==0||!row)throw Error(errors.slice(-1000)||output.slice(-1000)||'Blender device probe failed');
     const value=JSON.parse(row.slice(14));
     if(!Array.isArray(value.devices)||typeof value.version!=='string'||value.devices.some(d=>!d||typeof d.type!=='string'||typeof d.name!=='string'))throw Error('Invalid Blender device probe response');
     resolve(value);
    }catch(error){reject(error);}
   });
  });
  const backend=['METAL','OPTIX','CUDA','HIP','ONEAPI'].find(type=>details.devices.some(d=>d.type===type))??'CPU';
  return {available:true,path:executable,...details,device:backend,scenes:supportedScenes,limits:{workers:2,samples:4096},adaptations};
 }catch(error){return {available:false,scenes:supportedScenes,reason:error.message,adaptations};}
}
export const probeCycles=getCyclesCapabilities;
export function buildCyclesCommand({kind,snapshotPath,outputPath,settings={},root=ROOT}) {
 if(!['frame','preview','export'].includes(kind))throw Error('Unsupported Cycles job kind');
 const args=[path.join(root,'scripts/cycles.mjs'),kind,'--snapshot',snapshotPath,'--out',outputPath];
 const map={width:'width',height:'height',fps:'fps',cyclesSamples:'samples',samples:'samples',bounces:'bounces',device:'device',workers:'workers',motionBlur:'motion-blur',shutter:'shutter',denoise:'denoise',composite:'composite',resume:'resume',background:'background',finish:'finish',sequenceOnly:'sequence-only',progressive:'progressive'};
 for(const [field,flag] of Object.entries(map))if(settings[field]!==undefined)args.push('--'+flag,typeof settings[field]==='boolean'?(settings[field]?'on':'off'):String(settings[field]));
 return {command:process.execPath,args,cwd:root};
}
