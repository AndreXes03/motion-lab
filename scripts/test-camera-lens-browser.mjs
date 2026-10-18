import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const output=new URL('../outputs/camera-lens/',import.meta.url);await mkdir(output,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4194/?scene=starter&render=1');await page.waitForFunction(()=>window.motionPreview);await page.evaluate(()=>window.motionPreview.whenIdle());
 assert.equal(await page.locator('#control-cameraDistance').count(),1);assert.equal(await page.locator('#control-keepSubjectSize').isChecked(),true);
 await page.locator('#experience-pro').click();await page.locator('#control-cameraDistance-number').fill('.8');await page.locator('#control-cameraDistance-number').press('Tab');await page.evaluate(()=>window.motionPreview.whenIdle());await page.locator('#tab-code').click();assert.equal(JSON.parse(await page.locator('#code-content').textContent()).parameters.look.camera.distance,.8,'Desktop UI writes a renderable recipe');
 await page.route('**/camera-lens-check.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('http://127.0.0.1:4194/camera-lens-check.html');
 const results=await page.evaluate(async()=>{
  const {createRuntime}=await import('/src/engine/runtime.js'),{resolveParameters}=await import('/src/engine/project-controls.js');
  const results=[];
  for(const [scene,time]of [['objects',2],['starter',2],['pulse',2],['camera',4],['pop',2],['replay',2],['dot',14]]){
   const canvas=document.createElement('canvas'),runtime=createRuntime(canvas,{initialScene:scene});await runtime.ready;
   const base=resolveParameters(scene);base.renderSample={grain:false};const draw=p=>{runtime.render(time,{width:480,height:270,previewQuality:'fast',parameters:p});return {eye:runtime.camera.position.toArray(),fov:runtime.camera.fov,pixels:canvas.toDataURL()};};
   draw(base);const a=draw(base),wide=structuredClone(base);wide.look??={};wide.look.camera??={};
   if(scene==='objects')wide.look.camera.fov=a.fov*1.15;else if(scene==='starter')wide.product.fov=a.fov*1.15;else wide.look.camera.fovScale=1.15;
   const b=draw(wide),unlinked=structuredClone(wide);unlinked.look.camera.keepSubjectSize=false;const c=draw(unlinked);
   const manual=structuredClone(base);manual.look??={};manual.look.camera={...manual.look.camera,distance:.8};const d=draw(manual),reset=draw(base);
   results.push({scene,baseFov:a.fov,wideFov:b.fov,linkedMoved:a.eye.some((v,i)=>Math.abs(v-b.eye[i])>1e-5),freeUnmoved:a.eye.every((v,i)=>Math.abs(v-c.eye[i])<1e-8),manualMoved:a.eye.some((v,i)=>Math.abs(v-d.eye[i])>1e-5),pixelsChanged:a.pixels!==b.pixels,reset:a.pixels===reset.pixels,poseReset:a.eye.every((v,i)=>Math.abs(v-reset.eye[i])<1e-8)&&a.fov===reset.fov});runtime.dispose();
  }
  return results;
 });
 for(const result of results){assert.ok(result.wideFov>result.baseFov,result.scene+' opens the lens');for(const key of ['linkedMoved','freeUnmoved','manualMoved','pixelsChanged','reset','poseReset'])assert.ok(result[key],result.scene+': '+key);}
 await page.evaluate(async()=>{const {createDemoRuntime}=await import('/src/viewer/demo-runtime.js');document.body.replaceChildren();const canvas=document.createElement('canvas');document.body.append(canvas);window.lensDemo={canvas,runtime:createDemoRuntime(canvas)};document.body.style.cssText='margin:0;background:#e3ddff;display:grid;place-items:center;height:100vh';});
 for(const [name,fov,distance,keepSubjectSize]of [['reference',65,1,true],['wide',95,1,true],['wide-free',95,1,false],['closer',95,.8,true]]){
  await page.evaluate(({fov,distance,keepSubjectSize})=>window.lensDemo.runtime.render(1.2,{width:960,height:540,parameters:{product:{fov},look:{camera:{distance,keepSubjectSize}}}}),{fov,distance,keepSubjectSize});
  await page.locator('canvas').screenshot({path:new URL(name+'.png',output).pathname});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,scenes:results,demoComparisons:true}));
}finally{await browser.close();}
