import presets from '../../project/control-presets.json' with {type:'json'};
import {getControlCatalog,assertSafeControlDocument} from './control-catalog.js';
import {easeProgress,parameterEasings} from './parameter-animation.js';

const categories=new Set(['lights','compositing']);

/** Validate a named saved profile or a caller-provided profile without applying it. */
export function validatePresetSelection(scene,category,preset){
 const catalog=getControlCatalog(scene),definitions=new Map(catalog.map(control=>[control.id,control]));
 if(!categories.has(category))throw new Error(`Unsupported preset category: ${category}`);
 const candidates=presets.scenes?.[scene]?.[category]??(category==='compositing'?presets.compositing:[])??[];
 if(typeof preset==='string')preset=candidates.find(candidate=>candidate.id===preset);
 assertSafeControlDocument(preset);
 if(!preset||typeof preset!=='object'||Array.isArray(preset)||Object.keys(preset).some(key=>!['id','label','description','values'].includes(key)))throw new Error('Invalid control preset');
 for(const key of ['id','label','description'])if(typeof preset[key]!=='string'||!preset[key].trim()||preset[key].length>300)throw new Error(`Invalid preset ${key}`);
 if(!/^[a-z][a-z0-9-]{0,63}$/.test(preset.id))throw new Error('Invalid preset identifier');
 if(!preset.values||typeof preset.values!=='object'||Array.isArray(preset.values)||!Object.keys(preset.values).length||Object.keys(preset.values).length>15)throw new Error('Preset must contain 1–15 control values');
 const values={};
 for(const [id,value]of Object.entries(preset.values)){
  const control=definitions.get(id);
  if(!control||control.category!==category)throw new Error(`Preset control does not belong to ${category}: ${id}`);
  if(control.type==='range'&&(!Number.isFinite(value)||value<control.min||value>control.max))throw new Error(`Preset value outside control bounds: ${id}`);
  if(control.type==='color'&&(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)))throw new Error(`Invalid preset color: ${id}`);
  if(control.type==='toggle'&&typeof value!=='boolean')throw new Error(`Invalid preset toggle: ${id}`);
  if(control.type==='text'&&typeof value!=='string')throw new Error(`Invalid preset text: ${id}`);
  values[id]=value;
 }
 return{id:preset.id,label:preset.label,description:preset.description,values};
}

/** Curated native-value recipes; loading a recipe does not alter scene parameters. */
export function getControlPresets(scene,category){
 getControlCatalog(scene);
 if(!categories.has(category))throw new Error(`Unsupported preset category: ${category}`);
 const profiles=presets.scenes?.[scene]?.[category]??(category==='compositing'?presets.compositing:[])??[];
 if(!Array.isArray(profiles)||profiles.length>4)throw new Error('A preset category supports up to four curated profiles');
 const seen=new Set();
 return profiles.map(profile=>{if(seen.has(profile.id))throw new Error(`Duplicate control preset: ${profile.id}`);seen.add(profile.id);return validatePresetSelection(scene,category,profile);});
}

/** Validate a scene-specific interpolation recipe or a saved recipe identifier. */
export function validateInterpolationPreset(scene,profile){
 getControlCatalog(scene);
 const profiles=presets.scenes?.[scene]?.interpolation??presets.interpolation;
 if(typeof profile==='string')profile=profiles?.find(candidate=>candidate.id===profile);
 assertSafeControlDocument(profile);
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||Object.keys(profile).some(key=>!['id','label','ease','bezier'].includes(key)))throw new Error('Invalid interpolation preset');
 if(typeof profile.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(profile.id)||typeof profile.label!=='string'||!profile.label.trim()||profile.label.length>80||!parameterEasings.includes(profile.ease))throw new Error('Invalid interpolation preset');
 easeProgress(.5,profile.ease,profile.bezier);
 if(profile.bezier!==undefined&&profile.ease!=='bezier')throw new Error('Bezier values require bezier interpolation');
 return{...profile,...(profile.bezier?{bezier:[...profile.bezier]}:{})};
}

/** A small interpolation palette, optionally customized for an individual scene. */
export function getInterpolationPresets(scene){
 getControlCatalog(scene);
 const profiles=presets.scenes?.[scene]?.interpolation??presets.interpolation;
 if(!Array.isArray(profiles)||profiles.length>4)throw new Error('Interpolation supports up to four curated profiles');
 const seen=new Set();
 return profiles.map(profile=>{const validated=validateInterpolationPreset(scene,profile);if(seen.has(validated.id))throw new Error('Duplicate interpolation preset');seen.add(validated.id);return validated;});
}
