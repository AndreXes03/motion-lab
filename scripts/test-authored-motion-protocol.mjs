import assert from 'node:assert/strict';
import nativeMotion from '../project/motion.json' with {type:'json'};
import {getAuthoredAnimationTracks,getAuthoredAnimationProtocol,editAuthoredKey,validateAuthoredMotion,buildSampledAuthoredTracks} from '../src/engine/authored-animation.js';
import {sampleTrack} from '../src/engine/animation.js';
import {sampleParameterTrack,easeProgress} from '../src/engine/parameter-animation.js';
import {validateStudioParameters} from './studio-api.mjs';
import {sceneIds} from '../src/scene-registry.js';

const unchanged=JSON.stringify(nativeMotion);
const protocol=getAuthoredAnimationProtocol('bax',{motion:nativeMotion});
let comparisons=0;
for(const group of protocol.groups)for(const channel of group.source.channels){
 assert.equal(channel.editable,true);assert.equal(channel.timeDomain,'scene-seconds');
 assert.equal(channel.easingOwner,'outgoing-key');
 const source=nativeMotion.tracks[channel.binding.track];
 for(const t of [0,.137,.325,.65,1.37,3.723,5.083,9.999,10]){
  const value=sampleTrack(source,t),expected=channel.binding.component===null?value:value[channel.binding.component];
  assert.ok(Math.abs(sampleParameterTrack(channel.keys,t)-expected)<1e-12,channel.id+' at '+t);
  comparisons++;
 }
}
assert.equal(easeProgress(.25,'smooth'),.103515625,'smooth is the native quintic, not a cubic visual substitute');
assert.equal(JSON.stringify(nativeMotion),unchanged,'inspection must not normalize or rewrite omitted native easing');

const changed=editAuthoredKey('bax','camera','camera.position.x',1,{value:-2.4},{motion:nativeMotion});
assert.equal(changed.tracks['camera.position'][1].value[0],-2.4);
assert.deepEqual(changed.tracks['camera.position'][1].value.slice(1),nativeMotion.tracks['camera.position'][1].value.slice(1));
for(const target of Object.keys(nativeMotion.tracks).filter(id=>id!=='camera.position'))assert.deepEqual(changed.tracks[target],nativeMotion.tracks[target]);

const bezier=[.2,.1,.7,.85];
const eased=editAuthoredKey('bax','camera','camera.position.x',0,{ease:'bezier',bezier},{motion:changed});
const channels=getAuthoredAnimationTracks('bax','camera',{motion:eased});
for(const axis of ['x','y','z']){
 const channel=channels.find(c=>c.id==='camera.position.'+axis);
 assert.equal(channel.sharedTiming,true);assert.deepEqual(channel.keys[0].bezier,bezier);
}
assert.notEqual(sampleTrack(eased.tracks['camera.position'],.325)[0],sampleTrack(changed.tracks['camera.position'],.325)[0]);
const serialized=JSON.parse(JSON.stringify({scene:'bax',motion:eased,animation:{version:1,groups:{camera:{start:0,end:2.2,keys:[{t:0,value:0,ease:'linear'},{t:2.2,value:1,ease:'linear'}]}}}}));
const restored=await validateStudioParameters(serialized);
assert.deepEqual(restored.motion,eased,'local API accepts the same native bezier document as editor/render');
assert.deepEqual(restored.animation.groups.camera.keys,serialized.animation.groups.camera.keys,'native editing does not replace retiming');
const linear=editAuthoredKey('bax','camera','camera.position.x',0,{ease:'linear'},{motion:eased});
assert.equal(linear.tracks['camera.position'][0].bezier,undefined,'switching away from bezier removes stale handles');

const shifted=editAuthoredKey('bax','camera','camera.position.y',1,{t:.7},{motion:nativeMotion});
assert.equal(shifted.tracks['camera.position'][1].t,.7);
assert.deepEqual(shifted.tracks['camera.position'][1].value,nativeMotion.tracks['camera.position'][1].value);
for(const patch of [{t:0},{t:11},{value:NaN},{ease:'fake'},{ease:'bezier',bezier:[-1,0,1,1]},{bezier:[.1,0,.9,1]},{extra:1}]){
 assert.throws(()=>editAuthoredKey('bax','camera','camera.position.x',1,patch,{motion:nativeMotion}));
}
assert.throws(()=>editAuthoredKey('bax','radio','camera.position.x',0,{value:0},{motion:nativeMotion}),/not editable/);
assert.throws(()=>editAuthoredKey('pulse','camera','camera.position.x',0,{value:0},{motion:nativeMotion}),/not editable/);
const duplicate=structuredClone(nativeMotion);duplicate.tracks['camera.position'][1].t=0;
assert.throws(()=>validateAuthoredMotion(duplicate),/increase/);
await assert.rejects(()=>validateStudioParameters({scene:'bax',motion:duplicate}),/increase/);
assert.equal(JSON.stringify(nativeMotion),unchanged,'successful edits and failed patches must leave original source intact');

const observations=buildSampledAuthoredTracks('pulse','camera',[{t:0,values:{'camera.fov':50}},{t:1,values:{'camera.fov':40}}],[{id:'camera.fov',label:'Field of view',unit:'deg'}]);
assert.equal(observations[0].editable,false);assert.equal(observations[0].interpolation,'observed-linear');
for(const scene of sceneIds){
 const contract=getAuthoredAnimationProtocol(scene);
 assert.equal(contract.version,1);
 if(scene!=='bax')assert.ok(contract.groups.every(group=>!group.source.editable&&group.source.channels.length===0));
 await validateStudioParameters({scene,motion:nativeMotion});
}
console.log(JSON.stringify({passed:true,sourceChannelComparisons:comparisons,sourcePreserved:true,nativeBezierRoundTrip:true,sharedVectorTiming:true,sampledCurvesReadOnly:true,allScenesCompatible:true}));
