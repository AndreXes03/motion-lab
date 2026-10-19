import assert from 'node:assert/strict';
import {createLaunchDemo,launchPose,launchControls,launchCuts,launchControlDefaults} from '../src/scenes/launch-demo.js';

const scene=createLaunchDemo();
assert.equal(scene.config.duration,24);
assert.deepEqual(launchCuts,[0,4,9,14,19,24]);
assert.deepEqual(launchControls(),launchControlDefaults);
assert.equal(launchControls({sceneControls:{screenshotScale:Infinity}}).screenshotScale,1);
assert.equal(launchControls({sceneControls:{framingX:4}}).framingX,1);
assert.equal(launchControls({sceneControls:{cardShadow:-10}}).cardShadow,0);

// Retiming a group changes its observed pose, never the edit or another owner.
for(const group of ['camera','screens','typography']){
 const time=4.55,baseline=launchPose(time),parameters={animation:{groups:{[group]:{start:4,end:9,rate:1,keys:[{t:0,value:0,ease:'in'},{t:5,value:1,ease:'linear'}]}}}};
 const edited=launchPose(time,parameters),key={camera:'camera',screens:'screen',typography:'typography'}[group];
 assert.equal(edited.index,baseline.index);
 assert.notDeepEqual(edited[key],baseline[key]);
 for(const other of ['camera','screen','typography'].filter(value=>value!==key))assert.deepEqual(edited[other],baseline[other]);
 const channels=scene.animationChannels(group),values=scene.animationState(group,time,parameters);
 assert.ok(channels.length>1);
 assert.deepEqual(Object.keys(values),channels.map(channel=>channel.id));
 assert.ok(Object.values(values).every(Number.isFinite));
}

// Seeking away and back, and inspecting observations, cannot mutate a recipe.
const parameters={scene:'launch',sceneControls:{motionStrength:1.2}},snapshot=structuredClone(parameters),before=launchPose(10.25,parameters);
for(const time of [23.9,0,19,4,14,9,6.123])for(const group of ['camera','screens','typography'])scene.animationState(group,time,parameters);
assert.deepEqual(launchPose(10.25,parameters),before);
assert.deepEqual(parameters,snapshot);
assert.deepEqual(scene.animationChannels('unknown'),[]);
await scene.prepare();
scene.dispose();
await assert.rejects(()=>scene.prepare(),/disposed/);
console.log(JSON.stringify({launchScene:'passed',duration:24,controls:13,groupIsolation:'passed',observedPoses:'passed',seekDeterminism:'passed'}));
