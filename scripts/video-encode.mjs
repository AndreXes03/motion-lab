import path from 'node:path';

/** Keep the frame clock authoritative when audio encoder packets round differently. */
export function videoEncodeArgs({frameDir,target,fps,format,bitrateMbps,audioPath=null,frameCount}){
  const codec=format==='webm'?['-c:v','libvpx-vp9','-b:v',`${bitrateMbps}M`,'-pix_fmt','yuv420p']:format==='prores'?['-c:v','prores_ks','-profile:v','3','-pix_fmt','yuv422p10le','-movflags','+write_colr']:['-c:v','libx264','-preset','medium','-b:v',`${bitrateMbps}M`,'-pix_fmt','yuv420p','-movflags','+faststart'];
  return ['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',path.join(frameDir,'frame-%06d.png'),...(audioPath?['-i',audioPath,'-map','0:v:0','-map','1:a:0','-c:a',format==='webm'?'libopus':format==='prores'?'pcm_s16le':'aac']:[]),...codec,'-t',String(frameCount/fps),'-vf','scale=out_color_matrix=bt709:out_range=tv','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-f',format==='prores'?'mov':format,target];
}
