import {masterGain} from '../../src/engine/sound-design.js';
import ffmpeg from 'ffmpeg-static';
import {normalizeAudioTracks} from '../../src/engine/audio-track.js';
import {resolveAudioAsset} from '../audio-assets.mjs';

/** Prepare PCM on the frame clock; decoding, trimming, fades and mixing need no browser. */
export async function validateTimelineAudioAssets(root,audio){
  for(const track of normalizeAudioTracks(audio).tracks.filter(t=>t.enabled)){
    const asset=await resolveAudioAsset(root,track.assetId);
    if(track.sourceStart+track.duration>asset.metadata.duration+.025)throw Error(`Audio track ${track.name} extends beyond its source`);
  }
}

export async function renderTimelineAudio({root,audio,start=0,duration,destination,baseAudio=null,baseOffset=0,sound,baseMastered=true,run}){
  const tracks=normalizeAudioTracks(audio).tracks.filter(t=>t.enabled&&t.volume>0&&t.timelineStart<start+duration&&t.timelineStart+t.duration>start);
  if(!Number.isFinite(start)||start<0||!Number.isFinite(duration)||duration<=0||duration>7200)throw Error('Invalid audio render interval');
  const globalGain=masterGain(sound);
  if(!tracks.length&&(!baseAudio||baseMastered||globalGain===1))return baseAudio;
  if(typeof run!=='function')throw Error('Audio rendering requires the job process runner');
  const args=['-hide_banner','-loglevel','error','-y'],filters=[],labels=[];
  let input=0;
  if(baseAudio){args.push('-protocol_whitelist','file,pipe','-i',baseAudio);filters.push(`[${input++}:a:0]atrim=start=${baseOffset}:duration=${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${duration},volume=${baseMastered?1:globalGain}[base]`);labels.push('[base]');}
  for(let i=0;i<tracks.length;i++){
    const track=tracks[i],asset=await resolveAudioAsset(root,track.assetId);
    if(track.sourceStart+track.duration>asset.metadata.duration+.025)throw Error(`Audio track ${track.name} extends beyond its source`);
    const offset=Math.max(0,start-track.timelineStart),delay=Math.max(0,track.timelineStart-start),length=Math.min(track.duration-offset,duration-delay);
    args.push('-protocol_whitelist','file,pipe','-i',asset.path);
    // Fade before timeline trimming so a partial export keeps the original envelope.
    const fadeIn=track.fadeIn?`,afade=t=in:st=0:d=${track.fadeIn}:curve=tri`:'',fadeOut=track.fadeOut?`,afade=t=out:st=${track.duration-track.fadeOut}:d=${track.fadeOut}:curve=tri`:'';
    filters.push(`[${input++}:a:0]atrim=start=${track.sourceStart}:duration=${track.duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${track.volume*globalGain}${fadeIn}${fadeOut},atrim=start=${offset}:duration=${length},asetpts=PTS-STARTPTS,adelay=${Math.round(delay*48000)}S:all=1,apad=whole_dur=${duration}[track${i}]`);
    labels.push(`[track${i}]`);
  }
  // Explicit summation; PCM float keeps headroom. Match the preview's additive mix.
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,atrim=duration=${duration},asetpts=PTS-STARTPTS[out]`);
  args.push('-filter_complex',filters.join(';'),'-map','[out]','-ar','48000','-ac','2','-c:a','pcm_f32le',destination);
  await run(ffmpeg,args);
  return destination;
}
