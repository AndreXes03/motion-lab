import path from 'node:path';
const bool = (v, name, fallback) => {
  if (v === undefined) return fallback;
  if ([true, 'on', 'true'].includes(v)) return true;
  if ([false, 'off', 'false'].includes(v)) return false;
  throw Error(`${name} must be on or off`);
};
const numeric = (v, name, fallback, min, max, integer=false) => {
  const n = v === undefined ? fallback : Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw Error(`Invalid ${name}`);
  return n;
};
export const supportedScenes = ['pulse','loop'];
export const adaptations = [
  'Validated Cycles translation: PULSE and LOOP. Materials, light units and Filmic color response are adapted.',
  'Custom GLSL, hemisphere ambient lights, per-material environment maps, screen-space reflectors/contact shadows, fisheye, bloom, AO and depth-of-field postprocessing are not transferred.',
  'PULSE LED instance color and emission are explicitly translated. Basic labels use an unlit emission material.',
  'Display finish applies the shared color contrast and saturation after Filmic; raw finish skips them. PULSE exposure uses sceneControls.exposure; look.post.exposure is not consumed by the PULSE adapter.',
  'LOOP combines native Canvas graphics with Cycles geometry, area/spot lights and physical lens depth of field. Browser post effects are not reproduced.',
  'Procedural sound uses the current runtime sampleMotion and sound-design engine; an explicit audio source takes precedence.',
  'Animation groups, rates and numeric parameter tracks are baked at absolute time; geometry/texture changes update once per output frame, so deformation/texture motion blur is not supported.',
];
export function normalizeCyclesOptions(input={}, snapshot={}) {
  const command=input.command??snapshot.command??'frame';
  if (!['frame','export','preview'].includes(command)) throw Error('Cycles supports frame, preview or export');
  const saved=snapshot.settings??{}, parameters=structuredClone(snapshot.parameters??{});
  if (input.parameters) Object.assign(parameters,typeof input.parameters==='string'?JSON.parse(input.parameters):input.parameters);
  const scene=input.scene??parameters.scene??snapshot.config?.scene??'pulse';
  if(!supportedScenes.includes(scene)) throw Error(`Cycles has a validated adapter for PULSE and LOOP; ${scene} is unsupported`);
  parameters.scene=scene; delete parameters.previewQuality;
  // Raster-only review controls are not the output rendering mode.
  delete parameters.review; delete parameters.renderSample;
  const width=numeric(input.width??saved.width??snapshot.width,'width',1920,64,4096,true), height=numeric(input.height??saved.height??snapshot.height,'height',1080,64,4096,true);
  if (command!=='frame'&&(width%2||height%2)) throw Error('MP4 dimensions must be even');
  const fps=numeric(input.fps??saved.fps??snapshot.fps,'fps',30,1,120,true);
  const sceneDuration=scene==='loop'?22:13.9, start=numeric(input.start??snapshot.start,'start',0,0,sceneDuration);
  const duration=numeric(input.duration??(input.end!==undefined?Number(input.end)-start:undefined)??(snapshot.end!==undefined?snapshot.end-start:undefined),'duration',sceneDuration-start,1/fps,sceneDuration-start);
  const time=numeric(input.time??snapshot.time,'time',0,0,sceneDuration);
  const device=input.device??saved.device??'auto';
  if(!['auto','metal','gpu','cpu'].includes(device))throw Error('device must be auto, metal or cpu');
  const workers=numeric(input.workers==='auto'?1:input.workers??saved.workers,'workers',1,1,2,true);
  const composite=input.composite??saved.composite??'none';if(!['none','titles'].includes(composite))throw Error('composite must be none or titles');
  const finish=input.finish??saved.finish??'display';if(!['raw','display'].includes(finish))throw Error('finish must be raw or display');
  const background=input.background??saved.background??'scene';if(!['scene','transparent'].includes(background))throw Error('background must be scene or transparent');
  const sequenceOnly=bool(input['sequence-only']??saved.sequenceOnly,'sequence only',false);if(sequenceOnly&&command==='frame')throw Error('sequence-only is for video passes');
  if(background==='transparent'&&command!=='frame'&&!sequenceOnly)throw Error('MP4 cannot retain alpha. Use --sequence-only on --out pass.json for a transparent RGBA PNG pass.');
  const progressive=bool(input.progressive,'progressive',false);if(progressive&&command!=='frame')throw Error('Progressive rendering is for viewport frames only');
  const out=input.out?path.resolve(input.out):null;
  if(out&&path.extname(out).toLowerCase()!==(command==='frame'?'.png':sequenceOnly?'.json':'.mp4'))throw Error('Output extension must match frame (.png) or video (.mp4)');
  return {version:1,command,scene,sceneDuration,parameters,width,height,fps,start,duration,time,count:command==='frame'?1:Math.ceil(duration*fps-1e-8),samples:numeric(input.samples??saved.cyclesSamples??saved.samples,'samples',96,1,4096,true),bounces:numeric(input.bounces??saved.bounces,'bounces',8,1,32,true),device:device==='gpu'?'metal':device,workers,motionBlur:bool(input['motion-blur']??saved.motionBlur,'motion blur',true),shutter:numeric(input.shutter??saved.shutter,'shutter',.5,0,1),background,finish,sequenceOnly,progressive,denoise:bool(input.denoise??saved.denoise,'denoise',true),resume:bool(input.resume,'resume',false),composite,audio:input.audio?path.resolve(input.audio):null,out};
}
export function parseCyclesArgs(args) {
  const input={command:args[0]};
  for(let i=1;i<args.length;i+=2){if(!args[i]?.startsWith('--')||args[i+1]===undefined)throw Error('Expected --option value');const key=args[i].slice(2);if(!['snapshot','out','scene','width','height','fps','time','start','end','duration','samples','bounces','device','workers','motion-blur','shutter','denoise','resume','composite','audio','finish','background','sequence-only','parameters','blender','progressive'].includes(key))throw Error('Unknown Cycles option '+key);input[key]=args[i+1];}
  if(!input.out)throw Error('--out is required');return input;
}
