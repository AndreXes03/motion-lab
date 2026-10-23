import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {libraryState,saveActiveProject} from './project-library-session.mjs';
import {validateAppDemo,appDemoDuration} from '../src/engine/app-demo.js';
const root=fileURLToPath(new URL('../',import.meta.url)),[command,file]=process.argv.slice(2);
try{
 const {active}=await libraryState(root);
 if(active?.snapshot?.parameters?.scene!=='appdemo')throw Error('Open the App Demo project in Studio first.');
 if(command==='read')console.log(JSON.stringify({projectId:active.id,revision:active.revision,appDemo:validateAppDemo(active.snapshot.parameters.appDemo)},null,2));
 else if(command==='update'&&file){
  const input=JSON.parse(await readFile(file,'utf8'));
  if(input.projectId!==active.id||input.revision!==active.revision)throw Error('Project or revision changed. Read the active project again before updating.');
  const appDemo=validateAppDemo(input.appDemo),snapshot=structuredClone(active.snapshot);snapshot.parameters.appDemo=appDemo;snapshot.config.duration=appDemoDuration(appDemo);snapshot.end=snapshot.config.duration;
  const record=await saveActiveProject(root,{activeId:active.id,revision:active.revision,name:active.name,snapshot});console.log(JSON.stringify({projectId:record.id,revision:record.revision,duration:snapshot.end}));
 }else throw Error('Use: node scripts/app-demo.mjs read | update FILE. FILE contains projectId, revision and appDemo from read.');
}catch(error){console.error(error.message);process.exitCode=1;}
