#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {creativeState,writeBoard,updateFeedback,saveCreativeReview,listFeedback} from './creative-store.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const [command,arg,status,...rest]=process.argv.slice(2);
try{
 let result;
 if(command==='status')result=await creativeState(root,arg);
 else if(command==='comments')result=await listFeedback(root,arg);
 else if(command==='storyboard')result=await writeBoard(root,JSON.parse(await readFile(arg,'utf8')));
 else if(command==='review')result=await saveCreativeReview(root,JSON.parse(await readFile(arg,'utf8')));
 else if(command==='feedback')result=await updateFeedback(root,{id:arg,status,evidence:rest.join(' ')});
 else throw Error('Use creative.mjs status SCENE | comments [SCENE] | storyboard FILE | review FILE | feedback ID todo|doing|done|blocked "evidence"');
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
