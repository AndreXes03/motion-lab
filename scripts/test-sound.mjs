import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planSound,renderSound,encodeWav,normalizeSound,soundKits} from '../src/engine/sound-design.js';
const duration=2,rate=60;
const fixture=(moving=true)=>({duration,rate,frames:Array.from({length:121},(_,i)=>{const t=i/rate,x=moving?Math.sin(Math.PI*t)**2:0;return {time:t,camera:{position:[x*3,0,4],quaternion:[0,0,0,1]},objects:{box:{position:[x,0,0],quaternion:[0,0,Math.sin(x/2),Math.cos(x/2)],pan:x-.5,visibility:1}}};})});
const p=planSound(fixture());assert(p.events.some(e=>e.module==='camera'));assert(p.events.some(e=>e.module==='objects'));assert(p.events.some(e=>e.module==='accents'));
assert.equal(planSound(fixture(false)).events.length,0);
const render=()=>renderSound(p,{sampleRate:12000,stems:true});const a=render(),b=render();assert.deepEqual(a.channels,b.channels);assert(a.stats.peak<=.890001);assert(a.stats.rms>.01);
const disabled=renderSound(planSound(fixture(),{enabled:false}),{sampleRate:12000});assert(disabled.channels.every(c=>c.every(v=>v===0)));
const silent=renderSound(planSound(fixture(),{camera:0,objects:0,accents:0,music:0}),{sampleRate:12000});assert(silent.channels.every(c=>c.every(v=>v===0)));
for(let i=0;i<a.channels[0].length;i+=29)for(let c=0;c<2;c++)assert(Math.abs(a.channels[c][i]-Object.values(a.stems).reduce((s,x)=>s+x[c][i],0))<1e-6);
assert.equal(planSound(fixture(),{tempo:'manual',bpm:137}).bpm,137);
assert(planSound(fixture(),{density:1}).events.length>=planSound(fixture(),{density:0}).events.length);
for(const [key,value]of [['music',NaN],['tempo','bad'],['cameraKit','bad'],['seed',1.2],['bpm',10],['enabled','yes']])assert.throws(()=>normalizeSound({[key]:value}));
const hashes=new Set();for(const kit of soundKits.camera){const s=renderSound(planSound(fixture(),{cameraKit:kit,music:0,objects:0,accents:0}),{sampleRate:12000});hashes.add(createHash('sha256').update(encodeWav(s.channels,12000)).digest('hex'));}assert.equal(hashes.size,8);
const wave=encodeWav(a.channels,12000);assert.equal(new DataView(wave.buffer).getUint32(24,true),12000);
console.log(JSON.stringify({passed:true,checks:['motion detection','stationary silence','three modules','deterministic PCM','stem summation','peak headroom','mute','manual BPM','density','validation','distinct timbres','WAV header'],events:p.events.length,bpm:p.bpm}));

// Equal-distance gestures become brighter and stronger when performed faster.
const gesture=(extent,seconds)=>({duration:4,rate:60,frames:Array.from({length:241},(_,i)=>{const u=Math.min(1,i/60/seconds),x=extent*u*u*(3-2*u);return {time:i/60,camera:{position:[x,0,4],quaternion:[0,0,0,1]},objects:{}};})});
const slow=planSound(gesture(4,2)),fast=planSound(gesture(4,.6)),wide=planSound(gesture(8,2));
const cameraEvent=p=>p.events.find(e=>e.module==='camera');
assert(cameraEvent(fast).gain>cameraEvent(slow).gain);
assert(cameraEvent(wide).gain>cameraEvent(slow).gain);
assert(cameraEvent(fast).duration<cameraEvent(slow).duration);
assert(cameraEvent(wide).extent>cameraEvent(slow).extent);
function brightness(p){p.settings={...p.settings,music:0,objects:0,accents:0};const x=renderSound(p,{sampleRate:12000}).channels[0];let energy=0,delta=0;for(let i=1;i<x.length;i++){energy+=x[i]*x[i];delta+=(x[i]-x[i-1])**2;}return delta/energy;}
assert(brightness(fast)>brightness(slow));
console.log(JSON.stringify({adaptiveWhoosh:'passed',slow:cameraEvent(slow).gain,fast:cameraEvent(fast).gain,wide:cameraEvent(wide).gain,checks:['velocity drives loudness','velocity drives spectral brightness','travel drives body','gesture drives duration']}));
const {planFoley}=await import('../src/engine/sound-foley.js');
const localFixture=motion=>({duration:2,rate:60,frames:Array.from({length:121},(_,i)=>{const t=i/60,a=motion?(t<1?-t:-(2-t)):0;const object=profile=>({soundProfile:profile,localQuaternion:[0,Math.sin(a/2),0,Math.cos(a/2)],localRotation:[0,a,0],quaternion:[0,Math.sin(t),0,Math.cos(t)],visibility:1,pan:0});return {objects:{dial:object('dial'),hinge:object('hinge'),rotor:object('rotor')}};})});
assert.equal(planFoley(localFixture(false),normalizeSound()).events.length,0,'Parent motion must not trigger local mechanisms');
const detailed=planFoley(localFixture(true),normalizeSound());assert(detailed.events.some(e=>e.foley==='dial-click'));assert(detailed.events.some(e=>e.foley==='hinge-glide'));assert(detailed.events.some(e=>e.foley==='rotor-spin'));
console.log(JSON.stringify({foleyTests:'passed',events:detailed.events.length}));
