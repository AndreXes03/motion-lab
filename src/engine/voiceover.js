import {speechMarkers} from './narration.js';
export const audioRole=track=>track.role??'music';
export const hasVoiceover=audio=>(audio?.tracks??[]).some(t=>audioRole(t)==='voiceover'&&t.enabled!==false&&(t.volume??1)>0);
export const hasMusic=audio=>(audio?.tracks??[]).some(t=>audioRole(t)==='music');
export function validateVoiceoverDuration(audio,duration){for(const t of audio?.tracks??[])if(audioRole(t)==='voiceover'&&t.enabled!==false&&(t.volume??1)>0&&t.timelineStart+t.duration>duration+.025)throw Error(`Voiceover “${t.name}” ends at ${(t.timelineStart+t.duration).toFixed(2)} s. Extend the film or trim the voice before exporting.`);}

/** Fixed linear envelope, shared by browser and native sample-level mixing. */
export function musicDucking(audio){
 if(audio?.ducking===false)return [];
 const regions=(audio?.tracks??[]).filter(t=>audioRole(t)==='voiceover'&&t.enabled!==false&&(t.volume??1)>0).flatMap(t=>t.narration?.segments.length?speechMarkers(t).map(s=>[s.start,s.end]):[[t.timelineStart,t.timelineStart+t.duration]]).sort((a,b)=>a[0]-b[0]);
 const merged=[];for(const [a,b]of regions){const last=merged.at(-1);if(last&&a-last[1]<.5)last[1]=Math.max(last[1],b);else merged.push([a,b]);}
 return merged.map(([start,end])=>({start:Math.max(0,start-.12),hold:start,end,release:end+.35}));
}
export function musicGainAt(regions,time){
 let lo=0,hi=regions.length;while(lo<hi){const m=(lo+hi)>>>1;if(regions[m].release<=time)lo=m+1;else hi=m;}
 const r=regions[lo];if(!r||time<r.start)return 1;
 if(time<r.hold)return 1-.75*(time-r.start)/(r.hold-r.start);
 if(time<=r.end)return .25;
 return .25+.75*(time-r.end)/(r.release-r.end);
}
export function duckGeneratedMusic(result,audio){const music=result.stems?.music,regions=musicDucking(audio);if(!music||!regions.length)return result;for(let i=0;i<result.channels[0].length;i++){const gain=musicGainAt(regions,i/result.sampleRate);for(let c=0;c<2;c++){result.channels[c][i]+=music[c][i]*(gain-1);music[c][i]*=gain;}}return result;}
export function voiceMixSample(value){const x=Math.abs(value);return x>.9?Math.sign(value)*(.9+.09*Math.tanh((x-.9)/.09)):value;}
