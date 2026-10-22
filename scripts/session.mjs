#!/usr/bin/env node
import {ROOT} from './browser-runtime.mjs';
import {readFile} from 'node:fs/promises';
import {saveCheckpoint,listCheckpoints,restoreCheckpoint,recoverCheckpoint} from './session-checkpoints.mjs';
const [command,id,...label]=process.argv.slice(2);
try{
 let result;if(command==='save')result=await saveCheckpoint(ROOT,{label:[id,...label].filter(Boolean).join(' ')});
 else if(command==='list')result=await listCheckpoints(ROOT);
 else if(command==='restore')result=await restoreCheckpoint(ROOT,id);
 else if(command==='recover')result=await recoverCheckpoint(ROOT);
 else if(command==='brief')result=JSON.parse(await readFile(new URL('../.motion-cache/founder-brief.json',import.meta.url),'utf8'));
 else throw Error('Use session.mjs save [label], list, restore ID, recover or brief.');
 console.log(JSON.stringify(Array.isArray(result)?result:result?.files?{id:result.id,label:result.label,files:typeof result.files==='object'?Object.keys(result.files).length:result.files,backupId:result.backupId}:result??{recovered:true},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
