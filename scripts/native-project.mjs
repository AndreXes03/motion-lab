#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {ROOT} from './project-store.mjs';
import {createNativeProject,listNativeProjects,migrateRecipe,readNativeProject,updateNativeProject} from './native-project-store.mjs';
import {evaluateNativeProject} from '../src/engine/native-project.js';

async function jsonFile(file){return JSON.parse(await readFile(file,'utf8'));}
async function main([command,...args]){let result;switch(command){case 'list':result={projects:await listNativeProjects(ROOT)};break;case 'show':result={project:await readNativeProject(ROOT,args[0])};break;case 'create':result={project:await createNativeProject(ROOT,await jsonFile(args[0]))};break;case 'update':result={project:await updateNativeProject(ROOT,args[0],await jsonFile(args[1]),Number(args[2]))};break;case 'migrate':result={project:await createNativeProject(ROOT,migrateRecipe(await jsonFile(args[0]),{id:args[1],name:args.slice(2).join(' ')||undefined}))};break;case 'evaluate':result={frame:evaluateNativeProject(await readNativeProject(ROOT,args[0]),args[1],Number(args[2]))};break;default:throw Error('Use: native-project list | show ID | create FILE | update ID FILE EXPECTED_REVISION | migrate RECIPE_FILE ID [NAME] | evaluate ID SCENE_ID TIME');}console.log(JSON.stringify(result,null,2));}
main(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1;});
