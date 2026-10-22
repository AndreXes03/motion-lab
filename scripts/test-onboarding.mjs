import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {readOnboarding,updateOnboarding} from './onboarding-store.mjs';
import {sessionSupportMiddleware} from './session-support-server.mjs';
async function fixture(t) { const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-onboarding-'));t.after(()=>rm(root,{recursive:true,force:true}));return root; }
test('onboarding remembers skip and merges concurrent real steps without losing progress',async t=>{
  const root=await fixture(t);
  assert.deepEqual(await readOnboarding(root),{version:1,seen:false,completed:[]});
  await Promise.all(['explore','edit','render'].map(step=>updateOnboarding(root,{version:1,seen:true,completed:[step]})));
  assert.deepEqual(await readOnboarding(root),{version:1,seen:true,completed:['explore','edit','render']});
  await updateOnboarding(root,{version:1,seen:false,completed:[]});
  assert.equal((await readOnboarding(root)).completed.length,3);
  assert.throws(()=>updateOnboarding(root,{version:1,seen:true,completed:['connected-to-ai']}),/Invalid/);
  assert.deepEqual(JSON.parse(await readFile(path.join(root,'.motion-cache/onboarding.json'))).completed,['explore','edit','render']);
});
test('linked progress and cache directories cannot redirect writes',async t=>{
  const root=await fixture(t),outside=await fixture(t);
  await symlink(outside,path.join(root,'.motion-cache'));
  await assert.rejects(readOnboarding(root),/local directory/);
  await rm(path.join(root,'.motion-cache'));await mkdir(path.join(root,'.motion-cache'));
  await symlink(path.join(outside,'target.json'),path.join(root,'.motion-cache/onboarding.json'));
  await assert.rejects(readOnboarding(root),/Invalid/);
});
test('onboarding API keeps the exact-origin and session-token boundary',async t=>{
  const root=await fixture(t),server=http.createServer(sessionSupportMiddleware(root));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin='http://127.0.0.1:'+server.address().port;
  const data=await(await fetch(origin+'/onboarding')).json();
  const post=extra=>fetch(origin+'/onboarding',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Framevolve-Session':data.token,...extra},body:JSON.stringify({version:1,seen:true,completed:['explore']})});
  assert.equal((await post({Origin:'https://example.com'})).status,403);
  assert.equal((await post({'X-Framevolve-Session':'invalid'})).status,403);
  assert.equal((await post({})).status,200);
  assert.equal((await(await fetch(origin+'/onboarding')).json()).progress.seen,true);
});
