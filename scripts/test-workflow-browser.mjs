import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {getControlCatalog,readControlValue} from '../src/engine/control-catalog.js';
import {getControlPresets,getInterpolationPresets} from '../src/engine/control-presets.js';
import {validateStudioParameters} from './studio-api.mjs';

const openAdvanced=async page=>{await page.locator('#experience-pro').click();const retime=page.locator('#motion-view-retime');if(await retime.isVisible())await retime.click();const detail=page.locator('#motion-advanced');if(!await detail.evaluate(node=>node.open))await detail.locator(':scope > summary').click();};
const output=new URL('../outputs/adaptive-controls-draft/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
const idle=()=>page.evaluate(()=>window.motionPreview.whenIdle());
async function recipe(){await idle();await page.locator('#experience-pro').click();await page.locator('#tab-code').click();return JSON.parse(await page.locator('#code-content').textContent());}
async function mode(value){await page.locator('#preview-quality').selectOption(value);await idle();}
async function seek(time){await page.locator('#seek').evaluate((input,time)=>{input.value=String(time*30);input.dispatchEvent(new Event('input',{bubbles:true}));},time);await idle();}
async function motion(){await page.locator('#experience-pro').click();await page.locator('#tab-motion').click();const retime=page.locator('#motion-view-retime');if(await retime.isVisible())await retime.click();}
async function tools(category){
 const tab=category==='compositing'?'compositing':'look';
 await page.locator(`#tab-${tab}`).click();
 assert.equal(await page.locator(`#inspector-${tab} #workspace-catalog`).count(),1,'The active workspace owns the shared catalog');
 const button=page.locator(`#tool-categories button[data-category="${category}"]`);
 assert.equal(await button.count(),1,`The active workspace exposes ${category}`);
 // The category rail is omitted when the workspace has only one category.
 if(await button.isVisible())await button.click();
 const visibleCategories=await page.locator('#project-controls .control:visible').evaluateAll(nodes=>nodes.map(node=>node.dataset.category));
 assert.ok(visibleCategories.length);assert.ok(visibleCategories.every(value=>value===category));
}
function values(parameters,profile){const catalog=getControlCatalog(parameters.scene);return Object.fromEntries(Object.keys(profile.values).map(id=>[id,readControlValue(catalog.find(control=>control.id===id),parameters)]));}
const pass=(name,details={})=>checks.push({name,passed:true,...details});

try{
 await page.goto('http://127.0.0.1:4194/?scene=bax&render=1');
 await page.waitForFunction(()=>window.motionPreview&&window.motion?.ready);await page.evaluate(()=>window.motion.ready);await mode('sharp');
 const original=await recipe();
 for(const category of ['lights','compositing']){
  const profiles=getControlPresets('bax',category),profile=profiles.find(profile=>profile.id!=='original'&&profile.id!=='clean')??profiles[0];
  assert.ok(profile,'Preset must exist');
  await tools(category);
  const selector=page.locator(`.panel-preset[data-preset-category="${category}"]`).first();
  const before=await recipe();await tools(category);await selector.selectOption(profile.id);const applied=await recipe();
  assert.deepEqual(values(applied.parameters,profile),profile.values);
  assert.equal(applied.config.duration,original.config.duration);assert.deepEqual(applied.parameters.motion,before.parameters.motion);
  await page.locator('#undo-edit').click();assert.deepEqual(values((await recipe()).parameters,profile),values(before.parameters,profile));
  await page.locator('#redo-edit').click();assert.deepEqual(values((await recipe()).parameters,profile),profile.values);
  await tools(category);
  const def=getControlCatalog('bax').find(control=>Object.hasOwn(profile.values,control.id)&&control.type==='range');
  const custom=Number((Math.min(def.max,profile.values[def.id]+def.step*2)).toFixed(8));
  assert.notEqual(custom,profile.values[def.id]);
  await page.locator(`#control-${def.id}-number`).fill(String(custom));await page.locator(`#control-${def.id}-number`).press('Tab');await idle();
  assert.equal(await selector.inputValue(),'');
  const edited=await recipe();assert.equal(readControlValue(def,edited.parameters),custom);
  for(const[id,value]of Object.entries(profile.values))if(id!==def.id)assert.equal(values(edited.parameters,profile)[id],value);
  await page.locator('#undo-edit').click();assert.deepEqual(values((await recipe()).parameters,profile),profile.values);
  pass('Preset batch, one undo/redo and Custom after manual edit',{category,preset:profile.id,controls:Object.keys(profile.values)});
 }

 await page.locator('#scene').selectOption('pop');await idle();
 const film=await recipe(),filmMeta=await page.locator('#timeline-meta').textContent(),maxFrame=await page.locator('#seek').getAttribute('max');
 const cuts=await page.evaluate(p=>window.motion.cutTimes(p),film.parameters);
 await motion();assert.equal(await page.locator('#motion-control').inputValue(),'group:camera');
 assert.equal(film.parameters.animation,undefined);
 await page.locator('#motion-create-curve').click();
 await page.locator('#motion-control').selectOption('group:lettering');await page.locator('#motion-create-curve').click();
 await openAdvanced(page);await page.locator('#motion-new-key').click();await page.locator('#motion-key-time').fill('.8');await page.locator('#motion-key-value').fill('.3');
 const suggested=getInterpolationPresets('pop').find(preset=>preset.bezier);
 await page.locator('#motion-easing-preset').selectOption(suggested.id);
 const preSave=await recipe();assert.equal(preSave.parameters.animation.groups.lettering.keys.length,2);
 await motion();await page.locator('#motion-save-key').click();await page.locator('#motion-rate').fill('2');await page.locator('#motion-rate').press('Tab');
 let animated=await recipe();assert.equal(animated.parameters.animation.groups.lettering.keys.length,3);assert.equal(animated.parameters.animation.groups.lettering.rate,2);assert.equal(animated.parameters.animation.groups.camera.rate,1);
 await motion();await page.locator('#motion-control').selectOption('group:camera');await page.locator('.motion-key').first().click();await openAdvanced(page);await page.locator('#motion-key-ease').selectOption('hold');await page.locator('#motion-save-key').click();
 animated=await recipe();await validateStudioParameters(animated.parameters);
 const clocks=await page.evaluate(async p=>{const{sampleAnimationGroupTime}=await import('/src/engine/animation-groups.js');const full={camera:sampleAnimationGroupTime(p,'camera',1),lettering:sampleAnimationGroupTime(p,'lettering',1)};delete p.animation.groups.camera;return{full,withoutCamera:{camera:sampleAnimationGroupTime(p,'camera',1),lettering:sampleAnimationGroupTime(p,'lettering',1)}};},structuredClone(animated.parameters));
 assert.equal(clocks.full.camera,0);assert.equal(clocks.withoutCamera.camera,1);assert.equal(clocks.full.lettering,clocks.withoutCamera.lettering);assert.notEqual(clocks.full.lettering,1);
  const shotProof=await page.evaluate(async p=>{
   const{createPopDemo}=await import('/src/scenes/pop-demo.js');const{getAnimationGroups}=await import('/src/engine/animation-groups.js');const demo=createPopDemo();
   const times=[1,3,6,8],stage=parameters=>times.map(time=>demo.nodesAt(time,parameters).find(node=>node.id==='pop.word').text);
   const baseline=stage(p);const frozen={start:0,end:10,rate:1,keys:[{t:0,value:0,ease:'linear'},{t:10,value:0,ease:'linear'}]};
   p.animation={version:1,enabled:true,groups:{camera:frozen,lettering:frozen}};
   const windows=getAnimationGroups('pop')[0].windows;
   return{baseline,withFrozenTargets:stage(p),authoredCutTimes:[windows[0].start,...windows.map(window=>window.end)]};
  },structuredClone(film.parameters));
  assert.deepEqual(shotProof.baseline,['PLAY','BASS','MOVE','PLAY']);assert.deepEqual(shotProof.withFrozenTargets,shotProof.baseline);assert.deepEqual(shotProof.authoredCutTimes,[0,2.5,5,7.5,10]);
 assert.deepEqual(await page.evaluate(p=>window.motion.cutTimes(p),animated.parameters),cuts);assert.equal(await page.locator('#timeline-meta').textContent(),filmMeta);assert.equal(await page.locator('#seek').getAttribute('max'),maxFrame);assert.deepEqual(animated.config,film.config);
  pass('Camera and object curves have independent clocks, fixed shot branches and film duration',{clocks,shotProof,runtimeCutMetadata:cuts,duration:animated.config.duration,maxFrame});

 await page.locator('#tab-look').click();await mode('auto');
 await page.evaluate(()=>{
  const render=window.motion.render;window.qaPreviewFrames=[];
  window.motion.render=(time,options)=>{window.qaPreviewFrames.push({time,width:options.width,height:options.height,quality:options.previewQuality});return render(time,options);};
  const input=document.getElementById('control-speed');
  for(let i=0;i<20;i++){input.value=String(.5+i*.05);input.dispatchEvent(new Event('input',{bubbles:true}));}
  input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await idle();const frames=await page.evaluate(()=>window.qaPreviewFrames);
 assert.ok(frames.length>=1&&frames.length<=2,'Twenty synchronous edits should coalesce into one frame plus optional refinement');
 assert.equal((await recipe()).parameters.graphics.speed,1.45);
 pass('Twenty input edits coalesce into at most two preview renders',{frames});

 await mode('sharp');await seek(1);const stable=await recipe();
 assert.equal(await page.locator('#renderCanvas').evaluate(c=>c.width),960);
 await mode('fast');assert.equal(await page.locator('#renderCanvas').evaluate(c=>c.width),384);
 const fast=await recipe();assert.deepEqual(fast.parameters,stable.parameters);assert.deepEqual(fast.exportSettings,stable.exportSettings);assert.deepEqual(fast.config,stable.config);
 await page.locator('#export-settings summary').click();
 await page.locator('#export-resolution').selectOption('2560x1440');await page.locator('#export-fps').selectOption('25');await page.locator('#export-samples').selectOption('4');
  await page.locator('#export-settings summary').click();
 const delivery=await recipe();let renderRequest;
 await page.route('**/api/studio/render',async route=>{renderRequest=route.request().postDataJSON();await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'QA intercepted render request; no render job started.'})});});
 await page.locator('#render-final').click();await page.waitForFunction(()=>document.getElementById('render-status').textContent.includes('QA intercepted'));
 assert.equal(renderRequest.kind,'export');assert.equal(renderRequest.time,1);assert.deepEqual(renderRequest.settings,delivery.exportSettings);assert.deepEqual(renderRequest.parameters,delivery.parameters);
 assert.equal(Object.hasOwn(renderRequest,'previewQuality'),false);assert.equal(Object.hasOwn(renderRequest.parameters,'previewQuality'),false);assert.equal(renderRequest.settings.width,2560);assert.equal(renderRequest.settings.height,1440);assert.equal(renderRequest.settings.fps,25);assert.equal(renderRequest.settings.temporalSamples,4);
 pass('Preview quality changes no recipe values; export payload retains independent delivery settings',{previewWidth:384,exportSettings:renderRequest.settings,renderPolicy:renderRequest.parameters.renderPolicy,jobStarted:false});

 await page.setViewportSize({width:390,height:844});await mode('balanced');
 assert.equal(await page.locator('#renderCanvas').evaluate(c=>c.width),480);
 const mobile=await recipe();assert.deepEqual(mobile.parameters,delivery.parameters);assert.deepEqual(mobile.exportSettings,delivery.exportSettings);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 pass('Mobile preview cap is480 and delivery/recipe settings are preserved');
 await motion();await page.screenshot({path:new URL('mobile-group-workflow.png',output).pathname});
 assert.deepEqual(errors,[]);pass('No uncaught browser errors');
 const report={passed:true,checks,note:'Technical browser checks. The export payload was intercepted; this test does not claim an encoded export or visual approval.'};
 await writeFile(new URL('workflow-browser-checks.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
