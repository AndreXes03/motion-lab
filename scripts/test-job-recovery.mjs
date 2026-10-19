import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './project-store.mjs';
import {createMaintenanceLease,interruptedState,recoveryState} from './job-recovery.mjs';

let clock=0;const lease=createMaintenanceLease({now:()=>clock,ttl:20}),token=randomUUID();
assert.throws(()=>lease.acquire(token,true),/busy/);lease.acquire(token,false);
assert.throws(()=>lease.acquire(randomUUID(),false),/busy/);lease.release(randomUUID());assert.equal(lease.active(),true);
clock=21;assert.equal(lease.active(),false);
assert.equal(interruptedState({status:'queued'}).status,'interrupted');
assert.equal(interruptedState({status:'running'}).status,'interrupted');
assert.equal(recoveryState({status:'failed',snapshotAvailable:true,sourceHash:'a'},'b').canRetry,false);

const ids=[],children=[],files=new Set();let source='recovery-source-v1';
const moduleUrl=new URL('./studio-api.mjs',import.meta.url);
const apiModule=await import(moduleUrl.href+'?recovery='+randomUUID());
const parameters=await apiModule.validateStudioParameters({scene:'procedural'});
const settings={width:320,height:240,fps:24,format:'mp4',bitrateMbps:8,temporalSamples:2};
const renderDir=path.join(ROOT,'renders/studio');await mkdir(renderDir,{recursive:true});
function track(id,extension='.mp4'){ids.push(id);for(const name of [`.${id}.snapshot.json`,`${id}${extension}.job.json`,`${id}${extension}`,`${id}${extension}.project.json`])files.add(path.join(renderDir,name));}
const persisted=randomUUID();track(persisted);
await writeFile(path.join(renderDir,`.${persisted}.snapshot.json`),JSON.stringify({command:'export',parameters,settings,start:0,end:10,time:0}));
await writeFile(path.join(renderDir,`${persisted}.mp4.job.json`),JSON.stringify({id:persisted,kind:'export',scene:'procedural',status:'queued',sourceHash:source,parameters,settings,createdAt:new Date().toISOString()}));
const spawnFn=(command,args)=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=undefined;
 children.push({child,command,args});return child;
};
const api=apiModule.createStudioApi({spawnFn,sourceFingerprintFn:async()=>source});
const server=createServer((req,res)=>api(req,res,()=>{res.statusCode=404;res.end();}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/studio`;
const request=(route,body)=>fetch(base+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const job=async id=>(await request('/jobs/'+id)).json();
async function waitFor(fn){for(let i=0;i<100;i++){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Timed out waiting for mocked job');}
try{
 let state=await(await request('')).json();assert.equal(children.length,0,'Restart never automatically executes persisted queued jobs');
 assert.equal(state.jobs.find(j=>j.id===persisted).status,'interrupted');assert.equal(state.jobs.find(j=>j.id===persisted).canRetry,true);
 const submitted=[];
 for(let i=0;i<9;i++){
  const response=await request('/render',{kind:'export',parameters,settings});assert.equal(response.status,202,await response.clone().text());const result=await response.json();track(result.id);submitted.push(result.id);
  assert.equal(result.status,i===0?'running':'queued');
 }
 assert.equal(children.length,1,'Only one export subprocess starts');
 assert.equal((await request('/render',{kind:'export',parameters,settings})).status,429,'Queue is bounded');
 assert.equal((await request('/render',{kind:'frame',purpose:'viewport',parameters,settings:{width:64,height:64}})).status,409,'Viewport work never grows the queue');
 assert.equal((await request('/maintenance',{action:'acquire',token})).status,409);
 const queued=JSON.parse(await readFile(path.join(renderDir,submitted[1]+'.mp4.job.json'),'utf8'));assert.equal(queued.status,'queued');assert.deepEqual(queued.settings,settings);
 const snapshot=JSON.parse(await readFile(path.join(renderDir,`.${submitted[1]}.snapshot.json`),'utf8'));assert.deepEqual(snapshot.parameters,parameters);
 for(let i=0;i<9;i++){
  await waitFor(()=>children.length===i+1);
  children[i].child.emit('close',1);
  await waitFor(async()=>['failed'].includes((await job(submitted[i])).status));
 }
 assert.equal((await job(submitted[0])).canRetry,true);
 let response=await request('/jobs/'+submitted[0]+'/retry',{});assert.equal(response.status,202);assert.deepEqual(await response.json(),{id:submitted[0],attempt:2});
 assert.equal(children.length,10);const retry=children[9];assert.ok(retry.args.includes('--resume'));assert.equal(retry.args[retry.args.indexOf('--snapshot')+1],path.join(renderDir,`.${submitted[0]}.snapshot.json`));
 assert.equal((await request('/jobs/'+submitted[0]+'/retry',{})).status,409,'No duplicate retry while active');
 retry.child.emit('close',1);await waitFor(async()=>(await job(submitted[0])).status==='failed');
 source='changed-source';assert.equal((await job(submitted[0])).canRetry,false);assert.equal((await request('/jobs/'+submitted[0]+'/retry',{})).status,409);source='recovery-source-v1';
 response=await request('/maintenance',{action:'acquire',token});assert.equal(response.status,200);
 assert.equal((await request('/render',{kind:'export',parameters,settings})).status,409,'Maintenance blocks new render admissions');
 await request('/maintenance',{action:'release',token});
 const startIndex=children.length;
 const firstQueued=await(await request('/render',{kind:'export',parameters,settings})).json();track(firstQueued.id);
 const staleQueued=await(await request('/render',{kind:'export',parameters,settings})).json();track(staleQueued.id);
 source='changed-before-dequeue';children[startIndex].child.emit('close',1);
 await waitFor(async()=>(await job(staleQueued.id)).status==='failed');
 assert.equal(children.length,startIndex+1,'A queued job cannot render against changed sources');
 assert.match((await job(staleQueued.id)).error,/sources changed while queued/i);source='recovery-source-v1';
 await rm(path.join(renderDir,`.${submitted[0]}.snapshot.json`));assert.equal((await job(submitted[0])).canRetry,false);
 const record=JSON.parse(await readFile(path.join(renderDir,submitted[0]+'.mp4.job.json'),'utf8'));assert.equal(record.attempt,2);
 console.log(JSON.stringify({passed:true,mode:'mocked subprocesses; no browser',checks:['persisted queued interruption','no automatic restart','bounded serial export queue','viewport busy','saved settings/snapshot retry','compatible source only','duplicate protection','maintenance admission gate','lease ownership and expiry']}));
}finally{await new Promise(resolve=>server.close(resolve));for(const file of files)await rm(file,{force:true});}
