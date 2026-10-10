import assert from 'node:assert/strict';
import {shutterSamples} from '../src/engine/temporal.js';
const a=shutterSamples(2,{samples:24,fps:30,duration:10});
assert.deepEqual(a,shutterSamples(2,{samples:24,fps:30,duration:10}));
assert.equal(a.length,24);assert.ok(Math.abs(a.reduce((sum,s)=>sum+s.weight,0)-1)<1e-12);
assert.ok(Math.abs(a.reduce((sum,s)=>sum+s.time*s.weight,0)-2)<1e-12);
assert.ok(a[0].weight<a[11].weight);assert.ok(a.every((s,i)=>i===0||s.time>a[i-1].time));
for(const cuts of [[2],[{time:2}],[{t:2}]]){
 const before=shutterSamples(1.999,{cuts,samples:64});assert.ok(before.every(s=>s.time<2));
 const exact=shutterSamples(2,{cuts,samples:64});assert.ok(exact.every(s=>s.time>=2));
 const after=shutterSamples(2.001,{cuts,samples:64});assert.ok(after.every(s=>s.time>=2));
}
assert.ok(shutterSamples(0,{samples:64}).every(s=>s.time>=0));assert.ok(shutterSamples(10,{samples:64}).every(s=>s.time<=10));
assert.deepEqual(shutterSamples(1,{shutterAngle:0}),[{time:1,weight:1}]);assert.deepEqual(shutterSamples(1,{samples:1}),[{time:1,weight:1}]);
assert.ok(shutterSamples(1,{fps:60})[0].time>shutterSamples(1,{fps:30})[0].time);
for(const opts of [{samples:65},{samples:1.1},{fps:0},{cuts:[{}]},{cuts:[11]},{shutterAngle:361},{profile:'random'}])assert.throws(()=>shutterSamples(2,opts));
console.log(JSON.stringify({type:'tests',passed:true,tests:12,note:'Deterministic schedules, normalized weights, centered exposure, hard-cut boundaries, fps and validation.'}));
