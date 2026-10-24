/** Measured speech timing in source seconds. Rendering never calls a model. */
import {audioSlices} from './voice-edit.js';
const safeId=/^[a-zA-Z0-9_.-]{1,80}$/;
function exact(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error(`Invalid ${label}`);}
function text(value,max,label){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008]/.test(value))throw Error(`Invalid ${label}`);return value;}
function seconds(value){if(!Number.isFinite(value)||value<0||value>7200)throw Error('Speech times must be 0–7200 seconds');return value;}
export function normalizeNarration(input){
 exact(input,['version','text','source','segments','cues','language'],'speech timing');
 if(input.version!==1||!['provider','aligned','captions','manual','transcribed'].includes(input.source))throw Error('Unsupported speech timing source');
 if(!Array.isArray(input.segments)||input.segments.length>5000||!Array.isArray(input.cues??[])||(input.cues??[]).length>200)throw Error('Too many speech markers');
 if(input.language!==undefined&&(typeof input.language!=='string'||!/^([a-z]{2,3})$/.test(input.language)))throw Error('Invalid speech language');
 const ids=new Set();let previous=-1;
 const segments=input.segments.map(s=>{exact(s,['id','text','start','end'],'speech marker');if(typeof s.id!=='string'||!safeId.test(s.id)||ids.has(s.id))throw Error('Speech marker IDs must be unique');ids.add(s.id);seconds(s.start);seconds(s.end);if(s.start<previous||s.end<=s.start)throw Error('Speech markers must be ordered and have a positive duration');previous=s.start;return {id:s.id,text:text(s.text,2000,'spoken text'),start:s.start,end:s.end};});
 const cueIds=new Set(),byId=new Map(segments.map(s=>[s.id,s]));
 const cues=(input.cues??[]).map(c=>{exact(c,['id','from','to','offset','endOffset','label','super'],'narrative cue');if(typeof c.id!=='string'||!safeId.test(c.id)||cueIds.has(c.id)||!ids.has(c.from)||!ids.has(c.to))throw Error('Narrative cues need unique IDs and existing speech markers');cueIds.add(c.id);for(const n of [c.offset??0,c.endOffset??0])if(!Number.isFinite(n)||Math.abs(n)>30)throw Error('Cue offsets must be within 30 seconds');if(byId.get(c.to).end+(c.endOffset??0)<=byId.get(c.from).start+(c.offset??0))throw Error('Narrative cue must end after it starts');return {id:c.id,from:c.from,to:c.to,offset:c.offset??0,endOffset:c.endOffset??0,label:text(c.label??'',200,'cue label'),super:text(c.super??'',200,'super')};});
 return {version:1,...(input.language?{language:input.language}:{}),text:text(input.text??segments.map(s=>s.text).join(' '),30000,'transcript'),source:input.source,segments,cues};
}

