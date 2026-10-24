import {importSpeechTiming,speechMarkers} from '../engine/narration.js';

/** Secondary disclosure: no new control on the main canvas. */
export function voiceTimingDetails(track,{onEdit,onPause,onSeek,isCurrent=()=>true,getSourceDuration=()=>Infinity,open=false,onToggle=()=>{}}){
 const details=document.createElement('details');details.className='voice-timing';
 details.open=open;details.ontoggle=()=>onToggle(details.open);
 const summary=document.createElement('summary');summary.textContent='Speech & timing';details.append(summary);
 const script=document.createElement('textarea');script.rows=3;script.maxLength=30000;script.placeholder='Paste the spoken script (optional)';script.setAttribute('aria-label',`Voiceover script for ${track.name}`);script.value=track.narration?.text??'';script.readOnly=!!track.narration?.segments.length;
 script.onchange=()=>{track.narration={version:1,text:script.value,source:'manual',segments:[],cues:[]};onEdit();};
 const status=document.createElement('p');status.className='audio-import-note';const count=track.narration?.segments.length??0;
 status.textContent=count?`${count} ${track.narration.source==='captions'?'phrase':'speech'} markers · ready for scene and title cues.`:'Add measured timing to link scenes and titles to speech. The script alone has no timing.';
 const input=document.createElement('input');input.type='file';input.accept='.json,.srt,.vtt';input.hidden=true;
 const button=document.createElement('button');button.type='button';button.className='audio-small-action';button.textContent=count?'Replace timing…':'Import timing…';button.onclick=()=>input.click();
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw Error('Choose a timing file smaller than 1 MB');const narration=importSpeechTiming(await file.text());if(!isCurrent())return;if(narration.segments.some(s=>s.end>getSourceDuration()+.025))throw Error('These speech times extend beyond the voice file.');track.narration=narration;onPause();onEdit();}catch(error){status.textContent=error.message;}finally{input.value='';}};
 details.append(script,status,button,input);
 if(count){const select=document.createElement('select');select.setAttribute('aria-label',`Jump to spoken words in ${track.name}`);select.add(new Option('Jump to spoken words…',''));for(const marker of speechMarkers(track))select.add(new Option(`${marker.start.toFixed(2)} s · ${marker.text}`,String(marker.start)));select.onchange=()=>{if(select.value!==''&&onSeek){onPause();onSeek(Number(select.value));}};details.append(select);const note=document.createElement('p');note.className='audio-import-note';note.textContent='JSON word timing or SRT/VTT phrases. Replacing timing clears existing cue links for this voice.';details.append(note);}
 return details;
}
