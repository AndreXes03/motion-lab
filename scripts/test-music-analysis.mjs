import assert from 'node:assert/strict';
import {analyzeMusicPcm,proposeMusicExcerpt,proposeBeatAlignedEdits} from '../src/engine/music-analysis.js';

function clicks(duration,interval=.5,sampleRate=1000){
  const channel=new Float32Array(Math.round(duration*sampleRate));
  for(let time=.25;time<duration;time+=interval){const start=Math.round(time*sampleRate);channel.fill(.8,start,Math.min(channel.length,start+Math.round(.01*sampleRate)));}
  return channel;
}
const channel=clicks(12),analysis=analyzeMusicPcm({channels:[channel],sampleRate:1000});
assert.equal(analysis.status,'ready');assert.ok(Math.abs(analysis.bpm-120)<1);assert.ok(analysis.confidence>.8);
assert.ok(analysis.onsets.length>=23);assert.ok(Math.abs(analysis.beats[0]-.25)<=analysis.binDuration);
assert.ok(analysis.waveform.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
for(const bpm of [112,160,180]){
  const result=analyzeMusicPcm({channels:[clicks(12,60/bpm,48000)],sampleRate:48000});
  assert.ok(result.bpm!==null&&Math.abs(result.bpm-bpm)<1,`${bpm} BPM must not collapse to its slower multiple`);
}
const inverse=Float32Array.from(channel,value=>-value);
assert.deepEqual(analyzeMusicPcm({channels:[channel,inverse],sampleRate:1000}).envelope,analysis.envelope,'Stereo power must not cancel opposite phases');
analyzeMusicPcm({channels:[clicks(8,.4)],sampleRate:1000});
assert.deepEqual(analyzeMusicPcm({channels:[channel],sampleRate:1000}),analysis,'Unrelated analysis cannot affect deterministic results');

for(const [pcm,sampleRate,status] of [
  [new Float32Array(5000),1000,'silence'],
  [clicks(2.9),1000,'too-short'],
  [new Float32Array(5000).fill(.4),1000,'uncertain'],
  [Float32Array.from({length:240000},(_,i)=>.5*Math.sin(i*2*Math.PI*6400/48000)),48000,'uncertain']
]){
  const result=analyzeMusicPcm({channels:[pcm],sampleRate});
  assert.equal(result.status,status);assert.equal(result.bpm,null);assert.deepEqual(result.beats,[]);
}
let seed=4821;
const noise=Float32Array.from({length:12000},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/4294967296-.5)*.4;});
assert.equal(analyzeMusicPcm({channels:[noise],sampleRate:1000}).bpm,null,'Uncorrelated noise is not a confident beat grid');
const corrupt=new Float32Array([NaN,Infinity,-Infinity,0,1,-1]);
assert.ok(analyzeMusicPcm({channels:[corrupt],sampleRate:1000}).envelope.every(Number.isFinite));
assert.throws(()=>analyzeMusicPcm({channels:[],sampleRate:1000}));
assert.throws(()=>analyzeMusicPcm({channels:[channel,channel.subarray(1)],sampleRate:1000}));
assert.throws(()=>analyzeMusicPcm({channels:[channel],sampleRate:0}));

// A single loud transient must not outrank a sustained usable window.
const dynamics=new Float32Array(20000).fill(.05);dynamics.fill(1,5000,5010);dynamics.fill(.5,12000,18000);
const dynamicAnalysis=analyzeMusicPcm({channels:[dynamics],sampleRate:1000}),before=structuredClone(dynamicAnalysis);
const excerpt=proposeMusicExcerpt(dynamicAnalysis,4);
assert.equal(excerpt.kind,'automatic-proposal');assert.ok(excerpt.start>=12&&excerpt.start<=14);assert.equal(excerpt.end-excerpt.start,4);
assert.ok(excerpt.end<=dynamicAnalysis.duration);assert.ok(excerpt.candidates.length<=5);assert.deepEqual(dynamicAnalysis,before);
assert.deepEqual(proposeMusicExcerpt(dynamicAnalysis,4),excerpt);
const shortExcerpt=proposeMusicExcerpt(analysis,15);
assert.equal(shortExcerpt.start,0);assert.equal(shortExcerpt.end,12);assert.equal(shortExcerpt.duration,12);assert.equal(shortExcerpt.shortTrack,true);
const silentAnalysis=analyzeMusicPcm({channels:[new Float32Array(5000)],sampleRate:1000});
assert.equal(proposeMusicExcerpt(silentAnalysis,2).start,0);assert.throws(()=>proposeMusicExcerpt(analysis,0));

