import {access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
export const componentHome=()=>path.join(os.homedir(),'Library','Application Support','Framevolve','components','cycles');
export async function resolveNative(){
 const lock=JSON.parse(await readFile(path.join(ROOT,'native/cycles/lock.json'),'utf8'));
 let directory=process.env.FRAMEVOLVE_CYCLES_DIR; const experimental=!!directory; let receipt;
 if(!directory){try{const installed=JSON.parse(await readFile(path.join(componentHome(),'current.json'),'utf8'));receipt=installed;if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(installed.version))throw Error('Invalid component receipt');if(installed.protocol!==lock.protocol||installed.revision!==lock.revision||installed.version!==lock.version)throw Error('Installed Rendering Cycles needs an update.');directory=path.join(componentHome(),installed.version);}catch(e){if(e.code==='ENOENT')throw Error('Rendering Cycles is not installed. Install the optional component from Studio.');throw e;}}
 if(!path.isAbsolute(directory))throw Error('FRAMEVOLVE_CYCLES_DIR must be absolute');
 if(!experimental&&receipt?.security==='manual-macos')directory=path.join(directory,'Rendering Cycles.app','Contents','Resources','runtime');
 const executable=path.join(directory,'framevolve-cycles'),color=path.join(directory,'color','config.ocio');
 await access(executable,constants.X_OK);await access(color,constants.R_OK);
 return {directory,executable,color,lock,experimental,validatedScenes:experimental?['pulse','loop']:(receipt?.validatedScenes??[])};
}
export async function probeNative(){
 const runtime=await resolveNative();
 const details=await new Promise((resolve,reject)=>{const child=spawn(runtime.executable,['--probe']);let out='',err='';const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Cycles standalone probe timed out'));},20000);child.stdout.on('data',d=>out=(out+d).slice(-64000));child.stderr.on('data',d=>err=(err+d).slice(-4000));child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);try{if(code)throw Error(err||'Cycles probe failed');const line=out.split('\n').find(x=>x.startsWith('MOTION_CYCLES '));const value=JSON.parse(line.slice(14));if(value.protocol!==1||value.backend!=='cycles-standalone'||value.revision!==runtime.lock.revision)throw Error('Incompatible Cycles component');resolve(value);}catch(e){reject(e);}});});
 return {...runtime,...details};
}
