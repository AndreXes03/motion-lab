import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {renderSoundtrack,sliceSoundtrack} from '../music-assets.mjs';
/** Use exactly the source snapshot's runtime telemetry; prevent its initial raster preview. */
export async function sampleRuntimeSound(page,parameters){
 return page.evaluate(async parameters=>{
  const T=await import('/node_modules/three/build/three.module.js');const original=T.WebGLRenderer.prototype.render;T.WebGLRenderer.prototype.render=()=>{};
  try{const canvas=document.createElement('canvas');canvas.getContext('2d').drawImage=()=>{};const {createRuntime}=await import('/src/engine/runtime.js');const runtime=createRuntime(canvas,{initialScene:parameters.scene});await runtime.ready;return runtime.sampleMotion(parameters);}
  finally{T.WebGLRenderer.prototype.render=original;}
 },parameters);
}
export async function renderProceduralAudio({frozenRoot,telemetryPath,destination,parameters,start=0,duration}){
 const engine=await import(pathToFileURL(path.join(frozenRoot,'src/engine/sound-design.js')).href);
 const {encodeWav}=engine;
 const telemetry=JSON.parse(await readFile(telemetryPath,'utf8'));const result=await renderSoundtrack({root:frozenRoot,telemetry,parameters,engine}),plan=result.plan;const channels=sliceSoundtrack(result,{start,duration:duration??result.channels[0].length/result.sampleRate-start});await writeFile(destination,encodeWav(channels,result.sampleRate));
 return {path:destination,kind:parameters.music?'imported-music-and-effects':'procedural',sampleRate:result.sampleRate,channels:result.channels.length,duration:channels[0].length/result.sampleRate,sourceStart:start,events:plan.events.length,telemetrySource:'runtime.sampleMotion',settings:plan.settings};
}
