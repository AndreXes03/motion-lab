import {sceneRegistry} from '../scene-registry.js';
import {editorialDuration} from '../engine/editorial.js';
import {createBrowserRecorderSession} from './browser-export-session.js';

// The browser chooses an actual supported container. A WebM recording is never
// renamed to MP4; the returned recorder MIME determines the download extension.
export const browserVideoMimeTypes = Object.freeze([
 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
 'video/mp4;codecs=avc1.42E01E',
 'video/mp4',
 'video/webm;codecs=vp9,opus',
 'video/webm;codecs=vp8,opus',
 'video/webm'
]);
const extensionFor = mime => mime.toLowerCase().startsWith('video/mp4') ? 'mp4' : 'webm';

export function getBrowserExportCapabilities(environment = globalThis) {
 const canvas = environment.HTMLCanvasElement?.prototype;
 const Recorder = environment.MediaRecorder;
 const mimeTypes = canvas?.captureStream && typeof Recorder?.isTypeSupported === 'function'
  ? browserVideoMimeTypes.filter(mime => {try{return Recorder.isTypeSupported(mime);}catch{return false;}}) : [];
 const mimeType = mimeTypes[0] ?? null;
 return {
  available: Boolean(mimeType), mimeType, mimeTypes,
  extension: mimeType ? extensionFor(mimeType) : null,
  label: mimeType ? `${extensionFor(mimeType).toUpperCase()} video` : 'Video unavailable',
  supportsAudio: Boolean(mimeType && (environment.AudioContext || environment.webkitAudioContext)),
  reason: mimeType ? null : 'This browser does not support canvas video recording.'
 };
}

export function normalizeBrowserExportSettings(scene, settings = {}, parameters = {}) {
 const metadata = sceneRegistry[scene];
 if(!metadata)throw new Error(`Unknown export scene: ${scene}`);
 const duration=editorialDuration({...parameters,scene});
 if(!settings || typeof settings !== 'object' || Array.isArray(settings))throw new Error('Invalid browser export settings');
 const result = {width:settings.width ?? 1280,height:settings.height ?? 720,fps:settings.fps ?? 30,
  start:settings.start ?? 0,duration:settings.duration ?? duration,bitrateMbps:settings.bitrateMbps ?? 10};
 for(const key of ['width','height'])if(!Number.isInteger(result[key]) || result[key]<64 || result[key]>1920 || result[key]%2)throw new Error(`Export ${key} must be an even integer from 64 to 1920`);
 if(result.width*result.height>1920*1080)throw new Error('Browser export is limited to 1080p pixel area');
 if(!Number.isInteger(result.fps)||result.fps<1||result.fps>60)throw new Error('Export fps must be an integer from 1 to 60');
 if(!Number.isFinite(result.start)||result.start<0||result.start>=duration)throw new Error('Invalid export start time');
 if(!Number.isFinite(result.duration)||result.duration<1/result.fps||result.start+result.duration>duration+1e-9)throw new Error('Export duration must fit inside the authored film or editorial timeline');
 if(!Number.isFinite(result.bitrateMbps)||result.bitrateMbps<1||result.bitrateMbps>20)throw new Error('Export bitrate must be from 1 to 20 Mbps');
 return result;
}

const abortError = () => new DOMException('Video export cancelled', 'AbortError');
function checkAbort(signal){if(signal?.aborted)throw abortError();}
function delay(milliseconds,signal,session){
 checkAbort(signal);
 return new Promise((resolve,reject)=>{
  let done=false;
  let unsubscribe=()=>{};
  const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);unsubscribe();error?reject(error):resolve();};
  const abort=()=>finish(abortError());
  const timer=setTimeout(()=>finish(),Math.max(0,milliseconds));
  signal?.addEventListener('abort',abort,{once:true});
  if(session)unsubscribe=session.onFailure(finish);
 });
}

