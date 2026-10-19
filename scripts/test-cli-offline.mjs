import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderCliFrame} from './cli-frame.mjs';
import {withAtomicOutput,writeAtomicOutput} from './atomic-output.mjs';

// Pure/mocked evaluator checks. These do not claim GPU, font, asset decode,
// browser rasterization, or complete encoded-video verification.
const temporalModule = new URL('../src/engine/temporal.js',import.meta.url).href;
const options = {time:.5,width:1,height:1,parameters:{},temporalSamples:2,fps:30,duration:1,temporalModule};
let pixels = new Uint8ClampedArray(4), draws = [], finishes = [], allocations = 0, progress = [];
const ctx = {
  createImageData(w,h) { allocations++; return {data:new Uint8ClampedArray(w*h*4)}; },
  getImageData() { return {data:pixels.slice()}; },
  putImageData(image) { pixels=image.data.slice(); }
};
const canvas = {getContext:()=>ctx,toDataURL:()=>`data:image/png;base64,${Buffer.from(pixels).toString('base64')}`};
const motion = {
  prepare() { throw new Error('The frame evaluator must not prepare assets per sample'); },
  async render(time,{parameters}) { draws.push({time,parameters}); const c=time<.5?0:255; pixels=new Uint8ClampedArray([c,c,c,255]); },
  async finishFrame(_ctx,time,_w,_h,parameters) { finishes.push({time,parameters}); pixels[1]++; }
};
const previousWindow = globalThis.window, previousDocument = globalThis.document;
globalThis.window = {motion,__motionLabProgress:async event=>progress.push(event)};
globalThis.document = {querySelector:()=>canvas};
try {
  await assert.rejects(()=>renderCliFrame({...options,width:0}),/dimensions/);
  await assert.rejects(()=>renderCliFrame({...options,width:1.5}),/dimensions/);
  await assert.rejects(()=>renderCliFrame({...options,width:3840,height:3840}),/dimensions/);
  assert.equal(draws.length,0);
  const first=await renderCliFrame({...options,reportSamples:true});
  assert.deepEqual([...pixels],[188,189,188,255],'Integrate in linear light and finish once');
  assert.equal(finishes.length,1);assert.equal(finishes[0].time,.5);
  assert.ok(draws.every(d=>d.parameters.renderSample.grain===false && d.parameters.renderSample.frameTime===.5 && d.parameters.renderSample.fps===30));
  assert.equal(progress.at(-1).sample,2);
  await renderCliFrame({...options,time:.8});
  assert.equal(await renderCliFrame(options),first,'Random seeking must reproduce the frame');
  assert.equal(allocations,1,'Reuse the full-frame buffers across equal-sized frames');

  draws=[];finishes=[];motion.cutTimes=()=>[.5];
  await renderCliFrame({...options,temporalSamples:8});
  assert.ok(draws.every(d=>d.time>=.5),'A cut starts a new shot');
  assert.equal(finishes.length,1);
  motion.shutterAngleAt=()=>0;draws=[];finishes=[];
  await renderCliFrame(options);
  assert.deepEqual(draws.map(d=>d.time),[.5]);assert.equal(finishes.length,0);
  assert.equal(draws[0].parameters.renderSample.grain,undefined,'Single samples retain runtime finishing');
  delete motion.shutterAngleAt;
  motion.temporalSamplesAt=()=>NaN;draws=[];
  await assert.rejects(()=>renderCliFrame(options),/finite/);assert.equal(draws.length,0);
  delete motion.temporalSamplesAt;
  const finish=motion.finishFrame;delete motion.finishFrame;
  await assert.rejects(()=>renderCliFrame(options),/finishFrame/);assert.equal(draws.length,0);
  motion.finishFrame=finish;
  const render=motion.render;motion.render=async()=>{throw new Error('sample failed');};finishes=[];
  await assert.rejects(()=>renderCliFrame(options),/sample failed/);assert.equal(finishes.length,0);
  motion.render=render;
  assert.equal(await renderCliFrame(options),await renderCliFrame(options),'A failed sample cannot poison the next accumulation');
} finally {
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
}

const directory=await mkdtemp(path.join(os.tmpdir(),'motion-cli-offline-'));
try {
  const target=path.join(directory,'delivery.mp4');
  await writeFile(target,'previous delivery');
  await assert.rejects(()=>withAtomicOutput(target,async staged=>{await writeFile(staged,'partial encode');throw new Error('encoder failed');}),/encoder failed/);
  assert.equal(await readFile(target,'utf8'),'previous delivery');
  assert.deepEqual(await readdir(directory),['delivery.mp4'],'Failure must clean up staging files');
  await writeAtomicOutput(target,'new delivery');assert.equal(await readFile(target,'utf8'),'new delivery');
  assert.deepEqual(await readdir(directory),['delivery.mp4']);
} finally {await rm(directory,{recursive:true,force:true});}
console.log(JSON.stringify({passed:true,mode:'pure/mocked; no browser',checks:['linear temporal integration','random seek','cut boundaries','single finish','buffer reuse','invalid hints','failure recovery','atomic output replacement and cleanup']}));
