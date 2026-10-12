// Actual state-baking contract test. This samples scene state without rasterizing film frames.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});let browser;
server.middlewares.use('/__cycles-state-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Cycles state test</title>');});
try{
 await server.listen();browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__cycles-state-test`);
 const result=await page.evaluate(async()=>{
  const {createDemo}=await import('/src/scenes/pulse-demo.js'),{evaluateParameterAnimation}=await import('/src/engine/parameter-animation.js');const world=createDemo();world.renderer.render=()=>{};const canvas=document.createElement('canvas');canvas.width=384;canvas.height=216;const ctx=canvas.getContext('2d');ctx.drawImage=()=>{};
  function sample(parameters){world.render(ctx,9.23,384,216,{...evaluateParameterAnimation({scene:'pulse',...parameters},9.23),review:'clean'});world.scene.updateMatrixWorld(true);world.camera.updateMatrixWorld(true);return {camera:world.camera.matrixWorld.toArray(),key:world.scene.children.find(o=>o.isRectAreaLight).intensity};}
  const normal=sample({}),changed=sample({animation:{version:1,enabled:true,tracks:{keyLight:[{t:0,value:0,ease:'linear'},{t:13.9,value:2,ease:'linear'}]},rates:{keyLight:.5},groups:{camera:{start:6.675,end:13.9,rate:.5,keys:[{t:0,value:0,ease:'linear'},{t:7.225,value:1,ease:'linear'}]}}}}),again=sample({});world.dispose();return {normal,changed,again};
 });
 assert.notDeepEqual(result.normal.camera,result.changed.camera,'Group rate must alter the actual baked camera');assert.notEqual(result.normal.key,result.changed.key,'Per-target numeric track rates must alter actual lights');assert.deepEqual(result.normal,result.again,'Absolute-time bake must reset after parameter changes');console.log(JSON.stringify({test:'cycles-state-controls',passed:true,normalKey:result.normal.key,animatedKey:result.changed.key,cameraGroupChanged:true,randomSeekReset:true}));
}finally{await browser?.close();await server.close();}
