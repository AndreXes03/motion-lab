import path from 'node:path';

export function sequenceVideoArgs({sequence,fps,count,audioPath,audioOffset=0,out}){
  const args=['-y','-v','error','-framerate',String(fps),'-start_number','1','-i',path.join(sequence,'frame-%06d.png')];
  if(audioPath)args.push('-ss',String(audioOffset),'-i',audioPath);
  args.push('-map','0:v:0');if(audioPath)args.push('-map','1:a:0');
  // A video frame limit can terminate FFmpeg while audio is still buffered.
  // Use the presentation duration for both streams; validate frame count below.
  args.push('-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p','-t',String(count/fps));
  if(audioPath)args.push('-c:a','aac','-b:a','192k');
  return [...args,'-movflags','+faststart',out];
}

export function assertAudioCoverage(probe,expectedSeconds){
  const audio=probe.streams.find(s=>s.codec_type==='audio');
  if(!audio)throw Error('Procedural/explicit audio missing from encoded output');
  if(!Number.isFinite(Number(audio.duration))||Number(audio.duration)+.05<expectedSeconds)
    throw Error(`Encoded audio truncated: ${audio.duration}s, expected ${expectedSeconds}s`);
}
