import assert from 'node:assert/strict';
import {moveCurveSelection} from '../src/engine/curve-interaction.js';
import {editAuthoredKeys} from '../src/engine/authored-animation.js';
import motion from '../project/motion.json' with {type:'json'};
const source=[{t:0,value:0},{t:1,value:2},{t:2,value:3},{t:3,value:5}],original=structuredClone(source);
const moved=moveCurveSelection(source,[1,2],.3,1,{maxTime:3,minValue:0,maxValue:5});
assert.ok(Math.abs(moved[2].t-moved[1].t-1)<1e-6);assert.equal(moved[2].value-moved[1].value,1);assert.deepEqual(moved[0],source[0]);assert.deepEqual(source,original);
const blocked=moveCurveSelection(source,[1,2],10,10,{maxTime:3,minValue:0,maxValue:5});assert.ok(blocked[2].t<3);assert.equal(blocked[2].value,5);assert.equal(blocked[2].t-blocked[1].t,1);
assert.deepEqual(moveCurveSelection(source,[0,1,2,3],-1,0,{maxTime:3}),source);
assert.equal(moveCurveSelection(source,[1,2],.077,0,{maxTime:3,step:1/30,anchor:1})[1].t,1.066667);
const patches=motion.tracks['camera.position'].slice(1,3).map((key,i)=>({index:i+1,t:key.t+.1,value:key.value[0]+.2}));
const edited=editAuthoredKeys('objects','camera','camera.position.x',patches,{motion});
for(const patch of patches){assert.equal(edited.tracks['camera.position'][patch.index].t,patch.t);assert.deepEqual(edited.tracks['camera.position'][patch.index].value.slice(1),motion.tracks['camera.position'][patch.index].value.slice(1));}
assert.throws(()=>editAuthoredKeys('objects','camera','camera.position.x',[{index:1,t:0,value:1}],{motion}));
console.log('Curve selection: rigid movement, bounds, frame snapping, immutability and atomic shared-axis edits passed.');
