import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';

// Requires a real browser: native Canvas checks cannot validate MediaRecorder,
// cold image decode, or browser font/raster behavior.
const root=fileURLToPath(new URL('../',import.meta.url));
const chrome=process.env.CHROME_PATH || (process.platform==='darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
let server,browser;
try{
 server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});
 await server.listen();
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--disable-gpu-sandbox']});
 const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?scene=launch&render=1`);
 const proof=await page.evaluate(async()=>{
  const {createRuntime}=await import('/src/engine/runtime.js');
  const {createCommercialBrief}=await import('/src/engine/commercial-brief.js');
  const {exportBrowserVideo}=await import('/src/viewer/browser-export.js');
  const source=document.createElement('canvas');source.width=96;source.height=64;
  const sourceContext=source.getContext('2d');sourceContext.fillStyle='#e600b8';sourceContext.fillRect(0,0,96,64);sourceContext.fillStyle='#ffffff';sourceContext.fillRect(8,8,32,48);
  const parameters={scene:'launch',commercial:createCommercialBrief({assets:{logo:{name:'logo.png',src:source.toDataURL()},screenshots:[{name:'screen.png',src:source.toDataURL()}]}})};
  const original=JSON.stringify(parameters),canvas=document.createElement('canvas'),runtime=createRuntime(canvas,{initialScene:'launch'});
  const hash=target=>{let h=2166136261;for(const value of target.getContext('2d').getImageData(0,0,target.width,target.height).data)h=Math.imul(h^value,16777619);return h>>>0;};
  const options={width:480,height:270,parameters,previewQuality:'full'};
  await runtime.ready;
  let coldRejected=false;try{runtime.render(6.3,options);}catch{coldRejected=true;}
  await runtime.prepare(parameters);runtime.render(6.3,options);const preparedHash=hash(canvas);
  runtime.render(22,options);runtime.render(.6,options);runtime.render(6.3,options);
  const seekStable=hash(canvas)===preparedHash,unmodified=JSON.stringify(parameters)===original;
  runtime.dispose();
  const reloadedCanvas=document.createElement('canvas'),reloaded=createRuntime(reloadedCanvas,{initialScene:'launch'});
  await reloaded.ready;await reloaded.prepare(JSON.parse(original));reloaded.render(6.3,{...options,parameters:JSON.parse(original)});
  const reloadStable=hash(reloadedCanvas)===preparedHash;reloaded.dispose();
  let disposedRejected=false;try{await reloaded.prepare(parameters);}catch{disposedRejected=true;}
  const capture=HTMLCanvasElement.prototype.captureStream,captures=[];
  HTMLCanvasElement.prototype.captureStream=function(...args){captures.push(hash(this));return capture.apply(this,args);};
  let invalidRejected=false,recording;
  try{
   const bad=structuredClone(parameters);bad.commercial.assets.logo.src='data:image/png;base64,iVBORw0KGgo=';
   try{await exportBrowserVideo({parameters:bad,settings:{width:480,height:270,start:6.3,duration:.5}});}catch{invalidRejected=true;}
   if(captures.length)throw Error('Invalid image reached recording before decode failed');
   recording=await exportBrowserVideo({parameters,settings:{width:480,height:270,start:6.3,duration:.5},onProgress:progress=>{if(progress.phase==='preparing')parameters.commercial.brand.name='MUTATED';}});
  }finally{HTMLCanvasElement.prototype.captureStream=capture;}
  return {coldRejected,unmodified,seekStable,reloadStable,disposedRejected,invalidRejected,
   firstRecordedFrameMatches:captures[0]===preparedHash,recordedBytes:recording.blob.size,callerMutated:parameters.commercial.brand.name==='MUTATED'};
 });
 for(const [key,value]of Object.entries(proof))assert.ok(value,key);
 console.log(JSON.stringify({passed:true,...proof,note:'Asset preparation, cold first-frame capture, frozen export recipe and deterministic reload.'}));
}finally{await browser?.close();await server?.close();}
