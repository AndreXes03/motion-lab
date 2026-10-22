import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,realpath,open,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ffprobe from 'ffprobe-static';
const run=promisify(execFile);
export const MAX_AUDIO_BYTES=100*1024*1024;
const validId=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
async function directory(root){
 const base=await realpath(root),project=path.join(base,'project'),dir=path.join(project,'audio');
 for(const item of [project,dir]){await mkdir(item,{recursive:false}).catch(e=>{if(e.code!=='EEXIST')throw e;});const info=await lstat(item);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Audio storage must be a real project directory.');}
 if(await realpath(dir)!==dir)throw Error('Unsafe audio storage path.');return dir;
}
async function regular(file){const info=await lstat(file);if(info.isSymbolicLink()||!info.isFile())throw Error('Unsafe audio asset path.');return info;}
export async function resolveAudioAsset(root,id){
 if(!validId(id))throw Error('Invalid audio asset id.');const dir=await directory(root),file=path.join(dir,`${id}.audio`),meta=path.join(dir,`${id}.json`);
 await regular(file);await regular(meta);if(createHash('sha256').update(await readFile(file)).digest('hex')!==id)throw Error('Audio asset content no longer matches its id.');const asset=JSON.parse(await readFile(meta,'utf8'));if(asset.assetId!==id||!Number.isFinite(asset.duration)||asset.duration<=0)throw Error('Invalid audio asset metadata.');return {metadata:asset,...asset,path:file,url:`/api/studio/audio/assets/${id}/file`};
}
export async function listAudioAssets(root){const dir=await directory(root),assets=[];for(const name of await readdir(dir)){if(/^[a-f0-9]{64}\.json$/.test(name)){const {path:_,...asset}=await resolveAudioAsset(root,name.slice(0,-5));assets.push(asset);}}return assets;}
export async function importAudioAsset(root,stream,{name='Audio',contentLength}={}){
 if(contentLength!==undefined&&(!/^\d+$/.test(String(contentLength))||Number(contentLength)>MAX_AUDIO_BYTES))throw Error('Audio files must be no larger than 100 MB.');
 const dir=await directory(root),temporary=path.join(dir,`.upload-${randomUUID()}`);let handle,size=0;
 try{
  handle=await open(temporary,'wx',0o600);const hash=createHash('sha256');for await(const chunk of stream){size+=chunk.length;if(size>MAX_AUDIO_BYTES)throw Error('Audio files must be no larger than 100 MB.');hash.update(chunk);await handle.write(chunk);}await handle.close();handle=null;if(!size)throw Error('Audio file is empty.');
  const {stdout}=await run(ffprobe.path,['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',temporary],{timeout:15000,maxBuffer:1024*1024});
  const probe=JSON.parse(stdout),audio=probe.streams?.find(s=>s.codec_type==='audio'),duration=Number(audio?.duration??probe.format?.duration);if(!audio||!Number.isFinite(duration)||duration<=0||duration>7200)throw Error('Choose a readable audio file no longer than 2 hours.');
  const assetId=hash.digest('hex'),target=path.join(dir,`${assetId}.audio`),metadata=path.join(dir,`${assetId}.json`);
  const format=probe.format?.format_name??'';const containers=new Set(['wav','mp3','flac','ogg','mov','mp4','m4a','3gp','3g2','mj2','aac','aiff','caf','au','matroska','webm','ape','ac3','eac3']);if(!format||format.split(',').some(name=>!containers.has(name)))throw Error('Choose a self-contained audio file; playlists and indirect media are unsupported.');const mimeType=format.includes('mp3')?'audio/mpeg':format.includes('wav')?'audio/wav':format.includes('ogg')?'audio/ogg':format.includes('flac')?'audio/flac':format.includes('mov')||format.includes('m4a')?'audio/mp4':'application/octet-stream';
  const asset={assetId,mimeType,name:String(name).replace(/[\x00-\x1f\x7f]/g,'').slice(0,160)||'Audio',duration,size,codec:audio.codec_name,sampleRate:Number(audio.sample_rate),channels:audio.channels};
  try{await lstat(target);await resolveAudioAsset(root,assetId);await unlink(temporary);}catch(e){if(e.code!=='ENOENT')throw e;await open(target,'wx',0o600).then(h=>h.close());await rename(temporary,target);await writeFile(metadata,JSON.stringify(asset,null,2)+'\n',{flag:'wx',mode:0o600});}
  const {path:_,...result}=await resolveAudioAsset(root,assetId);return result;
 }finally{await handle?.close();await unlink(temporary).catch(()=>{});}
}
