import assert from 'node:assert/strict';
import nativeMotion from '../project/motion.json' with {type:'json'};
import {getAuthoredAnimationTracks,getAuthoredCameraChannels,buildSampledAuthoredTracks} from '../src/engine/authored-animation.js';
import {sceneIds} from '../src/scene-registry.js';
import {getAnimationGroups,sampleAnimationGroupTime} from '../src/engine/animation-groups.js';
import {validateParameterAnimation,evaluateParameterAnimation} from '../src/engine/parameter-animation.js';
import {getControlPresets,getInterpolationPresets,validatePresetSelection,validateInterpolationPreset} from '../src/engine/control-presets.js';
import {applyDisplayGrade} from '../src/engine/display-grade.js';
import {validateStudioParameters} from './studio-api.mjs';
for(const scene of sceneIds){
 const groups=getAnimationGroups(scene);assert.ok(groups.length);assert.equal(new Set(groups.map(g=>g.id)).size,groups.length);
 for(const group of groups){const {start,end}=group.windows[0];const animation=validateParameterAnimation({version:1,groups:{[group.id]:{start,end,keys:[{t:0,value:0},{t:end-start,value:1}]}}},scene);
  for(const t of [start,(start+end)/2,end])assert.equal(sampleAnimationGroupTime({scene,animation},group.id,t),t);
  const changed=structuredClone(animation);changed.groups[group.id].keys[0].ease='in';const t=(start+end)/2;assert.notEqual(sampleAnimationGroupTime({scene,animation:changed},group.id,t),t);
  for(const other of groups.filter(g=>g.id!==group.id))assert.equal(sampleAnimationGroupTime({scene,animation:changed},other.id,t),t);
  assert.equal(sampleAnimationGroupTime({scene,animation:changed},group.id,end+.01),end+.01);
  assert.equal(sampleAnimationGroupTime({scene,animation:{...changed,enabled:false}},group.id,t),t);
  const normalized=await validateStudioParameters({scene,animation:changed});assert.deepEqual(normalized.animation.groups,changed.groups);
 }
 for(const category of ['lights','compositing'])for(const preset of getControlPresets(scene,category))assert.deepEqual(validatePresetSelection(scene,category,preset),preset);
 for(const preset of getInterpolationPresets(scene))assert.deepEqual(validateInterpolationPreset(scene,preset),preset);
}
const independent=validateParameterAnimation({version:1,rate:2,tracks:{speed:[{t:0,value:.5,ease:'linear'},{t:4,value:2.5}],density:[{t:0,value:4,ease:'linear'},{t:4,value:12}]},rates:{density:.5},groups:{graphics:{start:0,end:4,keys:[{t:0,value:0},{t:4,value:1}]}}},'procedural');
assert.equal(independent.rate,1);assert.equal(independent.rates.speed,2);assert.equal(independent.rates.density,.5);
const p={scene:'procedural',graphics:{speed:1,density:8},animation:independent};assert.equal(evaluateParameterAnimation(p,1).graphics.speed,1.5);assert.equal(evaluateParameterAnimation(p,1).graphics.density,5);assert.equal(sampleAnimationGroupTime(p,'graphics',1),1);
for(const value of [{version:1,groups:null},{version:1,tracks:null},{version:1,rates:null},{version:1,groups:{unknown:{start:0,end:1,keys:[]}}},{version:1,groups:{camera:{start:0,end:2,keys:[{t:0,value:2}]}}}])assert.throws(()=>validateParameterAnimation(value,'objects'));
assert.throws(()=>validatePresetSelection('pulse','lights',{id:'bad',label:'Bad',description:'Unsupported',values:{colorContrast:1}}),/does not belong/);
assert.throws(()=>validateInterpolationPreset('pulse',{id:'bad',label:'Bad',ease:'bezier',bezier:[2,0,0,1]}));
let reads=0,writes=0;const rgba=new Uint8ClampedArray([100,50,10,255]),ctx={getImageData(){reads++;return{data:rgba}},putImageData(){writes++}};
applyDisplayGrade(ctx,1,1,{});assert.equal(reads,0);applyDisplayGrade(ctx,1,1,{colorSaturation:0});assert.equal(rgba[0],rgba[1]);assert.equal(rgba[1],rgba[2]);assert.equal(writes,1);
// Native source channels stay distinct from editable progress/timing curves.
const nativeCamera=getAuthoredAnimationTracks('objects','camera');
assert.deepEqual(nativeCamera.find(track=>track.id==='camera.position.x').keys.map(key=>key.value),nativeMotion.tracks['camera.position'].map(key=>key.value[0]));
assert.deepEqual(nativeCamera.find(track=>track.id==='camera.position.x').keys.map(key=>key.t),nativeMotion.tracks['camera.position'].map(key=>key.t));
assert.ok(nativeCamera.every(track=>track.source==='keys'&&track.keys.every(key=>key.ease==='smooth'||typeof key.ease==='string')));
nativeCamera[0].keys[0].value=10000;
assert.notEqual(getAuthoredAnimationTracks('objects','camera')[0].keys[0].value,10000,'inspecting native keys never mutates the saved authored motion');
for(const scene of sceneIds.filter(scene=>scene!=='objects'))for(const group of getAnimationGroups(scene))assert.deepEqual(getAuthoredAnimationTracks(scene,group.id),[],'function-authored motion requires actual evaluated samples, never invented native keys');
const channels=getAuthoredCameraChannels();
const observations=[0,.5,1].map(t=>({t,values:Object.fromEntries(channels.map((channel,index)=>[channel.id,t*(index+1)]))}));
const samples=buildSampledAuthoredTracks('pulse','camera',observations,channels);
assert.equal(samples.length,7);assert.ok(samples.every(track=>track.source==='samples'&&track.keys.every(key=>key.ease==='linear')),'observed poses have linear display joins without adding another easing');
assert.equal(samples[0].keys[1].value,observations[1].values[channels[0].id]);
samples[0].keys[1].value=10000;assert.notEqual(observations[1].values[channels[0].id],10000,'display samples are immutable copies');
assert.throws(()=>buildSampledAuthoredTracks('pulse','camera',[{t:0,values:{}}],channels),/Missing actual authored sample/);
assert.throws(()=>buildSampledAuthoredTracks('pulse','camera',[observations[1],observations[0]],channels),/times must increase/);
console.log(JSON.stringify({passed:true,scenes:sceneIds.length,groups:'independent',presets:'validated',displayGrade:'passed',legacyRate:'migrated per target',authoredCurves:'native and sampled read-only'}));
