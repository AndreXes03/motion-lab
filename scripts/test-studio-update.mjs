import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';import path from 'node:path';
import {updateStudio,trustedStudioOrigin} from './studio-update.mjs';
const dir=await mkdtemp(path.join(os.tmpdir(),'framevolve-update-')),remote=path.join(dir,'remote.git'),seed=path.join(dir,'seed'),local=path.join(dir,'local');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const write=(name,value)=>writeFile(path.join(seed,name),value);
try{
 await mkdir(seed);assert.equal((await updateStudio({confirm:async()=>true,root:seed,log:()=>{}})).state,'unmanaged');git(seed,'init','--initial-branch=main');git(seed,'config','user.email','test@example.invalid');git(seed,'config','user.name','Framevolve test');
 await write('package.json','{"name":"motion-lab","version":"1.0.0"}');await write('.gitignore','node_modules/\n');await write('scene.txt','baseline');git(seed,'add','.');git(seed,'commit','-m','Baseline');git(dir,'clone','--bare',seed,remote);git(dir,'clone',remote,local);
 git(local,'remote','set-url','origin','https://github.com/AndreXes03/motion-lab.git');git(local,'config',`url.file://${remote}.insteadOf`,'https://github.com/AndreXes03/motion-lab.git');
 await mkdir(path.join(local,'node_modules/vite'),{recursive:true});await writeFile(path.join(local,'node_modules/vite/package.json'),'{}');
 const update=()=>updateStudio({confirm:async()=>true,root:local,log:()=>{}});
 assert.equal((await update()).state,'current');
 await write('scene.txt','updated');git(seed,'commit','-am','Update scene');git(seed,'push',remote,'main');
 assert.equal((await updateStudio({root:local,log:()=>{},confirm:async()=>false})).state,'declined');assert.equal(await readFile(path.join(local,'scene.txt'),'utf8'),'baseline');
 assert.equal((await update()).state,'updated');assert.equal(await readFile(path.join(local,'scene.txt'),'utf8'),'updated');
 await writeFile(path.join(local,'scene.txt'),'local work');assert.equal((await update()).state,'local-changes');assert.equal(await readFile(path.join(local,'scene.txt'),'utf8'),'local work');git(local,'checkout','--','scene.txt');
 git(local,'checkout','-b','editing');assert.equal((await update()).state,'branch');git(local,'checkout','main');
 await mkdir(path.join(local,'.git/framevolve-launch-update.lock'));assert.equal((await update()).state,'busy');await rm(path.join(local,'.git/framevolve-launch-update.lock'),{recursive:true});
 git(local,'config','user.email','test@example.invalid');git(local,'config','user.name','Framevolve test');await writeFile(path.join(local,'scene.txt'),'ahead');git(local,'commit','-am','Local commit');assert.equal((await update()).state,'diverged');
 await rename(remote,remote+'.offline');assert.equal((await update()).state,'offline');
 assert.equal(trustedStudioOrigin('https://github.com/AndreXes03/motion-lab.git'),true);assert.equal(trustedStudioOrigin('git@github.com:AndreXes03/motion-lab.git'),true);assert.equal(trustedStudioOrigin('https://github.com.evil.invalid/AndreXes03/motion-lab.git'),false);
 git(local,'remote','set-url','origin','https://example.invalid/untrusted');assert.equal((await update()).state,'untrusted-origin');
 console.log('Launch updater: current, fast-forward, dirty copy, branch, lock, local commits, offline fallback and origin checks passed.');
}finally{await rm(dir,{recursive:true,force:true});}
