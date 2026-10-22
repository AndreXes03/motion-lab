import {access} from 'node:fs/promises';
import {probeNative} from './standalone/runtime.mjs';
import {getCyclesComponentStatus} from './component.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adaptations,supportedScenes} from './options.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function findBlender(explicit) {
 const candidates=[explicit,process.env.BLENDER_PATH,'/Applications/Blender.app/Contents/MacOS/Blender','/usr/bin/blender','/usr/local/bin/blender'].filter(Boolean);
 for(const candidate of candidates){try{await access(candidate);return candidate;}catch{if(candidate===explicit||candidate===process.env.BLENDER_PATH)throw Error('Configured Blender executable is unavailable: '+candidate);}}
 throw Error('Install Blender locally or set BLENDER_PATH. Cycles is optional and is not installed by Motion Lab.');
}
export async function getCyclesCapabilities({root=ROOT}={}) {
 const component = await getCyclesComponentStatus({root});
 try {
  const details = await probeNative();
  const devices = Array.isArray(details.devices) ? details.devices : [];
  const metal = devices.some(device => device.type === 'METAL');
  const development = !!process.env.FRAMEVOLVE_CYCLES_DIR;
  return {available:true, path:details.executable, backend:details.backend, protocol:details.protocol, revision:details.revision,
   devices, device:metal?'METAL':'CPU', scenes: development ? supportedScenes : (details.validatedScenes ?? []), limits:{workers:1,samples:4096}, adaptations,
   experimental:development, developmentOverride:development, component,
   ...(development ? {notice:'Experimental development component. This is not an installed stable release.'} : {})};
 } catch(error) {return {available:false, backend:'cycles-standalone', scenes:[], reason:error.message, adaptations, component};}
}
export const probeCycles=getCyclesCapabilities;
export function buildCyclesCommand({kind,snapshotPath,outputPath,settings={},root=ROOT}) {
 if(!['frame','preview','export'].includes(kind))throw Error('Unsupported Cycles job kind');
 const args=[path.join(root,'scripts/cycles.mjs'),kind,'--snapshot',snapshotPath,'--out',outputPath];
 const map={width:'width',height:'height',fps:'fps',cyclesSamples:'samples',samples:'samples',bounces:'bounces',device:'device',workers:'workers',motionBlur:'motion-blur',shutter:'shutter',denoise:'denoise',composite:'composite',resume:'resume',background:'background',finish:'finish',sequenceOnly:'sequence-only',progressive:'progressive'};
 for(const [field,flag] of Object.entries(map))if(settings[field]!==undefined)args.push('--'+flag,typeof settings[field]==='boolean'?(settings[field]?'on':'off'):String(settings[field]));
 return {command:process.execPath,args,cwd:root};
}
