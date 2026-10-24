import {validateVoiceSource,CUT_FADE} from '../../src/engine/voice-edit.js';
import {masterGain} from '../../src/engine/sound-design.js';
import ffmpeg from 'ffmpeg-static';
import {normalizeAudioTracks} from '../../src/engine/audio-track.js';
import {resolveAudioAsset} from '../audio-assets.mjs';
import {open,unlink} from 'node:fs/promises';
import {audioRole,hasVoiceover,musicDucking,musicGainAt} from '../../src/engine/voiceover.js';

/** Prepare PCM on the frame clock; decoding, trimming, fades and mixing need no browser. */
export async function validateTimelineAudioAssets(root,audio){
  for(const track of normalizeAudioTracks(audio).tracks.filter(t=>t.enabled)){
    const asset=await resolveAudioAsset(root,track.assetId);
    validateVoiceSource(track,asset.metadata.duration);
  }
}

export async function renderTimelineAudio({root,audio,start=0,duration,destination,baseAudio=null,baseOffset=0,sound,baseMastered=true,baseIsMusic=false,run}){
  const tracks=normalizeAudioTracks(audio).tracks.filter(t=>t.enabled&&t.volume>0&&t.timelineStart<start+duration&&t.timelineStart+t.duration>start);
  if(!Number.isFinite(start)||start<0||!Number.isFinite(duration)||duration<=0||duration>7200)throw Error('Invalid audio render interval');
  const globalGain=masterGain(sound);
  if(!tracks.length&&(!baseAudio||baseMastered||globalGain===1))return baseAudio;
  if(typeof run!=='function')throw Error('Audio rendering requires the job process runner');
  const args=['-hide_banner','-loglevel','error','-y'],filters=[],labels=[],regions=musicDucking(audio);
  const duckCount=regions.length?(tracks.filter(t=>audioRole(t)==='music').length+(baseAudio&&baseIsMusic?1:0)):0;
  const envelopePath=destination+'.duck.f32';
  let input=0;
  if(duckCount){
    // Write bounded chunks, using the exact preview gain at each project sample.
    const file=await open(envelopePath,'w');try{const count=Math.round(duration*48000);for(let i=0;i<count;i+=48000){const size=Math.min(48000,count-i),chunk=Buffer.alloc(size*4);for(let j=0;j<size;j++)chunk.writeFloatLE(musicGainAt(regions,start+(i+j)/48000),j*4);await file.write(chunk);}}finally{await file.close();}
    args.push('-f','f32le','-ar','48000','-ac','1','-i',envelopePath);filters.push(`[${input++}:a]pan=stereo|c0=c0|c1=c0,asplit=${duckCount}${Array.from({length:duckCount},(_,i)=>`[duck${i}]`).join('')}`);
  }
  let duckIndex=0;
  if(baseAudio){args.push('-protocol_whitelist','file,pipe','-i',baseAudio);filters.push(`[${input++}:a:0]atrim=start=${baseOffset}:duration=${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${duration},volume=${baseMastered?1:globalGain}[baseRaw]`);filters.push(`[baseRaw]${duckCount&&baseIsMusic?`[duck${duckIndex++}]amultiply`:'anull'}[base]`);labels.push('[base]');}
  for(let i=0;i<tracks.length;i++){
    const track=tracks[i],asset=await resolveAudioAsset(root,track.assetId);
    validateVoiceSource(track,asset.metadata.duration);
    const offset=Math.max(0,start-track.timelineStart),delay=Math.max(0,track.timelineStart-start),length=Math.min(track.duration-offset,duration-delay);
    args.push('-protocol_whitelist','file,pipe','-i',asset.path);
    let source=`${input++}:a:0`;
    if(track.clips){
      filters.push(`[${source}]asplit=${track.clips.length}${track.clips.map((_,j)=>`[cut${i}_${j}]`).join('')}`);
      for(const [j,c] of track.clips.entries())filters.push(`[cut${i}_${j}]atrim=start=${c.sourceStart}:duration=${c.duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,afade=t=in:st=0:d=${CUT_FADE},afade=t=out:st=${c.duration-CUT_FADE}:d=${CUT_FADE},apad=pad_dur=${c.pauseAfter}[piece${i}_${j}]`);
      source=`assembled${i}`;filters.push(`${track.clips.map((_,j)=>`[piece${i}_${j}]`).join('')}concat=n=${track.clips.length}:v=0:a=1[${source}]`);
    }
    // Fade before timeline trimming so a partial export keeps the original envelope.
    const fadeIn=track.fadeIn?`,afade=t=in:st=0:d=${track.fadeIn}:curve=tri`:'',fadeOut=track.fadeOut?`,afade=t=out:st=${track.duration-track.fadeOut}:d=${track.fadeOut}:curve=tri`:'';
    filters.push(`[${source}]atrim=start=${track.sourceStart}:duration=${track.duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${track.volume*globalGain}${fadeIn}${fadeOut},atrim=start=${offset}:duration=${length},asetpts=PTS-STARTPTS,adelay=${Math.round(delay*48000)}S:all=1,apad=whole_dur=${duration}[raw${i}]`);
    filters.push(`[raw${i}]${duckCount&&audioRole(track)==='music'?`[duck${duckIndex++}]amultiply`:'anull'}[track${i}]`);
    labels.push(`[track${i}]`);
  }
  // Explicit summation; PCM float keeps headroom. Match the preview's additive mix.
  const ceiling=hasVoiceover(audio)?`,aeval='${[0,1].map(c=>`if(gt(abs(val(${c})),0.9),sgn(val(${c}))*(0.9+0.09*tanh((abs(val(${c}))-0.9)/0.09)),val(${c}))`).join('|')}'`:'';
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,atrim=duration=${duration},asetpts=PTS-STARTPTS${ceiling}[out]`);
  args.push('-filter_complex',filters.join(';'),'-map','[out]','-ar','48000','-ac','2','-c:a','pcm_f32le',destination);
  try{await run(ffmpeg,args);}finally{if(duckCount)await unlink(envelopePath).catch(()=>{});}
  return destination;
}
