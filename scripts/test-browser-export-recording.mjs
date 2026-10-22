import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import probe from 'ffprobe-static';
const output=new URL('../outputs/browser-export-proof/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu-sandbox','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage();await page.goto(process.env.MOTION_LAB_URL || 'http://127.0.0.1:4194/?scene=procedural&render=1');
 const proof=await page.evaluate(async()=>{
  const {getBrowserExportCapabilities,exportBrowserVideo}=await import('/src/viewer/browser-export.js');
  const capabilities=getBrowserExportCapabilities();if(!capabilities.available)throw Error(capabilities.reason);
  const capturedTracks=[],capture=HTMLCanvasElement.prototype.captureStream;
  HTMLCanvasElement.prototype.captureStream=function(...args){const stream=capture.apply(this,args);capturedTracks.push(...stream.getTracks());return stream;};
  const Context=window.AudioContext || window.webkitAudioContext,context=new Context(),buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
  const pcm=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)pcm[i]=Math.sin(i*2*Math.PI*440/context.sampleRate)*.1;await context.close();
  const parameters={scene:'procedural',sceneControls:{colorContrast:1}},before=JSON.stringify(parameters),progress=[];
  const pending=exportBrowserVideo({scene:'procedural',parameters,settings:{width:640,height:360,fps:24,duration:1.5},audioBuffer:buffer,onProgress:p=>progress.push(p.phase)});
  parameters.scene='objects'; // The in-flight exporter must preserve its snapshot.
  const result=await pending;
  const bytes=new Uint8Array(await result.blob.arrayBuffer()),base64=btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
  const audioContext=new Context(),destination=audioContext.createMediaStreamDestination(),oscillator=audioContext.createOscillator();
  oscillator.connect(destination);oscillator.start();await audioContext.resume();
  const suppliedTrack=destination.stream.getAudioTracks()[0],originalSupport=MediaRecorder.isTypeSupported.bind(MediaRecorder);
  MediaRecorder.isTypeSupported=mime=>mime.startsWith('video/webm')&&originalSupport(mime);
  let fallback;
  try{fallback=await exportBrowserVideo({scene:'procedural',settings:{width:320,height:180,fps:20,duration:.5},audioStream:destination.stream});}
  finally{MediaRecorder.isTypeSupported=originalSupport;}
  const callerAudioPreserved=suppliedTrack.readyState==='live';oscillator.stop();suppliedTrack.stop();await audioContext.close();
  const controller=new AbortController();let cancelled=false;
  try{await exportBrowserVideo({scene:'procedural',settings:{width:320,height:180,duration:2},signal:controller.signal,onProgress:p=>{if(p.phase==='recording')controller.abort();}});}catch(error){cancelled=error.name==='AbortError';}
  const allCaptureTracksStopped=capturedTracks.every(track=>track.readyState==='ended');
  HTMLCanvasElement.prototype.captureStream=capture;
  return {...result,blob:undefined,base64,capabilities,progress,cancelled,callerScene:parameters.scene,before,
   allCaptureTracksStopped,callerAudioPreserved,fallback:{extension:fallback.extension,mimeType:fallback.mimeType,size:fallback.blob.size,hasAudio:fallback.hasAudio}};
 });
 assert.equal(proof.cancelled,true);assert.equal(proof.callerScene,'objects');assert.equal(proof.hasAudio,true);assert.ok(proof.framesRendered>1);assert.equal(proof.progress.at(-1),'complete');
 assert.equal(proof.filename,`framevolve-procedural.${proof.extension}`);assert.equal(proof.allCaptureTracksStopped,true);assert.equal(proof.callerAudioPreserved,true);
 assert.equal(proof.fallback.extension,'webm');assert.ok(proof.fallback.mimeType.startsWith('video/webm'));assert.ok(proof.fallback.size>0);assert.equal(proof.fallback.hasAudio,true);
 const file=new URL(`procedural-audio.${proof.extension}`,output);await writeFile(file,Buffer.from(proof.base64,'base64'));delete proof.base64;
 const metadata=JSON.parse(execFileSync(probe.path,['-v','error','-show_format','-show_streams','-of','json',file.pathname],{encoding:'utf8'}));
 const video=metadata.streams.find(stream=>stream.codec_type==='video'),audio=metadata.streams.find(stream=>stream.codec_type==='audio');
 assert.equal(video.width,640);assert.equal(video.height,360);assert.ok(audio,'Audio was muxed');
 const duration=Number(metadata.format.duration || video.duration);assert.ok(duration>=1.35&&duration<2.15,`Recorded duration ${duration}`);
 await writeFile(new URL('result.json',output),JSON.stringify({proof,metadata},null,2));
 console.log(JSON.stringify({container:proof.extension,videoCodec:video.codec_name,audioCodec:audio.codec_name,duration,framesRendered:proof.framesRendered,droppedFrameSlots:proof.droppedFrameSlots,cancelled:proof.cancelled}));
}finally{await browser.close();}
