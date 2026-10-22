import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';import os from 'node:os';
import {createServer} from 'vite';
import {ROOT,playwright,browserLaunchOptions} from './browser-runtime.mjs';
import {liveCommand} from './live-studio.mjs';
import {listCheckpoints} from './session-checkpoints.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-clean-zip-'));let server,browser;
try{
 // Test the committed download contents with no .git or prior user state.
 const archive=path.join(root,'source.tar');execFileSync('git',['archive','--format=tar','--output',archive,'HEAD'],{cwd:ROOT});execFileSync('/usr/bin/tar',['-xf',archive,'-C',root]);await rm(archive);
 await symlink(path.join(ROOT,'node_modules'),path.join(root,'node_modules'),'dir');
 server=await createServer({root,configFile:path.join(root,'vite.config.js'),server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 browser=await playwright().chromium.launch({...await browserLaunchOptions(),headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const origin='http://127.0.0.1:'+server.httpServer.address().port;
 await page.goto(origin+'/?scene=pop');await page.locator('#first-video-open').waitFor({timeout:60000});
 await page.locator('#first-video-open').click();await page.locator('#founder-form button').waitFor();await page.waitForFunction(()=>!document.querySelector('#founder-form button').disabled);
 await page.locator('[name=url]').fill('https://example.com/product');await page.locator('[name=product]').fill('A founder scheduling product');await page.locator('[name=audience]').fill('Small teams');await page.locator('[name=goal]').fill('Book a demo');await page.locator('#founder-form button').click();await page.locator('#founder-ready').waitFor();
 const prompt=await page.locator('#founder-prompt').inputValue();assert.match(prompt,/https:\/\/example.com\/product/);assert.match(prompt,/Book a demo/);assert.equal(JSON.parse(await readFile(path.join(root,'.motion-cache/founder-brief.json'),'utf8')).audience,'Small teams');
 let downloading=page.waitForEvent('download');await page.locator('#founder-download').click();let file=await downloading;assert.equal(await readFile(await file.path(),'utf8'),prompt);
 await mkdir(path.join(ROOT,'outputs/founder-session'),{recursive:true});await page.screenshot({path:path.join(ROOT,'outputs/founder-session/first-video.png')});
 await page.getByRole('button',{name:'Close session tools'}).click();await page.locator('#session-history-open').click();await page.waitForFunction(()=>!document.querySelector('#checkpoint-save').disabled);await page.locator('#checkpoint-label').fill('Approved first direction');await page.locator('#checkpoint-save').click();await page.waitForFunction(()=>document.querySelector('#session-status').textContent==='Checkpoint saved.');
 assert.equal((await listCheckpoints(root)).length,1);
 await page.getByRole('button',{name:'Close session tools'}).click();
 const plan=path.join(root,'project/test-feedback.json');await writeFile(plan,JSON.stringify([{id:'first',title:'Clarify the product benefit'}]));
 const command=(command,extra={})=>liveCommand({root,port:server.httpServer.address().port,command,...extra});await command('plan',{file:plan});await command('begin',{task:'first'});
 assert.equal((await listCheckpoints(root)).length,2,'Agent begin must save before editing');
 const sceneFile=path.join(root,'src/scenes/pop-demo.js');const before=await readFile(sceneFile,'utf8');await writeFile(sceneFile,before+'\n// founder revision fixture\n');await command('publish',{task:'first'});
 await page.waitForTimeout(900);await page.locator('#session-history-open').click();await page.waitForFunction(()=>!document.querySelector('#checkpoint-save').disabled);
 await page.locator('#checkpoint-list article').filter({hasText:'Approved first direction'}).getByRole('button').click();await page.locator('#restore-yes').click();await page.waitForFunction(()=>!document.querySelector('.session-dialog')?.open,{timeout:30000});await page.locator('#first-video-open').waitFor({timeout:30000});
 assert.equal(await readFile(sceneFile,'utf8'),before);assert.equal((await listCheckpoints(root)).length,3,'Restore must retain displaced state');
 await page.locator('#support-open').click();await page.waitForFunction(()=>!document.querySelector('#support-form button').disabled);await page.locator('[name=description]').fill('I could not find my export. Contact person@example.com');await page.locator('[name=expected]').fill('Find the finished video');await page.locator('#support-form button').click();await page.locator('#support-ready').waitFor();const report=await page.locator('#support-report').inputValue();assert.equal(report.includes('person@example.com'),false);assert.equal(report.includes('example.com/product'),false);assert.equal(await page.locator('#support-download').isDisabled(),true);
 await page.locator('#support-reviewed').check();await page.locator('#support-report').fill(report+'\n');assert.equal(await page.locator('#support-reviewed').isChecked(),false);await page.locator('#support-reviewed').check();downloading=page.waitForEvent('download');await page.locator('#support-download').click();file=await downloading;assert.equal(await readFile(await file.path(),'utf8'),report+'\n');
 await page.screenshot({path:path.join(ROOT,'outputs/founder-session/support.png')});await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.session-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await page.screenshot({path:path.join(ROOT,'outputs/founder-session/support-mobile.png')});
 assert.deepEqual(errors,[]);console.log('Clean ZIP Studio: founder brief, exact prompt download, source checkpoints, live revision, reversible restore, reviewed diagnostics, mobile layout and no page errors passed.');
}finally{await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});}
