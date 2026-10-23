import {lstat,mkdir,open,realpath,rename,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {appAssetPath} from '../src/engine/app-demo.js';
const maxBytes=10*1024*1024,hash=b=>createHash('sha256').update(b).digest('hex');
async function safe(root,asset,{create=false}={}){
 appAssetPath(asset);let current=await realpath(root);
 const parts=('public'+asset).split('/');
 for(const [i,part]of parts.entries()){current=path.join(current,part);let stat;try{stat=await lstat(current);}catch(e){if(e.code!=='ENOENT')throw e;if(create&&i<parts.length-1){await mkdir(current);stat=await lstat(current);}else if(i<parts.length-1)throw e;}
  if(stat?.isSymbolicLink()||(stat&&i<parts.length-1&&!stat.isDirectory()))throw Error('Image paths cannot contain links.');
 }return current;
}
export async function importImageAsset(root,bytes){
 if(!bytes.length||bytes.length>maxBytes)throw Error('Choose a PNG or JPG up to 10 MB.');
 const source=sharp(bytes,{limitInputPixels:25000000,failOn:'warning'}),meta=await source.metadata();
 if(!['png','jpeg'].includes(meta.format)||meta.pages>1)throw Error('Choose a still PNG or JPG image.');
 const normalized=await source.rotate().resize({width:3840,height:3840,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 if(normalized.length>maxBytes)throw Error('This image is too large. Save a smaller PNG or JPG.');
 const asset='/assets/app-demo/'+hash(normalized)+'.png',file=await safe(root,asset,{create:true});
 try{await lstat(file);await readImageAsset(root,asset);}catch(e){if(e.code!=='ENOENT')throw e;const temporary=file+'.'+randomUUID()+'.tmp';let handle;try{handle=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await handle.writeFile(normalized);await handle.sync();await handle.close();handle=null;await safe(root,asset);await rename(temporary,file);}finally{await handle?.close();await rm(temporary,{force:true});}}
 const {width,height}=await sharp(normalized).metadata();return {asset,width,height};
}
export async function readImageAsset(root,asset){
 const file=await safe(root,asset),handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const stat=await handle.stat();if(!stat.isFile()||stat.size>maxBytes)throw Error('Image is missing or too large.');const bytes=await handle.readFile();const id=path.basename(asset,'.png');if(id.length===64&&hash(bytes)!==id)throw Error('The saved image failed verification. Import it again.');return bytes;}finally{await handle.close();}
}
