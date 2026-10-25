import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {ROOT} from './project-store.mjs';

// Match the Pages paths, including the built public demo, without starting Studio.
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=createServer(async(req,res)=>{
  try {
    const name=new URL(req.url,'http://local').pathname;
    let file;
    if(name.startsWith('/motion-lab/founders/')) file=path.join(ROOT,'showcase/founders',name.slice(21)||'index.html');
    else if(name.startsWith('/motion-lab/studio/')) file=path.join(ROOT,'dist',name.slice(19)||'index.html');
    else if(name.startsWith('/motion-lab/brand/')) file=path.join(ROOT,'public/brand',name.slice(18));
    else if(name.startsWith('/motion-lab/demo/')) file=path.join(ROOT,'demo',name.slice(17));
    else if(name==='/motion-lab/LICENSE') file=path.join(ROOT,'LICENSE');
    else if(name==='/motion-lab/') file=path.join(ROOT,'showcase/index.html');
    else if(['/motion-lab/site.css','/motion-lab/site.js'].includes(name)) file=path.join(ROOT,'showcase',path.basename(name));
    else throw Error('Not found');
    const info=await stat(file);
    assert.ok(info.isFile());
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.setHeader('Content-Length',info.size);
    createReadStream(file).pipe(res);
  } catch {res.statusCode=404;res.end('Not found');}
});
await mkdir(path.join(ROOT,'outputs'),{recursive:true});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}/motion-lab/`;
const download='https://github.com/AndreXes03/motion-lab/archive/refs/heads/main.zip';
const guide='https://github.com/AndreXes03/motion-lab/blob/main/docs/MAC_SETUP.md';
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({reducedMotion:'reduce'});
  const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  for(const [width,height] of [[1440,1000],[390,844],[320,740]]) {
    await page.setViewportSize({width,height});
    await page.goto(base+'founders/');
    await page.locator('.film-card').first().waitFor();
    assert.equal(await page.locator('.hero .actions [data-studio]').getAttribute('href'),base+'studio/');
    assert.equal(await page.locator('.hero .actions a').nth(1).getAttribute('href'),download);
    await page.locator('.hero .actions a[href="#setup"]').click();
    assert.equal(new URL(page.url()).hash,'#setup');
    assert.equal(await page.locator('#setup li').count(),3);
    assert.equal(await page.locator('#setup>.button').getAttribute('href'),guide);
    assert.equal(await page.locator('#setup li a').getAttribute('href'),download);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}px`);
    await page.screenshot({path:path.join(ROOT,`outputs/founders-setup-${width}.png`)});
    const broken=await page.locator('a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));
    assert.deepEqual(broken,[]);
    await page.goto(base+'founders/');
    await page.screenshot({path:path.join(ROOT,`outputs/founders-hero-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.hero .actions [data-studio]').click();
  await page.waitForFunction(()=>window.motionPreview);
  assert.equal(await page.locator('.demo-header-download').getAttribute('href'),download);
  assert.equal(await page.locator('.demo-notice a').getAttribute('href'),guide);
  await page.locator('#experience-pro').click();
  assert.equal(await page.locator('#demo-pro-dialog').evaluate(el=>el.open),true);
  assert.equal(await page.locator('.demo-install-guide').getAttribute('href'),guide);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#demo-pro-dialog').evaluate(el=>el.open),false);
  await page.goBack();
  await page.locator('.hero .actions [data-studio]').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('href'),download);
  assert.notEqual(await page.locator(':focus').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,'#setup');
  const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const plain=await noJS.newPage();
  await plain.goto(base+'founders/');
  await plain.locator('.hero .actions a[href="#setup"]').click();
  assert.equal(new URL(plain.url()).hash,'#setup');
  assert.equal(await plain.locator('#setup>.button').getAttribute('href'),guide);
  assert.equal(await plain.locator('.hero .actions [data-studio]').getAttribute('href'),'../studio/');
  await noJS.close();
  assert.deepEqual(errors,[]);
  assert.deepEqual(failed,[]);
  console.log('Passed: founders → demo → download/setup links, 1440/390/320px, keyboard/focus, anchors, no JavaScript, no page/resource errors.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
