/** Small, serializable reference to a separately stored original audio file. */
export function normalizeMusicTrack(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid imported music track');
 const allowed=['version','source','assetId','name','mimeType','bytes','duration','trimStart','trimDuration','gain','fadeIn','fadeOut'];
 if(Object.keys(input).some(key=>!allowed.includes(key)))throw Error('Unknown imported music setting');
 const track={version:1,source:'asset',trimStart:0,trimDuration:input.duration,gain:1,fadeIn:0,fadeOut:0,...input};
 if(track.version!==1||track.source!=='asset'||typeof track.assetId!=='string'||!/^[0-9a-f]{64}$/.test(track.assetId))throw Error('Invalid imported music asset ID');
 if(typeof track.name!=='string'||!track.name.trim()||track.name.length>160||/[\x00-\x1f\x7f]/.test(track.name))throw Error('Invalid imported music filename');
 if(typeof track.mimeType!=='string'||!/^audio\/[a-z0-9.+-]{1,64}$/i.test(track.mimeType))throw Error('Invalid imported music media type');
 if(!Number.isInteger(track.bytes)||track.bytes<1||track.bytes>50*1024*1024)throw Error('Imported music exceeds the 50 MB file limit');
 for(const key of ['duration','trimStart','trimDuration','gain','fadeIn','fadeOut'])if(!Number.isFinite(track[key]))throw Error('Invalid imported music '+key);
 if(track.duration<=0||track.duration>600||track.trimStart<0||track.trimStart>=track.duration||track.trimDuration<=0||track.trimStart+track.trimDuration>track.duration+1e-5)throw Error('Imported music trim must fit inside the song');
 if(track.gain<0||track.gain>2||track.fadeIn<0||track.fadeOut<0||track.fadeIn>track.trimDuration||track.fadeOut>track.trimDuration)throw Error('Invalid imported music gain or fades');
 return track;
}

/** Mix decoded PCM at film time zero. Inputs stay intact; the selected window
 * ends in silence when it is shorter than the film. A single peak scale retains
 * the relative balance of music and effects if their sum would clip. */
export function mixMusicPcm({baseChannels,musicChannels,outputSampleRate,musicSampleRate,track,musicLevel=1}){
 const music=normalizeMusicTrack(track);
 if(!Array.isArray(baseChannels)||!baseChannels.length||!baseChannels[0]?.length||!Array.isArray(musicChannels)||!musicChannels.length||!musicChannels[0]?.length)throw Error('Missing decoded music or film audio');
 const count=baseChannels[0].length;
 if(baseChannels.some(channel=>!(channel instanceof Float32Array)||channel.length!==count)||musicChannels.some(channel=>!(channel instanceof Float32Array)||channel.length!==musicChannels[0].length))throw Error('Invalid music PCM channels');
 if(!Number.isFinite(outputSampleRate)||outputSampleRate<=0||!Number.isFinite(musicSampleRate)||musicSampleRate<=0||!Number.isFinite(musicLevel)||musicLevel<0||musicLevel>4)throw Error('Invalid music sample rate or level');
 const output=[Float32Array.from(baseChannels[0]),Float32Array.from(baseChannels[1]??baseChannels[0])];
 const sourceFrames=musicChannels[0].length,trimFrames=Math.min(count,Math.ceil(music.trimDuration*outputSampleRate));
 const read=(channel,position)=>{const samples=musicChannels[Math.min(channel,musicChannels.length-1)],index=Math.floor(position);if(index>=sourceFrames)return 0;const fraction=position-index;return samples[index]+((samples[Math.min(index+1,sourceFrames-1)]??samples[index])-samples[index])*fraction;};
 let peak=0;
 for(let i=0;i<count;i++){
  const time=i/outputSampleRate;
  if(i<trimFrames&&time<music.trimDuration){
   const fade=Math.min(1,music.fadeIn?time/music.fadeIn:1,music.fadeOut?(music.trimDuration-time)/music.fadeOut:1);
   const sourcePosition=(music.trimStart+time)*musicSampleRate,level=Math.max(0,fade)*music.gain*musicLevel;
   for(let c=0;c<2;c++)output[c][i]+=read(c,sourcePosition)*level;
  }
  peak=Math.max(peak,Math.abs(output[0][i]),Math.abs(output[1][i]));
 }
 if(peak>.98){const scale=.98/peak;for(const channel of output)for(let i=0;i<count;i++)channel[i]*=scale;}
 return output;
}
