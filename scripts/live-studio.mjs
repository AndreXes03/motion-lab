#!/usr/bin/env node
import {autosaveActiveProject} from './project-library-session.mjs';
import {saveCheckpoint} from './session-checkpoints.mjs';
import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ROOT } from './browser-runtime.mjs';
import { launch } from './launch-studio.mjs';
import { readReview, writeReview, updateReview } from './live-review-store.mjs';
export function liveArgs(args) {
  const [command = 'start', ...flags] = args, options = { command, root: ROOT, port: 4173, browser: 'none' };
  if (!['start','status','plan','begin','publish','done','block'].includes(command)) throw Error('Use start, status, plan, begin, publish, done or block.');
  for (let i=0;i<flags.length;i+=2) {
    const key=flags[i]?.slice(2), value=flags[i+1];
    if (!flags[i]?.startsWith('--') || !['repo','port','browser','scene','task','file','recipe','label'].includes(key) || !value || value.startsWith('--')) throw Error('Invalid live Studio option.');
    options[key==='repo'?'root':key]=value;
  }
  options.root=path.resolve(options.root);options.port=Number(options.port);
  if (!Number.isInteger(options.port)||options.port<1024||options.port>65535) throw Error('Invalid port.');
  if (!['none','integrated','external'].includes(options.browser)) throw Error('Browser must be integrated, external or none.');
  if (options.scene&&!/^[a-z0-9-]+$/.test(options.scene)) throw Error('Invalid scene id.');
  return options;
}
export async function liveCommand(options) {
  const {command,root,port}=options;
  if (command==='start') {
    const result=await launch({action:'start',root,port,open:false,update:false});
    const url=new URL(result.url);if(options.scene)url.searchParams.set('scene',options.scene);
    if(options.browser==='external') {const {execFile}=await import('node:child_process');await new Promise((resolve,reject)=>execFile('/usr/bin/open',[url.href],error=>error?reject(error):resolve()));}
    return {url:url.href,browser:options.browser,instruction:options.browser==='integrated'?'Use an available integrated-browser tool to open this exact URL in a visible tab. Reuse the tab for later edits. If no such tool can reach this local server, report that and offer the external browser. This command does not open an embedded browser itself.':'Keep this Studio URL open while editing.',reused:result.reused};
  }
  const previous=await readReview(root);
  if(command==='status')return previous;
  if(command==='begin'){
    if(options.task&&!previous.tasks.some(t=>t.id===options.task))throw Error('Unknown feedback id. Add it to the plan first.');
    try{const response=await fetch(`http://127.0.0.1:${port}/api/studio`,{signal:AbortSignal.timeout(1500)});const data=await response.json();if(data.jobs?.some(j=>['running','queued'].includes(j.status)))throw Error('Wait for the active Studio render before changing its source files.');}
    catch(error){if(error.message.startsWith('Wait for'))throw error;}
  }
  if(command==='begin'&&previous.phase!=='editing')await saveCheckpoint(root,{label:'Before: '+(previous.tasks.find(t=>t.id===options.task)?.title??options.label??'revision')});
  const tasks=options.file?JSON.parse(await readFile(path.resolve(root,options.file),'utf8')):undefined;
  if(command==='plan'&&!Array.isArray(tasks))throw Error('Use plan --file with a JSON array of feedback items.');
  const snapshot=options.recipe?JSON.parse(await readFile(path.resolve(root,options.recipe),'utf8')):undefined;
  const result=await writeReview(root,updateReview(previous,command,{task:options.task,tasks,snapshot,label:options.label}));
  if(command==='publish')await autosaveActiveProject(root,{snapshot:result.snapshot});
  return result;
}
if(process.argv[1]&&await realpath(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await liveCommand(liveArgs(process.argv.slice(2))),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
