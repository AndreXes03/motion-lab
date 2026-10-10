import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const out=path.join(ROOT,'renders/qa-media');await mkdir(out,{recursive:true});
const tests=[];const cases=[...[24,25,30,50,60].map(fps=>({fps,format:'mp4'})),{fps:25,format:'webm'},{fps:30,format:'prores'}];
async function cli(args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/cli.mjs',...args],{cwd:ROOT,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('close',code=>resolve({code,events:stdout.split('\n').filter(Boolean).map(line=>JSON.parse(line)),stderr}));});}
for(const {fps,format}of cases){
 const file=path.join(out,`${format}-${fps}.${format==='prores'?'mov':format}`);console.log(JSON.stringify({type:'progress',fps,format}));
 try{
  const render=await cli(['preview','--scene','procedural','--out',file,'--width','320','--height','180','--fps',String(fps),'--format',format,'--bitrate-mbps','4','--start','0','--end',String(2/fps),'--temporal-samples','2']);if(render.code)throw new Error(JSON.stringify(render));
  const verify=await cli(['verify','--out',file]);const result=verify.events.find(e=>e.type==='verification');if(verify.code||!result?.valid)throw new Error(JSON.stringify(verify));
  const snapshot=JSON.parse(await readFile(file+'.project.json','utf8'));if(snapshot.settings.fps!==fps||snapshot.settings.format!==format||snapshot.settings.temporalSamples!==2)throw new Error('Saved settings mismatch');
  tests.push({fps,format,passed:true,codec:result.video.codec_name,pixelFormat:result.video.pix_fmt,frames:result.expected.frames,metadataChecks:result.metadataChecks});
 }catch(error){tests.push({fps,format,passed:false,error:error.message});}
}
const report={passed:tests.every(t=>t.passed),tests,note:'ProRes 10-bit storage encodes the existing 8-bit display output; no HDR claim. Bitrate targets vary with content and codec.'};await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({type:'tests',...report}));if(!report.passed)process.exitCode=1;
