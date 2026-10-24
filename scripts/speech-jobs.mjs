import {fork} from 'node:child_process';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {resolveAudioAsset} from './audio-assets.mjs';
import {normalizeNarration} from '../src/engine/narration.js';

const worker=fileURLToPath(new URL('./speech-worker.mjs',import.meta.url));
export async function transcribeVoice(root,assetId,{onProgress=()=>{},forkFn=fork}={}){
 const asset=await resolveAudioAsset(root,assetId);
 if(asset.duration>1800)throw Error('Automatic transcription supports voice files up to 30 minutes. Import timing for longer recordings.');
 const dir=path.join(root,'.motion-cache','speech'),cache=path.join(dir,`${assetId}-whisper-base-v2.json`);
 await mkdir(dir,{recursive:true});
 try{const narration=normalizeNarration(JSON.parse(await readFile(cache,'utf8')));if(narration.source==='transcribed'&&narration.segments.length&&narration.segments.every(s=>s.end<=asset.duration+.025))return narration;}catch(error){if(error.code&&error.code!=='ENOENT')throw error;}
 const narration=await new Promise((resolve,reject)=>{
  const child=forkFn(worker,[asset.path,path.join(dir,'models')],{execArgv:[],stdio:['ignore','ignore','pipe','ipc']});
  let result,failure,stderr='';const timeout=setTimeout(()=>{failure='Transcription timed out. Retry with a shorter recording.';child.kill();},20*60*1000);
  child.stderr?.on('data',data=>{stderr=(stderr+data).slice(-2000);});
  child.on('message',data=>{if(data.status==='ready')result=data.narration;else if(data.status==='error')failure=data.message;else onProgress({status:data.status,message:data.message});});
  child.once('error',error=>{clearTimeout(timeout);reject(error);});
  child.once('exit',code=>{clearTimeout(timeout);if(code!==0||!result)return reject(Error(failure||`Speech analysis could not finish. Check the connection for the first model download and retry.${stderr.includes('ENOSPC')?' Free some disk space.':''}`));try{resolve(normalizeNarration(result));}catch(error){reject(error);}});
 });
 const tmp=cache+'.'+randomUUID();await writeFile(tmp,JSON.stringify(narration),{flag:'wx'});await rename(tmp,cache);return narration;
}

// Shared across Vite middleware reloads. One inference process at a time.
const managers=globalThis[Symbol.for('framevolve.speechJobs')]??=new Map();
export function speechJobs(root){
 if(managers.has(root))return managers.get(root);
 const jobs=new Map();let tail=Promise.resolve();
 const manager={
  get:id=>jobs.get(id)??{assetId:id,status:'missing',message:'Analysis has not started.'},
  async start(id){
   await resolveAudioAsset(root,id);
   const existing=jobs.get(id);if(existing&&existing.status!=='error')return existing;
   for(const [key,j] of jobs)if(['ready','error'].includes(j.status)&&Date.now()-j.updatedAt>3600000)jobs.delete(key);
   if([...jobs.values()].filter(j=>!['ready','error'].includes(j.status)).length>=8)throw Error('Speech analysis queue is full. Wait for the current voice to finish.');
   const job={assetId:id,status:'queued',message:'Waiting for speech analysis…',updatedAt:Date.now()};jobs.set(id,job);
   tail=tail.catch(()=>{}).then(async()=>{try{job.narration=await transcribeVoice(root,id,{onProgress:p=>Object.assign(job,p,{updatedAt:Date.now()})});job.status='ready';job.message='Transcript ready';}catch(error){job.status='error';job.message=error.message;}job.updatedAt=Date.now();});
   return job;
  }
 };managers.set(root,manager);return manager;
}
