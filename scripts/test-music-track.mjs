import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeMusicTrack,mixMusicPcm} from '../src/engine/music-track.js';
import {hashMusicBlob} from '../src/viewer/music-asset-store.js';
import {createMusicDecodeCache} from '../src/viewer/music-decode-cache.js';

const blob=new Blob(['original audio bytes'],{type:'audio/wav'});
const assetId=await hashMusicBlob(blob);
assert.equal(assetId,createHash('sha256').update('original audio bytes').digest('hex'));
const oversized=new Blob(['x']);Object.defineProperty(oversized,'size',{value:50*1024*1024+1});
await assert.rejects(hashMusicBlob(oversized),/50 MB/);
const original={assetId,name:'My song.wav',mimeType:'audio/wav',bytes:blob.size,duration:5,trimStart:1,trimDuration:2,gain:.5,fadeIn:.5,fadeOut:.5};
const track=normalizeMusicTrack(original);
assert.deepEqual(track,{version:1,source:'asset',...original});
assert.deepEqual(original,{assetId,name:'My song.wav',mimeType:'audio/wav',bytes:blob.size,duration:5,trimStart:1,trimDuration:2,gain:.5,fadeIn:.5,fadeOut:.5},'Validation leaves recipe input intact');
for(const invalid of [
 {...track,assetId:'file:///music.wav'},
 {...track,bytes:50*1024*1024+1},
 {...track,trimStart:4,trimDuration:2},
 {...track,fadeIn:3},
 {...track,gain:Infinity},
 {...track,embeddedData:'AAA='}
])assert.throws(()=>normalizeMusicTrack(invalid));

const base=[new Float32Array(5),new Float32Array(5)];
const song=[Float32Array.of(0,.4,.8,.4,0,0,0,0,0,0),Float32Array.of(0,.2,.4,.2,0,0,0,0,0,0)];
const section={...track,duration:5,trimStart:.5,trimDuration:1,fadeIn:.5,fadeOut:.5,gain:1};
const result=mixMusicPcm({baseChannels:base,musicChannels:song,outputSampleRate:2,musicSampleRate:2,track:section});
assert.ok(Math.abs(result[0][1]-.8)<1e-6&&result[0].every((value,i)=>i===1||value===0),'Starts at source trim, fades out, and is silent after the window');
assert.ok(Math.abs(result[1][1]-.4)<1e-6&&result[1].every((value,i)=>i===1||value===0));
assert.equal(base[0][1],0,'Mixing never changes its input');
const resampled=mixMusicPcm({baseChannels:[new Float32Array(2)],musicChannels:[Float32Array.of(0,.4,.8,.4,0)],outputSampleRate:2,musicSampleRate:4,track:{...track,trimStart:.125,trimDuration:1,gain:1,fadeIn:0,fadeOut:0}});
assert.ok(Math.abs(resampled[0][0]-.2)<1e-6&&Math.abs(resampled[0][1]-.6)<1e-6,'Nonmatching source sample rates interpolate at source time');
const loud=mixMusicPcm({baseChannels:[Float32Array.of(.7),Float32Array.of(.7)],musicChannels:[Float32Array.of(1)],outputSampleRate:2,musicSampleRate:2,track:{...track,trimStart:0,trimDuration:1,fadeIn:0,fadeOut:0}});
assert.ok(Math.abs(loud[0][0])<=.98+1e-6,'The combined mix does not clip');
const pending=new Map(),cache=createMusicDecodeCache(id=>new Promise(resolve=>pending.set(id,resolve)));
const oldTrack=cache.get('A'),newTrack=cache.get('B');
await Promise.resolve();pending.get('B')('decoded B');assert.equal(await newTrack,'decoded B');
pending.get('A')('decoded A');assert.equal(await oldTrack,'decoded A');
assert.equal(await cache.get('B'),'decoded B','An old decode cannot overwrite the active song');
cache.prime('B','relinked B');assert.equal(await cache.get('B'),'relinked B');
console.log('Imported music metadata, content hash, trim/fade/resampling and mix limits passed.');
