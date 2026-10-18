import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {ROOT} from './project-store.mjs';
await mkdir(path.join(ROOT,'outputs'),{recursive:true});
const mime={'.html':'text/html','.svg':'image/svg+xml','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname);let file;
 if(name.startsWith('/motion-lab/studio/'))file=path.join(ROOT,'dist',name.slice(19)||'index.html');
 else if(name.startsWith('/motion-lab/demo/'))file=path.join(ROOT,'demo',name.slice(17));
 else if(name==='/motion-lab/')file=path.join(ROOT,'showcase/index.html');
 else if(['/motion-lab/site.js','/motion-lab/site.css'].includes(name))file=path.join(ROOT,'showcase',path.basename(name));
 else throw Error('not found');
 const info=await stat(file);if(!info.isFile())throw Error('not found');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',info.size);createReadStream(file).pipe(res);
 }catch{res.statusCode=404;res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/motion-lab/`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],apiCalls=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiCalls.push(r.url());});
try{
 await page.goto(base);await page.locator('.hero-film-poster').waitFor();await page.locator('.ui-shot img').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.ui-shot img').complete&&document.querySelector('.ui-shot img').naturalWidth>0);const shot=await page.locator('.ui-shot img').first().boundingBox();const ratio=await page.locator('.ui-shot img').first().evaluate(img=>img.naturalWidth/img.naturalHeight);assert.ok(Math.abs(shot.width/shot.height-ratio)<.02,'UI screenshots must retain the full source aspect ratio');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(ROOT,'outputs/public-home-desktop.png'),fullPage:false});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#workflow').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(ROOT,'outputs/public-workflow-desktop.png')});
 await page.locator('#film-camera').click();assert.match(await page.locator('#film-download').getAttribute('href'),/camera-1080/);
 const scriptFiles=new Set();page.on('response',response=>{if(new URL(response.url()).pathname.endsWith('.js')&&response.ok())scriptFiles.add(new URL(response.url()).pathname);});
 await page.goto(base+'studio/?scene=pulse&panel=code');await page.waitForFunction(()=>window.motionPreview);await page.evaluate(()=>window.motionPreview.whenIdle());
 assert.equal(await page.locator('#scene').inputValue(),'starter','Public links always enter the small trial scene');assert.equal(await page.locator('#scene option').count(),1);
 await page.waitForFunction(()=>Number(document.getElementById('seek').value)>0);await page.locator('#play').click();
 assert.equal(await page.locator('#control-energy').count(),1);assert.equal(await page.locator('#control-cameraTravel').count(),1);
 assert.equal(await page.locator('body').getAttribute('data-experience'),'easy');assert.equal(await page.locator('#tab-code').isVisible(),false);assert.equal(await page.locator('#export-settings').isVisible(),false);
 assert.match(await page.locator('.demo-notice').textContent(),/Pro tools.*desktop download/);assert.match(await page.locator('.demo-header-download').getAttribute('href'),/archive\/refs\/heads\/main.zip/);
 await page.locator('#experience-pro').click();assert.equal(await page.locator('#demo-pro-dialog').evaluate(node=>node.open),true);assert.equal(await page.locator('body').getAttribute('data-experience'),'easy');await page.locator('.demo-pro-close').click();
 const probe=await page.evaluate(()=>{const first=window.motion.render(0),a=document.getElementById('renderCanvas').toDataURL();window.motion.render(6);const b=document.getElementById('renderCanvas').toDataURL();window.motion.render(1.5);const c=document.getElementById('renderCanvas').toDataURL();return {calls:first.drawCalls,triangles:first.triangles,loop:a===b,moves:a!==c};});
 assert.ok(probe.calls<=24&&probe.triangles<25000,'Richer scene must retain a small geometry/draw budget');assert.ok(probe.loop,'Default sculpture must loop seamlessly');assert.ok(probe.moves,'The sculpture must visibly change pose');
 await page.getByRole('button',{name:'Candy',exact:true}).click();await page.evaluate(()=>window.motionPreview.whenIdle());const candy=await page.locator('#renderCanvas').evaluate(canvas=>canvas.toDataURL());await page.getByRole('button',{name:'Electric',exact:true}).click();await page.evaluate(()=>window.motionPreview.whenIdle());assert.notEqual(await page.locator('#renderCanvas').evaluate(canvas=>canvas.toDataURL()),candy,'Palettes visibly change the scene');
 const original=await page.locator('#renderCanvas').evaluate(canvas=>canvas.toDataURL());
 await page.locator('#control-fov-number').fill('80');await page.locator('#control-fov-number').press('Tab');await page.evaluate(()=>window.motionPreview.whenIdle());assert.notEqual(await page.locator('#renderCanvas').evaluate(canvas=>canvas.toDataURL()),original,'Basic controls affect real 3D pixels');
 await page.locator('#undo-edit').click();await page.evaluate(()=>window.motionPreview.whenIdle());assert.equal(await page.locator('#control-fov-number').inputValue(),'65');
 const rect=await page.locator('#seek').boundingBox();await page.mouse.click(rect.x+rect.width*.5,rect.y+rect.height/2);await page.evaluate(()=>window.motionPreview.whenIdle());assert.ok(Number(await page.locator('#seek').inputValue())>60);
 await page.locator('#tab-motion').click();await page.waitForFunction(()=>document.querySelectorAll('.motion-template').length>=2);await page.locator('#motion-template-balanced').click();await page.evaluate(()=>window.motionPreview.whenIdle());assert.equal(await page.locator('#motion-template-balanced').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#motion-source-save').isVisible(),false,'Pro native editing stays in downloaded Studio');
 await page.locator('#tab-look').click();const panel=await page.locator('.direction').boundingBox();assert.ok(panel.width>=300&&panel.x+panel.width<=1441,'Desktop properties must remain fully visible');await page.screenshot({path:path.join(ROOT,'outputs/public-demo-desktop.png')});
 for(const [label,frame]of [['orbit',0],['twist',45],['float',90],['swing',135]]){await page.locator('#seek').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},frame);await page.evaluate(()=>window.motionPreview.whenIdle());await page.screenshot({path:path.join(ROOT,'outputs/demo-'+label+'.png')});}
 const {gzipSync}=await import('node:zlib');let initialScriptGzip=0;for(const url of scriptFiles){const buffer=await (await fetch(base.replace('/motion-lab/','')+url)).arrayBuffer();initialScriptGzip+=gzipSync(Buffer.from(buffer)).length;}
 assert.ok(initialScriptGzip<240000,'Web trial JS including Motion must stay below 240 kB gzip: '+initialScriptGzip);
 assert.equal([...scriptFiles].some(file=>/runtime-|pulse-demo|afterhours-demo/.test(file)),false,'Full desktop scenes must never load in the demo');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.motionPreview.whenIdle());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(ROOT,'outputs/public-demo-mobile.png'),fullPage:true});
 await page.goto(base);await page.screenshot({path:path.join(ROOT,'outputs/public-home-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(apiCalls,[],'Public build must never call a local API');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,publicBasePath:true,lightweight3D:true,initialScriptGzip,desktopProGate:true,downloadLink:true,basicControlsLive:true,sculptureBudget:probe,seamlessLoop:true,colorPalettes:true,undo:true,scrubbing:true,motionTemplates:true,mobile:true,noLocalAPI:true}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
