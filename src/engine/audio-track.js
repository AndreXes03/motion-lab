/** Portable imported-audio recipe. Times are absolute project seconds. */
import {normalizeVoiceClips,voiceSourceDuration} from './voice-edit.js';
import {normalizeNarration} from './narration.js';
const keys=new Set(['id','assetId','name','enabled','sourceStart','timelineStart','duration','volume','fadeIn','fadeOut']);
function record(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`${label} must be an object`);return value;}
function number(value,fallback,min,max,label){const n=value??fallback;if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(`${label} must be ${min}..${max}`);return n;}
export function normalizeAudioTracks(input={version:1,tracks:[]}){
  record(input,'Audio');const v2=input.version===2;if(Object.keys(input).some(k=>!(v2?['version','tracks','ducking']:['version','tracks']).includes(k))||![1,2].includes(input.version))throw Error('Unsupported audio document');
  if(v2&&input.ducking!==undefined&&typeof input.ducking!=='boolean')throw Error('Invalid music ducking setting');
  if(!Array.isArray(input.tracks)||input.tracks.length>16)throw Error('Audio supports at most 16 tracks');
  const ids=new Set();
  return {version:input.version,...(v2?{ducking:input.ducking??true}:{}),tracks:input.tracks.map(raw=>{
    record(raw,'Audio track');if(Object.keys(raw).some(k=>!keys.has(k)&&!(v2&&['role','narration','clips'].includes(k))))throw Error('Unknown audio track field');
    const role=raw.role??'music';if(!['music','voiceover','sfx'].includes(role))throw Error('Invalid audio role');
    if((raw.narration!==undefined||raw.clips!==undefined)&&role!=='voiceover')throw Error('Only voiceover tracks can contain speech timing');
    if(typeof raw.id!=='string'||!/^[a-zA-Z0-9_.-]{1,80}$/.test(raw.id)||ids.has(raw.id))throw Error('Audio track id must be unique and safe');ids.add(raw.id);
    if(typeof raw.assetId!=='string'||!/^[a-f0-9]{64}$/.test(raw.assetId))throw Error('Audio asset must reference an imported SHA-256 asset');
    if(raw.enabled!==undefined&&typeof raw.enabled!=='boolean')throw Error('Audio enabled must be boolean');
    if(raw.name!==undefined&&(typeof raw.name!=='string'||raw.name.length>160||/[\u0000-\u001f]/.test(raw.name)))throw Error('Invalid audio track name');
    const duration=number(raw.duration,undefined,.001,7200,'Track duration'),clips=raw.clips===undefined?undefined:normalizeVoiceClips(raw.clips);
    if(clips&&(raw.sourceStart??0)+duration>voiceSourceDuration({clips})+.001)throw Error('Voice trim exceeds its edited duration');
    return {id:raw.id,assetId:raw.assetId,name:raw.name??(role==='voiceover'?'Voiceover':'Music'),enabled:raw.enabled??true,sourceStart:number(raw.sourceStart,0,0,7200,'Source start'),timelineStart:number(raw.timelineStart,0,0,7200,'Timeline start'),duration,volume:number(raw.volume,1,0,2,'Track volume'),fadeIn:number(raw.fadeIn,0,0,duration,'Fade in'),fadeOut:number(raw.fadeOut,0,0,duration,'Fade out'),...(v2?{role,...(clips?{clips}:{}),...(raw.narration?{narration:normalizeNarration(raw.narration)}:{})}:{})};
  })};
}

export function audioTrackGain(track,time){
  const t=time-track.timelineStart;
  if(!track.enabled||t<0||t>=track.duration)return 0;
  return track.volume*(track.fadeIn?Math.min(1,t/track.fadeIn):1)*(track.fadeOut?Math.min(1,(track.duration-t)/track.fadeOut):1);
}
