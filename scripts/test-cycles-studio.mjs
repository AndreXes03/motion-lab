import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import path from 'node:path';
import {copyFile,mkdir,readFile,rm} from 'node:fs/promises';
import sharp from 'sharp';
import {ROOT} from './project-store.mjs';
import {createStudioApi} from './studio-api.mjs';
const server=createServer((req,res)=>createApi(req,res,()=>{res.statusCode=404;res.end();}));
const createApi=createStudioApi();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/studio`;
let id,outputPath;
try{
 const caps=await (await fetch(base+'/capabilities')).json();assert.equal(caps.capabilities.cycles.available,true,caps.capabilities.cycles.reason);
 const response=await fetch(base+'/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'frame',time:9.23,settings:{width:384,height:216,temporalSamples:1},parameters:{scene:'pulse',renderPolicy:{renderer:'cycles',source:'user',quality:'draft',cycles:{samples:16,workers:1,device:'auto',denoise:true}},sceneControls:{keyLight:1.1},look:{post:{colorContrast:1.1,colorSaturation:.85}}}})});
 const queued=await response.json();assert.equal(response.status,202,queued.error);id=queued.id;
 let job;for(let i=0;i<180;i++){job=await (await fetch(base+'/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,1000));}
 assert.equal(job.status,'completed',job.error||'Cycles frame did not complete');assert.equal(job.engine,'cycles');outputPath=job.outputPath;
 const metadata=await sharp(outputPath).metadata();assert.equal(metadata.width,384);assert.equal(metadata.height,216);
 const report=JSON.parse(await readFile(path.join(ROOT,'renders/studio/cycles',id+'.png.job.json'),'utf8'));assert.equal(report.status,'complete');assert.match(report.device,/Metal|CPU/);
 const reviewDir=path.join(ROOT,'outputs/release-review');await mkdir(reviewDir,{recursive:true});await copyFile(outputPath,path.join(reviewDir,'cycles-studio-frame.png'));
 console.log(JSON.stringify({passed:true,dispatch:'Studio → Cycles → PNG',device:report.device,samples:report.settings.samples,width:metadata.width,height:metadata.height,proof:'outputs/release-review/cycles-studio-frame.png'}));
}finally{
 await new Promise(resolve=>server.close(resolve));if(id){await rm(path.join(ROOT,'renders/studio',id+'.png.job.json'),{force:true});await rm(path.join(ROOT,'renders/studio','.'+id+'.snapshot.json'),{force:true});}if(outputPath)await rm(outputPath,{force:true});
}
