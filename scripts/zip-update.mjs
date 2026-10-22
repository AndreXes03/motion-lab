import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,rename,rm,lstat,readdir,chmod} from 'node:fs/promises';
import path from 'node:path';
const exec=promisify(execFile);
export const MANIFEST='.framevolve-distribution.json';
const API='https://api.github.com/repos/AndreXes03/motion-lab';
export const blobHash=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
export function safeUpdatePath(name){
 return typeof name==='string'&&name.length>0&&!name.includes('\\')&&!name.includes('\0')&&!path.posix.isAbsolute(name)&&!name.split('/').some(p=>!p||p==='.'||p==='..')&&!/^(?:\.git|\.motion-cache|node_modules|renders|outputs|archive|\.env(?:\..*)?)(?:\/|$)/.test(name)&&!/^project\/audio(?:\/|$)/.test(name)&&name!==MANIFEST;
}
export function validateManifest(value){
 if(value?.version!==1||!value.files||typeof value.files!=='object'||Array.isArray(value.files))throw Error('Invalid update manifest.');
 for(const [name,entry] of Object.entries(value.files))if(!safeUpdatePath(name)||!['100644','100755'].includes(entry.mode)||!/^[0-9a-f]{40}$/.test(entry.sha))throw Error('Unsupported update entry: '+name);
 return value;
}
async function safeFile(root,name){
 if(!safeUpdatePath(name)&&name!==MANIFEST)throw Error('Unsafe update path.');
 const parts=name.split('/');let current=root;
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);
  try{const info=await lstat(current);if(info.isSymbolicLink()||(i<parts.length-1&&!info.isDirectory())||(i===parts.length-1&&!info.isFile()))throw Error('Update path is not a regular file: '+name);}
  catch(error){if(error.code==='ENOENT')return path.join(root,name);throw error;}
 }
 return current;
}
async function hashAt(root,name){const file=await safeFile(root,name);try{return blobHash(await readFile(file));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function updatePlan(root,previous,next){
 validateManifest(previous);validateManifest(next);const changes=[],conflicts=[];
 for(const name of new Set([...Object.keys(previous.files),...Object.keys(next.files)])){
  const before=previous.files[name],after=next.files[name];
  if(before?.sha===after?.sha&&before?.mode===after?.mode)continue;
  const current=await hashAt(root,name);
  const mode=current===null?null:((await lstat(await safeFile(root,name))).mode&0o111?'100755':'100644');
  if(current===(after?.sha??null)&&mode===(after?.mode??null))continue;
  if(current!==(before?.sha??null)){conflicts.push(name);continue;}
  changes.push({name,entry:after??null,expected:current});
 }
 return {changes,conflicts};
}
export async function hasRunningStudio(root){
 let names;try{names=await readdir(path.join(root,'.motion-cache'));}catch(error){if(error.code==='ENOENT')return false;throw error;}
 for(const name of names){
  if(/^launcher-\d+\.lock$/.test(name))return true;
  if(!/^launcher-\d+\.json$/.test(name))continue;
  try{const data=JSON.parse(await readFile(path.join(root,'.motion-cache',name),'utf8'));if(Number.isInteger(data.pid)&&data.pid>0){try{process.kill(data.pid,0);return true;}catch(e){if(e.code!=='ESRCH')return true;}}}catch{return true;}
 }
 return false;
}
async function atomicFile(file,bytes,mode=0o644){await mkdir(path.dirname(file),{recursive:true});const temporary=file+'.update-'+randomUUID();try{await writeFile(temporary,bytes,{mode});await chmod(temporary,mode);await rename(temporary,file);}finally{await rm(temporary,{force:true});}}
// Durable rollback journal remains available until all source/dependency checks have succeeded.
export async function restoreUpdate(root,journal){
 for(const item of [...journal.files].filter(item=>item.written).reverse()){
  const current=await hashAt(root,item.name);
  if(current!==item.appliedHash&&current!==item.originalHash)throw Error('Recovery stopped to preserve a newer local edit: '+item.name);
  const target=await safeFile(root,item.name);
  if(item.existed)await atomicFile(target,await readFile(path.join(journal.backup,item.name)),item.mode);
  else await rm(target,{force:true});
 }
}
export async function applyZipUpdate(root,staged,previous,next,{install=async()=>{},busy=()=>hasRunningStudio(root),afterWrite=async()=>{}}={}){
 const plan=await updatePlan(root,previous,next);
 if(plan.conflicts.length)return {state:'conflict',files:plan.conflicts};
 if(await busy())return {state:'busy'};
 const backup=path.join(root,'.motion-cache/update-backups',randomUUID()),journal={version:1,backup,files:[]};
 await mkdir(backup,{recursive:true});
 // Verify all staged bytes and all targets before writing anything.
 for(const item of plan.changes){if(item.entry&&await hashAt(staged,item.name)!==item.entry.sha)throw Error('Downloaded file failed verification: '+item.name);}
 for(const name of [...plan.changes.map(x=>x.name),MANIFEST]){
  const target=await safeFile(root,name);let bytes,mode;
  try{bytes=await readFile(target);mode=(await lstat(target)).mode&0o777;}catch(error){if(error.code!=='ENOENT')throw error;}
  journal.files.push({name,existed:bytes!==undefined,mode:mode??0o644,originalHash:bytes===undefined?null:blobHash(bytes),written:false});
  if(bytes!==undefined){const to=path.join(backup,name);await mkdir(path.dirname(to),{recursive:true});await writeFile(to,bytes);}
 }
 const journalFile=path.join(root,'.motion-cache/update-transaction.json');
 await atomicFile(journalFile,Buffer.from(JSON.stringify(journal)),0o600);
 try{
  for(const item of plan.changes){
   if(await busy())throw Error('Studio started during the update.');
   if(await hashAt(root,item.name)!==item.expected)throw Error('A file changed during the update: '+item.name);
   const target=await safeFile(root,item.name);
   const record=journal.files.find(x=>x.name===item.name);record.written=true;record.appliedHash=item.entry?.sha??null;
   await atomicFile(journalFile,Buffer.from(JSON.stringify(journal)),0o600);
   if(item.entry)await atomicFile(target,await readFile(path.join(staged,item.name)),item.entry.mode==='100755'?0o755:0o644);
   else await rm(target,{force:true});
   await afterWrite(item.name);
  }
  if(plan.changes.some(x=>['package.json','package-lock.json','.npmrc'].includes(x.name)))await install(root);
  const manifestBytes=Buffer.from(JSON.stringify(next,null,2)+'\n');
  Object.assign(journal.files.find(x=>x.name===MANIFEST),{written:true,appliedHash:blobHash(manifestBytes)});
  await atomicFile(journalFile,Buffer.from(JSON.stringify(journal)),0o600);
  await atomicFile(path.join(root,MANIFEST),manifestBytes);
  await rm(journalFile,{force:true});return {state:plan.changes.length?'updated':'current',files:plan.changes.map(x=>x.name),backup};
 }catch(error){
  await restoreUpdate(root,journal);
  // npm ci may have replaced dependencies: restore the old lockfile's installation too.
  if(plan.changes.some(x=>['package.json','package-lock.json','.npmrc'].includes(x.name)))await install(root);
  await rm(journalFile,{force:true});
  throw error;
 }
}
async function apiJSON(url){const response=await fetch(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'Framevolve-Updater'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Update check unavailable ('+response.status+').');return response.json();}
async function remoteManifest(){
 const ref=await apiJSON(API+'/git/ref/heads/main');const sha=ref.object.sha;
 if(!/^[0-9a-f]{40}$/.test(sha))throw Error('Invalid update revision.');
 const tree=await apiJSON(API+'/git/trees/'+sha+'?recursive=1');if(tree.truncated)throw Error('Update file list is incomplete.');
 const files={};for(const item of tree.tree){if(item.type==='tree'||item.path===MANIFEST)continue;if(item.type!=='blob')throw Error('Unsupported update entry.');files[item.path]={sha:item.sha,mode:item.mode};}
 return validateManifest({version:1,revision:sha,files});
}
async function downloadVersion(root,revision){
 const stage=path.join(root,'.motion-cache/update-downloads',randomUUID());await mkdir(stage,{recursive:true});
 try{
  const archive=path.join(stage,'source.tar.gz');
  await exec('/usr/bin/curl',['--proto','=https','--proto-redir','=https','--tlsv1.2','-fL','--retry','1','--connect-timeout','15','--max-time','300','https://github.com/AndreXes03/motion-lab/archive/'+revision+'.tar.gz','-o',archive],{timeout:320000,maxBuffer:1024*1024});
  const {stdout:list}=await exec('/usr/bin/tar',['-tzf',archive],{maxBuffer:8*1024*1024});
  const prefix='motion-lab-'+revision+'/';
  for(const line of list.trim().split('\n')){if(!line.startsWith(prefix)||line.split('/').some(x=>x==='..')||line.includes('\\'))throw Error('Unsafe archive path.');}
  const {stdout:types}=await exec('/usr/bin/tar',['-tvzf',archive],{maxBuffer:8*1024*1024});
  if(types.split('\n').filter(Boolean).some(line=>!['d','-'].includes(line[0])))throw Error('Links are not permitted in an update archive.');
  await exec('/usr/bin/tar',['-xzf',archive,'-C',stage],{timeout:120000});
  return {root:path.join(stage,'motion-lab-'+revision),cleanup:()=>rm(stage,{recursive:true,force:true})};
 }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
}
export async function updateZip({root,confirm=async()=>false,notify=async()=>{},getRemote=remoteManifest,download=downloadVersion,install=async dir=>{
 try{await lstat(path.join(dir,'node_modules'));}catch{return;}
 await exec(process.platform==='win32'?'npm.cmd':'npm',['ci','--no-audit','--no-fund'],{cwd:dir,timeout:300000,maxBuffer:1024*1024});
}}){
 let previous;try{previous=validateManifest(JSON.parse(await readFile(path.join(root,MANIFEST),'utf8')));}catch(error){if(error.code==='ENOENT')return {state:'unmanaged',note:'This older ZIP needs the current setup download to enable updates.'};throw error;}
 if(await hasRunningStudio(root))return {state:'busy',note:'Close Studio before installing updates. Your current session is preserved.'};
 const lock=path.join(root,'.motion-cache/distribution-update.lock');await mkdir(path.dirname(lock),{recursive:true});
 try{await mkdir(lock);}catch(error){if(error.code==='EEXIST')return {state:'updating',note:'An update is already in progress. Wait for it to finish before launching again.'};throw error;}
 try{
  try{await lstat(path.join(root,'.motion-cache/update-transaction.json'));await notify('An update was interrupted. Keep this folder and its update-backups. Run node scripts/recover-update.mjs to restore the previous files before launching Studio.');return {state:'recovery-required',note:'An interrupted update needs recovery before launch.'};}catch(error){if(error.code!=='ENOENT')throw error;}
  let next;try{next=await getRemote();}catch{return {state:'offline',note:'Update check unavailable. Starting the installed version.'};}
  const plan=await updatePlan(root,previous,next);
  if(plan.conflicts.length){await notify('An update is available, but these files also contain local changes: '+plan.conflicts.slice(0,8).join(', ')+'. Nothing was replaced. Keep this project; use a separate new download or ask your agent to reconcile these files.');return {state:'conflict',files:plan.conflicts,note:'Local changes preserved; update needs reconciliation.'};}
  if(!plan.changes.length){await atomicFile(path.join(root,MANIFEST),Buffer.from(JSON.stringify(next,null,2)+'\n'));return {state:'current'};}
  if(!await confirm({revision:next.revision,files:plan.changes.length}))return {state:'declined',note:'Update postponed until a future launch.'};
  let staged;try{staged=await download(root,next.revision);return await applyZipUpdate(root,staged.root,previous,next,{install});}
  catch(error){await notify('The update could not finish: '+error.message+'. Source changes were rolled back if installation had begun. Keep the update-backups folder.');let interrupted=false;try{await lstat(path.join(root,'.motion-cache/update-transaction.json'));interrupted=true;}catch{}return {state:interrupted?'recovery-required':'failed',note:error.message};}
  finally{await staged?.cleanup();}
 }finally{await rm(lock,{recursive:true,force:true});}
}
