/** Non-destructive source slices. Track trims refer to the assembled voice clock. */
export const CUT_FADE = .003;
export function normalizeVoiceClips(clips) {
 if(!Array.isArray(clips)||!clips.length||clips.length>200)throw Error('Keep between 1 and 200 voice clips');
 const ids=new Set();
 const result=clips.map(c=>{
  if(!c||Object.keys(c).some(k=>!['id','sourceStart','duration','pauseAfter'].includes(k))||typeof c.id!=='string'||!/^[\w.-]{1,80}$/.test(c.id)||ids.has(c.id))throw Error('Voice clip IDs must be unique');ids.add(c.id);
  if(!Number.isFinite(c.sourceStart)||c.sourceStart<0||!Number.isFinite(c.duration)||c.duration<.01||c.sourceStart+c.duration>7200||!Number.isFinite(c.pauseAfter??0)||(c.pauseAfter??0)<0||(c.pauseAfter??0)>30)throw Error('Invalid voice cut or pause');
  return {id:c.id,sourceStart:c.sourceStart,duration:c.duration,pauseAfter:c.pauseAfter??0};
 });
 const ordered=[...result].sort((a,b)=>a.sourceStart-b.sourceStart);
 for(let i=1;i<ordered.length;i++)if(ordered[i].sourceStart<ordered[i-1].sourceStart+ordered[i-1].duration-1e-6)throw Error('Voice cuts cannot repeat or overlap source speech');
 if(voiceSourceDuration({clips:result})>7200)throw Error('Edited voice exceeds two hours');
 return result;
}
export function voiceSourceDuration(track,original=7200){return track.clips?.reduce((sum,c)=>sum+c.duration+c.pauseAfter,0)??original;}
export function validateVoiceSource(track,original){
 if(track.sourceStart+track.duration>voiceSourceDuration(track,original)+.025||track.clips?.some(c=>c.sourceStart+c.duration>original+.025))throw Error(`Audio track ${track.name} extends beyond its source`);
}
export function audioSlices(track){
 if(!track.clips)return [{sourceStart:track.sourceStart,duration:track.duration,timelineStart:track.timelineStart,cutOffset:0,cutDuration:track.duration,edited:false}];
 let clock=0;const slices=[];
 for(const c of track.clips){const from=Math.max(clock,track.sourceStart),to=Math.min(clock+c.duration,track.sourceStart+track.duration);if(to>from)slices.push({id:c.id,sourceStart:c.sourceStart+from-clock,duration:to-from,timelineStart:track.timelineStart+from-track.sourceStart,cutOffset:from-clock,cutDuration:c.duration,edited:true});clock+=c.duration+c.pauseAfter;}
 return slices;
}
export function sliceGain(slice,localTime){return slice.edited?Math.max(0,Math.min(1,(slice.cutOffset+localTime)/CUT_FADE,(slice.cutDuration-slice.cutOffset-localTime)/CUT_FADE)):1;}
/** Phrase boundaries keep the original silences until an explicit edit changes them. */
export function voicePhrases(track,sourceDuration){
 const words=track.narration?.segments??[];if(!words.length)return [];
 const groups=[];let start=0;
 for(let i=0;i<words.length;i++)if(i===words.length-1||/[.!?…,;:]["”']?$/.test(words[i].text)||words[i+1].start-words[i].end>.65||i-start>=23){groups.push(words.slice(start,i+1));start=i+1;}
 return groups.map((group,i)=>{const from=group[0],to=group.at(-1),a=i?(groups[i-1].at(-1).end+from.start)/2:0,b=i===groups.length-1?sourceDuration:(to.end+groups[i+1][0].start)/2;return {id:`p-${from.id}`,from:from.id,to:to.id,text:group.map(w=>w.text).join(' '),sourceStart:a,duration:b-a,pauseAfter:0};});
}
/** Agent plan uses measured word IDs, with a small breath margin inside adjacent gaps. */
export function editVoiceFromWords(track,plan,sourceDuration){
 const words=track.narration?.segments??[],indices=new Map(words.map((w,i)=>[w.id,i]));
 if(!Array.isArray(plan)||!plan.length)throw Error('Keep at least one spoken passage');
 const clips=plan.map((p,i)=>{
  if(!p||Object.keys(p).some(k=>!['id','from','to','pauseAfter'].includes(k)))throw Error('Invalid voice edit plan');
  const a=indices.get(p.from),b=indices.get(p.to);if(a===undefined||b===undefined||b<a)throw Error('Voice edits need ordered measured word IDs');
  const start=Math.max(0,words[a].start-Math.min(.06,a?Math.max(0,words[a].start-words[a-1].end)/2:.06));
  const end=Math.min(sourceDuration,words[b].end+Math.min(.1,b+1<words.length?Math.max(0,words[b+1].start-words[b].end)/2:.1));
  return {id:p.id??`part-${i+1}`,sourceStart:start,duration:end-start,pauseAfter:p.pauseAfter??0};
 });
 return applyVoiceClips(track,clips,sourceDuration);
}
export function applyVoiceClips(track,clips,sourceDuration){
 const next={...track,clips:normalizeVoiceClips(clips),sourceStart:0};next.duration=voiceSourceDuration(next);next.fadeIn=Math.min(next.fadeIn,next.duration);next.fadeOut=Math.min(next.fadeOut,next.duration);validateVoiceSource(next,sourceDuration);return next;
}
