import assert from 'node:assert/strict';
import {browserVideoMimeTypes,getBrowserExportCapabilities,normalizeBrowserExportSettings,readRecordedVideoMetadata} from '../src/viewer/browser-export.js';
import {createBrowserRecorderSession} from '../src/viewer/browser-export-session.js';

function environment(supported){
 return {HTMLCanvasElement:{prototype:{captureStream(){}}},MediaRecorder:{isTypeSupported:mime=>supported.includes(mime)},AudioContext:class{}};
}
assert.equal(getBrowserExportCapabilities({}).available,false);
assert.equal(getBrowserExportCapabilities({MediaRecorder:{isTypeSupported:()=>true}}).available,false,'Recording cannot be offered without canvas capture');
const mp4=getBrowserExportCapabilities(environment(['video/mp4','video/webm']));
assert.equal(mp4.extension,'mp4');assert.equal(mp4.mimeType,'video/mp4');assert.equal(mp4.supportsAudio,true);
const webm=getBrowserExportCapabilities(environment(['video/webm;codecs=vp9,opus','video/webm']));
assert.equal(webm.extension,'webm');assert.equal(webm.label,'WEBM video');
assert.equal(getBrowserExportCapabilities(environment([])).available,false);
const throwing=environment([]);throwing.MediaRecorder.isTypeSupported=()=>{throw new Error('Unsupported implementation');};
assert.equal(getBrowserExportCapabilities(throwing).available,false);
assert.ok(Object.isFrozen(browserVideoMimeTypes));
const defaults=normalizeBrowserExportSettings('pulse');
assert.deepEqual(defaults,{width:1280,height:720,fps:30,start:0,duration:13.9,bitrateMbps:10});
const settings={width:1080,height:1920,fps:60,start:2,duration:1,bitrateMbps:20};
assert.deepEqual(normalizeBrowserExportSettings('dot',settings),settings);
assert.deepEqual(settings,{width:1080,height:1920,fps:60,start:2,duration:1,bitrateMbps:20},'Settings are not mutated');
for(const invalid of [{width:1279},{height:63},{width:1920,height:1920},{fps:0},{fps:60.5},{fps:61},{start:-1},{start:10},{duration:0},{duration:11},{start:9,duration:2},{bitrateMbps:0},{bitrateMbps:21},{width:NaN}]){
 assert.throws(()=>normalizeBrowserExportSettings('objects',invalid),undefined,JSON.stringify(invalid));
}
assert.throws(()=>normalizeBrowserExportSettings('unknown'));
assert.throws(()=>normalizeBrowserExportSettings('objects',null));

function fakeRecorder({stops=true}={}){
 return {state:'recording',stop(){this.state='inactive';if(stops)queueMicrotask(()=>this.onstop?.());}};
}
const recorder=fakeRecorder(),session=createBrowserRecorderSession(recorder,{maxBytes:10});
recorder.ondataavailable({data:new Blob(['hello'])});
assert.equal(session.byteLength,5);
session.stop();await session.waitForStop(50);
assert.equal(new Blob(session.chunks).size,5);
session.dispose();assert.equal(recorder.onstop,null);
const failed=fakeRecorder(),failedSession=createBrowserRecorderSession(failed);
const encoderError=new Error('Encoder failed'),observed=[];
const unsubscribe=failedSession.onFailure(error=>observed.push(error));
failed.onerror({error:encoderError});unsubscribe();
assert.equal(await failedSession.failure,encoderError);
assert.deepEqual(observed,[encoderError]);
assert.equal(failedSession.error,encoderError);assert.equal(failed.state,'inactive');failedSession.dispose();
const oversized=fakeRecorder(),oversizedSession=createBrowserRecorderSession(oversized,{maxBytes:4});
oversized.ondataavailable({data:new Blob(['hello'])});
assert.match((await oversizedSession.failure).message,/256 MB memory limit/);
assert.equal(oversizedSession.chunks.length,0);oversizedSession.dispose();
const stuck=fakeRecorder({stops:false}),stuckSession=createBrowserRecorderSession(stuck);
stuckSession.stop();await assert.rejects(stuckSession.waitForStop(5),/did not finish stopping/);stuckSession.dispose();
const aborting=fakeRecorder({stops:false}),abortSession=createBrowserRecorderSession(aborting),controllerForStop=new AbortController();
abortSession.stop();const waiting=abortSession.waitForStop(10000,controllerForStop.signal);
controllerForStop.abort();await assert.rejects(waiting,{name:'AbortError'});abortSession.dispose();
const dying=fakeRecorder({stops:false}),dyingSession=createBrowserRecorderSession(dying);
const stopWait=dyingSession.waitForStop(10000);
dying.onerror({error:encoderError});await assert.rejects(stopWait,encoderError);dyingSession.dispose();

const originalDocument=globalThis.document,originalURL=globalThis.URL;
let video,releases=0;
try{
 globalThis.document={createElement:()=>video={duration:1.25,videoWidth:640,videoHeight:360,removeAttribute(){},load(){}}};
 globalThis.URL={createObjectURL:()=> 'blob:mock',revokeObjectURL:()=>{releases++;}};
 const probe=readRecordedVideoMetadata(new Blob(['recording']));
 video.onloadedmetadata();
 assert.deepEqual(await probe,{encodedDuration:1.25,encodedWidth:640,encodedHeight:360});
 const controller=new AbortController(),cancelled=readRecordedVideoMetadata(new Blob(['recording']),{signal:controller.signal});
 controller.abort();await assert.rejects(cancelled,{name:'AbortError'});
 assert.equal(releases,2);assert.equal(video.onloadedmetadata,null);
}finally{globalThis.document=originalDocument;globalThis.URL=originalURL;}
console.log('Browser export helpers passed: supported containers, setting bounds, recorder errors/limits/stop timeout, and metadata cancellation.');
