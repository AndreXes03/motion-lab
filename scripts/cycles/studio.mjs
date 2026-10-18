import {access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adaptations,supportedScenes} from './options.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function findBlender(explicit) {
 const candidates=[explicit,process.env.BLENDER_PATH,'/Applications/Blender.app/Contents/MacOS/Blender','/usr/bin/blender','/usr/local/bin/blender'].filter(Boolean);
 for(const candidate of candidates){try{await access(candidate);return candidate;}catch{if(candidate===explicit||candidate===process.env.BLENDER_PATH)throw Error('Configured Blender executable is unavailable: '+candidate);}}
 throw Error('Install Blender locally or set BLENDER_PATH. Cycles is optional and is not installed by Motion Lab.');
}
export async function getCyclesCapabilities({root=ROOT,blenderPath}={}) {
 try{
  const executable=await findBlender(blenderPath);
  const details=await new Promise((resolve,reject)=>{const child=spawn(executable,['--background','--factory-startup','--python',path.join(ROOT,'scripts/cycles/probe.py')],{cwd:root});let output='',errors='';const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Blender device probe timed out'));},20000);child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>errors+=d);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);const row=output.split('\n').find(x=>x.startsWith('MOTION_CYCLES '));if(code||!row)reject(Error(errors.slice(-1000)||'Blender device probe failed'));else resolve(JSON.parse(row.slice(14)));});});
  const metal=details.devices.some(d=>d.type==='METAL');
  return {available:true,path:executable,...details,device:metal?'METAL':'CPU',scenes:supportedScenes,limits:{workers:2,samples:4096},adaptations};
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
