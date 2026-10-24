import {normalizeAudioTracks,audioTrackGain} from './audio-track.js';
import {audioSlices,sliceGain,validateVoiceSource} from './voice-edit.js';
import {masterGain} from './sound-design.js';
import {audioRole,hasVoiceover,musicDucking,musicGainAt,voiceMixSample} from './voiceover.js';

/** Generated base is already mastered. Imported clips share the same final master. */
export async function mixAudioTracks(base,context,audio,sound,load,{baseIsMusic=false}={}){
 const tracks=normalizeAudioTracks(audio).tracks.filter(t=>t.enabled);
 if(!tracks.length)return base;
 const result=context.createBuffer(2,base.length,base.sampleRate),master=masterGain(sound),regions=musicDucking(audio);
 for(let c=0;c<2;c++)result.copyToChannel(base.getChannelData(Math.min(c,base.numberOfChannels-1)),c);
 if(baseIsMusic)for(let i=0;i<result.length;i++){const gain=musicGainAt(regions,i/result.sampleRate);for(let c=0;c<2;c++)result.getChannelData(c)[i]*=gain;}
 for(const track of tracks){
  const input=await load(track);
  validateVoiceSource(track,input.duration);
  for(const slice of audioSlices(track)){
   const begin=Math.round(slice.timelineStart*result.sampleRate),count=Math.max(0,Math.min(Math.round(slice.duration*result.sampleRate),result.length-begin));
   for(let c=0;c<2;c++){
    const from=input.getChannelData(Math.min(c,input.numberOfChannels-1)),to=result.getChannelData(c);
    for(let i=0;i<count;i++){
     const local=i/result.sampleRate,time=slice.timelineStart+local,pos=(slice.sourceStart+local)*input.sampleRate,lo=Math.floor(pos),value=(from[lo]??0)*(1-(pos-lo))+(from[lo+1]??0)*(pos-lo);
     to[begin+i]+=value*audioTrackGain(track,time)*sliceGain(slice,local)*master*(audioRole(track)==='music'?musicGainAt(regions,(begin+i)/result.sampleRate):1);
    }
   }
  }
 }
 if(hasVoiceover(audio))for(let c=0;c<2;c++){const data=result.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=voiceMixSample(data[i]);}
 return result;
}
