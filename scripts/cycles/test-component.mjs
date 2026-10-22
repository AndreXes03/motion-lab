import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createCyclesComponentManager} from './component.mjs';
const revision='a'.repeat(40), version='1.0.0';
function archive(entries=[['framevolve-cycles','executable'],['color/config.ocio','color config']]) {
 const blocks=[];
 for(const [name,content,type='0'] of entries){const data=Buffer.from(content),header=Buffer.alloc(512);header.write(name);header.write('0000755\0',100);header.write('0000000\0',108);header.write('0000000\0',116);header.write(data.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header.write(type,156);header.write('ustar\0',257);header.write('00',263);const checksum=header.reduce((a,b)=>a+b,0);header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148);blocks.push(header,data,Buffer.alloc((512-data.length%512)%512));}
 return gzipSync(Buffer.concat([...blocks,Buffer.alloc(1024)]));
}
async function fixture(t,{bytes=archive(),releases=true,fetchFn}={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-cycles-test-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'native/cycles'),{recursive:true});
 await writeFile(path.join(root,'native/cycles/lock.json'),JSON.stringify({protocol:1,version,revision}));
 const entry={protocol:1,version,revision,platform:'darwin-arm64',url:'https://example.test/component.tar.gz',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,installedBytes:4096,format:'tar.gz',signed:true,notarized:true,tested:true,channel:'stable',teamId:'TESTTEAM01',validatedScenes:['pulse','loop']};
 const manifest=path.join(root,'native/cycles/releases.json');await writeFile(manifest,JSON.stringify({protocol:1,releases:releases?[entry]:[],unavailableReason:'No signed tested release.'}));
 const home=path.join(root,'components');const manager=createCyclesComponentManager({root,componentHome:home,platform:'darwin',arch:'arm64',beforeChange:async()=>{},fetchFn:fetchFn??(async()=>new Response(bytes)),validateInstalled:async directory=>{await access(path.join(directory,'framevolve-cycles'));await access(path.join(directory,'color/config.ocio'));}});
 return {manager,root,home,manifest,entry};
}
test('missing signed release stays unavailable and install reports a clear blocker',async t=>{const {manager}=await fixture(t,{releases:false});const status=await manager.status();assert.equal(status.canInstall,false);assert.match(status.reason,/No signed/);await assert.rejects(manager.install(),/No signed/);assert.equal((await manager.status()).busy,false);});
test('verified package installs atomically, reuses compatible version and removes cleanly',async t=>{const {manager,home}=await fixture(t);assert.equal((await manager.install()).reused,false);const receipt=JSON.parse(await readFile(path.join(home,'current.json'),'utf8'));assert.equal(receipt.revision,revision);assert.deepEqual(receipt.validatedScenes,['pulse','loop']);assert.equal((await manager.status()).compatible,true);assert.equal((await manager.install()).reused,true);assert.deepEqual((await readdir(home)).sort(),['1.0.0','current.json']);await manager.remove();assert.equal((await manager.status()).installed,null);});
test('checksum mismatch never activates or leaves stages',async t=>{const {manager,manifest,entry,home}=await fixture(t);entry.sha256='0'.repeat(64);await writeFile(manifest,JSON.stringify({protocol:1,releases:[entry]}));await assert.rejects(manager.install(),/SHA-256/);assert.equal((await manager.status()).installed,null);assert.deepEqual(await readdir(home),[]);});
test('unsafe paths and archive links never escape staging',async t=>{for(const entries of [[['../escape','unsafe']],[['framevolve-cycles','target','2']]]){const {manager,root}=await fixture(t,{bytes:archive(entries)});await assert.rejects(manager.install(),/Unsafe archive path|links and special/);await assert.rejects(access(path.join(root,'escape')));assert.equal((await manager.status()).installed,null);}});
test('interrupted download retries and cleans orphan stage',async t=>{let calls=0;const bytes=archive();const {manager,home}=await fixture(t,{bytes,fetchFn:async()=>{if(++calls===1)throw Error('Connection interrupted');return new Response(bytes);}});await assert.rejects(manager.install(),/interrupted/);await mkdir(path.join(home,'.stage-interrupted'));await manager.install();assert.equal((await manager.status()).compatible,true);assert.equal((await readdir(home)).some(name=>name.startsWith('.stage-')),false);});
test('incompatible update preserves active receipt until verified replacement',async t=>{const {manager,home,manifest,entry}=await fixture(t);await mkdir(path.join(home,'0.9.0/color'),{recursive:true});await writeFile(path.join(home,'0.9.0/framevolve-cycles'),'old');await writeFile(path.join(home,'0.9.0/color/config.ocio'),'old');const old={protocol:1,version:'0.9.0',revision:'b'.repeat(40)};await writeFile(path.join(home,'current.json'),JSON.stringify(old));entry.sha256='0'.repeat(64);await writeFile(manifest,JSON.stringify({protocol:1,releases:[entry]}));assert.equal((await manager.status()).canUpdate,true);await assert.rejects(manager.update(),/SHA-256/);assert.deepEqual(JSON.parse(await readFile(path.join(home,'current.json'),'utf8')),old);});
