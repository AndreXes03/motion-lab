import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,symlink,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {appDemoExample,validateAppDemo,appDemoDuration,appAssetPath,appDemoShots} from '../src/engine/app-demo.js';
import {importImageAsset,readImageAsset} from './image-assets.mjs';
import {createNativeRenderer} from './native/renderer.mjs';
import {createProductionScene} from '../src/engine/production-scene.js';
import {resolveParameters} from '../src/engine/project-controls.js';
import {planSound,renderSound} from '../src/engine/sound-design.js';
const doc=structuredClone(appDemoExample);assert.equal(appDemoDuration(doc),18);doc.slides.reverse();doc.slides[0].duration=7;assert.equal(appDemoDuration(doc),21);assert.equal(appDemoShots(doc)[1].id,'delivery');
assert.throws(()=>appAssetPath('/assets/app-demo/../../secret.png'));assert.throws(()=>validateAppDemo({...doc,slides:[...doc.slides,...doc.slides]}));assert.throws(()=>validateAppDemo({...doc,accent:'url(file:secret)'}));
const root=await mkdtemp(path.join(os.tmpdir(),'framevolve-app-demo-'));
try{const bytes=await readFile(new URL('../public/assets/app-demo/audio.png',import.meta.url));const first=await importImageAsset(root,bytes),second=await importImageAsset(root,bytes);assert.equal(first.asset,second.asset);assert(first.width>0);assert((await readImageAsset(root,first.asset)).length>0);await assert.rejects(()=>importImageAsset(root,Buffer.from('<svg/>')));await assert.rejects(()=>importImageAsset(root,Buffer.alloc(11*1024*1024)));const alias=path.join(root,'linked');await mkdir(alias);await symlink(path.join(root,'public'),path.join(alias,'public'));await assert.rejects(()=>readImageAsset(alias,first.asset));}finally{await rm(root,{recursive:true,force:true});}
const p={...resolveParameters('appdemo'),appDemo:doc},r=createNativeRenderer(p);
try{const a=await r.renderPng(5,640,360,p);await r.renderPng(19,640,360,p);assert.deepEqual(await r.renderPng(5,640,360,p),a);assert.notDeepEqual(await r.renderPng(8,640,360,p),a);assert.equal(r.config.duration,21);}finally{await r.close();}
const telemetry=createProductionScene(p).sampleMotion(),sound=renderSound(planSound(telemetry,{enabled:true}));assert.equal(telemetry.duration,21);assert(sound.channels[0].some(v=>Math.abs(v)>.001));
console.log('App Demo: bounded content, image import, symlink rejection, seek stability, dynamic duration and audio passed.');
