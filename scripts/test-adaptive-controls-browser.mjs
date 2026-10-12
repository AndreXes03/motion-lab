import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {validateStudioParameters} from './studio-api.mjs';

const output=new URL('../outputs/adaptive-controls-draft/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu-sandbox']});
const results=[];
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const record=async name=>results.push({name,passed:true});
async function idle(){await page.evaluate(()=>window.motionPreview.whenIdle());}
async function state(){await idle();await page.locator('#tab-code').click();return JSON.parse(await page.locator('#code-content').textContent());}
async function seek(seconds){await page.locator('#seek').evaluate((input,t)=>{input.value=String(t*30);input.dispatchEvent(new Event('input',{bubbles:true}));},seconds);await idle();}
async function addKey(t,value,ease='linear'){await page.locator('#motion-new-key').click();await page.locator('#motion-key-time').fill(String(t));await page.locator('#motion-key-value').fill(String(value));await page.locator('#motion-key-ease').selectOption(ease);await page.locator('#motion-save-key').click();}
async function hash(){return page.locator('#renderCanvas').evaluate(canvas=>{let h=2166136261;for(const v of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)h=Math.imul(h^v,16777619);return h>>>0;});}
try{
 await page.goto('http://127.0.0.1:4194/?scene=procedural&render=1');await page.waitForFunction(()=>window.motion?.ready);await page.evaluate(()=>window.motion.ready);await page.locator('#preview-quality').selectOption('sharp');await idle();
 assert.equal((await state()).parameters.animation,undefined);await record('Viewing the draft does not create animation');
 await page.locator('#tab-motion').click();await page.locator('#motion-show-all-tools').check();await page.locator('#motion-control').selectOption('speed');
 await addKey(0,.5);await addKey(4,2);
 let recipe=await state();assert.equal(recipe.parameters.animation.tracks.speed.length,2);await validateStudioParameters(recipe.parameters);await record('Create and validate two speed keys on a 2D film');
 await page.locator('#undo-edit').click();assert.equal((await state()).parameters.animation.tracks.speed.length,1);
 await page.locator('#redo-edit').click();recipe=await state();assert.equal(recipe.parameters.animation.tracks.speed.length,2);await record('Undo and redo preserve animation tracks');
 await seek(2);const previewHash=await hash();
 const directHash=await page.evaluate(p=>{window.motion.render(2,{width:960,height:540,parameters:p});let h=2166136261;const canvas=document.getElementById('renderCanvas');for(const v of canvas.getContext('2d').getImageData(0,0,960,540).data)h=Math.imul(h^v,16777619);return h>>>0;},recipe.parameters);
 assert.equal(previewHash,directHash);
 await page.evaluate(p=>{delete p.animation;p.graphics.speed=1.25;window.motion.render(2,{width:960,height:540,parameters:p});},structuredClone(recipe.parameters));assert.equal(await hash(),previewHash);await record('Preview matches render evaluation and interpolated speed pixels');
 await page.evaluate(p=>{window.motion.render(8,{width:960,height:540,parameters:p});window.motion.render(2,{width:960,height:540,parameters:p});},recipe.parameters);assert.equal(await hash(),previewHash);await record('Animated seeking is deterministic');
 await page.locator('#tab-motion').click();await page.locator('.motion-key').first().click();await page.locator('#motion-key-ease').selectOption('bezier');
 for(const [i,v]of [.42,0,.58,1].entries())await page.locator('#motion-bezier-'+i).fill(String(v));await page.locator('#motion-save-key').click();recipe=await state();assert.equal(recipe.parameters.animation.tracks.speed[0].ease,'bezier');await record('Custom Bezier is saved in the recipe');
 await writeFile(new URL('procedural-example.project.json',output),JSON.stringify(recipe,null,2));await page.locator('#tab-versions').click();const dlPromise=page.waitForEvent('download');await page.locator('#download-recipe').click();const download=await dlPromise;const downloaded=JSON.parse(await readFile(await download.path(),'utf8'));assert.deepEqual(downloaded.parameters.animation,recipe.parameters.animation);
 await page.locator('#tab-look').click();await page.locator('#reset').click();assert.equal((await state()).parameters.animation,undefined);
 await page.locator('#tab-versions').click();await page.locator('#import-recipe').setInputFiles({name:'adaptive-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(downloaded))});assert.deepEqual((await state()).parameters.animation,recipe.parameters.animation);await record('Recipe download/import and reset round trip animation');
 await page.locator('#tab-motion').click();await seek(2);await page.screenshot({path:new URL('procedural-motion.png',output).pathname});
 await page.setViewportSize({width:390,height:844});await page.locator('#motion-control').evaluate(el=>el.scrollIntoView({block:'start'}));await page.locator('#preview-quality').selectOption('balanced');await idle();assert.equal(await page.locator('#renderCanvas').evaluate(c=>c.width),480);await page.screenshot({path:new URL('mobile-motion-panel.png',output).pathname});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await record('Mobile interface fits the viewport');await page.setViewportSize({width:1440,height:1000});await page.locator('#preview-quality').selectOption('sharp');await idle();
 await page.locator('#scene').selectOption('bax');await page.locator('#tab-look').click();await page.locator('#control-scope').selectOption('all');
 await page.locator('#control-search').fill('Radio X');assert.equal(await page.locator('#project-controls .control:visible').count(),1);await page.locator('#control-search').fill('');
 await page.locator('#tab-motion').click();await page.locator('#motion-show-all-tools').check();await page.locator('#motion-control').selectOption('device.root.x');await addKey(0,-.5);await addKey(4,.5);recipe=await state();await validateStudioParameters(recipe.parameters);assert.equal(recipe.parameters.animation.tracks['device.root.x'].length,2);await writeFile(new URL('bax-example.project.json',output),JSON.stringify(recipe,null,2));await record('3D transforms use real paths and catalog search filters controls');
 await seek(2);const threeHash=await hash();await page.evaluate(p=>{delete p.animation;p.objectEdits['device.root']={x:0};window.motion.render(2,{width:960,height:540,parameters:p});},structuredClone(recipe.parameters));assert.equal(await hash(),threeHash);await record('3D midpoint matches rendered object transform');
 await page.locator('#tab-motion').click();await page.screenshot({path:new URL('bax-motion.png',output).pathname});
 await page.locator('#scene').selectOption('pulse');await page.locator('#tab-motion').click();assert.ok(await page.locator('#motion-control option').count());await record('Existing PULSE film exposes selected animation tools');
 assert.deepEqual(errors,[]);await record('No browser errors');
 await writeFile(new URL('browser-checks.json',output),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results},null,2));
}finally{await browser.close();}
