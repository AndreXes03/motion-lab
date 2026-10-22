import {readFile,writeFile,readdir,mkdir,rename,rm,stat} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {validateBoard,normalizeAnchor,validateCreativeReview,text,sceneId} from '../src/viewer/creative-model.js';
import {sceneConfig} from '../src/scene-registry.js';
const cacheDir=root=>path.join(root,'.motion-cache/creative');
const hash=x=>createHash('sha256').update(x).digest('hex');
async function read(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function atomic(file,data){await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});await rename(tmp,file);}finally{await rm(tmp,{force:true});}}
const digests=new Map();
export async function sourceRevision(root){
 const files=[];async function walk(dir){let entries;try{entries=await readdir(path.join(root,dir),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name))){const name=dir+'/'+e.name;if(e.isSymbolicLink())continue;if(e.isDirectory()&&!/^project\/(history|versions|references|briefs)$/.test(name))await walk(name);else if(e.isFile()&&/\.(js|json|css|glsl)$/.test(name)){const file=path.join(root,name),s=await stat(file),key=[s.mtimeMs,s.ctimeMs,s.size].join(':');let d=digests.get(file);if(d?.key!==key){d={key,hash:hash(await readFile(file))};digests.set(file,d);}files.push([name,d.hash]);}}}
 await walk('src');await walk('project');return hash(JSON.stringify(files));
}
const boardFile=(root,scene)=>path.join(root,'project/storyboards',sceneId(scene)+'.json');
export async function readBoard(root,scene){const b=await read(boardFile(root,scene),null);return b?validateBoard(b,sceneConfig(scene)):null;}
export async function writeBoard(root,input){const b=validateBoard(input,sceneConfig(input.scene));await atomic(boardFile(root,b.scene),b);return b;}
export async function listFeedback(root,scene){const all=await read(path.join(cacheDir(root),'feedback.json'),[]);return scene?all.filter(c=>c.scene===scene):all;}
const queues=new Map();
async function serialized(root,fn){const previous=queues.get(root)??Promise.resolve();const next=previous.catch(()=>{}).then(fn);queues.set(root,next);try{return await next;}finally{if(queues.get(root)===next)queues.delete(root);}}
async function changeFeedback(root,fn){return serialized(root,async()=>{await mkdir(cacheDir(root),{recursive:true});const lock=path.join(cacheDir(root),'feedback.lock');try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')throw Error('Another feedback write is running. Retry shortly.');throw e;}try{const list=await listFeedback(root),result=await fn(list);await atomic(path.join(cacheDir(root),'feedback.json'),list);return result;}finally{await rm(lock,{recursive:true,force:true});}});}
export async function addFeedback(root,input){
 const config=sceneConfig(input.scene),anchor=normalizeAnchor(input,config),board=await readBoard(root,input.scene);
 if(anchor.shotId){const shot=board?.shots.find(s=>s.id===anchor.shotId);if(!shot)throw Error('This storyboard scene changed. Reopen it before commenting.');anchor.shotName=shot.name;}
 const record={...anchor,id:randomUUID(),text:text(input.text,4000),sourceRevision:input.sourceRevision&&/^[a-f0-9]{64}$/.test(input.sourceRevision)?input.sourceRevision:await sourceRevision(root),createdAt:new Date().toISOString(),status:'todo',evidence:''};
 return changeFeedback(root,list=>{if(list.length>=200)throw Error('Delete old feedback before adding more (200 maximum).');list.push(record);return record;});
}
export async function updateFeedback(root,{id,status,evidence}){return changeFeedback(root,list=>{const row=list.find(c=>c.id===id);if(!row)throw Error('Feedback not found.');if(!['todo','doing','done','blocked'].includes(status))throw Error('Invalid feedback status.');row.status=status;row.evidence=status==='todo'?'':text(evidence,2000);row.updatedAt=new Date().toISOString();return row;});}
export async function deleteFeedback(root,id){return changeFeedback(root,list=>{const index=list.findIndex(c=>c.id===id);if(index<0)throw Error('Feedback not found.');list.splice(index,1);return {deleted:true};});}
export async function saveCreativeReview(root,input){const r=validateCreativeReview(input);sceneConfig(r.scene);if(r.sourceRevision!==await sourceRevision(root))throw Error('Source changed. Inspect the current version before recording the review.');r.createdAt=new Date().toISOString();await atomic(path.join(cacheDir(root),'review-'+r.scene+'.json'),r);return r;}
export async function creativeState(root,scene){sceneConfig(scene);const [board,feedback,review,revision]=await Promise.all([readBoard(root,scene),listFeedback(root,scene),read(path.join(cacheDir(root),'review-'+scene+'.json'),null),sourceRevision(root)]);return {board,feedback,review,sourceRevision:revision};}
