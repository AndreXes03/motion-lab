import path from 'node:path';
import {createReadStream} from 'node:fs';
import {lstat,readFile,writeFile,rename,realpath} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {importAudioAsset,resolveAudioAsset} from './audio-assets.mjs';
async function regular(file,limit){const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw Error('Unsafe authored audio source.');return info;}
/** Migrate a local legacy score once. Only content-addressed references enter recipes. */
export async function authoredSceneAudio(root,scene){
 root=await realpath(root);
 if(scene!=='loop')throw Error('No authored audio default for this scene.');
 const mapping=path.join(root,'project','audio','authored-defaults.json');let defaults={version:1,scenes:{}};
 try{await regular(mapping,16384);defaults=JSON.parse(await readFile(mapping,'utf8'));if(defaults.version!==1||!defaults.scenes)throw Error('Invalid authored audio defaults.');const track=defaults.scenes.loop;if(track){await resolveAudioAsset(root,track.assetId);return {audio:{version:1,tracks:[track]},sound:{enabled:false,music:0}};}}catch(error){if(error.code!=='ENOENT')throw error;}
 const dir=path.join(root,'public','local-preview');try{if(await realpath(dir)!==path.resolve(dir))throw Error('Unsafe authored audio directory.');}catch(e){if(e.code==='ENOENT')return {audio:null};throw e;}
 const manifest=path.join(dir,'loop-audio.json');try{await regular(manifest,4096);}catch(e){if(e.code==='ENOENT')return {audio:null};throw e;}
 const legacy=JSON.parse(await readFile(manifest,'utf8'));if(legacy.scene!=='loop'||!/^\/local-preview\/[a-zA-Z0-9._-]+\.mp3$/.test(legacy.url))throw Error('Invalid local LOOP soundtrack manifest.');
 const file=path.join(dir,path.basename(legacy.url)),info=await regular(file,100*1024*1024);const asset=await importAudioAsset(root,createReadStream(file),{name:'LOOP · edited soundtrack',contentLength:info.size});
 const track={id:'authored-loop',assetId:asset.assetId,name:asset.name,enabled:true,sourceStart:0,timelineStart:0,duration:asset.duration,volume:1,fadeIn:0,fadeOut:0};defaults.scenes.loop=track;
 const temp=mapping+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(defaults,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temp,mapping);return {audio:{version:1,tracks:[track]},sound:{enabled:false,music:0}};
}
