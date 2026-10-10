import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const chrome=process.env.CHROME_PATH??(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
const evidenceDir='renders/sound-qa';
await mkdir(evidenceDir,{recursive:true});
const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();let browser;const checks=[];
try{
 browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?render=1`);await page.waitForFunction(()=>document.querySelector('#sound-tools'));await page.evaluate(()=>window.motion.ready);
 const evidence=await page.evaluate(async()=>{
  const {planSound}=await import('/src/engine/sound-design.js');const base={scene:'bax'},r=window.motion;
  r.render(3.3,{width:480,height:270,parameters:base});const before=document.querySelector('#renderCanvas').toDataURL();const motion=r.sampleMotion(base);r.render(3.3,{width:480,height:270,parameters:base});const after=document.querySelector('#renderCanvas').toDataURL();
  const normal=planSound(motion),stopped=planSound(r.sampleMotion({scene:'bax',objectMotion:0}));
  const objects=p=>p.events.filter(e=>e.module==='objects').length;
  return {samePixels:before===after,events:normal.events.length,normalObjects:objects(normal),stoppedObjects:objects(stopped),bpm:normal.bpm};
 });assert(evidence.samePixels);assert(evidence.normalObjects>0);assert.equal(evidence.stoppedObjects,0);checks.push({name:'actual scene telemetry; objects stop with zero energy; unchanged pixels',...evidence});
 await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-label')==='Pause');await page.waitForTimeout(600);await page.locator('#play').click();const paused=await page.locator('#seek').inputValue();assert(Number(paused)>0);await page.waitForTimeout(200);assert.equal(await page.locator('#seek').inputValue(),paused);checks.push({name:'audio playback and pause',frame:paused,status:await page.locator('#sound-status').textContent()});
 await page.locator('#seek').evaluate(el=>{el.value=120;el.dispatchEvent(new Event('input'));});await page.locator('#play').click();await page.waitForTimeout(350);await page.locator('#play').click();assert(Number(await page.locator('#seek').inputValue())>=120);checks.push({name:'seek then resume'});
 await page.locator('#sound-tempo').selectOption('manual');await page.locator('#sound-bpm').fill('128');await page.locator('#sound-bpm').dispatchEvent('change');await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#sound-status').textContent.includes('128 BPM'));await page.locator('#play').click();checks.push({name:'manual BPM rebuild'});
 const download=page.waitForEvent('download');await page.locator('button').filter({hasText:'Download WAV'}).click();assert.equal((await download).suggestedFilename(),'motion-lab-sound-design.wav');checks.push({name:'WAV download'});
 // API validation and persisted version round trip.
 const api=await page.evaluate(async()=>{const {soundDefaults}=await import('/src/engine/sound-design.js');const res=await fetch('/api/studio/versions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'QA sound round trip',parameters:{scene:'bax',sound:{...soundDefaults,bpm:128,tempo:'manual'}}})});const data=await res.json();return {status:res.status,data};});assert.equal(api.status,201,JSON.stringify(api));
 const saved=await page.evaluate(async id=>(await fetch(`/api/studio/versions/${id}`)).json(),api.data.id);assert.equal(saved.snapshot.parameters.sound.bpm,128);checks.push({name:'sound accepted by version API'});
 await page.screenshot({path:`${evidenceDir}/sound-panel.png`,fullPage:true});assert.deepEqual(errors,[]);checks.push({name:'no browser errors'});
 await writeFile(`${evidenceDir}/browser-tests.json`,JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser?.close();await server.close();}
