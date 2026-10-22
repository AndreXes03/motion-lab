import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,rm,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';import path from 'node:path';
import {createServer} from 'vite';
import {ROOT,playwright,browserLaunchOptions} from './browser-runtime.mjs';
import {listFeedback,sourceRevision,saveCreativeReview,writeBoard,readBoard} from './creative-store.mjs';
import {creativeCriteria} from '../src/viewer/creative-model.js';
const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-storyboard-'));let server,browser;
try{
 const archive=path.join(root,'source.tar');execFileSync('git',['archive','--format=tar','--output',archive,'HEAD'],{cwd:ROOT});execFileSync('/usr/bin/tar',['-xf',archive,'-C',root]);await rm(archive);await symlink(path.join(ROOT,'node_modules'),path.join(root,'node_modules'),'dir');
 server=await createServer({root,configFile:path.join(root,'vite.config.js'),server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 browser=await playwright().chromium.launch({...await browserLaunchOptions(),headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='http://127.0.0.1:'+server.httpServer.address().port;await page.goto(origin+'/?scene=pop');await page.locator('#story-mode').waitFor({timeout:60000});
 await page.locator('#seek').fill('42');await page.locator('#seek').dispatchEvent('input');await page.evaluate(()=>window.motionPreview.whenIdle());
 await page.locator('#story-mode').click();await page.waitForFunction(()=>document.querySelector('#story-status').textContent.startsWith('Layouts rendered'),{timeout:60000});
 assert.equal(await page.locator('.playback').isVisible(),false);assert.equal(await page.locator('.story-card').count(),4);assert.equal(await page.locator('#story-name').textContent(),'Press play');
 // Regression: the selected frame and thumbnail strip must share one Studio viewport.
 for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:768}]){
  await page.setViewportSize(viewport);
  const geometry=await page.evaluate(()=>{const stage=document.querySelector('.stage-column'),hero=document.querySelector('#story-hero').getBoundingClientRect(),rail=document.querySelector('#story-cards').getBoundingClientRect(),bounds=stage.getBoundingClientRect();return {overflow:stage.scrollHeight-stage.clientHeight,heroHeight:hero.height,heroTop:hero.top,railBottom:rail.bottom,bottom:Math.min(bounds.bottom,innerHeight)};});
  assert.ok(geometry.overflow<=2,`Storyboard must not need vertical scrolling at ${viewport.width}x${viewport.height}: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.heroHeight>=70&&geometry.heroTop>=0&&geometry.railBottom<=geometry.bottom+1,'Preview and scene strip must remain visible together');
 }
 await page.setViewportSize({width:1440,height:900});
 for(const id of ['story-refresh','story-previous','story-comment','story-edit','story-next','creative-review']){assert.ok(await page.locator('#'+id).getAttribute('aria-label'),'Icon actions need accessible names');assert.equal(await page.locator('#'+id+' .studio-icon').count(),1);}
 assert.equal(await page.locator('#frame-feedback').isVisible(),false,'Do not repeat the scene comment action');
 const first=await page.locator('#story-hero').getAttribute('src');assert.match(first,/^data:image\/png;base64,/);assert.ok(first.length>20000);
 await page.locator('#story-next').click();assert.equal(await page.locator('#story-name').textContent(),'Bass you can see');assert.notEqual(await page.locator('#story-hero').getAttribute('src'),first);
 await mkdir(path.join(ROOT,'outputs/storyboard'),{recursive:true});await page.screenshot({path:path.join(ROOT,'outputs/storyboard/board.png'),fullPage:true});
 await page.locator('#story-comment').click();await page.locator('#timed-feedback-save').waitFor();await page.waitForFunction(()=>!document.querySelector('#timed-feedback-save').disabled);await page.locator('#timed-feedback-text').fill('Here the benefit is unclear.');await page.locator('#timed-feedback-save').click();await page.waitForFunction(()=>document.querySelector('#creative-status').textContent.startsWith('Feedback saved'));
 let comments=await listFeedback(root,'pop');assert.equal(comments.length,1);assert.equal(comments[0].shotId,'visible-bass');assert.equal(comments[0].frame,99);assert.equal(comments[0].snapshot.parameters.scene,'pop');
 await page.locator('#creative-close').click();await page.locator('#video-mode').click();assert.equal(await page.locator('.playback').isVisible(),true);assert.equal(Number(await page.locator('#seek').inputValue()),42,'Browsing the storyboard must preserve the video position');
 await page.locator('#seek').fill('90');await page.locator('#seek').dispatchEvent('input');await page.evaluate(()=>window.motionPreview.whenIdle());await page.locator('#frame-feedback').click();await page.waitForFunction(()=>!document.querySelector('#timed-feedback-save').disabled);await page.locator('#timed-feedback-text').fill('Let this headline settle before moving.');await page.locator('#timed-feedback-save').click();await page.waitForFunction(()=>document.querySelector('#creative-status').textContent.startsWith('Feedback saved'));comments=await listFeedback(root,'pop');assert.equal(comments[1].frame,90);assert.equal(comments[1].shotId,null);await page.screenshot({path:path.join(ROOT,'outputs/storyboard/feedback.png')});await page.locator('#creative-close').click();
 await page.locator('#creative-review').click();assert.equal(await page.locator('.review-summary').textContent(),'Not reviewed yet');await page.locator('#creative-close').click();
 const report={version:1,scene:'pop',sourceRevision:await sourceRevision(root),snapshot:comments[1].snapshot,checks:creativeCriteria.map(([id])=>({id,status:'unverified',evidence:'Fixture only; no aesthetic approval claimed.'}))};await saveCreativeReview(root,report);
 await page.locator('#creative-review').click();await page.locator('.review-summary').waitFor();assert.match(await page.locator('.review-summary').textContent(),/matches/);assert.equal(await page.locator('#creative-body article').count(),7);await page.locator('#creative-close').click();
 const board=await readBoard(root,'pop');board.shots[0].name='Meet the player';await writeBoard(root,board);await page.locator('#creative-review').click();await page.locator('.review-summary').waitFor();assert.match(await page.locator('.review-summary').textContent(),/out of date/);await page.locator('#creative-close').click();
 await page.locator('#story-mode').click();await page.waitForFunction(()=>document.querySelector('#story-status').textContent.startsWith('Layouts rendered'),{timeout:60000});await page.locator('.story-card').first().click();assert.equal(await page.locator('#story-name').textContent(),'Meet the player');await page.locator('#story-edit').click();await page.waitForFunction(()=>Number(document.querySelector('#seek').value)===33);assert.equal(await page.locator('.playback').isVisible(),true);
 await page.locator('#frame-feedback').click();await page.waitForFunction(()=>!document.querySelector('#timed-feedback-save').disabled);await page.locator('#timed-feedback-list article').first().getByRole('button',{name:'Delete',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#timed-feedback-list article').length===1);assert.equal((await listFeedback(root)).length,1);await page.locator('#creative-close').click();
 await page.locator('#scene').selectOption('starter');await page.locator('#story-mode').click();await page.locator('#story-empty').waitFor();assert.equal(await page.locator('.story-card').count(),0);assert.equal(await page.locator('#story-empty').isVisible(),true);
 await page.locator('#scene').selectOption('pop');await page.waitForFunction(()=>document.querySelectorAll('.story-card').length===4&&document.querySelector('#story-status').textContent.startsWith('Layouts rendered'));
 await page.setViewportSize({width:390,height:844});
 await page.locator('#story-next').click();await page.locator('#story-next').click();await page.locator('#story-next').click();
 assert.equal(await page.locator('.story-card[aria-current=true]').evaluate(el=>{const card=el.getBoundingClientRect(),rail=el.parentElement.getBoundingClientRect();return card.left>=rail.left-1&&card.right<=rail.right+1;}),true,'Next scene must reveal its thumbnail inside the horizontal strip');
 await page.screenshot({path:path.join(ROOT,'outputs/storyboard/mobile.png'),fullPage:true});assert.equal(await page.locator('#storyboard').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
 // Session endpoint security also covers the newly added write operations.
 const anonymous=await fetch(origin+'/__framevolve_session/feedback',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.example'},body:'{}'});assert.equal(anonymous.status,403);
 assert.deepEqual(errors,[]);console.log('Native storyboard, distinct poses, untouched video position, frame/shot comments, reviewed-source invalidation, empty state, mobile and origin protection passed.');
}finally{await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});}
