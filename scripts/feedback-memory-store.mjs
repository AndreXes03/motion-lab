import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const memoryFile = root => path.join(root, '.motion-cache/feedback-memory.json');
const empty = () => ({version:1, consent:{enabled:false, noticeVersion:1}, records:[]});
export async function readMemory(root) {
  try {
    const raw = await readFile(memoryFile(root), 'utf8');
    if (Buffer.byteLength(raw)>4*1024*1024) throw Error('Feedback memory is too large.');
    const data=JSON.parse(raw);
    if(data.version!==1||typeof data.consent?.enabled!=='boolean'||!Array.isArray(data.records))throw Error('Invalid feedback memory.');
    return data;
  } catch(error) { if(error.code==='ENOENT')return empty(); throw error; }
}
// One lock for consent changes, appends and deletion, including concurrent CLI processes.
async function mutate(root, update) {
  const file=memoryFile(root), lock=file+'.lock';
  await mkdir(path.dirname(file),{recursive:true});
  let acquired=false;
  for(let attempt=0;attempt<40;attempt++){
    try{await mkdir(lock);acquired=true;break;}catch(error){if(error.code!=='EEXIST')throw error;await new Promise(resolve=>setTimeout(resolve,50));}
  }
  if(!acquired)throw Error('Feedback memory is busy. Retry; after an interrupted process, remove feedback-memory.json.lock only when no writer is running.');
  const temporary=file+'.'+randomUUID()+'.tmp';
  try{
    const next=await update(await readMemory(root));
    if(!next)return;
    const raw=JSON.stringify(next,null,2)+'\n';
    if(Buffer.byteLength(raw)>4*1024*1024)throw Error('Feedback memory is full. Review and delete old entries.');
    await writeFile(temporary,raw,{mode:0o600});await rename(temporary,file);return next;
  }finally{await rm(temporary,{force:true});await rm(lock,{recursive:true,force:true});}
}
export async function setMemoryConsent(root,enabled){
  if(typeof enabled!=='boolean')throw Error('Choose whether to save feedback memory.');
  return mutate(root,data=>({...data,consent:{enabled,noticeVersion:1,updatedAt:new Date().toISOString()}}));
}
export async function eraseMemory(root){return mutate(root,()=>empty());}
export const recordFields=['feedback','context','intent','diagnosis','change','preserve','before','after','verification','lesson'];
export function validateRecord(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Provide a feedback record.');
  const result={};
  for(const key of Object.keys(input))if(![...recordFields,'taskId','scene','visualStatus'].includes(key))throw Error('Unknown feedback field: '+key);
  for(const key of [...recordFields,'taskId','scene']){
    if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>4000))throw Error('Invalid feedback field: '+key);
    result[key]=(input[key]??'').trim();
  }
  for(const key of ['feedback','intent','change'])if(!result[key])throw Error('Feedback, intent and change are required.');
  result.visualStatus=input.visualStatus??'not-reviewed';
  if(!['not-reviewed','inspected','unavailable'].includes(result.visualStatus))throw Error('Invalid visual status.');
  return result;
}
export async function addMemoryRecord(root,input){
  let saved=null;
  await mutate(root,data=>{
    if(!data.consent.enabled)return null;
    if(data.records.length>=500)throw Error('Feedback memory has 500 entries. Review and delete old entries.');
    saved={...validateRecord(input),id:randomUUID(),createdAt:new Date().toISOString(),clientOutcome:'pending',clientResponse:''};
    return {...data,records:[...data.records,saved]};
  });
  return saved?{saved:true,id:saved.id}:{saved:false,reason:'Feedback memory is off. Continue the creative work without recording.'};
}
export async function setMemoryOutcome(root,{id,outcome,response=''}){
  if(!['pending','accepted','mixed','rejected'].includes(outcome)||typeof response!=='string'||response.length>4000)throw Error('Invalid client response.');
  return mutate(root,data=>{
    const record=data.records.find(r=>r.id===id);if(!record)throw Error('Feedback entry not found.');
    if(!data.consent.enabled)throw Error('Memory is paused. Enable it to save a response.');
    record.clientOutcome=outcome;record.clientResponse=response;record.respondedAt=new Date().toISOString();return data;
  });
}
export async function deleteMemoryRecord(root,id){return mutate(root,data=>({...data,records:data.records.filter(r=>r.id!==id)}));}
