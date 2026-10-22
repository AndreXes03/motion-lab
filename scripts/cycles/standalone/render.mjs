import path from 'node:path';
import sharp from 'sharp';
import {prepareAdapter,adaptFrame} from './adapter.mjs';
export async function renderNative({directory,options,runtime,pending,run,onEvent}){
 const device=options.device==='auto'?(runtime.devices.some(d=>d.type==='METAL')?'METAL':'CPU'):options.device.toUpperCase();
 if(!runtime.devices.some(d=>d.type===device))throw Error(`Cycles standalone ${device} is unavailable`);
 const adapter=await prepareAdapter(directory);
 for(const frame of pending){
  const stages=options.progressive?[{stage:1,scale:.25,samples:Math.min(4,options.samples)},{stage:2,scale:.5,samples:Math.min(16,options.samples)},{stage:3,scale:1,samples:options.samples}]:[{stage:3,scale:1,samples:options.samples}];
  for(const [stageIndex,stage] of stages.entries()){const settings={...options,width:Math.max(1,Math.round(options.width*stage.scale)),height:Math.max(1,Math.round(options.height*stage.scale)),samples:stage.samples};
   const converted=await adaptFrame(adapter,directory,frame,settings);
   const output=stage.stage===3?path.join(directory,'frames',`frame-${String(frame).padStart(6,'0')}.png`):path.join(directory,`preview-raw-${stage.stage}.png`);
   if(converted.snapshot.graphicOnly)await sharp({create:{width:settings.width,height:settings.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toFile(output);
   else await run(runtime.executable,[converted.file,output,device,String(settings.samples),runtime.color],{cwd:runtime.directory,env:{...process.env,OCIO:runtime.color},onEvent:e=>{if(e.type==='device')onEvent(e);else if(e.type==='progress')onEvent({...e,percent:20+Math.floor(((frame-1)+(stageIndex+e.percent/100)/stages.length)/options.count*70)});}});
   if(stage.stage<3)onEvent({type:'preview',stage:stage.stage,width:settings.width,height:settings.height,samples:settings.samples});
   else onEvent({type:'frame',frame,device,backend:'cycles-standalone',deviceName:runtime.devices.find(d=>d.type===device).name,omitted:converted.omitted});
  }
 }
}
