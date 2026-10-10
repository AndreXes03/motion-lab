#!/usr/bin/env node
// Real Canvas2D pixels verify seek/seed/masks; no mocked drawing calls.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(ROOT,'renders/procedural-tests.json');
let server,browser;
try{
 server=await createServer({root:ROOT,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu-sandbox']});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?render=1`);await page.waitForFunction(()=>window.motion?.ready);await page.evaluate(()=>window.motion.ready);
 const results=await page.evaluate(async()=>{
  const engine=await import('/src/engine/procedural.js');
  const results=[];function test(name,fn){try{const detail=fn();results.push({name,passed:true,...(detail??{})});}catch(error){results.push({name,passed:false,error:error.message});}}
  function assert(condition,message){if(!condition)throw new Error(message);}
  function throws(fn){let caught=false;try{fn();}catch{caught=true;}assert(caught,'Expected malformed input to throw');}
  function make(w=128,h=128){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d',{willReadFrequently:true});return canvas;}
  function hash(canvas){let n=2166136261;for(const value of canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)n=Math.imul(n^value,16777619);return (n>>>0).toString(16);}
  const canvas=make(),ctx=canvas.getContext('2d');
  const node=(id='box')=>({id,type:'rect',x:10,y:10,width:30,height:20,fill:'#ff0000'});
  const render=(nodes,time=0,seed=1)=>{ctx.clearRect(0,0,128,128);engine.renderProcedural(ctx,time,{width:128,height:128,nodes,seed});return hash(canvas);};
  test('noise deterministic across seek and seed',()=>{
   const a=engine.seededNoise(17),b=engine.seededNoise(17),c=engine.seededNoise(18);const points=[[.35,.2,.77],[11.25,4.7,.2],[2.2,.14,7.5]];
   const first=points.map(p=>a(...p));a(9,12,4);const again=points.map(p=>a(...p));assert(JSON.stringify(first)===JSON.stringify(again),'Noise changed after out-of-order sample');assert(JSON.stringify(first)===JSON.stringify(points.map(p=>b(...p))),'Same seed mismatch');assert(first.some((v,i)=>Math.abs(v-c(...points[i]))>1e-8),'Different seed did not change noise');assert(first.every(v=>v>=-1&&v<=1),'Noise outside [-1,1]');
  });
  test('absolute time nodes reproduce pixels after arbitrary seek',()=>{
   const nodes=[{...node(),x:t=>12+t*17}];const first=render(nodes,1.25);render(nodes,8);render(nodes,.1);assert(render(nodes,1.25)===first,'Pixel hash changed after seeks');assert(render(nodes,2)!==first,'Animated transform did not change pixels');return {hash:first};
  });
  test('seed reaches context and changes procedural pixels',()=>{
   const nodes=[{...node(),x:(t,c)=>45+c.noise(1.34,.7,t)*24}];const first=render(nodes,.4,17);assert(render(nodes,.4,17)===first,'Same seed pixels mismatch');assert(render(nodes,.4,18)!==first,'Different seed pixels mismatch');
  });
  test('repeat and local mask clip real pixels',()=>{
   const repeated=engine.repeat(4,i=>({...node('repeat-'+i),x:i*24,y:0,width:20,height:32}));
   assert(repeated.length===4&&new Set(repeated.map(n=>n.id)).size===4,'Repeat count or ids invalid');
   render([{id:'masked',type:'group',x:16,y:20,clip:{type:'rect',x:0,y:0,width:40,height:32},children:repeated}]);
   const alpha=(x,y)=>ctx.getImageData(x,y,1,1).data[3];assert(alpha(18,24)>240,'Mask erased interior');assert(alpha(44,24)>240,'Repeated second tile missing');assert(alpha(75,24)===0,'Mask leaked beyond local right edge');assert(alpha(18,18)===0,'Group translation failed');
  });
  test('node transforms and clipping do not leak context state',()=>{
   ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=.7;
   render([{id:'outer',type:'group',x:14,y:18,rotation:.7,opacity:.2,clip:{type:'rect',x:0,y:0,width:30,height:30},children:[node()]}]);
   const transform=ctx.getTransform();assert(transform.a===1&&transform.d===1&&transform.e===0&&transform.f===0,'Transform leaked');assert(Math.abs(ctx.globalAlpha-.7)<1e-6,'Alpha leaked');ctx.globalAlpha=1;
  });
  test('clear false preserves pixels beneath an overlay',()=>{
   ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#123456';ctx.fillRect(0,0,128,128);
   engine.renderProcedural(ctx,0,{width:128,height:128,clear:false,nodes:[node('overlay')]});
   const background=Array.from(ctx.getImageData(90,90,1,1).data);assert(JSON.stringify(background)===JSON.stringify([18,52,86,255]),'Overlay erased the background');
   assert(ctx.getImageData(20,20,1,1).data[0]===255,'Overlay was not drawn');
   engine.renderProcedural(ctx,0,{width:128,height:128,nodes:[]});assert(ctx.getImageData(90,90,1,1).data[3]===0,'Default clear failed');
  });
  test('stroke-only geometry remains hollow by default',()=>{
   render([{id:'outline',type:'rect',x:10,y:10,width:40,height:40,stroke:'#fff',lineWidth:4}]);
   assert(ctx.getImageData(30,30,1,1).data[3]===0,'Stroke-only rect received an implicit fill');
   assert(ctx.getImageData(10,30,1,1).data[3]>240,'Stroke-only rect did not draw its outline');
  });
  test('invalid blends and dash segments rejected without state leakage',()=>{
   throws(()=>render([{...node(),blend:'unsupported-custom-blend'}]));
   throws(()=>render([{...node(),stroke:'#fff',dash:[3,-1]}]));
   throws(()=>render([{...node(),stroke:'#fff',dash:[3,NaN]}]));
   throws(()=>engine.renderProcedural(ctx,0,{width:128,height:128,nodes:[],clear:'false'}));
   assert(ctx.globalCompositeOperation==='source-over','Error leaked composite mode');
  });
  test('malformed schemas rejected',()=>{
   const base={width:128,height:128,nodes:[node()]};
   for(const bad of [{...base,width:0},{...base,height:-1},{...base,nodes:null},{...base,nodes:[{...node(),type:'unknown'}]},{...base,nodes:[node(),node()]},{...base,nodes:[{id:'broken',type:'path',commands:[['BOGUS',0,0]]}]}])throws(()=>engine.renderProcedural(ctx,0,bad));
   throws(()=>engine.repeat(-1,()=>node()));throws(()=>engine.repeat(2,null));
  });
  test('runtime procedural seek deterministic at output resolution',()=>{
   const out=document.querySelector('#renderCanvas');const opts={width:960,height:540,parameters:{scene:'procedural'}};
   window.motion.render(2.35,opts);const first=hash(out);window.motion.render(8,opts);window.motion.render(.2,opts);window.motion.render(2.35,opts);assert(hash(out)===first,'Runtime pixels changed after seeks');assert(out.width===960&&out.height===540,'Wrong output size');return {hash:first};
  });
  test('2D resolution scaling preserves normalized composition',()=>{
   // Constant fractional bounds make the expected spatial scaling unambiguous.
   function sample(w,h){const c=make(w,h);engine.renderProcedural(c.getContext('2d'),0,{width:w,height:h,nodes:[{id:'scaled',type:'rect',x:(t,p)=>p.width*.25,y:(t,p)=>p.height*.25,width:(t,p)=>p.width*.5,height:(t,p)=>p.height*.5,fill:'#f00'}]});return c;}
   const small=sample(128,128),large=sample(256,256);for(const [x,y,filled]of [[.1,.1,false],[.3,.3,true],[.65,.65,true],[.85,.85,false]])for(const c of [small,large])assert((c.getContext('2d').getImageData(Math.floor(x*c.width),Math.floor(y*c.height),1,1).data[3]>0)===filled,'Normalized geometry changed with resolution');
   window.motion.render(2.35,{width:480,height:270,parameters:{scene:'procedural'}});assert(document.querySelector('#renderCanvas').width===480,'Runtime did not resize');
   window.motion.render(2.35,{width:1920,height:1080,parameters:{scene:'procedural'}});assert(document.querySelector('#renderCanvas').height===1080,'Runtime full resolution failed');
  });
  test('runtime rejects unsupported scene and nonfinite time',()=>{throws(()=>window.motion.render(0,{parameters:{scene:'broken'}}));throws(()=>window.motion.render(NaN,{parameters:{scene:'procedural'}}));});
  return results;
 });
 const report={passed:results.every(r=>r.passed),count:results.length,tests:results,note:'Pixel and API tests are technical checks, not visual approval.'};await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({type:'complete',path:output,...report}));if(!report.passed)process.exitCode=1;
}catch(error){console.log(JSON.stringify({type:'error',message:error.message}));process.exitCode=1;}finally{await browser?.close();await server?.close();}
