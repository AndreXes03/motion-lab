import {hasVoiceover,duckGeneratedMusic} from '../../src/engine/voiceover.js';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
/** Use exactly the source snapshot's runtime telemetry; prevent its initial raster preview. */
export async function sampleRuntimeSound(page,parameters){
 return page.evaluate(async parameters=>{
  const T=await import('/node_modules/three/build/three.module.js');const original=T.WebGLRenderer.prototype.render;T.WebGLRenderer.prototype.render=()=>{};
  try{const canvas=document.createElement('canvas');canvas.getContext('2d').drawImage=()=>{};const {createRuntime}=await import('/src/engine/runtime.js');const runtime=createRuntime(canvas,{initialScene:parameters.scene});await runtime.ready;return runtime.sampleMotion(parameters);}
  finally{T.WebGLRenderer.prototype.render=original;}
 },parameters);
}
export async function renderProceduralAudio({frozenRoot,telemetryPath,destination,parameters,start=0,duration}){
 const {planSound,renderSound,encodeWav}=await import(pathToFileURL(path.join(frozenRoot,'src/engine/sound-design.js')).href);
 const telemetry=JSON.parse(await readFile(telemetryPath,'utf8'));const plan=planSound(telemetry,parameters.sound),result=duckGeneratedMusic(renderSound(plan,{stems:hasVoiceover(parameters.audio)}),parameters.audio);const end=duration===undefined?result.channels[0].length:Math.round((start+duration)*result.sampleRate),channels=result.channels.map(c=>c.slice(Math.round(start*result.sampleRate),end));await writeFile(destination,encodeWav(channels,result.sampleRate));
 return {path:destination,kind:'procedural',sampleRate:result.sampleRate,channels:result.channels.length,duration:channels[0].length/result.sampleRate,sourceStart:start,events:plan.events.length,telemetrySource:'runtime.sampleMotion',settings:plan.settings};
}
