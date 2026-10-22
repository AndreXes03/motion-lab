import {normalizeAudioTracks,audioTrackGain} from './audio-track.js';
import {masterGain} from './sound-design.js';

/** Generated base is already mastered. Imported clips share the same final master. */
export async function mixAudioTracks(base,context,audio,sound,load){
 const tracks=normalizeAudioTracks(audio).tracks.filter(t=>t.enabled);
 if(!tracks.length)return base;
 const result=context.createBuffer(2,base.length,base.sampleRate),master=masterGain(sound);
 for(let c=0;c<2;c++)result.copyToChannel(base.getChannelData(Math.min(c,base.numberOfChannels-1)),c);
 for(const track of tracks){
  const input=await load(track);
  if(track.sourceStart+track.duration>input.duration+.025)throw Error(`Audio trim exceeds the source: ${track.name}`);
  const begin=Math.round(track.timelineStart*result.sampleRate),count=Math.max(0,Math.min(Math.round(track.duration*result.sampleRate),result.length-begin));
  for(let c=0;c<2;c++){
   const from=input.getChannelData(Math.min(c,input.numberOfChannels-1)),to=result.getChannelData(c);
   for(let i=0;i<count;i++){
    const time=i/result.sampleRate,pos=(track.sourceStart+time)*input.sampleRate,lo=Math.floor(pos),value=(from[lo]??0)*(1-(pos-lo))+(from[lo+1]??0)*(pos-lo);
    to[begin+i]+=value*audioTrackGain(track,track.timelineStart+time)*master;
   }
  }
 }
 return result;
}
