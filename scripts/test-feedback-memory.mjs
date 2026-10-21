import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {readMemory,setMemoryConsent,addMemoryRecord,setMemoryOutcome,eraseMemory,deleteMemoryRecord,memoryFile,validateRecord} from './feedback-memory-store.mjs';
import {feedbackCommand} from './feedback-memory.mjs';
import {feedbackMemoryMiddleware} from './feedback-memory-server.mjs';
import {createFeedbackReport,feedbackMailto} from '../src/viewer/feedback-report.js';
const example={feedback:'Too slow',intent:'Earlier benefit',change:'Shortened empty hold',preserve:'Calm camera',before:'Proof at 5s',after:'Proof at 2s'};
async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-memory-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('off by default, no record, no stdin read and no journal until consent',async t=>{
 const root=await fixture(t);assert.equal((await readMemory(root)).consent.enabled,false);
 assert.equal((await addMemoryRecord(root,example)).saved,false);
 assert.equal((await feedbackCommand(['record','--repo',root],{[Symbol.asyncIterator](){throw Error('Must not consume feedback');}})).saved,false);
 await assert.rejects(readFile(memoryFile(root)),{code:'ENOENT'});
 await assert.rejects(setMemoryConsent(root,'true'));
});
test('consented records survive restart; approval separate; off and deletion respected',async t=>{
 const root=await fixture(t);await setMemoryConsent(root,true);
 const {id}=await addMemoryRecord(root,example);let data=await readMemory(root);
 assert.equal(data.records[0].clientOutcome,'pending');assert.equal(data.records[0].visualStatus,'not-reviewed');
 assert.equal((await stat(memoryFile(root))).mode&0o777,0o600);
 await setMemoryOutcome(root,{id,outcome:'mixed',response:'Earlier proof helps; title too short'});
 await setMemoryConsent(root,false);
 assert.equal((await addMemoryRecord(root,example)).saved,false);
 await assert.rejects(setMemoryOutcome(root,{id,outcome:'accepted'}),/paused/);
 assert.equal((await readMemory(root)).records[0].clientOutcome,'mixed');
 await deleteMemoryRecord(root,id);assert.equal((await readMemory(root)).records.length,0);
 await setMemoryConsent(root,true);await addMemoryRecord(root,example);await eraseMemory(root);
 assert.deepEqual(await readMemory(root),{version:1,consent:{enabled:false,noticeVersion:1},records:[]});
 assert.equal((await addMemoryRecord(root,example)).saved,false);
});
test('serialized writers do not lose cases or resurrect memory after erasure',async t=>{
 const root=await fixture(t);await setMemoryConsent(root,true);
 await Promise.all(Array.from({length:12},()=>addMemoryRecord(root,example)));
 const data=await readMemory(root);assert.equal(data.records.length,12);assert.equal(new Set(data.records.map(x=>x.id)).size,12);
 await Promise.all([addMemoryRecord(root,example),eraseMemory(root),addMemoryRecord(root,example)]);
 assert.equal((await readMemory(root)).consent.enabled,false);assert.equal((await readMemory(root)).records.length,0);
});
test('bounded schema rejects approval, unknown fields and malformed evidence',()=>{
 assert.throws(()=>validateRecord({...example,clientOutcome:'accepted'}),/Unknown/);
 assert.throws(()=>validateRecord({...example,video:'secret.mp4'}),/Unknown/);
 assert.throws(()=>validateRecord({...example,visualStatus:'passed'}));
 assert.throws(()=>validateRecord({...example,feedback:'x'.repeat(4001)}));
 assert.throws(()=>validateRecord({...example,intent:''}));
});
test('sharing is allowlisted text; strips obvious identifiers without promising anonymity',()=>{
 const record={...example,id:'private-id',scene:'private-client',createdAt:'secret-date',video:'never.mp4',feedback:'Ask person@example.com https://secret.example/x /Users/name/secret.mov C:\\Users\\private\\scene.mov sk-abcdefghijklmnopqrstuv',clientOutcome:'pending'};
 const report=createFeedbackReport([record]);assert.equal(JSON.parse(report).records.length,1);
 for(const secret of ['person@example','secret.example','/Users/name','C:\\Users','sk-abc','private-id','private-client','secret-date','never.mp4'])assert.equal(report.includes(secret),false,secret);
 assert.match(report,/not guarantee anonymity/);
 const url=new URL(feedbackMailto('framevolve.app@gmail.com'));assert.equal(decodeURIComponent(url.pathname),'framevolve.app@gmail.com');assert.match(url.searchParams.get('body'),/Attach the reviewed/);assert.equal(url.searchParams.get('body').includes('Too slow'),false);
 assert.throws(()=>feedbackMailto('a@example.com?bcc=someone@example.com'));
 assert.throws(()=>feedbackMailto('a@example.com\r\nbcc:other@example.com'));
});
test('local API requires exact origin + capability for mutations and rejects hostile hosts',async t=>{
 const root=await fixture(t),handle=feedbackMemoryMiddleware(root);
 const request=async(url='/',{method='GET',headers={},body=''}={})=>{
  const req=Readable.from([body]);Object.assign(req,{method,url,headers:{host:'127.0.0.1:4173',...headers}});
  let status,data;await handle(req,{writeHead(s){status=s;},end(raw){data=JSON.parse(raw);}});return {status,data};
 };
 assert.equal((await request('/',{headers:{host:'evil.test'}})).status,403);
 assert.equal((await request('/',{headers:{origin:'null'}})).status,403);
 const {data}=await request();assert.equal(data.consent.enabled,false);
 const headers={origin:'http://127.0.0.1:4173','content-type':'application/json','x-framevolve-memory':data.token};
 assert.equal((await request('/consent',{method:'POST',headers:{...headers,'x-framevolve-memory':'wrong'},body:'{"enabled":true}'})).status,403);
 assert.equal((await request('/consent',{method:'POST',headers:{...headers,origin:'https://evil.test'},body:'{"enabled":true}'})).status,403);
 assert.equal((await request('/consent',{method:'POST',headers,body:'{"enabled":true}'})).status,200);
 await addMemoryRecord(root,example);
 const result=await request('/erase',{method:'POST',headers,body:'{}'});assert.equal(result.data.records.length,0);assert.equal(result.data.consent.enabled,false);
 assert.equal((await request('/consent',{method:'POST',headers,body:'x'.repeat(64001)})).status,413);
});
