import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;
try{
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?scene=starter&render=1');await page.evaluate(()=>window.motion.ready);
 const result=await page.evaluate(async()=>{
  const options={width:640,height:360,parameters:{scene:'starter'}},canvas=document.querySelector('#renderCanvas');
  const hash=()=>{let h=2166136261;for(const v of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)h=Math.imul(h^v,16777619);return h;};
  window.motion.render(3,options);const first=hash();window.motion.render(.1,options);window.motion.render(5.9,options);window.motion.render(3,options);const seek=hash()===first;
  window.motion.render(3,{...options,parameters:{scene:'starter',product:{accent:'#ff3300',fill:.3}}});const controls=hash()!==first;
  window.motion.render(3,{...options,parameters:{scene:'starter',review:'clay'}});const clay=hash()!==first;
  window.motion.render(3,options);const restore=hash()===first;
  const T=await import('/node_modules/three/build/three.module.js');const {createProductStage,createFilmAsset}=await import('/src/product-kit/index.js');
  const renderer=new T.WebGLRenderer({antialias:true}),stage=createProductStage(renderer,{width:320,height:180});
  stage.camera.position.set(1,.7,4);stage.camera.lookAt(0,0,0);const names=[];
  for(const kind of ['turntable','headphones','camera']){
   const asset=createFilmAsset(kind,{renderer,environment:stage.kit.environment});stage.scene.add(asset.root);stage.prepare();stage.render(0,{width:320,height:180});
   const bounds=new T.Box3().setFromObject(asset.root);if(bounds.isEmpty()||Math.abs(Math.max(...bounds.getSize(new T.Vector3()))-3)>1e-5)throw Error('Invalid normalized asset '+kind);
   names.push(kind);asset.dispose();asset.dispose();
  }
  const rubber=stage.kit.variant('rubber',{color:'#223344'});if(rubber===stage.kit.materials.rubber||rubber.color.getHexString()!=='223344')throw Error('Variant alias');
  stage.dispose();stage.dispose();renderer.dispose();
  return {seek,controls,clay,restore,assets:names,shutter:window.motion.shutterAngleAt(2,{scene:'starter'})};
 });
 assert.ok(result.seek&&result.controls&&result.clay&&result.restore);assert.equal(result.shutter,270);assert.equal(result.assets.length,3);
 await mkdir('renders/product-kit',{recursive:true});
 await page.goto(base+'/showcase/');await page.locator('.hero-film img').evaluate(i=>i.decode());
 await page.screenshot({path:'renders/product-kit/site-desktop.png',fullPage:true});
 assert.equal(await page.locator('[data-film="pulse"]').getAttribute('aria-selected'),'true');
 await page.locator('[data-film="camera"]').click();assert.equal(await page.locator('#film-title').innerText(),'CAMERA');
 await page.locator('[data-film="camera"]').press('ArrowRight');assert.equal(await page.locator('#film-title').innerText(),'DOT');
 await page.locator('summary').first().click();assert.ok(await page.locator('details').first().evaluate(e=>e.open));
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#site-ambient').evaluate(e=>getComputedStyle(e).display),'none');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'renders/product-kit/site-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const missing=await page.locator('img').evaluateAll(images=>images.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,...result,site:'desktop/mobile, tabs, keyboard, FAQ, reduced motion, images and no overflow'}));
}finally{await browser?.close();await server.close();}
