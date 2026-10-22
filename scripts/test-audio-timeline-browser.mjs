import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {browserLaunchOptions} from './browser-runtime.mjs';
import {mkdir} from 'node:fs/promises';
import {encodeWav} from '../src/engine/sound-design.js';
const tone=Float32Array.from({length:96000},(_,i)=>.3*Math.sin(i/48000*Math.PI*2*220));
const bytes=Buffer.from(encodeWav([tone,tone]));
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},root:process.cwd(),server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'audio-qa',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/__audio-qa')return next();res.setHeader('Content-Type','text/html');res.end(`<html><body style="background:#12171a;font:13px Arial"><div id="inspector-audio" style="width:340px;margin:20px"></div><script type="module">
import {mountSoundPanel} from '/src/viewer/sound-panel.js';
window.qaTime=0;window.qaEdits=0;const telemetry={duration:4,rate:10,frames:Array.from({length:41},(_,i)=>({time:i/10,camera:{position:[0,0,0],quaternion:[0,0,0,1]},objects:{}})),cuts:[]};
let panel;panel=mountSoundPanel({runtime:{sampleMotion:()=>telemetry},parameters:()=>({scene:'objects',sound:panel.getSettings(),audio:panel.getAudio()}),onPause:()=>{},onChange:()=>window.qaEdits++,getTime:()=>window.qaTime,getDuration:()=>4,onSeek:t=>{window.qaTime=t;panel.refreshTimeline(t);}});
window.qaPanel=panel;panel.setState({scene:'objects',sound:{enabled:false},audio:{version:1,tracks:[{id:'one',assetId:'a'.repeat(64),name:'Fixture tone',enabled:true,sourceStart:.2,timelineStart:.5,duration:1,volume:.5,fadeIn:.1,fadeOut:.2},{id:'two',assetId:'a'.repeat(64),name:'Disabled tone',enabled:false,sourceStart:0,timelineStart:2,duration:1,volume:1,fadeIn:0,fadeOut:0}]}});
</script></body></html>`);});}}]});
await server.listen();let browser;
try{
 browser=await chromium.launch({...await browserLaunchOptions(),headless:true});const page=await browser.newPage({viewport:{width:700,height:1300}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/studio/audio/assets/*/file',route=>route.fulfill({status:200,contentType:'audio/wav',body:bytes}));
 await page.route('**/local-preview/loop-audio.json',route=>route.fulfill({status:404,body:'{}'}));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__audio-qa`);await page.waitForFunction(()=>window.qaPanel&&document.querySelector('.audio-wave-status')?.textContent==='');
 assert.equal(await page.locator('.audio-clip').count(),2);assert.equal(await page.locator('.is-disabled').count(),1);
 const lane=await page.locator('.audio-clip-lane').first().boundingBox(),move=page.locator('.audio-clip-move').first(),box=await move.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+lane.width/8,box.y+box.height/2,{steps:3});await page.mouse.up();
 let audio=await page.evaluate(()=>qaPanel.getAudio());assert.ok(Math.abs(audio.tracks[0].timelineStart-1)<.03);assert.equal(audio.tracks[0].sourceStart,.2);assert.equal(audio.tracks[1].enabled,false);
 await page.locator('.audio-trim-left').first().focus();await page.keyboard.press('ArrowRight');audio=await page.evaluate(()=>qaPanel.getAudio());assert.ok(Math.abs(audio.tracks[0].sourceStart-.3)<.001);assert.ok(Math.abs(audio.tracks[0].duration-.9)<.001);
 await page.locator('.audio-trim-right').first().focus();await page.keyboard.press('ArrowLeft');audio=await page.evaluate(()=>qaPanel.getAudio());assert.ok(Math.abs(audio.tracks[0].duration-.8)<.001);
 const seek=page.getByRole('slider',{name:'Audio timeline playhead'});await seek.fill('2.5');assert.equal(await page.evaluate(()=>qaTime),2.5);assert.equal(await page.locator('.audio-clip-playhead').first().evaluate(el=>el.style.left),'62.5%');
 await page.locator('.audio-clip-details summary').first().click();assert.equal(await page.locator('.audio-clip-details[open] input[type=number]').count(),6);
 const peak=await page.evaluate(async()=>{const p={scene:'objects',sound:qaPanel.getSettings(),audio:qaPanel.getAudio()};const a=await qaPanel.exportBuffer(p);qaPanel.setSettings({...p.sound,master:.4});const b=await qaPanel.exportBuffer({...p,sound:qaPanel.getSettings()});qaPanel.setSettings({...p.sound,muted:true});const c=await qaPanel.exportBuffer({...p,sound:qaPanel.getSettings()});const peak=b=>b.getChannelData(0).reduce((n,x)=>Math.max(n,Math.abs(x)),0);return [a,b,c].map(peak);});assert.ok(peak[0]>.05);assert.ok(Math.abs(peak[1]/peak[0]-.5)<.001);assert.equal(peak[2],0);
 await page.locator('#sound-muted').check();assert.equal(await page.evaluate(()=>qaPanel.getSettings().muted),true);
 await mkdir('outputs/ux-audio',{recursive:true});await page.locator('#sound-tools').screenshot({path:'outputs/ux-audio/audio-timeline.png'});assert.deepEqual(errors,[]);
 console.log('Audio browser passed: waveform, pointer move, keyboard trims, disabled tracks, numeric settings, playhead seek and browser export global gain/mute.');
}finally{await browser?.close();await server.close();}
