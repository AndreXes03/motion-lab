import {validateNarrationCues} from '../engine/narration.js';
import {voiceSourceDuration,validateVoiceSource,audioSlices} from '../engine/voice-edit.js';
import {normalizeAudioTracks} from '../engine/audio-track.js';
import {mixAudioTracks} from '../engine/audio-mix.js';
import {editAudioClip,waveformPeaks} from './audio-timeline.js';
import {audioRole} from '../engine/voiceover.js';
import {voiceTimingDetails} from './voice-timing.js';

export function mountAudioImportPanel({container,onEdit,onImport=()=>{},onPause=()=>{},onSeek,getTime=()=>0,getDuration=()=>30}){
 let audio={version:1,tracks:[]},documentRevision=0,decodeContext,drawRevision=0,importRole='music';
 const openSettings=new Set(),speechStates=new Map();
 const decoded=new Map(),loading=new Map(),failures=new Map(),playheads=[];
 const group=document.createElement('section');group.className='sound-section imported-audio';
 const title=document.createElement('h4');title.textContent='Audio tracks';
 const file=document.createElement('input');file.type='file';file.accept='.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.aif,audio/*';file.id='music-file-input';file.hidden=true;file.setAttribute('aria-label','Import audio file');
 const note=document.createElement('p');note.className='audio-import-note';note.setAttribute('role','status');
 const list=document.createElement('div'),choose=document.createElement('button');choose.type='button';choose.id='import-music';choose.className='audio-small-action';choose.textContent='＋ Music';choose.setAttribute('aria-label','Import music');choose.onclick=()=>{importRole='music';file.click();};
 const voice=document.createElement('button');voice.type='button';voice.id='import-voiceover';voice.className='audio-small-action';voice.textContent='＋ Voiceover';voice.setAttribute('aria-label','Import voiceover');voice.onclick=()=>{importRole='voiceover';file.click();};
 const header=document.createElement('div');header.className='audio-import-header';header.append(title,choose,voice);
 const duckRow=document.createElement('label');duckRow.className='audio-track-enabled voice-ducking';const duck=document.createElement('input');duck.type='checkbox';duck.checked=true;duck.onchange=()=>{audio={...audio,version:2,ducking:duck.checked};changed();};duckRow.append(duck,document.createTextNode('Lower music during speech'));
 const ruler=document.createElement('div');ruler.className='audio-timeline-ruler';
 const seek=document.createElement('input');seek.type='range';seek.min=0;seek.step=.01;seek.value=0;seek.setAttribute('aria-label','Audio timeline playhead');seek.disabled=!onSeek;seek.oninput=()=>{onPause();onSeek?.(Number(seek.value));refreshTimeline(Number(seek.value));};
 const rulerLabel=document.createElement('span');rulerLabel.className='audio-ruler-label';ruler.append(rulerLabel,seek);
 group.append(header,file,note,duckRow,ruler,list);container.append(group);
 const publicDemo=import.meta.env.VITE_PUBLIC_DEMO==='true';file.disabled=choose.disabled=voice.disabled=publicDemo;note.textContent=publicDemo?'Import music and voiceover in the local Studio.':'MP3, WAV or M4A · up to 100 MB · saved with this project.';
 const filmDuration=()=>Math.max(.01,Number(getDuration())||30);
 function refreshTimeline(time=getTime()){
  const duration=filmDuration();seek.max=duration;seek.value=Math.min(duration,Math.max(0,time));rulerLabel.textContent=`${Number(seek.value).toFixed(2)} s / ${duration.toFixed(2)} s`;
  for(const head of playheads)head.style.left=`${Math.max(0,Math.min(100,time/duration*100))}%`;
 }
 async function load(track,context){
  if(decoded.has(track.assetId))return decoded.get(track.assetId);
  if(!loading.has(track.assetId)){
   const promise=(async()=>{const response=await fetch(`/api/studio/audio/assets/${track.assetId}/file`);if(!response.ok)throw Error(`Imported audio unavailable: ${track.name}`);decodeContext??=context??new AudioContext({sampleRate:48000});const buffer=await decodeContext.decodeAudioData(await response.arrayBuffer());decoded.set(track.assetId,buffer);failures.delete(track.assetId);return buffer;})();
   loading.set(track.assetId,promise);promise.catch(error=>failures.set(track.assetId,error.message)).finally(()=>loading.delete(track.assetId));
  }
  return loading.get(track.assetId);
 }
 function changed(){audio=normalizeAudioTracks(audio);draw();onEdit();}
 function validateSource(track){const buffer=decoded.get(track.assetId);if(buffer)validateVoiceSource(track,buffer.duration);}
 function draw(){
  const revision=++drawRevision;list.replaceChildren();playheads.length=0;ruler.hidden=!audio.tracks.length;duckRow.hidden=!audio.tracks.some(t=>audioRole(t)==='voiceover');duck.checked=audio.ducking!==false;refreshTimeline();
  for(const track of audio.tracks){
   const card=document.createElement('fieldset');card.className='imported-audio-track';card.classList.toggle('is-disabled',!track.enabled);card.dataset.trackId=track.id;
   const legend=document.createElement('legend');legend.textContent=track.name;const badge=document.createElement('span');badge.className='audio-role';badge.textContent=audioRole(track)==='voiceover'?'Voice':audioRole(track)==='sfx'?'Effect':'Music';legend.prepend(badge);card.dataset.role=audioRole(track);card.append(legend);
   const enabled=document.createElement('label');enabled.className='audio-track-enabled';const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=track.enabled;toggle.onchange=()=>{track.enabled=toggle.checked;changed();};enabled.append(toggle,document.createTextNode('Enabled'));card.append(enabled);
   const lane=document.createElement('div');lane.className='audio-clip-lane';lane.setAttribute('aria-label',`${track.name} timeline`);
   const clip=document.createElement('div');clip.className='audio-clip';
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=60;canvas.setAttribute('aria-hidden','true');
   const move=document.createElement('button');move.type='button';move.className='audio-clip-move';move.setAttribute('aria-label',`Move ${track.name}; arrow keys move by 0.1 seconds`);
   const left=document.createElement('button'),right=document.createElement('button');for(const [button,side]of [[left,'left'],[right,'right']]){button.type='button';button.className=`audio-trim audio-trim-${side}`;button.setAttribute('aria-label',`Trim ${side==='left'?'start':'end'} of ${track.name}; arrow keys trim by 0.1 seconds`);}
   const head=document.createElement('span');head.className='audio-clip-playhead';head.setAttribute('aria-hidden','true');playheads.push(head);clip.append(canvas,move,left,right);lane.append(clip,head);card.append(lane);
   const timing=document.createElement('p');timing.className='audio-clip-timing';card.append(timing);
   const state=document.createElement('p');state.className='audio-wave-status';state.setAttribute('role','status');card.append(state);
   function paint(value=track){
    const duration=filmDuration();clip.style.left=`${value.timelineStart/duration*100}%`;clip.style.width=`${Math.min(value.duration,Math.max(0,duration-value.timelineStart))/duration*100}%`;
    timing.textContent=`${value.timelineStart.toFixed(2)}–${(value.timelineStart+value.duration).toFixed(2)} s · source ${value.sourceStart.toFixed(2)} s${value.timelineStart+value.duration>duration+.025?(audioRole(value)==='voiceover'?' · extend film or trim voice before export':' · tail outside film'):''}`;
    timing.classList.toggle('audio-duration-warning',audioRole(value)==='voiceover'&&value.timelineStart+value.duration>duration+.025);
    const buffer=decoded.get(track.assetId),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    if(buffer){const visible=Math.min(value.duration,Math.max(0,duration-value.timelineStart)),peaks=Array.from({length:200},(_,i)=>{const time=value.timelineStart+i/200*visible,slice=audioSlices(value).find(s=>time>=s.timelineStart&&time<s.timelineStart+s.duration);return slice?waveformPeaks(buffer,slice.sourceStart+time-slice.timelineStart,Math.min(visible/200,slice.timelineStart+slice.duration-time),1)[0]:0;});ctx.fillStyle='#9cd6bd';for(let i=0;i<peaks.length;i++){const height=Math.max(1,Math.min(54,peaks[i]*54));ctx.fillRect(i*2,30-height/2,1,height);}state.textContent='';}
    else{state.textContent=failures.get(track.assetId)??'Loading waveform…';if(failures.has(track.assetId)){const retry=document.createElement('button');retry.type='button';retry.textContent='Retry waveform';retry.onclick=()=>{failures.delete(track.assetId);draw();};state.append(' ',retry);}}
   }
   function commit(next){Object.assign(track,next);changed();}
   for(const [button,mode]of [[move,'move'],[left,'left'],[right,'right']]){
    button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();onPause();commit(editAudioClip(track,mode,(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.1),{sourceDuration:voiceSourceDuration(track,decoded.get(track.assetId)?.duration),timelineDuration:filmDuration()}));list.querySelector(`[data-track-id="${track.id}"] .${button.className.split(' ')[0]}`)?.focus();};
    button.onpointerdown=e=>{
     if(e.button!==0)return;e.preventDefault();onPause();button.setPointerCapture(e.pointerId);const initial={...track},start=e.clientX,width=lane.getBoundingClientRect().width;let next=initial;
     button.onpointermove=event=>{next=editAudioClip(initial,mode,(event.clientX-start)/width*filmDuration(),{sourceDuration:voiceSourceDuration(track,decoded.get(track.assetId)?.duration),timelineDuration:filmDuration()});paint(next);};
     button.onpointerup=()=>{button.onpointermove=null;button.onpointerup=null;button.onpointercancel=null;commit(next);};
     button.onpointercancel=()=>{button.onpointermove=null;button.onpointerup=null;paint();};
    };
   }
   lane.onclick=e=>{if(e.target!==lane||!onSeek)return;onPause();onSeek(Math.max(0,Math.min(filmDuration(),(e.clientX-lane.getBoundingClientRect().left)/lane.getBoundingClientRect().width*filmDuration())));};
   const details=document.createElement('details');details.className='audio-clip-details';details.open=openSettings.has(track.id);details.ontoggle=()=>{if(details.open)openSettings.add(track.id);else openSettings.delete(track.id);};const summary=document.createElement('summary');summary.textContent='Clip settings';details.append(summary);
   for(const [key,label,max] of [['sourceStart','Source start · seconds',7200],['timelineStart','Timeline start · seconds',7200],['duration','Duration · seconds',7200],['volume','Clip volume · 0–2',2],['fadeIn','Fade in · seconds',track.duration],['fadeOut','Fade out · seconds',track.duration]]){
    const row=document.createElement('label');row.className='sound-field';row.textContent=(key==='sourceStart'&&track.clips?'Edited voice start · seconds':label);const input=document.createElement('input');input.type='number';input.min=key==='duration'?.01:0;input.max=max;input.step=.01;input.value=track[key];input.onchange=()=>{const previous={...track};track[key]=input.valueAsNumber;try{if(key==='duration'){track.fadeIn=Math.min(track.fadeIn,track.duration);track.fadeOut=Math.min(track.fadeOut,track.duration);}validateSource(track);changed();}catch(e){Object.assign(track,previous);input.value=track[key];note.textContent=e.message;}};row.append(input);details.append(row);
   }
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove track';remove.onclick=()=>{audio.tracks=audio.tracks.filter(t=>t.id!==track.id);changed();};details.append(remove);card.append(details);if(audioRole(track)==='voiceover'){const speechStatus=document.createElement('p');speechStatus.className='audio-import-note';speechStatus.dataset.speechStatus=track.id;speechStatus.setAttribute('role','status');speechStatus.textContent=track.narration?.segments.length?'Transcript ready · open Speech & pauses':speechStates.get(track.id)?.message??'Preparing speech analysis…';try{validateNarrationCues({tracks:[track]});}catch(error){speechStatus.textContent=error.message+' · update the scene link before export.';}card.append(speechStatus,voiceTimingDetails(track,{onEdit:changed,onTranscribe:()=>analyzeVoice(track.id,true),speechState:speechStates.get(track.id),onPause,onSeek,open:openSettings.has(track.id+'.speech'),onToggle:open=>{if(open)openSettings.add(track.id+'.speech');else openSettings.delete(track.id+'.speech');},isCurrent:()=>revision===drawRevision&&audio.tracks.includes(track),getSourceDuration:()=>decoded.get(track.assetId)?.duration??Infinity}));}list.append(card);paint();
   if(!decoded.has(track.assetId)&&!failures.has(track.assetId))load(track).then(()=>{if(revision===drawRevision)draw();}).catch(()=>{if(revision===drawRevision)paint();});
  }
  refreshTimeline();
 }
 async function analyzeVoice(id,retry=false){
  const initial=audio.tracks.find(t=>t.id===id);if(!initial||initial.role!=='voiceover'||initial.narration?.segments.length||(!retry&&speechStates.has(id)))return;
  const assetId=initial.assetId,revision=documentRevision,originalNarration=JSON.stringify(initial.narration);
  const current=()=>documentRevision===revision&&audio.tracks.find(t=>t.id===id&&t.assetId===assetId&&JSON.stringify(t.narration)===originalNarration);
  const update=state=>{speechStates.set(id,state);const label=list.querySelector(`[data-speech-status="${id}"]`);if(label)label.textContent=state.message;};
  const url=`/api/studio/audio/assets/${assetId}/transcription`;
  try{
   update({status:'queued',message:'Preparing speech analysis…'});draw();
   let response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),data=await response.json();if(!response.ok)throw Error(data.error??'Speech analysis unavailable');
   while(current()){
    update(data);
    if(data.status==='ready'){const track=current();track.narration=data.narration;onPause();changed();return;}
    if(data.status==='error')throw Error(data.message);
    if(data.status==='missing')throw Error('Studio restarted during analysis. Retry transcription.');
    await new Promise(resolve=>setTimeout(resolve,1000));if(!current())return;
    response=await fetch(url);data=await response.json();if(!response.ok)throw Error(data.error??'Speech analysis unavailable');
   }
  }catch(error){if(current()){update({status:'error',message:error.message});draw();}}
 }
 file.onchange=async()=>{
  const selected=file.files?.[0];if(!selected)return;
  if(selected.size>100*1024*1024){note.textContent='Choose an audio file no larger than 100 MB.';return;}
  if(audio.tracks.length>=16){note.textContent='A project supports up to 16 audio tracks.';return;}
  const importingRevision=documentRevision,role=importRole;file.disabled=choose.disabled=voice.disabled=true;note.textContent='Importing and checking audio…';
  try{const response=await fetch('/api/studio/audio/assets',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Audio-Name':encodeURIComponent(selected.name)},body:selected});const data=await response.json();if(!response.ok)throw Error(data.error??'Audio import failed');if(importingRevision!==documentRevision)return;if(role==='music')audio.tracks=audio.tracks.filter(track=>track.id!=='authored-loop');audio.version=2;audio.ducking??=true;const trackId=crypto.randomUUID();audio.tracks.push({id:trackId,assetId:data.asset.assetId,name:data.asset.name,role,enabled:true,sourceStart:0,timelineStart:0,duration:role==='voiceover'?data.asset.duration:Math.min(7200,filmDuration(),data.asset.duration),volume:1,fadeIn:0,fadeOut:0});onImport(role);changed();note.textContent=role==='voiceover'?'Voiceover imported · music preserved':'Music imported · press Play to listen';if(role==='voiceover')void analyzeVoice(trackId);}catch(e){note.textContent=e.message;}finally{file.disabled=choose.disabled=voice.disabled=publicDemo;file.value='';}
 };
 return {getAudio:()=>structuredClone(audio),setAudio:value=>{documentRevision++;audio=normalizeAudioTracks(value??{version:1,tracks:[]});speechStates.clear();draw();queueMicrotask(()=>{for(const track of audio.tracks)if(track.role==='voiceover'&&!track.narration?.segments.length)void analyzeVoice(track.id);});},mix:(base,context,document,sound,options)=>mixAudioTracks(base,context,document,sound,track=>load(track,context),options),refreshTimeline};
}