const edit={version:1,clips:[
  {id:'intro',sourceStart:2,sourceEnd:4,duration:2.1},
  {id:'hero',sourceStart:8,sourceEnd:12,duration:3},
  {id:'outro',sourceStart:14,sourceEnd:18,duration:4.9}
]},original=structuredClone(edit);
const grid={bpm:120,confidence:.9,beats:Array.from({length:30},(_,i)=>.25+i*.5)};
const proposal=proposeBeatAlignedEdits(grid,edit,{musicStart:.25});
assert.equal(proposal.snappedCuts,2);assert.deepEqual(proposal.edit.clips.map(clip=>clip.duration),[2,3,5]);
assert.deepEqual(edit,original);assert.equal(proposal.edit.clips.reduce((sum,clip)=>sum+clip.duration,0),10);
for(let i=0;i<edit.clips.length;i++){
  const {duration:ignored,...source}=edit.clips[i],{duration:proposedDuration,...proposedSource}=proposal.edit.clips[i];
  assert.deepEqual(proposedSource,source);assert.ok(proposedDuration>0);
}
const precise=proposeBeatAlignedEdits(grid,edit,{musicStart:.123456789});
assert.equal(precise.edit.clips[0].duration,2.25-.123456789,'An exact trim offset must retain its precision');
assert.deepEqual(proposeBeatAlignedEdits(grid,edit,{maxShift:.01}).edit,edit);
assert.deepEqual(proposeBeatAlignedEdits({...grid,confidence:.2},edit).edit,edit);
assert.deepEqual(proposeBeatAlignedEdits(silentAnalysis,edit).edit,edit);
assert.deepEqual(proposeBeatAlignedEdits({...grid,beats:[.25],beatInterval:.5,beatPhase:.25},edit,{musicStart:1000.25}).edit,proposal.edit,'A later trim uses the compact grid beyond display-beat storage');
const tiny={version:1,clips:[{id:'a',sourceStart:0,sourceEnd:1,duration:.05},{id:'b',sourceStart:1,sourceEnd:2,duration:1}]};
assert.deepEqual(proposeBeatAlignedEdits(grid,tiny).edit,tiny);
const many={version:1,clips:Array.from({length:64},(_,i)=>({id:`c${i}`,sourceStart:i,sourceEnd:i+1,duration:.15+i*.001}))};
const manyProposal=proposeBeatAlignedEdits(grid,many,{minClipDuration:.1});
assert.equal(manyProposal.edit.clips.reduce((sum,clip)=>sum+clip.duration,0),many.clips.reduce((sum,clip)=>sum+clip.duration,0));
assert.ok(manyProposal.edit.clips.every(clip=>clip.duration>=.1-1e-12));
let editSeed=5;
const random=()=>{editSeed=(Math.imul(editSeed,1664525)+1013904223)>>>0;return editSeed/4294967296;};
for(let trial=0;trial<300;trial++){
  const source={version:1,clips:Array.from({length:2+Math.floor(random()*15)},(_,i)=>({id:`p${i}`,sourceStart:i,sourceEnd:i+1,duration:.1+random()*10}))};
  const aligned=proposeBeatAlignedEdits({...grid,beatInterval:.5,beatPhase:.26},source).edit;
  assert.equal(aligned.clips.reduce((sum,clip)=>sum+clip.duration,0),source.clips.reduce((sum,clip)=>sum+clip.duration,0),'Floating-point retiming must preserve the exact summed duration');
}
assert.throws(()=>proposeBeatAlignedEdits(grid,{version:1,clips:[{id:'long',sourceStart:0,sourceEnd:1,duration:301}]}));

// Long-input work/storage stays bounded, including callers trying to raise limits.
const long=new Float32Array(2000000).fill(.2),started=performance.now();
const bounded=analyzeMusicPcm({channels:[long,long],sampleRate:1000},{maxBins:1e9,maxSampleReads:1e9});
const elapsed=performance.now()-started;
assert.ok(bounded.limits.sampleReads<=1536000);assert.ok(bounded.envelope.length<=24000);assert.ok(bounded.waveform.length<=1200);
assert.ok(bounded.onsets.length<=4096);assert.ok(bounded.beats.length<=4096);
const reduced=analyzeMusicPcm({channels:[long,long],sampleRate:1000},{maxSampleReads:64});assert.ok(reduced.limits.sampleReads<=64);
console.log(`PASS: deterministic PCM analysis, 120 BPM clicks, silence/short/tone/noise guards, sustained excerpts, exact editable beat cuts; capped long input ${elapsed.toFixed(1)} ms (${bounded.limits.sampleReads} reads).`);
