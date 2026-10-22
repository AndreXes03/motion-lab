import {open, lstat, mkdir, readdir, rename, rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT} from './project-store.mjs';
import {sceneConfig} from '../src/scene-registry.js';
import {validateNativeProject} from '../src/engine/native-project.js';

const validId=/^[a-z0-9][a-z0-9_-]{0,59}$/;
const storeDir=root=>path.join(root,'.motion-cache','projects');
function projectId(id){if(typeof id!=='string'||!validId.test(id)||id==='migrate')throw Error('Invalid project id');return id;}
function projectFile(root,id){return path.join(storeDir(root),projectId(id)+'.json');}
function error(status,message){const e=Error(message);e.status=status;return e;}
async function noSymlink(file){try{const info=await lstat(file);if(info.isSymbolicLink())throw error(400,'Symlinked project storage is not allowed');return info;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function safeDirectory(dir){const current=await noSymlink(dir);if(current){if(!current.isDirectory())throw error(400,'Project storage must be a directory');return;}try{await mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const created=await noSymlink(dir);if(!created?.isDirectory())throw error(400,'Project storage must be a directory');}
async function ensureStore(root){const base=path.resolve(root);const info=await noSymlink(base);if(!info?.isDirectory())throw error(400,'Project root must be a directory');const cache=path.join(base,'.motion-cache');await safeDirectory(cache);const dir=storeDir(base);await safeDirectory(dir);return dir;}
async function safeRead(file){const info=await noSymlink(file);if(!info)return null;if(!info.isFile()||info.size>2*1024*1024)throw error(400,'Invalid project file');const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{return JSON.parse(await handle.readFile('utf8'));}finally{await handle.close();}}
async function atomic(file,value){const tmp=file+'.'+randomUUID()+'.tmp';const handle=await open(tmp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}try{await rename(tmp,file);}finally{await rm(tmp,{force:true});}}
async function locked(root,id,operation){await ensureStore(root);const lock=projectFile(root,id)+'.lock';try{await mkdir(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw error(409,'Project is being edited; retry');throw e;}try{return await operation();}finally{await rm(lock,{recursive:true,force:true});}}

export async function listNativeProjects(root=ROOT){await ensureStore(root);const entries=await readdir(storeDir(root),{withFileTypes:true}),rows=[];for(const entry of entries){if(!entry.name.endsWith('.json'))continue;const id=entry.name.slice(0,-5);if(!validId.test(id))continue;if(entry.isSymbolicLink())throw error(400,'Symlinked project storage is not allowed');if(!entry.isFile())continue;const doc=validateNativeProject(await safeRead(projectFile(root,id)));rows.push({id:doc.id,name:doc.name,revision:doc.revision,scenes:doc.scenes.map(s=>({id:s.id,name:s.name,adapter:s.adapter.kind}))});}return rows.sort((a,b)=>a.id.localeCompare(b.id));}
export async function readNativeProject(root=ROOT,id){await ensureStore(root);const raw=await safeRead(projectFile(root,id));if(!raw)throw error(404,'Project not found');const doc=validateNativeProject(raw);if(doc.id!==id)throw error(400,'Project id does not match filename');return doc;}
export async function createNativeProject(root=ROOT,input){const doc=validateNativeProject(input);if(doc.revision!==1)throw error(400,'New project revision must be 1');return locked(root,doc.id,async()=>{const file=projectFile(root,doc.id);if(await noSymlink(file))throw error(409,'Project already exists');await atomic(file,doc);return doc;});}
export async function updateNativeProject(root=ROOT,id,input,expectedRevision){projectId(id);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw error(400,'expectedRevision must be a positive integer');return locked(root,id,async()=>{const previous=await readNativeProject(root,id);if(previous.revision!==expectedRevision)throw error(409,`Revision conflict: current revision is ${previous.revision}`);const doc=validateNativeProject(input);if(doc.id!==id||doc.revision!==expectedRevision+1)throw error(400,'Updated project id or revision is invalid');await atomic(projectFile(root,id),doc);return doc;});}

/** Wrap a schema 2 render recipe. Authored source files and render settings stay untouched. */
export function migrateRecipe(recipe,{id,name}={}){
  if(!recipe||recipe.schemaVersion!==2||!recipe.parameters||typeof recipe.parameters.scene!=='string')throw Error('Expected a schema 2 recipe');
  const source=sceneConfig(recipe.parameters.scene);const start=recipe.start??0,end=recipe.end??source.duration;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>source.duration)throw Error('Invalid recipe time range');
  const doc={version:1,id:projectId(id??`project_${randomUUID().slice(0,8)}`),revision:1,name:name??source.title,width:recipe.settings?.width??recipe.width??source.width,height:recipe.settings?.height??recipe.height??source.height,fps:recipe.settings?.fps??recipe.fps??source.fps,scenes:[{id:'scene_1',name:source.title,duration:end-start,adapter:{kind:'legacy-recipe',scene:source.scene,sourceStart:start,parameters:structuredClone(recipe.parameters),recipe:structuredClone(recipe)}}],assets:[],elements:[],animation:{version:1,tracks:[]},audio:{version:1,tracks:[]},controls:{version:1,selections:[]}};
  return validateNativeProject(doc);
}
