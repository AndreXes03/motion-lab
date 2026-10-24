import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {encodeWav} from '../src/engine/sound-design.js';
import {importAudioAsset} from './audio-assets.mjs';
import {transcribeVoice} from './speech-jobs.mjs';
import {createStudioApi} from './studio-api.mjs';
const root=await mkdtemp(path.join(tmpdir(),'framevolve-speech-'));
try{
 const asset=await importAudioAsset(root,Readable.from([Buffer.from(encodeWav([new Float32Array(48000),new Float32Array(48000)],48000))]),{name:'Silence'});
 // Real child/decoder, no model download for silent input. Explicit error, no fake text.
 await assert.rejects(transcribeVoice(root,asset.assetId),/No audible speech/);
 await assert.rejects(transcribeVoice(root,'../../outside'),/Invalid audio asset/);
 const narration={version:1,source:'transcribed',language:'it',text:'Una prova.',segments:[{id:'w1',text:'Una prova.',start:0,end:.5}],cues:[]};
 const dir=path.join(root,'.motion-cache','speech');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,asset.assetId+'-whisper-base-v2.json'),JSON.stringify(narration));
 assert.deepEqual(await transcribeVoice(root,asset.assetId,{forkFn:()=>assert.fail('Cached analysis must not start inference')}),narration);
 let calls=0;const api=createStudioApi({speechManager:{start:async id=>{calls++;return {assetId:id,status:'queued'};},get:id=>({assetId:id,status:'ready',narration})}});
 for(const [origin,body,status]of [[undefined,'{}',403],['https://foreign.example','{}',403],['http://localhost:5173','{"path":"/etc/hosts"}',400],['http://localhost:5173','{}',202]]){
  const req=Readable.from([Buffer.from(body)]);Object.assign(req,{url:`/studio/audio/assets/${asset.assetId}/transcription`,method:'POST',headers:{host:'localhost:5173',...(origin?{origin}:{}),'content-type':'application/json'}});let result;const res={setHeader(){},end(value){result=JSON.parse(value);}};await api(req,res,()=>assert.fail('Missing route'));assert.equal(res.statusCode,status);assert.ok(result);
 }
 assert.equal(calls,1,'Only a same-origin empty request can start inference');
 console.log('Speech jobs passed: real silence rejection, safe source IDs, cached/offline reuse and same-origin API requests.');
}finally{await rm(root,{recursive:true,force:true});}
