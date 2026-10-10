import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {openFrameCache,sourceFingerprint} from './render-cache.mjs';
import {applyRenderQuality} from '../src/engine/render-quality.js';

const root=await mkdtemp(path.join(os.tmpdir(),'motion-cache-test-'));
try {
  for(const dir of ['src','scripts'])await mkdir(path.join(root,dir));
  for(const file of ['src/model.js','scripts/cli.mjs','index.html','package-lock.json'])await writeFile(path.join(root,file),'original');
  const original=await sourceFingerprint(root);
  const recipe={source:original,width:8,height:8,parameters:{scene:'pulse'},fps:30,temporalSamples:48};
  const png=await sharp({create:{width:8,height:8,channels:4,background:'#123456'}}).png().toBuffer();
  let cache=await openFrameCache(root,recipe,{resume:true});
  await assert.rejects(()=>openFrameCache(root,recipe,{resume:true}),/already running/);
  await cache.write(0,png);const directory=cache.directory;
  await cache.close(false);
  cache=await openFrameCache(root,{...recipe,parameters:{scene:'pulse'}},{resume:true});
  assert.equal(cache.directory,directory);assert.deepEqual(await cache.read(0),png);assert.equal(await cache.read(1),null);
  await writeFile(path.join(directory,'frame-000002.png'),png.subarray(0,32));
  assert.equal(await cache.read(1),null,'Truncated PNG must not be reused');
  await cache.close(true);await assert.rejects(()=>access(directory));
  cache=await openFrameCache(root,recipe,{resume:true,keepFrames:true});await cache.write(0,png);await cache.close(true);
  const changed=await openFrameCache(root,{...recipe,temporalSamples:24},{resume:true});
  assert.notEqual(changed.directory,directory);assert.equal(await changed.read(0),null);await changed.close(true);
  await writeFile(path.join(root,'src/model.js'),'new geometry');
  const updated=await sourceFingerprint(root);assert.notEqual(updated,original);
  const newSource=await openFrameCache(root,{...recipe,source:updated},{resume:true});assert.equal(await newSource.read(0),null);await newSource.close(true);
  assert.equal(applyRenderQuality({quality:'premium'})['temporal-samples'],48);
  assert.equal(applyRenderQuality({quality:'premium','temporal-samples':2})['temporal-samples'],2);
  assert.equal(applyRenderQuality({quality:'premium'}).resume,'on');
  console.log(JSON.stringify({passed:true,checks:['failure recovery','concurrent lock','truncated PNG','cleanup','settings invalidation','source invalidation','explicit preset override']}));
} finally {await rm(root,{recursive:true,force:true});}
