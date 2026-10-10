#!/usr/bin/env node
// Model review is an image gate. Successful rendering never implies visual approval.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const emit=(type,data={})=>process.stdout.write(JSON.stringify({type,...data})+'\n');
const args=process.argv.slice(2),options={};
function escapeXml(s){return s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
async function frame(output,parameters,time,width,height){
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(ROOT,'scripts/cli.mjs'),'frame','--out',output,'--time',String(time),'--width',String(width),'--height',String(height),'--parameters',JSON.stringify(parameters)],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`Frame failed (${code}): ${stderr.trim()||stdout.trim()}`)));
 });
}
async function main(){
 for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]===undefined)throw new Error('Usage: node scripts/quality.mjs [--out renders/quality-board.png] [--time 2] [--width 720] [--height 720] [--yaw 20]');options[args[i].slice(2)]=args[i+1];}
 for(const key of Object.keys(options))if(!['out','time','width','height','yaw','scene'].includes(key))throw new Error(`Unknown option --${key}`);
 const time=Number(options.time??2),width=Number(options.width??720),height=Number(options.height??720),yaw=Number(options.yaw??20);
 if(!Number.isFinite(time)||time<0||time>10||!Number.isFinite(yaw)||![width,height].every(n=>Number.isInteger(n)&&n>=128&&n<=4096))throw new Error('Invalid time, yaw or dimensions');
 const output=path.resolve(ROOT,options.out??'renders/quality-board.png');
 const frameDir=path.join(path.dirname(output),path.basename(output,path.extname(output))+'-frames');await mkdir(frameDir,{recursive:true});
 const objects=options.scene==='pop'?[['pop.player','Player'],['type.PLAY','PLAY'],['type.BASS','BASS']]:[['device.root','Radio'],['bax.emblem','B smaltata'],['bax.kinetic','Giroscopio']],reviews=['clean','clay'];
 const overlays=[],records=[],labelHeight=48;
 for(let row=0;row<reviews.length;row++)for(let col=0;col<objects.length;col++){
  const [object,label]=objects[col],review=reviews[row],file=path.join(frameDir,`${object.replaceAll('.','-')}-${review}.png`);
  emit('progress',{object,review,path:file});await frame(file,{scene:options.scene??'bax',inspect:{object,yaw},review},time,width,height);
  overlays.push({input:await readFile(file),left:col*width,top:row*(height+labelHeight)});
  const caption=`${label} / ${review==='clean'?'materiali':'geometria clay'}`;
  overlays.push({input:Buffer.from(`<svg width="${width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#17202b"/><text x="18" y="31" fill="white" font-family="Arial" font-size="20">${escapeXml(caption)}</text></svg>`),left:col*width,top:row*(height+labelHeight)+height});
  records.push({object,review,path:file});
 }
 await sharp({create:{width:width*3,height:(height+labelHeight)*2,channels:4,background:'#17202b'}}).composite(overlays).png().toFile(output);
 const manifest={board:output,time,yaw,frames:records,rendered:true,visualApproval:false,checklist:path.join(ROOT,'QUALITY-GATES.md')};
 await writeFile(output+'.json',JSON.stringify(manifest,null,2));emit('complete',manifest);
}
main().catch(error=>{emit('error',{message:error.message});process.exitCode=1;});
