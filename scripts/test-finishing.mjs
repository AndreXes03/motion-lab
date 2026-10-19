import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {Scene, PerspectiveCamera, Texture, Mesh, BoxGeometry, MeshStandardMaterial, DirectionalLight} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {applyDisplayGrade} from '../src/engine/display-grade.js';
import {applyFilmGrain} from '../src/engine/film-grain.js';
import {configureDetailSampling} from '../src/engine/detail-sampling.js';
import {createComposite} from '../src/engine/composite.js';

const hash=data=>createHash('sha256').update(data).digest('hex');
function pattern(width,height){
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i++)data[i]=(i*17+i%137)&255;
  return data;
}
const context=data=>({getImageData:()=>({data}),putImageData:()=>{}});
function alphaUnchanged(before,after){for(let i=3;i<before.length;i+=4)assert.equal(after[i],before[i]);}

// Golden pixels captured from the authored implementation before optimization.
// They include clipping, partial alpha, grain tiling, noninteger sizes, fps and portrait layouts.
const grades=[
  [{colorContrast:1.2,colorSaturation:.8},'a71ac68b30af4e09fcd16b8d5ae7eafaecdf1cc23efba9a195e1b405ac886434'],
  [{colorContrast:.5,colorSaturation:0},'f6df407f1b767a8313e23670e6cf74f4afcf343e86b2c5ac8833c48884caf65d'],
  [{colorContrast:1.8,colorSaturation:2.5},'74cc5f6e65cba2375a580653b0afea0ebcb2b0f146e19f9883a019349e644c9c']
];
for(const [options,expected] of grades){const data=pattern(257,5),before=data.slice();applyDisplayGrade(context(data),257,5,options);assert.equal(hash(data),expected);alphaUnchanged(before,data);}
{
  // Exhaust the 24-bit RGB domain, including clamp/rounding boundaries, against
  // the original implementation's hash. Alpha varies through the whole byte range.
  const data=new Uint8ClampedArray(256**3*4);
  for(let rgb=0;rgb<256**3;rgb++){const i=rgb*4;data[i]=rgb>>>16;data[i+1]=rgb>>>8;data[i+2]=rgb;data[i+3]=rgb&255;}
  applyDisplayGrade(context(data),4096,4096,grades[0][0]);
  assert.equal(hash(data),'8742848bee63c8a7f91ee96f440bfc4135003669985b9c2a239bc02a4d006feb');
}
const grainCases=[
  [64,36,1,{amount:.018,size:1.1,fps:30},'c24e0356c44ea55341401ce655e0a9cfbc941e552e7d798cafceda2e537202b0'],
  [119,67,7.125,{amount:.08,size:3,fps:24},'be2aef5d3b726aa35f021e0556ddc9365d590b613b4e06ec0ab297b6c652aa0b'],
  [320,180,0,{amount:.006,size:.4,fps:60},'88cec6b92df70ceeee2d7c423dababe01ff537405603813eeaaf612daaaf71d1'],
  [90,160,2.75,{amount:.018,size:1.1,fps:30},'e313d5d86dcb0e29b2ed7d86684986cf9c06aedcf195ba1e9e2f289608f546b7']
];
for(const [w,h,time,options,expected] of [...grainCases,...grainCases.toReversed()]){
  const data=pattern(w,h),before=data.slice();applyFilmGrain(context(data),time,w,h,options);assert.equal(hash(data),expected);alphaUnchanged(before,data);
}
const noRead={getImageData(){throw Error('Bypass must not read pixels');}};
applyDisplayGrade(noRead,10,10);applyFilmGrain(noRead,0,10,10);

// Repreparing a scene must not cause another GPU texture upload or shadow render.
const scene=new Scene(),texture=new Texture(),material=new MeshStandardMaterial({map:texture,normalMap:texture});
scene.add(new Mesh(new BoxGeometry(),material));
const light=new DirectionalLight();light.castShadow=true;scene.add(light);
const renderer={capabilities:{getMaxAnisotropy:()=>8,maxSamples:4},getPixelRatio:()=>1};
assert.equal(configureDetailSampling(renderer,scene).textures,1);assert.equal(texture.anisotropy,8);
const version=texture.version;light.shadow.needsUpdate=false;
configureDetailSampling(renderer,scene);assert.equal(texture.version,version);assert.equal(light.shadow.needsUpdate,false);
renderer.capabilities.getMaxAnisotropy=()=>4;configureDetailSampling(renderer,scene);assert.equal(texture.anisotropy,4);assert.equal(texture.version,version+1);

// Exercise the actual Three.js passes without creating a WebGL context.
// Observe pass state at the composer boundary; shader picture QA still requires a browser.
let passes;
const addPass=EffectComposer.prototype.addPass;
EffectComposer.prototype.addPass=function(pass){passes=this.passes;return addPass.call(this,pass);};
let composite;
try{composite=createComposite(renderer,scene,new PerspectiveCamera(),{width:64,height:36});}
finally{EffectComposer.prototype.addPass=addPass;}
try{
  const ao=passes.find(pass=>pass.constructor.name==='GTAOPass'),dof=passes.find(pass=>pass.constructor.name==='BokehPass'),bloom=passes.find(pass=>pass.constructor.name==='UnrealBloomPass');
  composite.applyLook({aoIntensity:.4,dofEnabled:true,bloomStrength:.12,bloomRadius:.25,bloomThreshold:1.15});
  assert.equal(ao.enabled,true);assert.equal(dof.enabled,true);assert.equal(bloom.enabled,true);
  composite.setReview('clean');assert.equal(ao.enabled,false);assert.equal(dof.enabled,false);assert.equal(bloom.enabled,false);
  composite.applyLook({aoIntensity:.7,dofEnabled:true,bloomEnabled:false});
  assert.equal(ao.enabled,false);assert.equal(dof.enabled,false);assert.equal(bloom.enabled,false);
  composite.setReview('beauty');assert.equal(ao.enabled,true);assert.equal(dof.enabled,true);assert.equal(bloom.enabled,false);
  composite.applyLook({aoIntensity:0,dofEnabled:false});composite.setReview('clay');composite.setReview();
  assert.equal(ao.enabled,false);assert.equal(dof.enabled,false);assert.equal(bloom.enabled,true);
  let noiseDisposals=0;ao.pdNoiseTexture.addEventListener('dispose',()=>noiseDisposals++);
  composite.dispose();composite.dispose();assert.equal(noiseDisposals,1);
}finally{composite.dispose();texture.dispose();material.dispose();scene.children[0].geometry.dispose();}

// Optional installed native Canvas integration, with no downloads or browser substitutes.
if(process.env.NATIVE_CANVAS_MODULE){
  const {createCanvas}=createRequire(import.meta.url)(process.env.NATIVE_CANVAS_MODULE);
  const canvas=createCanvas(119,67),ctx=canvas.getContext('2d');
  ctx.fillStyle='#1c74c9';ctx.fillRect(0,0,119,67);
  const source=ctx.getImageData(0,0,119,67),expected=source.data.slice();
  applyDisplayGrade(context(expected),119,67,grades[0][0]);applyFilmGrain(context(expected),2.5,119,67,grainCases[0][3]);
  applyDisplayGrade(ctx,119,67,grades[0][0]);applyFilmGrain(ctx,2.5,119,67,grainCases[0][3]);
  assert.deepEqual(ctx.getImageData(0,0,119,67).data,expected);
  console.log('PASS: native Canvas grade and grain pixels');
}
console.log('PASS: authored finishing pixels, random seek, alpha, no-op, sampling invalidation and review restoration');
