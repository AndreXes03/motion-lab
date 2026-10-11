import assert from 'node:assert/strict';
import * as T from 'three';
import {createImpactMotion,createProductCameraMove} from '../src/product-kit/motion.js';
import {createRotaryControl,createOpticalCell,createHousingPanel} from '../src/product-kit/models.js';
import {resolveParameters} from '../src/engine/project-controls.js';
const impact=createImpactMotion({start:1,hit:2,end:2.5,travel:3});
assert.equal(impact(0),3);assert.equal(impact(2),0);assert.equal(impact(3),0);
for(let t=0;t<4;t+=.001){const v=impact(t);assert.ok(Number.isFinite(v)&&v>=0&&v<=3);}
assert.ok(impact(2.04)>0);assert.ok(impact(1.9)>impact(1.99));
assert.throws(()=>createImpactMotion({hit:0}));assert.throws(()=>impact(NaN));
const move=createProductCameraMove({points:[[0,1,5],[1,1,4],[2,0,3]],target:[0,0,0],duration:4,power:4,pace:'accelerate',bank:.2});
const camera=new T.PerspectiveCamera();move.apply(camera,2);const first=[...camera.position,...camera.quaternion,camera.fov];move.apply(camera,4);move.apply(camera,0);move.apply(camera,2);assert.deepEqual([...camera.position,...camera.quaternion,camera.fov],first);
assert.ok(move.sample(3.99).position.distanceTo(move.sample(3.9).position)>move.sample(.19).position.distanceTo(move.sample(.1).position));
const materials=Object.fromEntries(['rubber','brushedMetal','satinPlastic','mattePlastic','anodizedMetal','glass'].map(k=>[k,new T.MeshStandardMaterial()]));let disposed=0;Object.values(materials).forEach(m=>m.addEventListener('dispose',()=>disposed++));
const a=createRotaryControl(materials),b=createRotaryControl(materials,{radius:.5}),optic=createOpticalCell(materials),panel=createHousingPanel(materials,{holes:[{x:0,y:0,radius:.5}]});
for(const item of [a,b,optic,panel]){item.root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(item.root);assert.ok(!bounds.isEmpty());assert.ok([...bounds.min,...bounds.max].every(Number.isFinite));item.root.traverse(o=>{if(o.geometry)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});}
assert.throws(()=>createHousingPanel(materials,{holes:[{x:0,y:0,radius:.5},{x:.1,y:0,radius:.5}]}));
assert.throws(()=>createRotaryControl(materials,{ridges:1}));
a.dispose();a.dispose();assert.equal(disposed,0);assert.ok(b.root.children.length>0);[b,optic,panel].forEach(m=>m.dispose());assert.equal(disposed,0);
const params=resolveParameters('starter',{fov:300,fill:-1,accent:'#ff4400'});assert.equal(params.product.fov,95);assert.equal(params.product.fill,0);assert.equal(params.product.accent,'#ff4400');
console.log('Product kit: deterministic movement, contact bounds, independent models, material ownership and control limits passed.');
