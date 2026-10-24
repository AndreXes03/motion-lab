import {voicePhrases,applyVoiceClips} from '../engine/voice-edit.js';
import {importSpeechTiming,speechMarkers} from '../engine/narration.js';

/** Secondary disclosure: no new control on the main canvas. */
export function voiceTimingDetails(track,{onEdit,onPause,onSeek,isCurrent=()=>true,getSourceDuration=()=>Infinity,open=false,onToggle=()=>{},onTranscribe=()=>{},speechState}){
 const details=document.createElement('details');details.className='voice-timing';
 details.open=open;details.ontoggle=()=>onToggle(details.open);
 const summary=document.createElement('summary');summary.textContent='Speech & pauses';details.append(summary);
 const script=document.createElement('textarea');script.rows=3;script.maxLength=30000;script.placeholder='Paste the spoken script (optional)';script.setAttribute('aria-label',`Voiceover script for ${track.name}`);script.value=track.clips?speechMarkers(track).map(w=>w.text).join(' '):track.narration?.text??'';script.readOnly=!!track.narration?.segments.length;
 script.onchange=()=>{track.narration={version:1,text:script.value,source:'manual',segments:[],cues:[]};onEdit();};
 const status=document.createElement('p');status.className='audio-import-note';const count=track.narration?.segments.length??0;
 status.textContent=count?`${count} ${track.narration.source==='captions'?'phrase':'speech'} markers · ready for scene and title cues.`:(speechState?.message??'Text and timing are extracted locally from the voice file.');
 const input=document.createElement('input');input.type='file';input.accept='.json,.srt,.vtt';input.hidden=true;
 const button=document.createElement('button');button.type='button';button.className='audio-small-action';button.textContent=count?'Replace timing…':'Import timing…';button.onclick=()=>input.click();
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw Error('Choose a timing file smaller than 1 MB');const narration=importSpeechTiming(await file.text());if(!isCurrent())return;if(narration.segments.some(s=>s.end>getSourceDuration()+.025))throw Error('These speech times extend beyond the voice file.');track.narration=narration;onPause();onEdit();}catch(error){status.textContent=error.message;}finally{input.value='';}};
 const retry=document.createElement('button');retry.type='button';retry.className='audio-small-action';retry.textContent='Transcribe voice';retry.disabled=speechState&&!['error','ready'].includes(speechState.status);retry.onclick=onTranscribe;
 details.append(script,status);if(!count)details.append(retry);details.append(button,input);
 if(count&&Number.isFinite(getSourceDuration())){
  const sourceDuration=getSourceDuration(),words=track.narration.segments;
  const clips=track.clips??voicePhrases(track,sourceDuration).map(({id,sourceStart,duration,pauseAfter})=>({id,sourceStart,duration,pauseAfter}));
  const label=document.createElement('p');label.className='audio-import-note';label.textContent='Keep passages and add silence after them. The original recording stays intact.';details.append(label);
  const passages=document.createElement('div');passages.className='voice-passages';
  const apply=next=>{try{const edited=applyVoiceClips(track,next,sourceDuration);Object.assign(track,edited);onPause();onEdit();return true;}catch(error){status.textContent=error.message;return false;}};
  for(const [i,clip] of clips.entries()){
   const row=document.createElement('div');row.className='voice-passage';
   const keep=document.createElement('input');keep.type='checkbox';keep.checked=true;keep.setAttribute('aria-label',`Keep passage ${i+1}`);keep.onchange=()=>{if(!apply(clips.filter(c=>c.id!==clip.id)))keep.checked=true;};
   const jump=document.createElement('button');jump.type='button';jump.className='voice-passage-text';const included=words.filter(w=>w.start<clip.sourceStart+clip.duration&&w.end>clip.sourceStart);jump.textContent=included.map(w=>w.text).join(' ')||'Pause';jump.title='Listen from this passage';jump.onclick=()=>{const marker=speechMarkers(track).find(w=>included.some(x=>x.id===w.id));if(marker){onPause();onSeek?.(marker.start);}};
   const pauseLabel=document.createElement('label');pauseLabel.textContent='Pause +';const pause=document.createElement('input');pause.type='number';pause.min=0;pause.max=30;pause.step=.1;pause.value=clip.pauseAfter;pause.setAttribute('aria-label',`Extra pause after passage ${i+1} in seconds`);pause.onchange=()=>{if(!apply(clips.map(c=>c.id===clip.id?{...c,pauseAfter:pause.valueAsNumber}:c)))pause.value=clip.pauseAfter;};pauseLabel.append(pause,document.createTextNode('s'));
   row.append(keep,jump,pauseLabel);passages.append(row);
  }
  details.append(passages);
  if(track.clips){const reset=document.createElement('button');reset.type='button';reset.className='audio-small-action';reset.textContent='Restore original voice';reset.onclick=()=>{delete track.clips;track.sourceStart=0;track.duration=sourceDuration;track.fadeIn=Math.min(track.fadeIn,sourceDuration);track.fadeOut=Math.min(track.fadeOut,sourceDuration);onPause();onEdit();};details.append(reset);}
 }

 if(count){const select=document.createElement('select');select.setAttribute('aria-label',`Jump to spoken words in ${track.name}`);select.add(new Option('Jump to spoken words…',''));for(const marker of speechMarkers(track))select.add(new Option(`${marker.start.toFixed(2)} s · ${marker.text}`,String(marker.start)));select.onchange=()=>{if(select.value!==''&&onSeek){onPause();onSeek(Number(select.value));}};details.append(select);const note=document.createElement('p');note.className='audio-import-note';note.textContent='JSON word timing or SRT/VTT phrases. Replacing timing clears existing cue links for this voice.';details.append(note);}
 return details;
}
