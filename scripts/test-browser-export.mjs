import assert from 'node:assert/strict';
import {browserVideoMimeTypes,getBrowserExportCapabilities,normalizeBrowserExportSettings} from '../src/viewer/browser-export.js';

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
console.log('Browser export helpers passed: supported-container selection, capture guard, authored duration, resolution/FPS/bitrate bounds and immutable settings.');
