import {pipeline,env,Tensor} from '@huggingface/transformers';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ffmpeg from 'ffmpeg-static';
import {normalizeNarration} from '../src/engine/narration.js';

// Only model files leave the local boundary as downloads; audio is decoded locally.
const [file,cacheDir]=process.argv.slice(2);
const report=data=>process.send?.(data);
process.once('disconnect',()=>process.exit(process.exitCode??0));
try{
 const {stdout}=await promisify(execFile)(ffmpeg,['-v','error','-protocol_whitelist','file,pipe','-i',file,'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],{encoding:'buffer',maxBuffer:128*1024*1024,timeout:120000});
 const pcm=new Float32Array(stdout.buffer.slice(stdout.byteOffset,stdout.byteOffset+stdout.byteLength));
 let energy=0;for(const x of pcm)energy+=x*x;if(!pcm.length||Math.sqrt(energy/pcm.length)<.0001)throw Error('No audible speech found. The original voice is unchanged.');
 env.cacheDir=cacheDir;env.allowLocalModels=false;
 report({status:'loading',message:'Preparing local speech model…'});
 const transcriber=await pipeline('automatic-speech-recognition','Xenova/whisper-base',{
  revision:'64da57285918e20ea79ea5c88eed7197933abaa8',dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:4,interOpNumThreads:1},
  progress_callback:p=>{if(p.status==='progress')report({status:'loading',message:'Preparing speech model (first use downloads it)…'});}
 });
 report({status:'transcribing',message:'Transcribing voice locally…'});
 // Whisper predicts the language token from audio. This pinned runtime otherwise
 // defaults to English; never silently translate a multilingual recording.
 const speechStart=Math.max(0,pcm.findIndex(x=>Math.abs(x)>.005)-1600);
 const features=await transcriber.processor(pcm.subarray(speechStart,speechStart+30*16000));
 const detected=await transcriber.model({...features,decoder_input_ids:new Tensor('int64',[BigInt(transcriber.model.generation_config.decoder_start_token_id)],[1,1])});
 const [token]=Object.entries(transcriber.model.generation_config.lang_to_id).sort((a,b)=>detected.logits.data[b[1]]-detected.logits.data[a[1]])[0];
 const language=token.slice(2,-2);
 const result=await transcriber(pcm,{language,return_timestamps:'word',chunk_length_s:30,stride_length_s:5,task:'transcribe',do_sample:false});
 const segments=[];let pending='';
 for(const chunk of result.chunks??[]){
  const [start,end]=chunk.timestamp??[],text=(pending+chunk.text).trim();
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>pcm.length/16000+.04)throw Error('Speech timing is incomplete. Retry or import corrected timing.');
  if(end<=start){pending=text+' ';continue;}pending='';
  if(text)segments.push({id:`w${segments.length+1}`,text,start,end:Math.min(end,pcm.length/16000)});
 }
 if(pending&&segments.length)segments.at(-1).text+=' '+pending.trim();
 if(!segments.length)throw Error('No timed speech found. Try a clearer voice recording.');
 const narration=normalizeNarration({version:1,source:'transcribed',language,text:segments.map(s=>s.text).join(' '),segments,cues:[]});
 report({status:'ready',message:'Transcript ready',narration});
}catch(error){report({status:'error',message:error.message==='fetch failed'?'Could not download the speech model. Check your internet connection and retry.':error.message});process.exitCode=1;}finally{process.disconnect?.();}
