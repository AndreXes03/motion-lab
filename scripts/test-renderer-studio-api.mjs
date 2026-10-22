import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createStudioApi,validateStudioParameters} from './studio-api.mjs';
import {ROOT} from './project-store.mjs';
const caps={threejs:{available:true},cycles:{available:true,scenes:['pulse'],device:'METAL',devices:[{type:'METAL'}]},mixed:{available:false}};
const calls=[],files=[],jobs=[];
const api=createStudioApi({capabilitiesFn:async()=>caps,spawnFn:(command,args,options)=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=process.pid;
 calls.push({command,args,options});
 setTimeout(async()=>{try{
  const out=args[args.indexOf('--out')+1],snapshot=args[args.indexOf('--snapshot')+1];files.push(out,snapshot);await mkdir(path.dirname(out),{recursive:true});await writeFile(out,await sharp({create:{width:64,height:64,channels:3,background:'#ff4422'}}).png().toBuffer());
  child.stdout.write(JSON.stringify({type:'frame',frame:1,frames:1,total:1,percent:90})+'\n');child.emit('close',0);
 }catch(error){child.stderr.write(error.message);child.emit('close',1);}},25);
 return child;
}});
const server=createServer((req,res)=>api(req,res,()=>{res.statusCode=404;res.end();}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/studio`;
const request=(route,body)=>fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
const policy={renderer:'cycles',source:'user',cycles:{samples:16,device:'auto',workers:1,denoise:false}};
try{
 const recipe=await validateStudioParameters({scene:'pulse',renderPolicy:policy,animation:{version:1,enabled:true,groups:{camera:{start:8.55,end:10.95,rate:.7,keys:[{t:0,value:0,ease:'linear'},{t:2.4,value:1,ease:'linear'}]}}},sceneControls:{keyLight:1.25}});
 assert.equal(recipe.renderPolicy.cycles.samples,16);
 await assert.rejects(()=>validateStudioParameters({scene:'pulse',renderPolicy:{cycles:{command:'unsafe'}}}),/Unknown Cycles field/);
 let response=await request('/capabilities');assert.equal(response.status,200);assert.equal((await response.json()).capabilities.cycles.device,'METAL');
 response=await request('/render',{kind:'frame',parameters:{scene:'camera',renderPolicy:policy},settings:{width:64,height:64}});assert.equal(response.status,400);assert.match((await response.json()).error,/adapter/);
 response=await request('/render',{kind:'export',parameters:recipe,settings:{format:'webm'}});assert.equal(response.status,400);assert.match((await response.json()).error,/MP4/);
 response=await request('/render',{kind:'frame',time:9.23,parameters:recipe,settings:{width:64,height:64,temporalSamples:1}});assert.equal(response.status,202);const {id}=await response.json();jobs.push(id);
 let job;for(let i=0;i<60;i++){job=await (await request('/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,30));}
 assert.equal(job.status,'completed',job.error);assert.equal(job.engine,'cycles');files.push(job.outputPath,path.join(ROOT,'renders/studio',id+'.png.job.json'));
 const invocation=calls[0];assert.equal(path.basename(invocation.args[0]),'cycles.mjs');assert.equal(invocation.args[invocation.args.indexOf('--samples')+1],'16');assert.equal(invocation.args[invocation.args.indexOf('--denoise')+1],'off');assert.equal(invocation.args[invocation.args.indexOf('--motion-blur')+1],'off');assert.equal(invocation.options.shell,false);
 const frozen=JSON.parse(await readFile(invocation.args[invocation.args.indexOf('--snapshot')+1],'utf8'));assert.deepEqual(frozen.parameters.animation,recipe.animation);assert.equal(frozen.time,9.23);assert.equal(frozen.parameters.sceneControls.keyLight,1.25);assert.equal(frozen.parameters.previewQuality,undefined);
 response=await request('/jobs/'+id+'/preview');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
 const record=JSON.parse(await readFile(path.join(ROOT,'renders/studio',id+'.png.job.json'),'utf8'));assert.equal(record.engine,'cycles');assert.equal(record.parameters.renderPolicy.cycles.samples,16);
 console.log(JSON.stringify({passed:true,capabilities:true,unsupportedBlocked:true,formatBlocked:true,cyclesDispatch:true,recipePreserved:true,pngDownload:true}));
}finally{
 await new Promise(resolve=>server.close(resolve));for(const file of new Set(files))await rm(file,{force:true});
}
