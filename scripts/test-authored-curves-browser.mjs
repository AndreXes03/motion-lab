import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const openAdvanced=async page=>{await page.locator('#experience-pro').click();const retime=page.locator('#motion-view-retime');if(await retime.isVisible())await retime.click();const detail=page.locator('#motion-advanced');if(!await detail.evaluate(node=>node.open))await detail.locator(':scope > summary').click();};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4194/?scene=procedural&render=1');await page.waitForFunction(()=>window.motionPreview&&window.motion?.ready);await page.evaluate(()=>window.motion.ready);await page.locator('#preview-quality').selectOption('sharp');
 const idle=()=>page.evaluate(()=>window.motionPreview.whenIdle());
 const recipe=async()=>{await idle();await page.locator('#experience-pro').click();await page.locator('#tab-code').click();return JSON.parse(await page.locator('#code-content').textContent());};
 const hash=()=>page.locator('#renderCanvas').evaluate(c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return h>>>0;});
 const scenes=await page.evaluate(async()=>{const{sceneIds}=await import('/src/scene-registry.js');return sceneIds;});
 const results=[];
 for(const scene of scenes){
  await page.locator('#scene').selectOption(scene);await idle();const before=await recipe();assert.equal(before.parameters.animation,undefined);
  await page.locator('#seek').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});await idle();const beforeHash=await hash();
  await page.locator('#tab-motion').click();await page.locator('#motion-view-original').click();assert.equal(await page.locator('#motion-view-original').getAttribute('aria-pressed'),'true');
  const groups=await page.locator('#motion-control option').evaluateAll(options=>options.map(option=>({id:option.value,label:option.textContent})));
  for(const group of groups){
   const started=Date.now();
   await page.locator('#motion-control').selectOption(group.id);
   await page.waitForFunction(()=>document.getElementById('motion-native-section').dataset.loading==='false');await idle();
   const data=await page.locator('#motion-native-section').evaluate(section=>({status:section.querySelector('#motion-native-status').textContent,tracks:section.querySelector('#motion-native-track').options.length,points:section.querySelector('#motion-native-graph polyline')?.getAttribute('points'),nativeKeys:section.querySelectorAll('.motion-native-key').length,source:section.querySelector('#motion-native-graph').dataset.source,editable:section.querySelector('#motion-native-graph').dataset.editable}));
   if(scene==='procedural'||['pop/group:lettering','dot/group:character','replay/group:cards'].includes(scene+'/'+group.id)){assert.equal(data.tracks,0);assert.ok(data.status.includes('No source channel'));
   }else{assert.ok(data.tracks>0,scene+'/'+group.id+' tracks');if(data.source==='keys'){assert.ok(data.nativeKeys>0,scene+'/'+group.id+' source key list');assert.equal(data.editable,'true');}else{assert.equal(data.nativeKeys,0,'Samples must not be presented as editable source keys');assert.equal(data.editable,'false');assert.ok(data.status.includes('read only'));}assert.ok(data.points?.split(' ').length>=2,scene+'/'+group.id+' curve');assert.ok(data.points.split(' ').every(point=>point.split(',').every(value=>Number.isFinite(Number(value)))),scene+'/'+group.id+' finite curve');}
   assert.equal(await page.locator('.motion-key').count(),2,scene+'/'+group.id+' timing reference pair');
   results.push({scene,group:group.id,tracks:data.tracks,nativeKeys:data.nativeKeys,status:data.status,inspectionMs:Date.now()-started,passed:true});
  }
  const after=await recipe();assert.deepEqual(after.parameters,before.parameters,scene+' inspection must not edit recipe');assert.equal(await hash(),beforeHash,scene+' inspection must restore original pixels');
 }
 await page.locator('#scene').selectOption('bax');await idle();const untouched=await recipe();await page.locator('#tab-motion').click();await page.locator('#motion-view-retime').click();
 const chosenWindow=await page.locator('#motion-window').inputValue(),referenceText=await page.locator('.motion-key').allTextContents();
 await page.locator('#seek').evaluate(input=>{input.value='96';input.dispatchEvent(new Event('input',{bubbles:true}));});await idle();
 assert.equal(await page.locator('#motion-window').inputValue(),chosenWindow);assert.deepEqual(await page.locator('.motion-key').allTextContents(),referenceText);
 await page.locator('.motion-key').last().click();await idle();assert.equal(await page.locator('#motion-window').inputValue(),chosenWindow);
 assert.equal((await recipe()).parameters.animation,undefined);await page.locator('#tab-motion').click();
 await page.locator('.motion-key').first().click();await openAdvanced(page);await page.locator('#motion-key-ease').selectOption('bezier');
 for(const[i,value]of[.42,0,.58,1].entries())await page.locator('#motion-bezier-'+i).fill(String(value));await page.locator('#motion-save-key').click();
 const edited=await recipe();assert.equal(edited.parameters.animation.groups.camera.start,0);assert.equal(edited.parameters.animation.groups.camera.end,2.2);assert.equal(edited.parameters.animation.groups.camera.keys.length,2);assert.equal(edited.parameters.animation.groups.camera.keys[0].ease,'bezier');assert.equal(edited.parameters.animation.groups.camera.keys[1].ease,'linear');assert.deepEqual(edited.parameters.motion,untouched.parameters.motion);assert.equal(edited.parameters.scene,'bax');
 assert.deepEqual(errors,[]);const report={passed:true,groups:results,defaultRecipesAndPixelsUnchanged:true,virtualKeyEditCopiesOnce:true,chosenClipFrozenAcrossCuts:true,nativeSourceUnchanged:true,errors,note:'Original motion is the default. BAX source keys are editable; evaluated function paths remain read-only. Retiming is an explicit separate mode and does not replace source keys.'};
 const output=new URL('../outputs/adaptive-controls-draft/',import.meta.url);await mkdir(output,{recursive:true});await writeFile(new URL('authored-curves-browser-checks.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
