import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {sceneIds} from '../src/scene-registry.js';
import {createControlManifest,getControlCatalog} from '../src/engine/control-catalog.js';
import {getAnimationGroups} from '../src/engine/animation-groups.js';
import {validateStudioParameters} from './studio-api.mjs';
const openAdvanced=async page=>{await page.locator('#experience-pro').click();const retime=page.locator('#motion-view-retime');if(await retime.isVisible())await retime.click();const detail=page.locator('#motion-advanced');if(!await detail.evaluate(node=>node.open))await detail.locator(':scope > summary').click();};
const output=new URL('../outputs/adaptive-controls-draft/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
async function idle(){await page.evaluate(()=>window.motionPreview.whenIdle());}
async function recipe(){await idle();await page.locator('#experience-pro').click();await page.locator('#tab-code').click();return JSON.parse(await page.locator('#code-content').textContent());}
try{
 await page.goto('http://127.0.0.1:4194/?scene=procedural&render=1');await page.waitForFunction(()=>window.motion?.ready);await page.evaluate(()=>window.motion.ready);if(await page.locator('.preview-options>summary').isVisible())await page.locator('.preview-options>summary').click();await page.locator('#preview-quality').selectOption('sharp');if(await page.locator('.preview-options>summary').isVisible())await page.locator('.preview-options>summary').click();await idle();
 for(const scene of sceneIds){
  await page.locator('#scene').selectOption(scene);await page.locator('#tab-look').click();
  const manifest=createControlManifest(scene),catalog=getControlCatalog(scene);
  assert.equal(await page.locator('#project-controls .control').count(),manifest.controls.length);
  assert.equal(await page.locator('.catalog-group').count(),manifest.panels.length);
  assert.ok(await page.locator('#project-controls .control:visible').count());
  for(const category of [...new Set(manifest.panels.map(p=>p.category))]){
   const tab=category==='compositing'?'compositing':'look';
   await page.locator(`#tab-${tab}`).click();
   assert.equal(await page.locator(`#inspector-${tab} #workspace-catalog`).count(),1,'The active workspace owns the shared catalog');
   assert.ok(await page.locator(`#tool-categories button[data-category="${category}"]`).count(),JSON.stringify({scene,missingCategory:category,actualCategories:await page.locator('#tool-categories button').evaluateAll(nodes=>nodes.map(node=>node.dataset.category)),errors}));
   // A workspace with one category hides the redundant category rail.
   const categoryButton=page.locator(`#tool-categories button[data-category="${category}"]`);
   if(await categoryButton.isVisible())await categoryButton.click();
   const categories=await page.locator('#project-controls .control:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.category));assert.ok(categories.length);assert.ok(categories.every(c=>c===category));
  }
  await page.locator('#tab-look').click();
  const saved=await recipe();await validateStudioParameters(saved.parameters);assert.deepEqual(saved.parameters.studio.controlManifest,manifest);
  await page.locator('#tab-motion').click();const selectedNumeric=catalog.filter(c=>c.animatable&&manifest.controls.includes(c.id)).map(c=>c.id);
  const options=await page.locator('#motion-control option').evaluateAll(nodes=>nodes.map(n=>n.value));const groupIds=getAnimationGroups(scene).map(g=>'group:'+g.id);assert.deepEqual(options,groupIds);
  await openAdvanced(page);await page.locator('#motion-show-all-tools').check();assert.equal(await page.locator('#motion-control option').count(),groupIds.length+catalog.filter(c=>c.animatable).length);await page.locator('#motion-show-all-tools').uncheck();assert.equal((await recipe()).parameters.animation,undefined);
  if(['dot','pulse','camera','replay'].includes(scene)){
   const def=catalog.find(c=>selectedNumeric.includes(c.id));await page.locator('#tab-motion').click();await openAdvanced(page);await page.locator('#motion-show-all-tools').check();await page.locator('#motion-control').selectOption(def.id);
   await openAdvanced(page);await page.locator('#motion-new-key').click();await page.locator('#motion-key-time').fill('0');await page.locator('#motion-key-value').fill(String(def.min));await page.locator('#motion-save-key').click();
   await openAdvanced(page);await page.locator('#motion-new-key').click();await page.locator('#motion-key-time').fill('2');await page.locator('#motion-key-value').fill(String(def.max));await page.locator('#motion-save-key').click();
   const animated=await recipe();assert.equal(animated.parameters.animation.tracks[def.id].length,2);await validateStudioParameters(animated.parameters);
   await page.locator('#tab-versions').click();const legacy={parameters:{...saved.parameters,studio:{...saved.parameters.studio,controlManifest:{version:1,scene,controls:[]}}}};
   await page.locator('#import-recipe').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await page.waitForFunction(scene=>document.getElementById('scene').value===scene&&document.getElementById('version-status').textContent==='Recipe imported'&&document.getElementById('import-recipe').value==='',scene);const restored=await recipe();assert.deepEqual(restored.parameters.studio.controlManifest,manifest);
  }
  checks.push({scene,selected:manifest.controls.length,available:catalog.length,panels:manifest.panels.length,passed:true});
 }
 await page.locator('#scene').selectOption('pulse');await page.locator('#tab-look').click();await page.locator('#seek').evaluate(el=>{el.value='109';el.dispatchEvent(new Event('input',{bubbles:true}));});await idle();await page.screenshot({path:new URL('pulse-project-tools.png',output).pathname});
 await page.locator('#tool-categories button[data-category="lights"]').click();await page.screenshot({path:new URL('pulse-lights-panel.png',output).pathname});
 await page.setViewportSize({width:390,height:844});await page.locator('#tool-categories').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:new URL('mobile-project-tools.png',output).pathname});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);const report={passed:true,scenes:checks,mobile:'fits viewport',legacyMigration:'passed',errors};await writeFile(new URL('scene-tools-checks.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
