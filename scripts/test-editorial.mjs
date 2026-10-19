import assert from 'node:assert/strict';
import {sceneIds,sceneConfig} from '../src/scene-registry.js';
import {defaultEditorialEdit,validateEditorialEdit,editorialDuration,mapEditorialTime,editorialCuts,isIdentityEditorialEdit} from '../src/engine/editorial.js';
import {shutterSamples} from '../src/engine/temporal.js';
import {sampleProceduralMotion,planProceduralSound} from '../src/engine/sound-procedural.js';
import {normalizeBrowserExportSettings} from '../src/viewer/browser-export.js';

for(const scene of sceneIds){
 const edit=defaultEditorialEdit(scene),duration=sceneConfig(scene).duration,parameters={scene,edit};
 assert.equal(editorialDuration(parameters),duration,scene+' default duration');
 assert.ok(isIdentityEditorialEdit(edit,scene));
 for(let i=0;i<=111;i++){const time=duration*i/111;assert.equal(mapEditorialTime(time,parameters),time,scene+' identity source time');}
 assert.deepEqual(editorialCuts(parameters),editorialCuts({scene}),scene+' identity cuts');
 assert.deepEqual(validateEditorialEdit(edit,scene),edit);
}
const edit={version:1,clips:[{id:'second',sourceStart:4,sourceEnd:8,duration:2},{id:'first',sourceStart:0,sourceEnd:2,duration:4}]};
const p={scene:'objects',edit,motion:{cuts:[1,5,7]}},original=structuredClone(p);
assert.equal(editorialDuration(p),6);
assert.equal(mapEditorialTime(-1,p),4);assert.equal(mapEditorialTime(0,p),4);assert.equal(mapEditorialTime(.5,p),5);
assert.equal(mapEditorialTime(2,p),0);assert.equal(mapEditorialTime(3,p),.5);assert.equal(mapEditorialTime(6,p),2);assert.equal(mapEditorialTime(100,p),2);
assert.deepEqual(editorialCuts(p),[0,.5,1.5,2,4,6]);
assert.deepEqual(p,original,'Editorial evaluation never mutates a saved recipe');
for(const time of [0,.4999,.5,1.9999,2,4]){
 const samples=shutterSamples(time,{duration:6,cuts:editorialCuts(p),samples:32});
 const shotStart=editorialCuts(p).filter(t=>t<=time).at(-1),shotEnd=editorialCuts(p).find(t=>t>time)??6;
 assert.ok(samples.every(s=>s.time>=shotStart&&s.time<shotEnd),'Temporal integration stays inside edited shot');
}
assert.equal(mapEditorialTime(-10,{scene:'objects'}),-10,'Absent edit preserves legacy time handling');
assert.throws(()=>mapEditorialTime(NaN,p),/finite/);
for(const invalid of [null,[],{version:2,clips:edit.clips},{...edit,unknown:true},{version:1,clips:[]},{version:1,clips:Array(65).fill(edit.clips[0])},
 {...edit,clips:[edit.clips[0],edit.clips[0]]},...[{id:'../bad'},{sourceStart:-1},{sourceEnd:11},{sourceEnd:4},{duration:0},{duration:Infinity},{duration:301},{extra:1}].map(change=>({version:1,clips:[{...edit.clips[0],...change}]}))])assert.throws(()=>validateEditorialEdit(invalid,'objects'));
assert.throws(()=>editorialCuts({...p,motion:{cuts:[Infinity]}}),/finite/);
assert.throws(()=>validateEditorialEdit({version:1,clips:[{...edit.clips[0],duration:1/60}]},'objects'),/at least one authored frame/);
const cloned=validateEditorialEdit(edit,'objects');cloned.clips[0].duration=3;assert.equal(edit.clips[0].duration,2);
assert.equal(normalizeBrowserExportSettings('objects',{},p).duration,6);
assert.throws(()=>normalizeBrowserExportSettings('objects',{duration:7},p),/duration/);
const long={scene:'objects',edit:{version:1,clips:[{id:'slow',sourceStart:0,sourceEnd:10,duration:20}]}};
assert.equal(normalizeBrowserExportSettings('objects',{start:15,duration:5},long).duration,5);

// Dynamic graph functions must see mapped source time, while sound timestamps
// and derivatives remain in output seconds (including altered playback speed).
const telemetry=sampleProceduralMotion(()=>[{id:'box',type:'rect',x:t=>t*10,y:20,width:10,height:10}],{duration:6,rate:20,width:100,height:100,sourceTimeAt:t=>mapEditorialTime(t,p)});
assert.equal(telemetry.frames[10].time,.5);assert.equal(telemetry.frames[10].objects.box.position[0],4.4);
assert.equal(telemetry.frames[40].time,2);assert.equal(telemetry.frames[40].objects.box.position[0],.4);
telemetry.cuts=editorialCuts(p);
const settings={density:.5,cameraKit:'silk',objectKit:'soft',accentKit:'pop'};
const sound=planProceduralSound(telemetry,settings);
assert.equal(sound.curves.box[40],0,'A reordered cut does not create a false movement spike');
assert.ok(sound.events.every(e=>e.time>=0&&e.time<6));
console.log('Editorial contracts passed: all-scene exact identity, reorder/trim/retime, strict validation, immutable recipes, mapped cut protection, browser export bounds and source-aligned procedural sound. No browser/pixel validation.');
