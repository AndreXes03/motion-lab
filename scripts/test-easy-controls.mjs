import assert from 'node:assert/strict';
import {sceneIds} from '../src/scene-registry.js';
import {freshSceneSnapshot} from '../src/viewer/scene-snapshot.js';
import {createControlManifest,getControlCatalog,readControlValue,validateControlManifest} from '../src/engine/control-catalog.js';
import {easyControlsFor,easyChoiceState,applyEasyChoice,applyEasyAmount,easySliderAmount} from '../src/engine/easy-controls.js';
import {validateStudioParameters} from './studio-api.mjs';
for(const scene of sceneIds){
 const base=freshSceneSnapshot(scene),saved=structuredClone(base),catalog=getControlCatalog(scene),manifest=createControlManifest(scene),groups=easyControlsFor(scene,manifest);
 assert.ok(groups.length>=1&&groups.length<=5,scene+' requires authored Easy controls');
 for(const group of groups){
  if(group.presentation==='slider')for(const amount of [0,17,25,50,73,100]){
   const edited=applyEasyAmount(base,group,amount);assert.ok(Math.abs(easySliderAmount(group,edited.parameters,catalog)-amount)<1e-6);
   const normalized=await validateStudioParameters(edited.parameters);assert.ok(Math.abs(easySliderAmount(group,normalized,catalog)-amount)<1e-6,'Slider survives renderer round-trip');assert.deepEqual(base,saved);
  }

  for(const choice of group.choices){
   const edited=applyEasyChoice(base,group,choice.id);assert.deepEqual(base,saved,'Never mutate the input recipe');
   for(const [id,value]of Object.entries(choice.values))assert.equal(readControlValue(catalog.find(c=>c.id===id),edited.parameters),value);
   const normalized=await validateStudioParameters(edited.parameters);
   for(const [id,value]of Object.entries(choice.values))assert.equal(readControlValue(catalog.find(c=>c.id===id),normalized),value,'Saved/rendered recipe retains Easy values');
   assert.deepEqual(edited.parameters.sound,base.parameters.sound);assert.deepEqual(edited.parameters.audio,base.parameters.audio);assert.deepEqual(edited.parameters.motion,base.parameters.motion);assert.deepEqual(edited.config,base.config);assert.deepEqual(edited.exportSettings,base.exportSettings);
   assert.equal(easyChoiceState(group,edited.parameters,catalog).selected,choice.id);
  }
  const id=Object.keys(group.choices[0].values)[0],animated=structuredClone(base);animated.parameters.animation={version:1,enabled:true,tracks:{[id]:[{t:0,value:1}]}};
  assert.throws(()=>applyEasyChoice(animated,group,group.choices[0].id),/custom animation/);
  if(group.presentation==='slider'){assert.throws(()=>applyEasyAmount(animated,group,25),/custom animation/);assert.throws(()=>applyEasyAmount(base,group,101),/Invalid Easy slider/);}
 }
 const legacy=structuredClone(manifest);delete legacy.easy;assert.ok(easyControlsFor(scene,legacy).length);assert.equal(validateControlManifest(legacy,scene).easy,undefined,'Old manifests remain valid without rewriting recipes');
 const overlap=structuredClone(manifest);overlap.easy=[groups[0],{...groups[0],id:'duplicate'}];assert.throws(()=>validateControlManifest(overlap,scene),/compete/);
 const invalid=structuredClone(manifest);invalid.easy[0].choices[0].values.unknown=1;assert.throws(()=>validateControlManifest(invalid,scene));
}
console.log('Easy choices: all scenes, safe writes, renderer round-trip, legacy recipes and animation protection passed');
