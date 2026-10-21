import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,stat} from 'node:fs/promises';
import path from 'node:path';

export function trustedStudioOrigin(value) {
  try {
    const url=new URL(value.startsWith('git@github.com:')?'ssh://git@github.com/'+value.slice(15):value);
    return ['https:','ssh:'].includes(url.protocol)&&url.hostname==='github.com'&&!url.port&&!url.password&&!url.hash&&!url.search&&(url.protocol==='ssh:'?url.username==='git':!url.username)&&url.pathname.replace(/\.git$/,'').toLowerCase()==='/andrexes03/motion-lab';
  } catch{return false;}
}
const exists=async file=>{try{await stat(file);return true;}catch{return false;}};
const run=(root,command,args,timeout=10000)=>new Promise((resolve,reject)=>execFile(command,args,{cwd:root,timeout,maxBuffer:2*1024*1024,encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH??'')}},(error,stdout,stderr)=>error?reject(Error(`${command}: ${stderr?.trim()||error.message}`)):resolve(stdout.trim())));

/** Check main on every launch. Fast-forward only; never stash, reset or clean. */
export async function updateStudio({root,log=console.error}={}) {
  const git=(...args)=>run(root,'git',args);
  let lock,locked=false;
  const result=(state,note,extra={})=>{log('Framevolve: '+note);return {state,note,...extra};};
  try {
    try{await git('rev-parse','--git-dir');}catch{return result('unmanaged','Downloaded copy: starting locally. Clone the repository for automatic updates.');}
    let origin;try{origin=await git('config','--get-all','remote.origin.url');}catch{return result('untrusted-origin','No update repository configured; starting locally.');}
    if(!trustedStudioOrigin(origin))return result('untrusted-origin','Update skipped: this copy does not use the official repository.');
    if(await git('branch','--show-current')!=='main')return result('branch','Work branch preserved; automatic updates are available on main.');
    const dirty=()=>git('status','--porcelain','--untracked-files=all','--ignore-submodules=none');
    if(await dirty())return result('local-changes','Local changes preserved; starting the installed copy without overwriting them.');
    const gitPath=async name=>path.resolve(root,await git('rev-parse','--git-path',name));
    for(const name of ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply','sequencer','BISECT_LOG','index.lock'])if(await exists(await gitPath(name)))return result('busy','Git operation in progress; update postponed.');
    lock=await gitPath('framevolve-launch-update.lock');
    try{await mkdir(lock);locked=true;}catch(error){if(error.code==='EEXIST')return result('busy','Another launcher is already checking for updates.',{lock});throw error;}
    const fingerprint=async()=>{const hash=createHash('sha256');for(const name of ['package.json','package-lock.json','.npmrc']){hash.update(name);try{hash.update(await readFile(path.join(root,name)));}catch(error){if(error.code!=='ENOENT')throw error;}}return hash.digest('hex');};
    const before=await git('rev-parse','HEAD'),beforeHash=await fingerprint(),statePath=await gitPath('framevolve-dependencies.json');
    let previous;try{previous=JSON.parse(await readFile(statePath,'utf8'));}catch{}
    try{await git('fetch','--no-tags','--no-recurse-submodules','origin','refs/heads/main:refs/remotes/origin/main');}catch{return result('offline','GitHub is unreachable; starting the installed version.');}
    if(await dirty()||await git('rev-parse','HEAD')!==before)return result('local-changes','The working copy changed during the check; update postponed.');
    const [ahead]= (await git('rev-list','--left-right','--count','HEAD...refs/remotes/origin/main')).split(/\s+/).map(Number);
    if(ahead)return result('diverged','Local commits preserved; no automatic reconciliation.');
    await git('merge','--ff-only','--no-edit','refs/remotes/origin/main');
    const after=await git('rev-parse','HEAD'),hash=await fingerprint();
    const install=hash!==beforeHash||previous?.pending===true||(previous&&previous.hash!==hash)||(previous&&previous.abi!==process.versions.modules)||!await exists(path.join(root,'node_modules/vite/package.json'));
    const save=async pending=>{const temp=statePath+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify({hash,abi:process.versions.modules,pending}));await rename(temp,statePath);};
    if(install){await save(true);log('Framevolve: updating dependencies…');try{await run(root,process.platform==='win32'?'npm.cmd':'npm',['ci','--no-audit','--no-fund'],180000);}catch(error){throw Error('Dependency installation is incomplete; retry on the next launch. '+error.message);}}
    await save(false);
    return result(before===after?'current':'updated',before===after?'The installed version is up to date.':`Updated ${before.slice(0,8)} → ${after.slice(0,8)}.`,{before,after,installed:install});
  } finally {if(locked)await rm(lock,{recursive:true,force:true});}
}
