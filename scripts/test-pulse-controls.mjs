import assert from 'node:assert/strict';
import {MeshPhysicalMaterial,MeshStandardMaterial} from 'three';
import {createPulseSurfaceControls} from '../src/scenes/pulse-surface-controls.js';
import {resolveParameters} from '../src/engine/project-controls.js';
import {validateStudioParameters} from './studio-api.mjs';
import {studyControlDefinitions} from '../src/engine/scene-capabilities.js';
import {evaluateParameterAnimation} from '../src/engine/parameter-animation.js';

const shell=new MeshPhysicalMaterial({roughness:.43}),metal=new MeshStandardMaterial({roughness:.16});
const apply=createPulseSurfaceControls({shells:[shell,shell],metals:[metal]});
apply({shellRoughness:.25,metalRoughness:3});
assert.equal(shell.roughness,.1075);
assert.equal(metal.roughness,.48);
apply({shellRoughness:2,metalRoughness:.25});
assert.equal(shell.roughness,.86);
assert.equal(metal.roughness,.04);
apply({shellRoughness:.25,metalRoughness:3});
assert.equal(shell.roughness,.1075,'random seeking never compounds material gains');
apply({});
assert.equal(shell.roughness,.43,'reset restores authored surface');
assert.equal(metal.roughness,.16);

const definitions=studyControlDefinitions.pulse;
for(const definition of definitions) {
  const values=Object.fromEntries(definitions.map(d=>[d.id,d.default]));
  values[definition.id]=definition.max;
  const parameters=resolveParameters('pulse',values,'original');
  const validated=await validateStudioParameters(parameters);
  assert.equal(validated.sceneControls[definition.id],definition.max,`${definition.id} survives recipe validation`);
  const animated=evaluateParameterAnimation({...parameters,animation:{version:1,tracks:{[definition.id]:[{t:0,value:definition.min,ease:'linear'},{t:1,value:definition.max,ease:'linear'}]}}},.5);
  assert.ok(Math.abs(animated.sceneControls[definition.id]-(definition.min+definition.max)/2)<1e-9,`${definition.id} is actually keyframeable`);
}
shell.dispose();metal.dispose();
console.log(JSON.stringify({pulseControls:'passed',controls:definitions.length,surfaces:'deterministic',recipes:'validated',animation:'evaluated'}));
