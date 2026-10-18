import assert from 'node:assert/strict';
import authored from './fixtures/procedural-authored-nodes.json' with {type:'json'};
import {createProceduralDemo} from '../src/scenes/procedural-demo.js';
import {controlledCardPose} from '../src/scenes/replay-demo.js';
import {replayCardPose} from '../src/scenes/replay-motion-direction.js';
import {createPopDemo} from '../src/scenes/pop-demo.js';
import {graphicControls} from '../src/scenes/graphic-controls.js';
import {studyControlDefinitions} from '../src/engine/scene-capabilities.js';
import {resolveParameters} from '../src/engine/project-controls.js';
import {validateStudioParameters} from './studio-api.mjs';
import {evaluateParameterAnimation} from '../src/engine/parameter-animation.js';

const procedural=createProceduralDemo(),original=authored.frames;
// The fixture comes from the approved pre-controls commit, rounded to 6 decimals.
// Math.sin/cos last bits vary between V8 platforms. Preserve all node structure,
// text and IDs exactly, and compare geometry within one millionth of a pixel.
function assertAuthored(actual,expected,path='nodes') {
 if(typeof expected==='number') {
  assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-6,`${path}: expected ${expected}, received ${actual}`);
  return;
 }
 if(expected!==null&&typeof expected==='object') {
  assert.equal(Array.isArray(actual),Array.isArray(expected),`${path}: container type`);
  assert.deepEqual(Object.keys(actual??{}),Object.keys(expected),`${path}: structure`);
  for(const key of Object.keys(expected))assertAuthored(actual[key],expected[key],`${path}.${key}`);
  return;
 }
 assert.equal(actual,expected,path);
}
for(const {time,nodes} of original)assertAuthored(procedural.nodesAt(time),nodes,`chapter ${time}`);
// Guard the comparator itself: allow harmless rounding, reject visible drift.
assertAuthored([1+1e-8],[1]);
assert.throws(()=>assertAuthored([1.001],[1]),/expected 1/);
assert.throws(()=>assertAuthored({text:'CHANGED'},{text:'MOTION'}));
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
assert.deepEqual(procedural.nodesAt(.5),base,'edits and random seeks preserve the default exactly within the same runtime');
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
