import assert from 'node:assert/strict';
import {beatClock,springIn} from '../src/engine/beat-clock.js';
import {resolveParameters} from '../src/engine/project-controls.js';
import {validateStudioParameters} from './studio-api.mjs';
for(const time of [0,.5,2.5,5,7.5,10]){assert.equal(beatClock(time).phase,0);assert.equal(beatClock(time).pulse,1);}
assert.throws(()=>beatClock(NaN));assert.throws(()=>beatClock(1,0));assert.equal(springIn(0,1),0);
const resolved=resolveParameters('pop',{accent:'#6bddf5',speed:1.5});assert.equal(resolved.graphics.accent,'#6bddf5');
const normalized=await validateStudioParameters({...resolved,studio:{values:{accent:'#6bddf5',speed:1.5},preset:'original'}});assert.equal(normalized.scene,'pop');
await assert.rejects(()=>validateStudioParameters({scene:'pop',graphics:{speed:100}}));
await assert.rejects(()=>validateStudioParameters({scene:'pop',graphics:{accent:'invalid'}}));
console.log('PASS pop beat boundaries, parameter resolution and persistence validation');

const {sampleGraphicCamera}=await import('../src/engine/graphic-camera.js');
const shots=[{time:0,x:100,zoom:1},{time:1,x:300,zoom:2}];
assert.equal(sampleGraphicCamera(.5,shots).x,200);
assert.equal(sampleGraphicCamera(-1,shots).zoom,1);
assert.equal(sampleGraphicCamera(10,shots).zoom,2);
assert.deepEqual(sampleGraphicCamera(.5,shots),sampleGraphicCamera(.5,shots));

assert.ok(Math.abs(beatClock(.5-.00001).pulse-beatClock(.5+.00001).pulse)<1e-8, "beat pulse must stay continuous across the shutter");

assert.equal(resolveParameters('pop',{cameraMotion:0}).graphics.cameraMotion,0);
await assert.rejects(()=>validateStudioParameters({scene:'pop',graphics:{cameraMotion:2}}));
assert.equal((await validateStudioParameters({scene:'pop',graphics:{cameraMotion:.5}})).graphics.cameraMotion,.5);

assert.equal(resolveParameters('pop',{fisheye:0}).graphics.fisheye,0);
await assert.rejects(()=>validateStudioParameters({scene:'pop',graphics:{fisheye:.8}}));
assert.equal((await validateStudioParameters({scene:'pop',graphics:{fisheye:.3}})).graphics.fisheye,.3);
