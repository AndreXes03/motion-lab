#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ROOT } from './browser-runtime.mjs';
import { readMemory, addMemoryRecord } from './feedback-memory-store.mjs';
export async function feedbackCommand(args,input=process.stdin){
  const [command='status',...flags]=args;let root=ROOT;
  if(flags.length){if(flags.length!==2||flags[0]!=='--repo')throw Error('Use --repo PATH.');root=path.resolve(flags[1]);}
  if(!['status','list','record'].includes(command))throw Error('Use status, list or record (JSON on stdin). Manage consent and deletion in Studio.');
  const data=await readMemory(root);
  if(command==='status')return {enabled:data.consent.enabled,count:data.records.length,noticeVersion:data.consent.noticeVersion};
  if(command==='list')return data;
  if(!data.consent.enabled)return {saved:false,reason:'Feedback memory is off. Do not create a feedback file or enable it for the user.'};
  let raw='';for await(const chunk of input){raw+=chunk;if(Buffer.byteLength(raw)>64000)throw Error('Feedback record is too large.');}
  return addMemoryRecord(root,JSON.parse(raw));
}
if(process.argv[1]&&await realpath(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await feedbackCommand(process.argv.slice(2)),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