/** Accept provider word/character timing, WhisperX segments, or SRT/VTT phrases. */
export function importSpeechTiming(contents){
 if(typeof contents!=='string'||contents.length>1024*1024)throw Error('Choose a timing file smaller than 1 MB');
 let rows,source='provider',transcript;
 if(/^[\s]*[\[{]/.test(contents)){
  const data=JSON.parse(contents);if(data.version===1&&data.segments&&data.source)return normalizeNarration(data);
  transcript=data.text;const alignment=data.normalized_alignment??data.alignment??(data.characters&&data.character_start_times_seconds?data:null);
  if(alignment){rows=[];let word='',start,end;const chars=alignment.characters,starts=alignment.character_start_times_seconds,ends=alignment.character_end_times_seconds;if(!Array.isArray(chars)||chars.length!==starts?.length||chars.length!==ends?.length)throw Error('Incomplete character timing');for(let i=0;i<chars.length;i++){if(/\s/.test(chars[i])){if(word){rows.push({text:word,start,end});word='';}}else{if(!word)start=starts[i];word+=chars[i];end=ends[i];}}if(word)rows.push({text:word,start,end});}
  else rows=Array.isArray(data)?data:data.words??data.segments?.flatMap(s=>s.words?.length?s.words:[s]);
 }else{
  source='captions';rows=[];const stamp=v=>v.replace(',','.').split(':').reduce((n,x)=>n*60+Number(x),0);
  for(const block of contents.replace(/\r/g,'').split(/\n\s*\n/)){const lines=block.trim().split('\n'),i=lines.findIndex(l=>l.includes('-->'));if(i<0)continue;const match=lines[i].match(/((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})/);if(!match)throw Error('Invalid caption time');rows.push({start:stamp(match[1]),end:stamp(match[2]),text:lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'')});}
 }
 if(!Array.isArray(rows)||!rows.length)throw Error('No measured speech times found. Import word-timing JSON, SRT or VTT.');
 // Missing alignment is an error, never a guessed timestamp.
 const segments=rows.map((s,i)=>({id:`w${i+1}`,text:s.text??s.word,start:s.start,end:s.end}));
 return normalizeNarration({version:1,source,text:transcript??segments.map(s=>s.text).join(' '),segments,cues:[]});
}

export function speechMarkers(track){return audioSlices(track).flatMap(clip=>(track.narration?.segments??[]).flatMap(s=>{const start=Math.max(s.start,clip.sourceStart),end=Math.min(s.end,clip.sourceStart+clip.duration);return end>start?[{...s,sourceStart:s.start,sourceEnd:s.end,start:clip.timelineStart+start-clip.sourceStart,end:clip.timelineStart+end-clip.sourceStart}]:[];})).sort((a,b)=>a.start-b.start);}

/** Stable cue lookup for authored scenes/supers; clips move/trim without stale hardcoded times. */
export function narrationCue(audio,id,{trackId,fps=30}={}){
 if(!Number.isFinite(fps)||fps<=0||fps>240)throw Error('Invalid cue frame rate');
 const matches=(audio?.tracks??[]).filter(t=>t.role==='voiceover'&&t.enabled!==false&&(!trackId||t.id===trackId)).flatMap(track=>(track.narration?.cues??[]).filter(c=>c.id===id).map(cue=>({track,cue})));
 if(matches.length!==1)throw Error(`Narrative cue ${id} is missing or ambiguous`);
 const {track,cue}=matches[0],markers=new Map((track.clips?speechMarkers(track):track.narration.segments.map(s=>({...s,start:track.timelineStart+s.start-track.sourceStart,end:track.timelineStart+s.end-track.sourceStart}))).map(s=>[s.id,s]));
 const from=markers.get(cue.from),to=markers.get(cue.to);
 if(!from||!to)throw Error(`Narrative cue ${id} is outside the voice clip: a linked word was cut`);
 const start=Math.max(track.timelineStart,from.start+cue.offset),end=Math.min(track.timelineStart+track.duration,to.end+cue.endOffset);
 if(end<=start)throw Error(`Narrative cue ${id} has reversed or empty edited timing`);
 const snap=t=>Math.round(t*fps)/fps,a=snap(start),b=snap(end);
 if(b<=a)throw Error(`Narrative cue ${id} is shorter than a frame`);
 return {id,label:cue.label,super:cue.super,start:a,end:b,duration:b-a};
}
export function evaluateNarrationCue(audio,id,time,options){const cue=narrationCue(audio,id,options);return {...cue,active:time>=cue.start&&time<cue.end,localTime:time-cue.start,progress:Math.max(0,Math.min(1,(time-cue.start)/cue.duration))};}

export function validateNarrationCues(audio,{fps=30}={}){for(const track of audio?.tracks??[])if(track.role==='voiceover'&&track.enabled!==false)for(const cue of track.narration?.cues??[])narrationCue(audio,cue.id,{trackId:track.id,fps});}
