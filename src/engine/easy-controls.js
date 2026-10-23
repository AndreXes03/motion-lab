import {createControlManifest,getControlCatalog,readControlValue,writeControlValue,assertSafeControlDocument} from './control-catalog.js';
import {validateEasyControls} from './easy-control-schema.js';

export function easyControlsFor(scene,manifest){
 if(manifest.easy)return validateEasyControls(manifest.easy,getControlCatalog(scene),manifest.controls);
 // Old recipes retain their selected tools and use only compatible scene-authored bundles.
 return (createControlManifest(scene).easy??[]).filter(group=>Object.keys(group.choices[0].values).every(id=>manifest.controls.includes(id)));
}
export function easyChoiceState(group,parameters,catalog){
 const ids=Object.keys(group.choices[0].values);
 const animated=parameters.animation?.enabled!==false&&ids.some(id=>parameters.animation?.tracks?.[id]?.length);
 const selected=group.choices.find(choice=>Object.entries(choice.values).every(([id,value])=>{const current=readControlValue(catalog.find(c=>c.id===id),parameters);return typeof value==='number'?Math.abs(current-value)<1e-6:current===value;}));
 return {animated:!!animated,selected:selected?.id??null};
}
/** One atomic recipe edit; no new renderer parameters or hidden state to reconstruct. */
export function applyEasyChoice(snapshot,group,choiceId){
 assertSafeControlDocument(snapshot);const scene=snapshot.parameters.scene,catalog=getControlCatalog(scene),manifest=snapshot.parameters.studio?.controlManifest??createControlManifest(scene);
 const [safe]=validateEasyControls([group],catalog,manifest.controls),choice=safe.choices.find(c=>c.id===choiceId);
 if(!choice)throw Error('Unknown Easy choice');if(easyChoiceState(safe,snapshot.parameters,catalog).animated)throw Error('This control has custom animation. Edit it in Pro.');
 const next=structuredClone(snapshot),p=next.parameters;p.studio??={};p.studio.values??={};
 for(const [id,value]of Object.entries(choice.values)){
  const def=catalog.find(c=>c.id===id);writeControlValue(p,def,value);
  if(def.binding==='value')p.studio.values[def.valueId]=value;
  if(def.path[0]==='look'){
   let target=p.studio.lookOverrides??={};for(const key of def.path.slice(1,-1))target=target[key]??={};target[def.path.at(-1)]=value;
  }
 }
 return next;
}
