import assert from 'node:assert/strict';
import {mixAudioTracks} from '../src/engine/audio-mix.js';
import {soundDefaults,normalizeSound,planSound,renderSound} from '../src/engine/sound-design.js';
import {editAudioClip,waveformPeaks} from '../src/viewer/audio-timeline.js';
const context={createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:i=>data[i],copyToChannel:(input,i)=>data[i].set(input)};}};
const input=context.createBuffer(1,200,100);input.getChannelData(0).fill(.4);
const track={id:'clip',assetId:'a'.repeat(64),name:'Tone',enabled:true,sourceStart:.2,timelineStart:.3,duration:1,volume:.5,fadeIn:.2,fadeOut:.4};
const audio={version:1,tracks:[track,{...track,id:'disabled',enabled:false}]};
for(const [master,muted,ratio]of [[.8,false,1],[.4,false,.5],[0,false,0],[.8,true,0]]){
 const sound={...soundDefaults,master,muted},base=context.createBuffer(2,150,100);for(let c=0;c<2;c++)base.getChannelData(c).fill(.1*ratio);
 let loads=0;const result=await mixAudioTracks(base,context,audio,sound,async()=>{loads++;return input;});assert.equal(loads,1);
 assert.ok(Math.abs(result.getChannelData(0)[60]-.3*ratio)<1e-7,'One shared gain for generated and imported, no double gain');
 assert.ok(Math.abs(result.getChannelData(1)[30]-.1*ratio)<1e-7,'Source delay and fade start');
 assert.ok(Math.abs(result.getChannelData(0)[120]-.15*ratio)<1e-7,'Fade out retains timeline position');
}
await assert.rejects(mixAudioTracks(context.createBuffer(2,150,100),context,{version:1,tracks:[{...track,sourceStart:1.5}]},soundDefaults,async()=>input),/beyond its source/);
const moved=editAudioClip(track,'move',100,{sourceDuration:2,timelineDuration:2});assert.equal(moved.timelineStart,1.99);assert.equal(moved.sourceStart,.2);assert.equal(moved.duration,1);
const left=editAudioClip(track,'left',.25,{sourceDuration:2,timelineDuration:2});assert.ok(Math.abs(left.sourceStart-.45)<1e-9);assert.ok(Math.abs(left.timelineStart-.55)<1e-9);assert.ok(Math.abs(left.duration-.75)<1e-9);
const extend=editAudioClip(track,'left',-100);assert.equal(extend.sourceStart,0);assert.ok(Math.abs(extend.timelineStart-.1)<1e-9);
const right=editAudioClip(track,'right',100,{sourceDuration:1.1,timelineDuration:5});assert.ok(Math.abs(right.duration-.9)<1e-9);
const short=editAudioClip(track,'right',-100);assert.equal(short.duration,.01);assert.equal(short.fadeIn,.01);assert.equal(short.fadeOut,.01);
assert.deepEqual(waveformPeaks(input,.2,1,4),Array(4).fill(input.getChannelData(0)[0]));
assert.equal(normalizeSound({}).muted,false);assert.throws(()=>normalizeSound({muted:'yes'}));
const telemetry={duration:1,rate:10,frames:Array.from({length:11},(_,i)=>({time:i/10,camera:{position:[0,0,0],quaternion:[0,0,0,1]},objects:{}})),cuts:[]};
const full=renderSound(planSound(telemetry,soundDefaults),{sampleRate:1000}),half=renderSound(planSound(telemetry,{...soundDefaults,master:.4}),{sampleRate:1000}),silent=renderSound(planSound(telemetry,{...soundDefaults,muted:true}),{sampleRate:1000});
assert.ok(full.stats.peak>0);for(let i=0;i<1000;i++){assert.ok(Math.abs(half.channels[0][i]-full.channels[0][i]*.5)<1e-8);assert.ok(silent.channels[0][i]===0);}
console.log('Audio mix + timeline: global master/mute, disabled clips, fades, source bounds, waveform bins and move/trim correspondence passed.');
