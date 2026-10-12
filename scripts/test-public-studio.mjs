import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {ROOT} from './project-store.mjs';
await mkdir(path.join(ROOT,'outputs'),{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.woff2':'font/woff2'};
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
 await page.goto(base);await page.locator('.hero-film-poster').waitFor();const shot=await page.locator('.ui-shot img').first().boundingBox();assert.ok(shot.width/shot.height>1.59&&shot.width/shot.height<1.61,'UI screenshots must show the complete interface');await page.screenshot({path:path.join(ROOT,'outputs/public-home-desktop.png'),fullPage:false});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#workflow').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(ROOT,'outputs/public-workflow-desktop.png')});
 await page.locator('#film-camera').click();assert.match(await page.locator('#film-download').getAttribute('href'),/camera-1080/);
 await page.goto(base+'studio/?scene=pulse&panel=look');await page.waitForFunction(()=>window.motionPreview&&window.motionRender);await page.evaluate(()=>window.motionPreview.whenIdle());
 assert.equal(await page.locator('#scene').inputValue(),'pulse');assert.equal(await page.locator('#render-final').isDisabled(),true);assert.equal(await page.locator('#export-settings').isVisible(),false);
 await page.locator('#export-dock').evaluate(el=>el.open=true);assert.equal(await page.locator('.render-policy-panel').isVisible(),true);assert.match(await page.locator('.render-policy-status').textContent(),/Local video/);
 await page.getByLabel('Renderer',{exact:true}).selectOption('cycles');await page.locator('#tab-code').click();const recipe=JSON.parse(await page.locator('#code-content').textContent());assert.equal(recipe.parameters.renderPolicy.renderer,'cycles');
 assert.equal(recipe.parameters.previewQuality,undefined);assert.equal(await page.locator('#preview-quality').isVisible(),true);
 await page.locator('#export-dock').evaluate(el=>el.open=false);await page.locator('#tab-motion').click();assert.ok((await page.locator('#motion-control option').allTextContents()).some(x=>x.includes('Camera')));
 await page.locator('#tab-look').click();assert.ok(await page.locator('.panel-preset').count()>0);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.motionPreview.whenIdle());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto(base);await page.screenshot({path:path.join(ROOT,'outputs/public-home-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(apiCalls,[],'Public build must never call a local API');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,publicBasePath:true,localRenderHonest:true,rendererRecipe:true,groups:true,presets:true,mobile:true,noLocalAPI:true}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