export async function readRecordedVideoMetadata(blob,{signal}={}) {
 checkAbort(signal);
 const video=document.createElement('video'),url=URL.createObjectURL(blob);
 try{return await new Promise((resolve,reject)=>{
  let done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timeout);signal?.removeEventListener('abort',abort);video.onloadedmetadata=video.onerror=null;
   if(error){reject(error);return;}resolve({encodedDuration:Number.isFinite(video.duration)&&video.duration>0?video.duration:null,
   encodedWidth:video.videoWidth || null,encodedHeight:video.videoHeight || null});};
  const abort=()=>finish(abortError());
  const timeout=setTimeout(()=>finish(),1500);
  signal?.addEventListener('abort',abort,{once:true});
  video.onloadedmetadata=()=>finish();video.onerror=()=>finish();video.preload='metadata';
  try{video.src=url;}catch(error){finish(error);}
 });}finally{video.removeAttribute('src');try{video.load();}catch{/* A failed media element still releases its URL. */}URL.revokeObjectURL(url);}
}

/** Real-time browser recording, with its own runtime and a frozen recipe.
 * framesRendered and droppedFrameSlots describe submitted poses, not encoded
 * frames. Slow rendering skips poses instead of stretching authored film time.
 */
export async function exportBrowserVideo({scene,parameters={},settings={},onProgress=()=>{},signal,audioBuffer,audioStream}={}) {
 const capabilities=getBrowserExportCapabilities();
 if(!capabilities.available)throw new Error(capabilities.reason);
 const chosen=scene ?? parameters.scene ?? 'objects',options=normalizeBrowserExportSettings(chosen,settings,parameters);
 const snapshot=structuredClone(parameters);
 snapshot.scene=chosen;delete snapshot.previewQuality;
 checkAbort(signal);
 if(audioBuffer && audioStream)throw new Error('Choose an AudioBuffer or an audio stream, not both');
 const canvas=document.createElement('canvas');canvas.width=options.width;canvas.height=options.height;
 let runtime,stream,recorder,session,audioContext,audioSource;
 const ownedAudioTracks=[];
 let framesRendered=0,droppedFrameSlots=0,recordingStarted=0,recordingWallSeconds=0;
 const report=data=>onProgress({...data,width:options.width,height:options.height,fps:options.fps});
 try{
  // Create/resume while the export button still supplies user activation.
  if(audioBuffer){
   const Context=globalThis.AudioContext || globalThis.webkitAudioContext;
   if(!Context)throw new Error('This browser cannot record the requested audio');
   audioContext=new Context();await audioContext.resume();
   if(audioContext.state!=='running')throw new Error('Audio is blocked; start export from the video export button');
  }
  report({phase:'preparing',percent:0});
  const {createRuntime}=await import('../engine/runtime.js');checkAbort(signal);
  runtime=createRuntime(canvas,{initialScene:chosen});await runtime.ready;checkAbort(signal);
  await runtime.prepare(snapshot);checkAbort(signal);
  runtime.render(options.start,{width:options.width,height:options.height,parameters:snapshot,previewQuality:'full'});
  stream=canvas.captureStream(0);
  let videoTrack=stream.getVideoTracks()[0];
  if(!videoTrack)throw new Error('The browser did not create a canvas video track');
  if(typeof videoTrack.requestFrame!=='function'){
   stream.getTracks().forEach(track=>track.stop());stream=canvas.captureStream(options.fps);videoTrack=stream.getVideoTracks()[0];
   if(!videoTrack)throw new Error('The browser did not create a canvas video track');
  }
  if(audioBuffer){
   const destination=audioContext.createMediaStreamDestination();
   audioSource=audioContext.createBufferSource();audioSource.buffer=audioBuffer;audioSource.connect(destination);
   ownedAudioTracks.push(...destination.stream.getAudioTracks());
  }else if(audioStream){
   const tracks=audioStream.getAudioTracks?.();
   if(!tracks?.length||tracks.some(track=>track.readyState==='ended'))throw new Error('The requested audio stream has no live audio track');
   for(const track of tracks)ownedAudioTracks.push(track.clone());
  }
  for(const track of ownedAudioTracks)stream.addTrack(track);
  let selectedMimeType;
  for(const candidate of capabilities.mimeTypes){
   try{
    recorder=new MediaRecorder(stream,{mimeType:candidate,videoBitsPerSecond:Math.round(options.bitrateMbps*1e6),audioBitsPerSecond:192000});
    session=createBrowserRecorderSession(recorder);
    checkAbort(signal);recorder.start(250);selectedMimeType=candidate;break;
   }catch(error){
    if(recorder?.state && recorder.state!=='inactive')try{recorder.stop();}catch{/* The failed recorder cannot be reused. */}
    session?.dispose();session=null;
    if(error?.name==='AbortError')throw error;
    recorder=null; // A supported MIME can still fail during construction or start.
   }
  }
  if(!recorder)throw new Error('This browser could not start a video recorder');
  const mimeType=recorder.mimeType || selectedMimeType,extension=extensionFor(mimeType);
  recordingStarted=performance.now();checkAbort(signal);
  audioSource?.start(0,options.start,options.duration);
  if(typeof videoTrack.requestFrame==='function')videoTrack.requestFrame();
  else runtime.render(options.start,{width:options.width,height:options.height,parameters:snapshot,previewQuality:'full'});
  framesRendered=1;
  report({phase:'recording',percent:0,mimeType,extension,framesRendered,droppedFrameSlots});
  let lastSlot=0;
  while(true){
   checkAbort(signal);if(session.error)throw session.error;
   const elapsed=(performance.now()-recordingStarted)/1000;
   if(elapsed>=options.duration)break;
   const slot=Math.floor(elapsed*options.fps);
   if(slot>lastSlot){
    droppedFrameSlots+=Math.max(0,slot-lastSlot-1);lastSlot=slot;
    runtime.render(options.start+Math.min(slot/options.fps,options.duration),{width:options.width,height:options.height,parameters:snapshot,previewQuality:'full'});
    videoTrack.requestFrame?.();framesRendered++;
    report({phase:'recording',percent:Math.min(99,elapsed/options.duration*100),mimeType,extension,framesRendered,droppedFrameSlots});
   }
   const nextTime=Math.min(options.duration,(lastSlot+1)/options.fps)*1000;
   await delay(Math.max(0,nextTime-(performance.now()-recordingStarted)),signal,session);
  }
  recordingWallSeconds=(performance.now()-recordingStarted)/1000;
  droppedFrameSlots+=Math.max(0,Math.ceil(options.duration*options.fps)-1-lastSlot);
  checkAbort(signal);if(session.error)throw session.error;
  session.stop();await session.waitForStop(30000,signal);
  checkAbort(signal);if(session.error)throw session.error;
  const blob=new Blob(session.chunks,{type:mimeType});
  if(!blob.size)throw new Error('The browser produced an empty video');
  report({phase:'finalizing',percent:99,mimeType,extension,framesRendered,droppedFrameSlots});
  const metadata=await readRecordedVideoMetadata(blob,{signal});checkAbort(signal);
  const result={blob,mimeType,extension,filename:`framevolve-${chosen}.${extension}`,mode:'realtime',renderer:'threejs',
   width:options.width,height:options.height,fpsRequested:options.fps,durationRequested:options.duration,
   recordingWallSeconds,framesRendered,droppedFrameSlots,hasAudio:ownedAudioTracks.length>0,...metadata};
  report({phase:'complete',percent:100,mimeType,extension,framesRendered,droppedFrameSlots});return result;
 }finally{
  try{audioSource?.stop();}catch{/* A source may already have reached its buffer end. */}
  if(recorder?.state!=='inactive'&&recorder?.state){try{recorder.stop();}catch{/* Already stopped by an encoder error. */}}
  session?.dispose();
  stream?.getTracks().forEach(track=>track.stop());ownedAudioTracks.forEach(track=>track.stop());
  if(audioContext)await audioContext.close().catch(()=>{});
  runtime?.dispose?.();canvas.width=canvas.height=1;
 }
}

export function downloadBrowserExport(result){
 const url=URL.createObjectURL(result.blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=result.filename;document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
