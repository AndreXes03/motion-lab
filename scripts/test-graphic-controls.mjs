import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProceduralDemo} from '../src/scenes/procedural-demo.js';
import {controlledCardPose} from '../src/scenes/replay-demo.js';
import {replayCardPose} from '../src/scenes/replay-motion-direction.js';
import {createPopDemo} from '../src/scenes/pop-demo.js';
import {graphicControls} from '../src/scenes/graphic-controls.js';
import {studyControlDefinitions} from '../src/engine/scene-capabilities.js';
import {resolveParameters} from '../src/engine/project-controls.js';
import {validateStudioParameters} from './studio-api.mjs';
import {evaluateParameterAnimation} from '../src/engine/parameter-animation.js';

// Numeric JSON hashes vary at Math.sin/cos ULPs between JS platforms. Six decimal
// places retain subpixel geometry checks; exact same-runtime seeking is tested below.
const procedural=createProceduralDemo(),hash=nodes=>createHash('sha256').update(JSON.stringify(nodes,(_,value)=>typeof value==='number'?Number(value.toFixed(6)):value)).digest('hex');
// Re-derived from approved pre-controls source 502de6cee0490b3f7c609d1b4556388f1636ac95,
// src/scenes/procedural-demo.js, at the same six-decimal precision. Its nodes match
// the new default controls exactly on Linux x64; no scene or film content changed.
const original=[
 [.5,'5111033518ecf935cff411a32b47863c956134d6e776bc86a3b12179dadf2c84'],
 [2.5,'506d8e04313be1b401bd9ee7419d8360908a9d09008c51cb7a635c833956f874'],
 [4.5,'758d10d356484dfffac449fcdbaa59c18ea0541e99ed39903c27812c511c28cc'],
 [6.5,'535d70552e91ce5c3a3603b90d965bea8285e5f6a114ff1f7718ef4aa07bae6f'],
 [8,'f7f33ae9df50f4c7469a18ac6426b4a8eec7ddd3940f8b174de0564173006f1f'],
 [9.5,'c700cb7e16b1e4e210dfa50ce533740be8d848d50c69dd2444ae8956c0af49ff']
];
for(const [time,expected] of original)assert.equal(hash(procedural.nodesAt(time)),expected,`authored procedural chapter at ${time} is unchanged`);
const changed=(time,values)=>procedural.nodesAt(time,{sceneControls:values}),find=(nodes,id)=>nodes.find(n=>n.id===`lab.${id}`);
const base=procedural.nodesAt(.5);
assert.equal(find(changed(.5,{typeScale:.7}),'headline').font,'700 133px Arial, sans-serif');
assert.equal(find(changed(.5,{overlayOpacity:0}),'brand').opacity,0);
assert.equal(find(changed(.5,{strokeWidth:2}),'flow.0').lineWidth,6);
assert.equal(find(changed(.5,{particleSize:2}),'flow.head.0').radius,10);
assert.notDeepEqual(find(changed(.5,{waveAmplitude:0}),'flow.0').commands,find(base,'flow.0').commands);
assert.notDeepEqual(find(changed(.5,{shapeScale:.6}),'flow.0').commands,find(base,'flow.0').commands);
assert.equal(find(changed(8,{echoOpacity:0}),'kinetic.word.1').opacity,0);
assert.notDeepEqual(changed(2.5,{beatStrength:0}),procedural.nodesAt(2.5));
assert.deepEqual(procedural.nodesAt(.5),base,'edits and random seeks preserve the exact same-runtime default');
const replayDefault=graphicControls('replay');
assert.deepEqual(controlledCardPose(2,6,replayDefault),replayCardPose(2,6));
assert.equal(controlledCardPose(2,6,{...replayDefault,cardDepth:1.5}).z,replayCardPose(2,6).z*1.5);
const pop=createPopDemo();
assert.equal(pop.nodesAt(.5,{sceneControls:{typeScale:.6}})[1].font,'900 132px Arial');
assert.equal(pop.nodesAt(.5)[1].font,'900 220px Arial');

let controls=0;
for(const scene of ['procedural','replay','pop'])for(const definition of studyControlDefinitions[scene]) {
 const parameters=resolveParameters(scene,{[definition.id]:definition.max});
 assert.equal(parameters.sceneControls[definition.id],definition.max);
 const validated=await validateStudioParameters(parameters);
 assert.equal(validated.sceneControls[definition.id],definition.max);
 const animated=evaluateParameterAnimation({...parameters,animation:{version:1,tracks:{[definition.id]:[{t:0,value:definition.min,ease:'linear'},{t:1,value:definition.max,ease:'linear'}]}}},.5);
 assert.ok(Math.abs(animated.sceneControls[definition.id]-(definition.min+definition.max)/2)<1e-9);
 controls++;
}
console.log(JSON.stringify({graphicControls:'passed',controls,authoredProceduralChapters:original.length,recipes:'validated',keyframes:'evaluated',randomSeek:'stable'}));
