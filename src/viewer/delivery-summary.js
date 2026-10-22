import {RENDERER_LABELS} from '../engine/render-policy.js';

/** Describe a plan, never claim a job has already used a particular device. */
export function deliverySummary({duration,settings,parameters,selection,capabilities={},publicDemo=false,browserCaps={},busy=false}) {
 const engine=publicDemo?'threejs':selection?.selectedRenderer;
 const plan=selection?.plan??parameters.renderPolicy??{};
 const sound=parameters.sound??{};
 const clips=(parameters.audio?.tracks??[]).filter(t=>t.enabled!==false&&t.volume!==0&&t.duration>0&&t.timelineStart<duration&&t.timelineStart+t.duration>0);
 const muted=sound.muted===true||sound.master===0;
 let audioIncluded=muted?'Muted':sound.enabled?'Generated sound'+(clips.length?` + ${clips.length} clip${clips.length===1?'':'s'}`:''):clips.length?`${clips.length} imported clip${clips.length===1?'':'s'}`:'No audio';
 if(engine==='mixed')audioIncluded=plan.composite?.audioFile?'Prepared soundtrack':'No prepared soundtrack';
 if(publicDemo&&!browserCaps.supportsAudio)audioIncluded='Audio unavailable in this browser';
 let deviceLabel='Browser graphics',deviceVerified, note='The renderer and device are planned. The completed render reports what was actually used.';
 if(engine==='skia')deviceLabel='CPU';
 if(engine==='mixed'){deviceLabel='CPU · prepared layers';note='Prepared picture and audio must be rebuilt after edits.';}
 if(engine==='cycles'){
  const request=plan.cycles?.device??'auto',devices=capabilities.cycles?.devices??[];
  const gpu=devices.find(d=>['METAL','CUDA','OPTIX','HIP','ONEAPI'].includes(String(d.type).toUpperCase()));
  const cpu=devices.find(d=>String(d.type).toUpperCase()==='CPU');
  const picked=request==='cpu'?cpu:gpu??(request==='auto'?cpu:null);
  deviceLabel=picked?`${picked.type}${picked.name?' · '+picked.name:''}`:request==='cpu'?'CPU':request==='auto'?'Auto · GPU or CPU':'GPU';
  if(['gpu','metal'].includes(request)&&capabilities.cycles?.available&&!gpu)deviceVerified=false;
 }
 const available=publicDemo?!!browserCaps.available:!!selection?.runnable;
 if(!available)note=selection?.availability||browserCaps.reason||'This renderer is unavailable.';
 return {durationSeconds:duration,frameCount:Math.round(duration*settings.fps),audioIncluded,
  rendererLabel:RENDERER_LABELS[engine]??'Checking renderer',rendererAvailable:available,deviceLabel,deviceVerified,note,
  testFrameAvailable:!publicDemo&&available,testDisabled:busy,testFrameReason:publicDemo?'Test frames are available in the installed Studio.':busy?'Wait for the current render to finish.':selection?.availability};
}
