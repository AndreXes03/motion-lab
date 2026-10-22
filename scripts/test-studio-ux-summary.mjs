import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSceneSnapshot} from '../src/viewer/scene-snapshot.js';
import {deliverySummary} from '../src/viewer/delivery-summary.js';

test('fresh examples do not carry edits, soundtrack or mutable defaults across projects',()=>{
 const first=freshSceneSnapshot('pulse');
 first.parameters.look.post.grain=.5;
 first.parameters.sound.master=0;
 first.parameters.audio.tracks.push({id:'private-music'});
 const second=freshSceneSnapshot('pulse');
 assert.equal(second.parameters.look.post.grain,0);
 assert.equal(second.parameters.sound.master,.8);
 assert.deepEqual(second.parameters.audio.tracks,[]);
 assert.equal(second.exportSettings.temporalSamples,4);
 assert.equal(freshSceneSnapshot('procedural').exportSettings.temporalSamples,1);
 assert.equal(freshSceneSnapshot('procedural',{cyclesStandalone:true}).parameters.renderPolicy.cycles.workers,1);
});
const base={duration:22.5,settings:{fps:30},parameters:{sound:{enabled:false,master:.8},audio:{tracks:[{enabled:true,volume:1,duration:5,timelineStart:0}]}},selection:{selectedRenderer:'cycles',runnable:false,availability:'Install Rendering Cycles',plan:{cycles:{device:'gpu'}}}};
test('delivery summary counts frames and imports, but does not claim unavailable Cycles ran',()=>{
 const result=deliverySummary(base);
 assert.equal(result.frameCount,675);
 assert.equal(result.audioIncluded,'1 imported clip');
 assert.equal(result.rendererLabel,'Cycles');
 assert.equal(result.rendererAvailable,false);
 assert.equal(result.testFrameAvailable,false);
 assert.match(result.note,/Install Rendering Cycles/);
 assert.notEqual(result.deviceVerified,true);
});
test('delivery summary distinguishes mute, prepared mix and unsupported browser audio',()=>{
 const muted={...base,parameters:{...base.parameters,sound:{enabled:true,muted:true}}};
 assert.equal(deliverySummary(muted).audioIncluded,'Muted');
 assert.equal(deliverySummary({...base,selection:{selectedRenderer:'mixed',plan:{composite:{audioFile:'/prepared.wav'}}}}).audioIncluded,'Prepared soundtrack');
 assert.equal(deliverySummary({...base,publicDemo:true,browserCaps:{available:true,supportsAudio:false}}).audioIncluded,'Audio unavailable in this browser');
});
