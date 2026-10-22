const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
/** A left trim preserves the source/timeline correspondence; movement preserves the cut. */
export function editAudioClip(track,mode,delta,{sourceDuration=7200,timelineDuration=7200}={}){
 const next={...track},end=track.timelineStart+track.duration;
 if(mode==='move')next.timelineStart=clamp(track.timelineStart+delta,0,Math.max(0,timelineDuration-.01));
 if(mode==='left'){
  const shift=clamp(delta,Math.max(-track.sourceStart,-track.timelineStart),track.duration-.01);
  next.sourceStart+=shift;next.timelineStart+=shift;next.duration=end-next.timelineStart;
 }
 if(mode==='right')next.duration=clamp(track.duration+delta,.01,Math.max(.01,Math.min(sourceDuration-track.sourceStart,timelineDuration-track.timelineStart)));
 next.fadeIn=Math.min(next.fadeIn,next.duration);next.fadeOut=Math.min(next.fadeOut,next.duration);
 for(const key of ['sourceStart','timelineStart','duration','fadeIn','fadeOut'])next[key]=Math.round(next[key]*1e6)/1e6;
 return next;
}
export function waveformPeaks(buffer,sourceStart,duration,bins=100){
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 return Array.from({length:bins},(_,bin)=>{
  const a=Math.max(0,Math.floor((sourceStart+duration*bin/bins)*buffer.sampleRate)),b=Math.min(buffer.length,Math.ceil((sourceStart+duration*(bin+1)/bins)*buffer.sampleRate));
  let peak=0;for(const channel of channels)for(let i=a;i<b;i+=Math.max(1,Math.floor((b-a)/100)))peak=Math.max(peak,Math.abs(channel[i]));return peak;
 });
}
