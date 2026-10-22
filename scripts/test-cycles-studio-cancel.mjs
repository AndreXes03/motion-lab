import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {createStudioApi} from './studio-api.mjs';
import {ROOT} from './project-store.mjs';

const caps={threejs:{available:true},cycles:{available:true,backend:'cycles-standalone',scenes:['pulse'],device:'CPU',devices:[{type:'CPU',name:'Fixture CPU'}]},mixed:{available:false}};
let child,signal,id;
const api=createStudioApi({capabilitiesFn:async()=>caps,spawnFn:()=>{
 child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=98765;
 child.kill=value=>{signal=value;return true;};return child;
}});
const server=createServer((req,res)=>api(req,res,()=>{res.statusCode=404;res.end();}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/studio`;
const parameters={scene:'pulse',renderPolicy:{renderer:'cycles',source:'user',cycles:{samples:16,device:'cpu',workers:1,denoise:false}}};
const request=(route,body,headers={})=>fetch(base+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
try{
 let response=await request('/render',{kind:'frame',time:0,parameters,settings:{width:64,height:64,temporalSamples:1}});
 assert.equal(response.status,202,await response.clone().text());id=(await response.json()).id;
 child.stdout.write(JSON.stringify({type:'device',backend:'cycles-standalone',device:'CPU',deviceName:'Fixture CPU'})+'\n');
 child.stdout.write(JSON.stringify({type:'progress',phase:'sampling',sample:3,totalSamples:16,percent:42})+'\n');
 let job=await (await request('/jobs/'+id)).json();assert.equal(job.progress,42);
 assert.equal(job.device,'CPU');assert.equal(job.backend,'cycles-standalone');
 response=await request('/jobs/'+id+'/cancel',{}, {Origin:'https://foreign.example'});assert.equal(response.status,403);
 assert.equal(signal,undefined,'Foreign origin must not terminate the render');
 response=await request('/jobs/'+id+'/cancel',{}, {Origin:`http://127.0.0.1:${server.address().port}`});
 assert.ok([200,202].includes(response.status),await response.clone().text());
 job=await response.json();assert.equal(job.status,'cancelling');assert.equal(job.cancelRequested,true);
 assert.equal(signal,'SIGTERM');
 response=await request('/render',{kind:'frame',time:0,parameters,settings:{width:64,height:64,temporalSamples:1}});
 assert.equal(response.status,409,'The render slot stays occupied until the child closes');
 child.emit('close',143);
 for(let attempt=0;attempt<50;attempt++){job=await (await request('/jobs/'+id)).json();if(job.status==='cancelled')break;await new Promise(resolve=>setTimeout(resolve,20));}
 assert.equal(job.status,'cancelled',job.error);assert.equal(job.phase,'cancelled');assert.equal(job.url,null);assert.equal(job.downloadUrl,null);
 response=await request('/jobs/'+id+'/file');assert.equal(response.status,404);
 response=await request('/jobs/'+id+'/cancel',{}, {Origin:`http://127.0.0.1:${server.address().port}`});
 assert.ok([200,202].includes(response.status));assert.equal((await response.json()).status,'cancelled');
 console.log('Studio Cycles cancellation: device/progress metadata, same-origin guard, SIGTERM, reserved slot, terminal state, no download and idempotence passed');
}finally{
 await new Promise(resolve=>server.close(resolve));
 if(id){for(const file of [path.join(ROOT,'renders/studio',id+'.png'),path.join(ROOT,'renders/studio',id+'.png.job.json'),path.join(ROOT,'renders/studio','.'+id+'.snapshot.json')])await rm(file,{force:true});}
}
