import assert from 'node:assert/strict';
import {mkdtemp,symlink,rm,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';import path from 'node:path';
import {createServer} from 'vite';
import {ROOT,playwright,browserLaunchOptions} from './browser-runtime.mjs';
import {writeBoard,readBoard} from './creative-store.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-storyboard-'));let server,browser;
try{
 const archive=path.join(root,'source.tar');execFileSync('git',['archive','--format=tar','--output',archive,'HEAD'],{cwd:ROOT});execFileSync('/usr/bin/tar',['-xf',archive,'-C',root]);await rm(archive);await symlink(path.join(ROOT,'node_modules'),path.join(root,'node_modules'),'dir');
 // Test the current focused panel changes even before their source lands in HEAD.
 await copyFile(path.join(ROOT,'src/viewer/storyboard-panel.js'),path.join(root,'src/viewer/storyboard-panel.js'));
 await copyFile(path.join(ROOT,'src/viewer/storyboard-panel.css'),path.join(root,'src/viewer/storyboard-panel.css'));
 server=await createServer({root,configFile:path.join(root,'vite.config.js'),server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 browser=await playwright().chromium.launch({...await browserLaunchOptions(),headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='http://127.0.0.1:'+server.httpServer.address().port;await page.goto(origin+'/?scene=pop');await page.locator('#story-mode').waitFor({timeout:60000});
 await page.setViewportSize({width:945,height:855});
 const modeRow=await page.evaluate(()=>{const rect=id=>document.querySelector(id).getBoundingClientRect(),story=rect('#story-mode'),video=rect('#video-mode'),interactive=rect('#preview-mode-interactive'),render=rect('#preview-mode-render'),quality=rect('#preview-quality'),controls=rect('#preview-controls');return {ys:[story.top,video.top,interactive.top,render.top,quality.top],right:quality.right,controlsRight:controls.right,modeRight:video.right,previewLeft:interactive.left};});
 assert.ok(Math.max(...modeRow.ys)-Math.min(...modeRow.ys)<=2,`Storyboard/Video and preview controls should share one row at 945px: ${JSON.stringify(modeRow)}`);
 assert.ok(modeRow.modeRight<modeRow.previewLeft&&modeRow.right<=modeRow.controlsRight+1,'View mode icons should precede the controls and fit inside their row');
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#seek').fill('42');await page.locator('#seek').dispatchEvent('input');await page.evaluate(()=>window.motionPreview.whenIdle());
 await page.locator('#story-mode').click();await page.waitForFunction(()=>document.querySelector('#story-status').textContent.startsWith('Layouts rendered'),{timeout:60000});
 assert.equal(await page.locator('.playback').isVisible(),false);assert.equal(await page.locator('.story-card').count(),4);assert.equal(await page.locator('#story-name').textContent(),'Press play');
 // Regression: the selected frame and thumbnail strip must share one Studio viewport.
 for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:768},{width:945,height:855}]){
  await page.setViewportSize(viewport);
  const geometry=await page.evaluate(()=>{const stage=document.querySelector('.stage-column'),hero=document.querySelector('#story-hero').getBoundingClientRect(),rail=document.querySelector('#story-cards').getBoundingClientRect(),bounds=stage.getBoundingClientRect();return {overflow:stage.scrollHeight-stage.clientHeight,heroHeight:hero.height,heroTop:hero.top,railBottom:rail.bottom,bottom:Math.min(bounds.bottom,innerHeight)};});
  assert.ok(geometry.overflow<=2,`Storyboard must not need vertical scrolling at ${viewport.width}x${viewport.height}: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.heroHeight>=70&&geometry.heroTop>=0&&geometry.railBottom<=geometry.bottom+1,'Preview and scene strip must remain visible together');
 }
 await page.setViewportSize({width:1440,height:900});
 for(const id of ['story-mode','video-mode','story-refresh','story-previous','story-edit','story-next']){assert.ok(await page.locator('#'+id).getAttribute('aria-label'),'Icon actions need accessible names');assert.equal(await page.locator('#'+id+' .studio-icon').count(),1);}
 for(const id of ['story-comment','frame-feedback','creative-review','creative-close','creative-body','timed-feedback-save'])assert.equal(await page.locator('#'+id).count(),0,`Removed review/comment UI must not expose #${id}`);
 const first=await page.locator('#story-hero').getAttribute('src');assert.match(first,/^data:image\/png;base64,/);assert.ok(first.length>20000);
 await page.locator('#story-next').click();assert.equal(await page.locator('#story-name').textContent(),'Bass you can see');assert.notEqual(await page.locator('#story-hero').getAttribute('src'),first);
 await page.locator('#video-mode').click();assert.equal(await page.locator('.playback').isVisible(),true);assert.equal(Number(await page.locator('#seek').inputValue()),42,'Browsing the storyboard must preserve the video position');
 await page.locator('#seek').fill('90');await page.locator('#seek').dispatchEvent('input');await page.evaluate(()=>window.motionPreview.whenIdle());
 const board=await readBoard(root,'pop');board.shots[0].name='Meet the player';await writeBoard(root,board);
 await page.locator('#story-mode').click();await page.waitForFunction(()=>document.querySelector('#story-status').textContent.startsWith('Layouts rendered'),{timeout:60000});
 await page.locator('.story-card').first().click();assert.equal(await page.locator('#story-name').textContent(),'Meet the player');await page.locator('#story-edit').click();await page.waitForFunction(()=>Number(document.querySelector('#seek').value)===33);assert.equal(await page.locator('.playback').isVisible(),true);
 await page.locator('#scene').selectOption('starter');await page.locator('#story-mode').click();await page.locator('#story-empty').waitFor();assert.equal(await page.locator('.story-card').count(),0);assert.equal(await page.locator('#story-empty').isVisible(),true);
 await page.locator('#scene').selectOption('pop');await page.waitForFunction(()=>document.querySelectorAll('.story-card').length===4&&document.querySelector('#story-status').textContent.startsWith('Layouts rendered'));
 await page.setViewportSize({width:390,height:844});
 await page.locator('#story-next').click();await page.locator('#story-next').click();await page.locator('#story-next').click();
 assert.equal(await page.locator('.story-card[aria-current=true]').evaluate(el=>{const card=el.getBoundingClientRect(),rail=el.parentElement.getBoundingClientRect();return card.left>=rail.left-1&&card.right<=rail.right+1;}),true,'Next scene must reveal its thumbnail inside the horizontal strip');
 assert.equal(await page.locator('#storyboard').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
 // Session endpoint security also covers the newly added write operations.
 const anonymous=await fetch(origin+'/__framevolve_session/feedback',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.example'},body:'{}'});assert.equal(anonymous.status,403);
 assert.deepEqual(errors,[]);console.log('Native storyboard, icon view modes, distinct poses, live agent updates, untouched video position, scene navigation, empty state, mobile and origin protection passed.');
}finally{await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});}
