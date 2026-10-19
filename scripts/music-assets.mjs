import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import {normalizeMusicTrack,mixMusicPcm} from '../src/engine/music-track.js';
import {normalizeSound,planSound,renderSound} from '../src/engine/sound-design.js';
export const MAX_MUSIC_BYTES=50*1024*1024;
const formats='wav,mp3,flac,ogg,mov,matroska,webm,aac,aiff';
const assetDirectory=root=>path.join(root,'project/references/music');
const safeId=id=>typeof id==='string'&&/^[0-9a-f]{64}$/.test(id);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
async function hashFile(filename){const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);return hash.digest('hex');}
async function execute(program,args,{maxBytes=1024*1024,timeout=60000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(program,args,{stdio:['ignore','pipe','pipe']});const chunks=[];let bytes=0,error='',failure;
  const timer=setTimeout(()=>{failure=Error('Music decoding timed out');child.kill('SIGKILL');},timeout);
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){failure=Error('Decoded music exceeds the supported duration');child.kill('SIGKILL');}else chunks.push(chunk);});
  child.stderr.on('data',chunk=>error=(error+chunk).slice(-4000));
  child.on('error',reason=>{clearTimeout(timer);reject(reason);});
  child.on('close',code=>{clearTimeout(timer);if(failure||code!==0)reject(failure??Error('Could not decode imported music: '+error));else resolve(Buffer.concat(chunks));});
 });
}
export async function probeMusicFile(filename){
 const info=JSON.parse((await execute(ffprobe.path,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist',formats,'-show_streams','-show_format','-of','json',filename])).toString());
 const audio=info.streams?.find(stream=>stream.codec_type==='audio');
 const duration=Number(audio?.duration??info.format?.duration);
 if(!audio||!Number.isFinite(duration)||duration<=0||duration>600)throw fail('Imported music must contain audio lasting up to 10 minutes');
 return {duration,sampleRate:Number(audio.sample_rate),channels:audio.channels};
}
export async function storeMusicAsset({root,stream,name='Imported music',mimeType='audio/mpeg',contentLength}){
 if(!/^audio\/[a-z0-9.+-]{1,64}$/i.test(mimeType))throw fail('Upload an audio file');
 if(typeof name!=='string'||!name.trim()||name.length>160||/[\x00-\x1f\x7f]/.test(name))throw fail('Invalid music filename');
 if(contentLength!==undefined&&(!Number.isInteger(Number(contentLength))||Number(contentLength)<1||Number(contentLength)>MAX_MUSIC_BYTES))throw fail('Imported music exceeds the 50 MB file limit',413);
 const directory=assetDirectory(root);await mkdir(directory,{recursive:true});const temporary=path.join(directory,'.upload-'+randomUUID());
 let handle;let bytes=0;const hash=createHash('sha256');
 try{
  handle=await open(temporary,'wx',0o600);
  for await(const chunk of stream){bytes+=chunk.length;if(bytes>MAX_MUSIC_BYTES)throw fail('Imported music exceeds the 50 MB file limit',413);hash.update(chunk);await handle.writeFile(chunk);}
  await handle.close();handle=null;if(!bytes)throw fail('Imported music file is empty');
  const {duration}=await probeMusicFile(temporary),assetId=hash.digest('hex');
  const asset={assetId,name:name.trim(),mimeType:mimeType.toLowerCase(),bytes,duration};
  const destination=path.join(directory,assetId+'.audio');
  // Only a content hash selects the on-disk path; user names are display metadata.
  await rename(temporary,destination);
  const metadata=path.join(directory,assetId+'.json'),staged=metadata+'.'+randomUUID()+'.tmp';
  await writeFile(staged,JSON.stringify(asset),{flag:'wx',mode:0o600});await rename(staged,metadata);
  return asset;
 }finally{await handle?.close();await rm(temporary,{force:true});}
}
export async function resolveMusicAsset({root,assetId,track,verify=true}){
 const music=track?normalizeMusicTrack(track):null,id=music?.assetId??assetId;
 if(!safeId(id))throw fail('Invalid imported music asset ID');
 const filename=path.join(assetDirectory(root),id+'.audio');
 let info,metadata;
 try{[info,metadata]=await Promise.all([stat(filename),readFile(path.join(assetDirectory(root),id+'.json'),'utf8').then(JSON.parse)]);}catch(error){if(error.code==='ENOENT')throw fail('Imported music is missing on this computer. Re-import the original song before exporting.',404);throw error;}
 if(!info.isFile()||info.size<1||info.size>MAX_MUSIC_BYTES||metadata.assetId!==id||metadata.bytes!==info.size||!Number.isFinite(metadata.duration)||metadata.duration<=0||metadata.duration>600)throw fail('Imported music asset is damaged. Re-import the original song.');
 if(music&&(music.bytes!==info.size||Math.abs(music.duration-metadata.duration)>.25))throw fail('Imported music metadata does not match the stored original. Re-import the song.');
 if(verify&&await hashFile(filename)!==id)throw fail('Imported music asset changed. Re-import the original song.');
 return {...metadata,path:filename};
}
export async function decodeMusicAsset({root,track,sampleRate=48000,duration}){
 const music=normalizeMusicTrack(track),asset=await resolveMusicAsset({root,track:music});
 const seconds=Math.min(music.trimDuration,duration??music.trimDuration);
 const raw=await execute(ffmpeg,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist',formats,'-i',asset.path,'-ss',String(music.trimStart),'-t',String(seconds),'-map','0:a:0','-vn','-ac','2','-ar',String(sampleRate),'-f','f32le','pipe:1'],{maxBytes:Math.ceil(seconds*sampleRate+sampleRate)*8,timeout:120000});
 if(!raw.length||raw.length%8)throw fail('Imported music could not be decoded');
 const channels=[new Float32Array(raw.length/8),new Float32Array(raw.length/8)];
 for(let i=0;i<raw.length/8;i++)for(let c=0;c<2;c++)channels[c][i]=raw.readFloatLE(i*8+c*4);
 return {channels,sampleRate,track:{...music,trimStart:0,duration:music.trimDuration}};
}
export async function renderSoundtrack({root,telemetry,parameters,engine={normalizeSound,planSound,renderSound}}){
 const settings=engine.normalizeSound(parameters.sound??{}),music=parameters.music?normalizeMusicTrack(parameters.music):null;
 const plan=engine.planSound(telemetry,music?{...settings,music:0}:settings),result=engine.renderSound(plan);
 if(music&&settings.enabled){
  const decoded=await decodeMusicAsset({root,track:music,sampleRate:result.sampleRate,duration:telemetry.duration});
  result.channels=mixMusicPcm({baseChannels:result.channels,musicChannels:decoded.channels,outputSampleRate:result.sampleRate,musicSampleRate:decoded.sampleRate,track:decoded.track,musicLevel:2*settings.music*settings.master});
 }
 return {...result,plan};
}
/** Cut after mixing at absolute film time; zero-pad the final partial video frame. */
export function sliceSoundtrack(result,{start=0,duration}){
 const offset=Math.round(start*result.sampleRate),count=Math.round(duration*result.sampleRate);
 if(!Number.isInteger(count)||count<1||offset<0)throw Error('Invalid soundtrack output range');
 return result.channels.map(channel=>{const output=new Float32Array(count);output.set(channel.subarray(offset,offset+count));return output;});
}
