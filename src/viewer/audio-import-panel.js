import {normalizeAudioTracks} from '../engine/audio-track.js';
import {mixAudioTracks} from '../engine/audio-mix.js';
import {editAudioClip,waveformPeaks} from './audio-timeline.js';

export function mountAudioImportPanel({container,onEdit,onImport=()=>{},onPause=()=>{},onSeek,getTime=()=>0,getDuration=()=>30}){
 let audio={version:1,tracks:[]},documentRevision=0,decodeContext,drawRevision=0;
 const openSettings=new Set();
 const decoded=new Map(),loading=new Map(),failures=new Map(),playheads=[];
 const group=document.createElement('section');group.className='sound-section imported-audio';
 const title=document.createElement('h4');title.textContent='Imported music';
 const file=document.createElement('input');file.type='file';file.accept='.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.aif,audio/*';file.id='music-file-input';file.hidden=true;file.setAttribute('aria-label','Import audio file');
 const note=document.createElement('p');note.className='audio-import-note';note.setAttribute('role','status');
 const list=document.createElement('div'),choose=document.createElement('button');choose.type='button';choose.id='import-music';choose.className='import-music-button';choose.textContent='＋ Import music';choose.onclick=()=>file.click();
 const ruler=document.createElement('div');ruler.className='audio-timeline-ruler';
 const seek=document.createElement('input');seek.type='range';seek.min=0;seek.step=.01;seek.value=0;seek.setAttribute('aria-label','Audio timeline playhead');seek.disabled=!onSeek;seek.oninput=()=>{onPause();onSeek?.(Number(seek.value));refreshTimeline(Number(seek.value));};
 const rulerLabel=document.createElement('span');rulerLabel.className='audio-ruler-label';ruler.append(rulerLabel,seek);
 group.append(title,choose,file,note,ruler,list);container.append(group);
 const publicDemo=import.meta.env.VITE_PUBLIC_DEMO==='true';file.disabled=choose.disabled=publicDemo;note.textContent=publicDemo?'Import music in the local Studio.':'MP3, WAV or M4A · up to 100 MB. Stored locally with this project. Drag a clip to move; use its edges to trim.';
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
 function validateSource(track){const buffer=decoded.get(track.assetId);if(buffer&&track.sourceStart+track.duration>buffer.duration+.025)throw Error('The clip extends beyond its source. Trim its duration or source start.');}
 function draw(){
  const revision=++drawRevision;list.replaceChildren();playheads.length=0;ruler.hidden=!audio.tracks.length;refreshTimeline();
  for(const track of audio.tracks){
   const card=document.createElement('fieldset');card.className='imported-audio-track';card.classList.toggle('is-disabled',!track.enabled);card.dataset.trackId=track.id;
   const legend=document.createElement('legend');legend.textContent=track.name;card.append(legend);
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
    timing.textContent=`${value.timelineStart.toFixed(2)}–${(value.timelineStart+value.duration).toFixed(2)} s · source ${value.sourceStart.toFixed(2)} s${value.timelineStart+value.duration>duration+.001?' · tail outside film':''}`;
    const buffer=decoded.get(track.assetId),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    if(buffer){const visible=Math.min(value.duration,Math.max(0,duration-value.timelineStart)),peaks=waveformPeaks(buffer,value.sourceStart,visible,200);ctx.fillStyle='#9cd6bd';for(let i=0;i<peaks.length;i++){const height=Math.max(1,Math.min(54,peaks[i]*54));ctx.fillRect(i*2,30-height/2,1,height);}state.textContent='';}
    else{state.textContent=failures.get(track.assetId)??'Loading waveform…';if(failures.has(track.assetId)){const retry=document.createElement('button');retry.type='button';retry.textContent='Retry waveform';retry.onclick=()=>{failures.delete(track.assetId);draw();};state.append(' ',retry);}}
   }
   function commit(next){Object.assign(track,next);changed();}
   for(const [button,mode]of [[move,'move'],[left,'left'],[right,'right']]){
    button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();onPause();commit(editAudioClip(track,mode,(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.1),{sourceDuration:decoded.get(track.assetId)?.duration,timelineDuration:filmDuration()}));list.querySelector(`[data-track-id="${track.id}"] .${button.className.split(' ')[0]}`)?.focus();};
    button.onpointerdown=e=>{
     if(e.button!==0)return;e.preventDefault();onPause();button.setPointerCapture(e.pointerId);const initial={...track},start=e.clientX,width=lane.getBoundingClientRect().width;let next=initial;
     button.onpointermove=event=>{next=editAudioClip(initial,mode,(event.clientX-start)/width*filmDuration(),{sourceDuration:decoded.get(track.assetId)?.duration,timelineDuration:filmDuration()});paint(next);};
     button.onpointerup=()=>{button.onpointermove=null;button.onpointerup=null;button.onpointercancel=null;commit(next);};
     button.onpointercancel=()=>{button.onpointermove=null;button.onpointerup=null;paint();};
    };
   }
   lane.onclick=e=>{if(e.target!==lane||!onSeek)return;onPause();onSeek(Math.max(0,Math.min(filmDuration(),(e.clientX-lane.getBoundingClientRect().left)/lane.getBoundingClientRect().width*filmDuration())));};
   const details=document.createElement('details');details.className='audio-clip-details';details.open=openSettings.has(track.id);details.ontoggle=()=>{if(details.open)openSettings.add(track.id);else openSettings.delete(track.id);};const summary=document.createElement('summary');summary.textContent='Clip settings';details.append(summary);
   for(const [key,label,max] of [['sourceStart','Source start · seconds',7200],['timelineStart','Timeline start · seconds',7200],['duration','Duration · seconds',7200],['volume','Clip volume · 0–2',2],['fadeIn','Fade in · seconds',track.duration],['fadeOut','Fade out · seconds',track.duration]]){
    const row=document.createElement('label');row.className='sound-field';row.textContent=label;const input=document.createElement('input');input.type='number';input.min=key==='duration'?.01:0;input.max=max;input.step=.01;input.value=track[key];input.onchange=()=>{const previous={...track};track[key]=input.valueAsNumber;try{if(key==='duration'){track.fadeIn=Math.min(track.fadeIn,track.duration);track.fadeOut=Math.min(track.fadeOut,track.duration);}validateSource(track);changed();}catch(e){Object.assign(track,previous);input.value=track[key];note.textContent=e.message;}};row.append(input);details.append(row);
   }
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove track';remove.onclick=()=>{audio.tracks=audio.tracks.filter(t=>t.id!==track.id);changed();};details.append(remove);card.append(details);list.append(card);paint();
   if(!decoded.has(track.assetId)&&!failures.has(track.assetId))load(track).then(()=>{if(revision===drawRevision)paint();}).catch(()=>{if(revision===drawRevision)paint();});
  }
  refreshTimeline();
 }
 file.onchange=async()=>{
  const selected=file.files?.[0];if(!selected)return;
  if(selected.size>100*1024*1024){note.textContent='Choose an audio file no larger than 100 MB.';return;}
  if(audio.tracks.length>=16){note.textContent='A project supports up to 16 audio tracks.';return;}
  const importingRevision=documentRevision;file.disabled=choose.disabled=true;choose.textContent='Importing…';note.textContent='Importing and checking audio…';
  try{const response=await fetch('/api/studio/audio/assets',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Audio-Name':encodeURIComponent(selected.name)},body:selected});const data=await response.json();if(!response.ok)throw Error(data.error??'Audio import failed');if(importingRevision!==documentRevision)return;audio.tracks=audio.tracks.filter(track=>track.id!=='authored-loop');audio.tracks.push({id:crypto.randomUUID(),assetId:data.asset.assetId,name:data.asset.name,enabled:true,sourceStart:0,timelineStart:0,duration:Math.min(7200,filmDuration(),data.asset.duration),volume:1,fadeIn:0,fadeOut:0});onImport();changed();note.textContent='Music imported · press Play to listen';}catch(e){note.textContent=e.message;}finally{file.disabled=choose.disabled=publicDemo;choose.textContent='＋ Import music';file.value='';}
 };
 return {getAudio:()=>structuredClone(audio),setAudio:value=>{documentRevision++;audio=normalizeAudioTracks(value??{version:1,tracks:[]});draw();},mix:(base,context,document,sound)=>mixAudioTracks(base,context,document,sound,track=>load(track,context)),refreshTimeline};
}
