#!/usr/bin/env node
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let server,browser;
try{
 server=await createServer({root:ROOT,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.qa={webglCalls:0,widthWrites:0,heightWrites:0};
  const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')window.qa.webglCalls++;return context.call(this,type,...args);};
  for(const key of ['width','height']){const original=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(HTMLCanvasElement.prototype,key,{...original,set(v){if(this.id==='renderCanvas')window.qa[key+'Writes']++;return original.set.call(this,v);}});}
 });
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?scene=procedural&render=1`);await page.waitForFunction(()=>window.motion?.ready);await page.evaluate(()=>window.motion.ready);await page.locator('.preview-options>summary').click();await page.locator('#preview-quality').selectOption('sharp');await page.locator('.preview-options>summary').click();await page.evaluate(()=>window.motionPreview.whenIdle());
 const tests=await page.evaluate(()=>{
  const tests=[];function assert(ok,text){if(!ok)throw new Error(text);}function test(name,fn){try{const detail=fn();tests.push({name,passed:true,...detail});}catch(e){tests.push({name,passed:false,error:e.message});}}
  const canvas=document.querySelector('#renderCanvas');function hash(){let h=2166136261;for(const v of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)h=Math.imul(h^v,16777619);return (h>>>0).toString(16);}
  const opts=scene=>({width:480,height:270,parameters:{scene}});
  test('procedural startup creates no WebGL context and Sharp uses 960 preview',()=>{assert(window.qa.webglCalls===0,'2D-only startup initialized WebGL');assert(canvas.width===960&&canvas.height===540,'Sharp desktop preview must be 960x540');return {webglCalls:window.qa.webglCalls};});
  test('same-size procedural frames never reset output canvas',()=>{window.motion.render(.5,opts('procedural'));const before={...window.qa};window.motion.render(1,opts('procedural'));window.motion.render(2,opts('procedural'));assert(window.qa.widthWrites===before.widthWrites&&window.qa.heightWrites===before.heightWrites,'Canvas resized on a same-size frame');});
  test('2D to 3D to 2D restores identical procedural pixels',()=>{window.motion.render(2.35,opts('procedural'));const first=hash();window.motion.render(1,opts('objects'));assert(window.qa.webglCalls>0,'3D transition did not initialize renderer');window.motion.render(2.35,opts('procedural'));assert(hash()===first,'2D pixels changed after 3D transition');return {hash:first};});
  test('3D to 2D to 3D restores identical scene pixels',()=>{window.motion.render(3.3,opts('objects'));const first=hash();window.motion.render(8,opts('procedural'));window.motion.render(3.3,opts('objects'));assert(hash()===first,'3D pixels changed after 2D transition');return {hash:first};});
  test('diagnostic clay and normal views restore beauty after scene switch',()=>{window.motion.render(3.3,opts('objects'));const first=hash();for(const review of ['clay','normals']){window.motion.render(3.3,{...opts('objects'),parameters:{scene:'objects',review}});assert(hash()!==first,review+' diagnostic had no effect');window.motion.render(8,opts('procedural'));window.motion.render(3.3,opts('objects'));assert(hash()===first,'Beauty changed after '+review+'/switch');}});
  return tests;
 });
 await page.evaluate(()=>{window.qa.playback=[];const original=window.motion.render;window.motion.render=(time,opts)=>{window.qa.playback.push({now:performance.now(),width:opts?.width,height:opts?.height});return original(time,opts);};});
 await page.locator('#play').click();await page.waitForTimeout(1200);await page.locator('#play').click();
 const playback=await page.evaluate(()=>window.qa.playback);const span=playback.length>1?(playback.at(-1).now-playback[0].now)/1000:0;const rate=span?(playback.length-1)/span:0;
 tests.push({name:'Sharp desktop playback capped at 30fps with 960x540 frames',passed:playback.length>5&&rate<=31.5&&playback.every(f=>f.width===960&&f.height===540),frames:playback.length,measuredFramesPerSecond:rate});
 tests.push({name:'no uncaught browser errors',passed:errors.length===0,errors});
 const report={passed:tests.every(t=>t.passed),tests,note:'Technical runtime checks, not visual approval.'};const output=path.join(ROOT,'renders/studio-runtime-tests.json');await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({type:'tests',path:output,...report}));if(!report.passed)process.exitCode=1;
}catch(error){console.log(JSON.stringify({type:'error',message:error.message}));process.exitCode=1;}finally{await browser?.close();await server?.close();}
