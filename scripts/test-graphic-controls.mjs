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

const procedural=createProceduralDemo(),hash=nodes=>createHash('sha256').update(JSON.stringify(nodes)).digest('hex');
// Captured from the approved procedural node output before adding these controls.
const original=[
 [.5,'32d74600712d9953b1856a07786fc84f9b0f94726a38a5fba935d9acc6646412'],
 [2.5,'d10f6292e53dad7f7c65c5f0222e208616c211f56158472e326f40c8624c5261'],
 [4.5,'1ecf497bf54e1d7fd8e65ae4349ac1fd0ef77616b14c8dff972060828cc94253'],
 [6.5,'d0f77bf03c5040075c211ba664599ee46f7952afedebdbd23030747dc2f96d27'],
 [8,'01223ca767b767a025204ad01c845a4c3337844586e93dd0087aa1563a97053e'],
 [9.5,'eafdd78fc4bad1bee152b4e4d50b4dc32a475180ce851673e1af0deddc7fc98c']
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
assert.equal(hash(procedural.nodesAt(.5)),original[0][1],'edits and random seeks preserve the default');
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
