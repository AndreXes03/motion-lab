#!/usr/bin/env node
import {getControlPresets,getInterpolationPresets,validatePresetSelection,validateInterpolationPreset} from '../src/engine/control-presets.js';
import {readFile,writeFile} from 'node:fs/promises';
import {getControlCatalog,createControlManifest,buildControlPanels,validateControlManifest} from '../src/engine/control-catalog.js';
import {sceneIds} from '../src/scene-registry.js';
const [command='help',...args]=process.argv.slice(2);
const flag=name=>{const index=args.indexOf('--'+name);return index<0?undefined:args[index+1];};
const scene=flag('scene'),selectionFile=new URL('../project/control-selections.json',import.meta.url);
const print=value=>console.log(JSON.stringify(value,null,2));
async function plan(){
 if(!scene||!sceneIds.includes(scene))throw Error('Choose a registered --scene.');
 if(flag('file')){const manifest=JSON.parse(await readFile(flag('file'),'utf8'));return validateControlManifest(manifest,scene);}
 const controls=flag('controls')?.split(',').map(x=>x.trim()).filter(Boolean);
 if(!controls)return createControlManifest(scene);
 const panels=buildControlPanels(scene,controls),advanced=new Set((flag('advanced')??'').split(',').filter(Boolean));
 for(const panel of panels)panel.advanced=advanced.has(panel.category);
 return validateControlManifest({version:1,scene,controls,panels,rationale:flag('reason')},scene);
}
try{
 if(command==='preset-catalog'){
  if(!scene)throw Error('Choose --scene.');print({lights:getControlPresets(scene,'lights'),compositing:getControlPresets(scene,'compositing'),interpolation:getInterpolationPresets(scene)});
 }else if(['preset-plan','preset-set'].includes(command)){
  if(!scene||!sceneIds.includes(scene))throw Error('Choose a registered --scene.');const category=flag('category');const candidate=flag('file')?JSON.parse(await readFile(flag('file'),'utf8')):flag('id');const preset=category==='interpolation'?validateInterpolationPreset(scene,candidate):validatePresetSelection(scene,category,candidate);
  if(command==='preset-plan')print(preset);else{const file=new URL('../project/control-presets.json',import.meta.url),doc=JSON.parse(await readFile(file,'utf8'));doc.scenes[scene]??={};const fallback=category==='interpolation'?getInterpolationPresets(scene):getControlPresets(scene,category);const profiles=doc.scenes[scene][category]??fallback;const existing=profiles.findIndex(p=>p.id===preset.id);if(existing<0&&profiles.length>=4)throw Error('Keep up to four quality variants; replace an existing preset ID.');if(existing>=0)profiles[existing]=preset;else profiles.push(preset);doc.scenes[scene][category]=profiles;await writeFile(file,JSON.stringify(doc,null,2)+'\n');print({saved:true,scene,category,preset});}
 }else if(command==='catalog'){
  if(!scene)throw Error('Choose --scene.');
  print(getControlCatalog(scene).map(({id,label,type,category,path,min,max,step,default:value,animatable,help})=>({id,label,type,category,path,min,max,step,default:value,animatable,help})));
 }else if(command==='plan')print(await plan());
 else if(command==='set'){
  const manifest=await plan();if(!manifest.controls.some(id=>getControlCatalog(scene).find(c=>c.id===id)?.animatable))throw Error('Select at least one supported numeric animation tool.');if(!manifest.rationale?.trim())throw Error('A saved selection needs --reason or a rationale in --file.');
  const document=JSON.parse(await readFile(selectionFile,'utf8'));
  document.scenes[scene]={controls:manifest.controls,panels:manifest.panels,rationale:manifest.rationale};
  await writeFile(selectionFile,JSON.stringify(document,null,2)+'\n');print({saved:true,scene,controls:manifest.controls.length,panels:manifest.panels.length});
 }else if(command==='check'){
  const doc=JSON.parse(await readFile(selectionFile,'utf8'));if(doc.version!==1||Object.keys(doc.scenes).some(id=>!sceneIds.includes(id)))throw Error('Control selections do not match the registered scenes.');
  print({passed:true,scenes:sceneIds.map(id=>{const catalog=getControlCatalog(id),manifest=createControlManifest(id);if(!catalog.some(c=>c.animatable&&c.type==='range'))throw Error(`Scene ${id} needs a real animatable numeric parameter.`);return {scene:id,available:catalog.length,selected:manifest.controls.length,panels:manifest.panels.length};})});
 }else if(command==='help')console.log('controls.mjs catalog --scene ID\ncontrols.mjs plan --scene ID [--controls comma,separated,IDs] [--advanced compositing,lens] [--reason "Purpose"]\ncontrols.mjs set --scene ID --file manifest.json\ncontrols.mjs set --scene ID --controls IDs --reason "Purpose"\ncontrols.mjs check\ncontrols.mjs preset-catalog --scene ID\ncontrols.mjs preset-plan --scene ID --category lights|compositing|interpolation --id ID or --file profile.json\ncontrols.mjs preset-set --scene ID --category CATEGORY --file profile.json');
 else throw Error('Unknown command. Use controls.mjs help.');
}catch(error){console.error(error.message);process.exitCode=1;}
