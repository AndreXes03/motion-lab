import assert from 'node:assert/strict';
import {createProductionScene} from '../src/engine/production-scene.js';
import {createNativeRenderer} from './native/renderer.mjs';
import {createNativeCanvas} from './native/canvas.mjs';
import {renderProcedural} from '../src/engine/procedural.js';
import {resolveRenderPlan} from '../src/engine/render-policy.js';
const scene=createProductionScene({scene:'procedural'}),a=scene.evaluate(2);
scene.evaluate(8);assert.deepEqual(scene.evaluate(2),a);assert.equal(a.version,1);
assert.throws(()=>createProductionScene({scene:'pop'}),/legacy/);
assert.throws(()=>scene.evaluate(NaN),/finite/);
const changed=createProductionScene({scene:'procedural',sceneControls:{typeScale:1.5}}).evaluate(2);
assert.notDeepEqual(changed.nodes,a.nodes);
const r=createNativeRenderer({scene:'procedural'});
try{const first=await r.renderPng(2,320,180,{scene:'procedural'});await r.renderPng(7.5,320,180,{scene:'procedural'},4);assert.deepEqual(await r.renderPng(2,320,180,{scene:'procedural'}),first);}finally{await r.close();}
// Real graph clip + transparent compositing, with known interior pixel expectations.
const c=createNativeCanvas(32,32),ctx=c.getContext('2d');
renderProcedural(ctx,0,{width:32,height:32,nodes:[{id:'mask',type:'group',clip:{type:'rect',width:16,height:32},children:[{id:'paint',type:'rect',width:32,height:32,fill:'#ff0000',opacity:.5}]}]});
const pixels=ctx.getImageData(0,0,32,32).data;assert(Math.abs(pixels[(8*32+8)*4+3]-128)<=1);assert.equal(pixels[(8*32+24)*4+3],0);c.dispose();
const selection=resolveRenderPlan({},{scene:'procedural',capabilities:{skia:{available:true,scenes:['procedural']}}});assert.equal(selection.selectedRenderer,'skia');assert(selection.runnable);
assert.equal(resolveRenderPlan({renderer:'skia'},{scene:'pop',capabilities:{skia:{available:true,scenes:['procedural']}}}).runnable,false);
console.log('Native production: deterministic evaluation/seek, live controls, motion sampling, clipped alpha and explicit renderer availability passed.');
