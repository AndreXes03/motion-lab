import assert from 'node:assert/strict';
import {mkdtemp,cp,symlink,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'vite';
import {ROOT,playwright} from './browser-runtime.mjs';
import {readReview,writeReview,updateReview} from './live-review-store.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-live-ui-'));
let server,browser,page;
try{
 for(const name of ['src','scripts','project','public','index.html','vite.config.js','package.json'])await cp(path.join(ROOT,name),path.join(root,name),{recursive:true});
 await symlink(path.join(ROOT,'node_modules'),path.join(root,'node_modules'),'dir');
 server=await createServer({root,configFile:path.join(root,'vite.config.js'),server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 browser=await playwright().chromium.launch({executablePath:playwright().chromium.executablePath(),headless:true});
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.httpServer.address().port}/?scene=procedural`;
 const ready=async()=>{await page.waitForFunction(()=>window.motionLive?.getState().revision!==undefined);await page.evaluate(()=>window.motionPreview.whenIdle());};
 const recipe=async()=>{await page.evaluate(()=>window.motionPreview.whenIdle());await page.locator('#experience-pro').click();await page.locator('#tab-code').click();return JSON.parse(await page.locator('#code-content').textContent());};
 const openUpdates=async()=>{if(await page.locator('.studio-more').getAttribute('open')===null)await page.locator('.studio-more>summary').click();if(await page.locator('.workspace-updates').getAttribute('open')===null)await page.locator('.workspace-updates>summary').click();};
 const command=async(action,options={})=>writeReview(root,updateReview(await readReview(root),action,options));
 const waitRevision=async rev=>page.waitForFunction(rev=>window.motionLive?.getState().revision>=rev,rev);
 const pixelHash=()=>page.evaluate(()=>{const canvas=document.querySelector('#renderCanvas');let h=2166136261;for(const n of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)h=Math.imul(h^n,16777619);return h>>>0;});
 await page.goto(url);await ready();if(await page.locator('.preview-options>summary').isVisible())await page.locator('.preview-options>summary').click();await page.locator('#preview-quality').selectOption('sharp');if(await page.locator('.preview-options>summary').isVisible())await page.locator('.preview-options>summary').click();
 await page.locator('#seek').evaluate(el=>{el.value='240';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.evaluate(()=>window.motionPreview.whenIdle());
 // An old recovery snapshot must not hide a new authored default after a source reload.
 const lookFile=path.join(root,'project/look.json'),look=JSON.parse(await readFile(lookFile,'utf8'));look.post.grain=.025;
 await writeFile(lookFile,JSON.stringify(look));
 await page.waitForFunction(()=>window.motionLive?.getState().revision>=1);await ready();
 assert.equal((await recipe()).parameters.look.post.grain,.025);
 assert.equal(await page.locator('#seek').inputValue(),'240');
 await command('plan',{tasks:[{id:'f1',title:'New title'},{id:'f2',title:'Accent and scene code'},{id:'f3',title:'Final title'}]});
 await command('begin',{task:'f1'});
 const one=await recipe();one.parameters.graphics.title='FIRST CHANGE';one.parameters.studio.values.title='FIRST CHANGE';
 await page.evaluate(()=>window.liveTabIdentity='same-tab');const before=await pixelHash();
 await command('publish',{task:'f1',snapshot:one});await waitRevision(2);await page.evaluate(()=>window.motionPreview.whenIdle());
 assert.equal((await recipe()).parameters.graphics.title,'FIRST CHANGE');assert.equal(await page.evaluate(()=>window.liveTabIdentity),'same-tab');assert.notEqual(await pixelHash(),before);
 await command('done',{task:'f1'});await page.waitForFunction(()=>document.querySelector('#live-review summary').textContent.includes('1/3'));
 // Two source writes remain hidden until the coherent checkpoint is published.
 await command('begin',{task:'f2'});await page.waitForFunction(()=>document.querySelector('#live-review-status')?.textContent.includes('Agent editing'));
 const sourceFile=path.join(root,'src/scenes/procedural-demo.js'),source=await readFile(sourceFile,'utf8');
 await writeFile(sourceFile,source+'\nglobalThis.__liveSourceProof=1;\n');
 await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>window.__liveSourceProof),undefined);assert.equal(await page.evaluate(()=>window.liveTabIdentity),'same-tab');
 const two=structuredClone(one);two.parameters.graphics.title='SECOND CHANGE';two.parameters.studio.values.title='SECOND CHANGE';
 await command('publish',{task:'f2',snapshot:two});
 await page.waitForFunction(()=>window.__liveSourceProof===1);await ready();
 assert.equal((await recipe()).parameters.graphics.title,'SECOND CHANGE');assert.equal(await page.locator('#seek').inputValue(),'240');
 await command('done',{task:'f2'});
 // Syntax errors keep the last good page, then recover automatically after a fix.
 const goodHash=await pixelHash();await page.evaluate(()=>window.liveTabIdentity='before-error');
 await writeFile(sourceFile,source+'\nexport const broken = ;\n');
 await page.waitForFunction(()=>document.querySelector('#live-review-status')?.textContent.includes('Update needs a fix'));
 assert.equal(await page.evaluate(()=>window.liveTabIdentity),'before-error');assert.equal(await pixelHash(),goodHash);
 await writeFile(sourceFile,source+'\nglobalThis.__liveSourceProof=2;\n');
 await page.waitForFunction(()=>window.__liveSourceProof===2);await ready();
 // Manual edits are never silently replaced; explicit application keeps a recoverable backup.
 const local=structuredClone(two);local.parameters.graphics.title='MY LOCAL TITLE';local.parameters.studio.values.title='MY LOCAL TITLE';
 await page.locator('#import-recipe').setInputFiles({name:'local.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(local))});
 await page.waitForFunction(()=>window.motionLive.getState().dirty);
 await command('begin',{task:'f3'});const three=structuredClone(two);three.parameters.graphics.title='THIRD CHANGE';three.parameters.studio.values.title='THIRD CHANGE';
 await command('publish',{task:'f3',snapshot:three});
 await page.locator('.studio-more>summary').click();await page.locator('.workspace-updates>summary').click();
 await page.locator('#live-review-apply').waitFor({state:'visible'});
 assert.equal((await recipe()).parameters.graphics.title,'MY LOCAL TITLE');
 await openUpdates();await page.locator('#live-review-apply').click();await page.waitForFunction(()=>!window.motionLive.getState().pending);
 assert.equal((await recipe()).parameters.graphics.title,'THIRD CHANGE');
 await openUpdates();await page.locator('#live-review-restore').click();assert.equal((await recipe()).parameters.graphics.title,'MY LOCAL TITLE');assert.equal(await page.evaluate(()=>window.motionLive.getState().paused),true);
 await mkdir(path.join(ROOT,'outputs/live-studio'),{recursive:true});await openUpdates();await page.locator('#live-review summary').click();await page.screenshot({path:path.join(ROOT,'outputs/live-studio/feedback-checklist.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Live Studio passed: authored defaults, sequential recipe updates with changed pixels, same-tab reuse, multi-file hold, source reload, time preservation, syntax recovery, checklist and manual-edit backup.');
}catch(error){
 console.error('Live test failure:',error.message);
 if(page)console.error(await page.evaluate(()=>({status:document.querySelector('#live-review-status')?.textContent,live:window.motionLive?.getState(),proof:window.__liveSourceProof})).catch(()=>({page:'unavailable'})));
 if(server){const info=await fetch(`http://127.0.0.1:${server.httpServer.address().port}/__framevolve_live`).then(r=>r.json()).catch(()=>({}));delete info.snapshot;console.error('Server live state:',info);}
 throw error;
}finally{await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});}
