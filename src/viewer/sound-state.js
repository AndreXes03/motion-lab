import {normalizeSound} from '../engine/sound-design.js';
import {normalizeAudioTracks} from '../engine/audio-track.js';

/** A project snapshot owns its complete mix; an absent field means fresh defaults. */
export function normalizeSoundState({sound,audio}={}){
 return {sound:normalizeSound(sound??{}),audio:normalizeAudioTracks(audio??{version:1,tracks:[]})};
}

export function usesEditedSoundtrack(scene,sound,asset,audio){return !audio?.tracks?.some(track=>track.enabled!==false)&&scene==='loop'&&!!asset&&(sound?.musicStyle??'scene')==='scene';}
