import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,copyFile,readFile,rm} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {createStudioApi} from './studio-api.mjs';
import {ROOT} from './project-store.mjs';
import {prepareComposite,compositeFrame} from './lib/simple-compositor.mjs';
const folder='renders/mixed-api-proof-'+randomUUID();await mkdir(path.join(ROOT,folder));
const pulseProof=process.argv.includes('--pulse-proof');if(!pulseProof){for(const [name,color]of [['background','#050b19'],['cycles',{r:30,g:140,b:170,alpha:.6}],['graphics',{r:190,g:240,b:80,alpha:.2}]])await sharp({create:{width:384,height:216,channels:4,background:color}}).png().toFile(path.join(ROOT,folder,name+'.png'));}
const basePlan={version:1,colorSpace:'srgb',width:384,height:216,fps:30,frameCount:417,layers:[
 {id:'navy',source:{type:'image',path:'renders/mixed-pulse-proof/assets/background.png'}},
 {id:'beauty',source:{type:'image',path:'renders/mixed-pulse-proof/assets/cycles-000001.png'}},
 {id:'type',source:{type:'image',path:'renders/mixed-pulse-proof/assets/graphics.png'}}]};
if(!pulseProof)for(const [index,name]of ['background','cycles','graphics'].entries())basePlan.layers[index].source.path=folder+'/'+name+'.png';
await writeFile(path.join(ROOT,folder,'plan.json'),JSON.stringify(basePlan));
const api=createStudioApi();const server=createServer((req,res)=>api(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/studio`;
const policy={renderer:'mixed',source:'user',composite:{enabled:true,planFile:folder+'/plan.json'}};
const request=body=>fetch(url+'/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
let id,outputPath;
try{
 let response=await request({kind:'frame',time:0,parameters:{scene:'pulse',renderPolicy:policy},settings:{width:640,height:360,fps:30}});assert.equal(response.status,400);assert.match((await response.json()).error,/must match/);
 response=await request({kind:'frame',time:0,parameters:{scene:'pulse',renderPolicy:policy},settings:{width:384,height:216,fps:30,temporalSamples:1}});const queued=await response.json();assert.equal(response.status,202,queued.error);id=queued.id;
 let job;for(let i=0;i<60;i++){job=await (await fetch(url+'/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,100));}
 assert.equal(job.status,'completed',job.error);assert.equal(job.engine,'mixed');outputPath=job.outputPath;
 const expected=await compositeFrame(await prepareComposite({plan:basePlan,assetsRoot:ROOT}),0),actual=await readFile(outputPath);
 const hash=x=>createHash('sha256').update(x).digest('hex');assert.equal(hash(actual),hash(expected));
 await mkdir(path.join(ROOT,'outputs/release-review'),{recursive:true});await copyFile(outputPath,path.join(ROOT,'outputs/release-review/mixed-studio-frame.png'));
 console.log(JSON.stringify({passed:true,dispatch:'Studio → prepared mixed layers → PNG',matchingInputs:true,dimensionMismatchBlocked:true,width:384,height:216,pixelExact:true,inputs:pulseProof?'PULSE Cycles RGBA and graphic layer':'synthetic RGBA fixtures'}));
}finally{await new Promise(resolve=>server.close(resolve));await rm(path.join(ROOT,folder),{recursive:true,force:true});if(outputPath)await rm(outputPath,{force:true});if(id){for(const suffix of ['.png.job.json','.png.inputs','.png.mixed'])await rm(path.join(ROOT,'renders/studio',id+suffix),{recursive:true,force:true});await rm(path.join(ROOT,'renders/studio','.'+id+'.snapshot.json'),{force:true});}}
