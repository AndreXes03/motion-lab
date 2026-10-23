import {validateEasyControls} from './easy-control-schema.js';
import {perspectiveScenes} from './camera-lens.js';
import selections from '../../project/control-selections.json' with {type:'json'};
import {controlCategory,controlCategories} from './scene-capabilities.js';
import {studioProjects} from './project-controls.js';
import {sceneRegistry} from '../scene-registry.js';
import defaultLook from '../../project/look.json' with {type:'json'};

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function assertScene(scene) {
  if (typeof scene !== 'string' || !own(sceneRegistry, scene)) throw new Error(`Unknown control scene: ${scene}`);
}

/** Reject unsafe keys throughout external documents before interpreting them. */
export function assertSafeControlDocument(value, depth = 0) {
  if (depth > 16) throw new Error('Control document is too deeply nested');
  if (value === null || typeof value !== 'object') return;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('Control documents must contain plain objects');
  for (const key of Object.keys(value)) {
    if (forbidden.has(key)) throw new Error(`Unsafe control key: ${key}`);
    assertSafeControlDocument(value[key], depth + 1);
  }
}

function range(id, label, path, min, max, step, fallback, group, contexts, help) {
  return {id, label, type:'range', path, min, max, step, default:fallback, help, group, animatable:true, contexts, binding:'parameter'};
}

/** Public parameter bindings; dotted object names remain a single path segment. */
export function getControlCatalog(scene) {
  assertScene(scene);
  const project = studioProjects.find(item => item.id === scene);
  const controls = (project?.controls ?? []).map(control => {
    const path = scene === 'starter' ? ['product', control.id] : Array.isArray(control.path) ? [...control.path] : String(control.path).split('.');
    const camera = ['fov','fisheye','cameraMotion'].includes(control.id);
    const lighting = ['contrast','keyStrength','fill'].includes(control.id);
    const contexts=[camera ? 'camera' : lighting ? 'lighting' : 'composition'];
    if (scene === 'objects' && ['shell','knob','display'].includes(control.id)) contexts.push('device.root');
    if (scene === 'objects' && control.id === 'energy') contexts.push('device.root','objects.kinetic','objects.emblem');
    return {...control, path, group:control.group??(camera ? 'Lens' : lighting ? 'Lights' : 'Composition'), contexts:control.contexts??contexts, animatable:control.animatable??(control.type === 'range' && control.id !== 'contrast'), binding:'value', valueId:control.id};
  });
  if (scene === 'objects') {
    controls.push(
      range('fov','Camera field of view',['look','camera','fov'],25,100,1,defaultLook.camera.fov,'Camera',['camera'],'Lens angle in degrees.'),
      range('exposure','Exposure',['look','post','exposure'],.25,2.5,.01,defaultLook.post.exposure,'Lighting',['lighting'],'Overall light exposure.'),
      range('key','Key light',['look','lighting','key'],0,500,1,defaultLook.lighting.key,'Lighting',['lighting'],'Main studio light intensity.'),
      range('fill','Shadow fill',['look','lighting','fill'],0,.4,.005,defaultLook.lighting.fill,'Lighting',['lighting'],'Fill light intensity.'),
      range('rim','Rim light',['look','lighting','rim'],0,8,.05,defaultLook.lighting.rim,'Lighting',['lighting'],'Edge light intensity.'),
      range('environment','Environment light',['look','lighting','environment'],0,1.5,.01,defaultLook.lighting.environment,'Lighting',['lighting'],'Ambient studio light intensity.')
    );
    for (const [objectId, label] of [['device.root','Radio'],['objects.kinetic','Gyro'],['objects.emblem','Emblem']]) {
      for (const axis of ['x','y','z']) controls.push(range(`${objectId}.${axis}`,`${label} ${axis.toUpperCase()}`,['objectEdits',objectId,axis],-5,5,.05,0,label,[objectId],`Position offset on the ${axis.toUpperCase()} axis.`));
      controls.push(range(`${objectId}.yaw`,`${label} rotation`,['objectEdits',objectId,'yaw'],-180,180,1,0,label,[objectId],'Rotation offset in degrees.'),range(`${objectId}.scale`,`${label} scale`,['objectEdits',objectId,'scale'],.25,2,.01,1,label,[objectId],'Uniform scale multiplier.'));
    }
  }
  if(scene==='objects'){
    for(const [id,label,min,max,step,fallback,group]of [
      ['lensDistortion','Lens distortion',0,.6,.01,0,'Lens'],['aberrationPx','Chromatic aberration',0,12,.1,0,'Lens'],
      ['dofFocus','Focus distance',.1,60,.1,8,'Lens'],['dofStrength','Depth of field strength',0,1,.01,.35,'Lens'],['dofMaxBlur','Maximum focus blur',0,30,1,12,'Lens'],
      ['bloomStrength','Bloom strength',0,1,.01,0,'Compositing'],['bloomThreshold','Bloom threshold',0,10,.1,1,'Compositing'],['bloomRadius','Bloom radius',0,1,.01,.1,'Compositing'],
      ['aoIntensity','Ambient occlusion',0,1,.01,0,'Compositing'],['vignette','Vignette',0,.6,.01,0,'Compositing'],['grain','Film grain',0,.06,.001,.018,'Compositing'],['grainSize','Grain size',.5,3,.1,1.1,'Compositing'],['shutterAngle','Motion blur shutter',0,360,15,210,'Compositing']
    ])controls.push(range(id,label,['look','post',id],min,max,step,defaultLook.post[id]??fallback,group,['camera','lighting'],id==='shutterAngle'?'Motion blur shutter for exports with temporal samples.':id==='dofFocus'?'Manual focus distance, used when auto-focus is disabled.':`Adjust ${label.toLowerCase()} in the renderer.`));
    for(const [id,label,fallback,group]of [['dofEnabled','Depth of field',false,'Lens'],['dofAuto','Auto-focus',true,'Lens'],['antialias','Smoother edges',true,'Compositing']])controls.push({id,label,type:'toggle',path:['look','post',id],default:defaultLook.post[id]??fallback,group,contexts:['camera'],binding:'parameter',animatable:false,help:`Enable ${label.toLowerCase()}.`});
    for(const [id,label,fallback]of [['keyColor','Key light color','#fff1de'],['rimColor','Rim light color','#badcff']])controls.push({id,label,type:'color',path:['look','lighting',id],default:defaultLook.lighting[id]??fallback,group:'Lights',contexts:['lighting'],binding:'parameter',animatable:false,help:'Actual studio light color.'});
    controls.push(range('shellRoughness','Shell roughness',['look','surface','shellRoughness'],.05,1,.01,defaultLook.surface.shellRoughness,'Appearance',['device.root'],'Roughness of the radio shell material.'),range('motionAmount','Authored motion gain',['look','motion','amount'],0,2,.05,defaultLook.motion.amount,'Motion',['camera'],'Gain of the authored camera and object tracks.'));
  }
  if(['procedural','pop'].includes(scene))for(const [id,label,min,max,step,fallback]of [['grain','Film grain',0,.06,.001,.018],['grainSize','Grain size',.5,3,.1,1.1]])controls.push(range(id,label,['look','post',id],min,max,step,defaultLook.post[id]??fallback,'Compositing',['composition'],'Display grain applied after frame integration.'));
  if(perspectiveScenes.includes(scene)) {
    if(!controls.some(control=>control.id==='fov')) controls.push(range('fovScale','Wide lens',['look','camera','fovScale'],.6,1.5,.01,1,'Lens',['camera'],'Lens angle relative to each authored shot. Pair with Camera distance; Keep subject size automatically compensates framing.'));
    controls.push(range('cameraDistance','Camera distance',['look','camera','distance'],.35,2.5,.01,1,'Lens',['camera'],'Real camera distance to the shot target. Below 1 moves closer; above 1 moves away. Pair with the wide lens to shape perspective.'));
    controls.push({id:'keepSubjectSize',label:'Keep subject size',type:'toggle',path:['look','camera','keepSubjectSize'],default:true,group:'Lens',contexts:['camera'],binding:'parameter',animatable:false,help:'Move the camera as the lens angle changes to keep the subject at approximately the same size. Camera distance remains independently adjustable.'});
  }
  controls.push(range('colorContrast','Color contrast',['look','post','colorContrast'],.5,1.8,.01,1,'Compositing',['composition'],'Contrast of the finished image. One preserves the original.'),range('colorSaturation','Color saturation',['look','post','colorSaturation'],0,2.5,.01,1,'Compositing',['composition'],'Zero is monochrome; one preserves the original color.'));
  return controls.map(control=>({...control,category:controlCategory(control)}));
}

function assertPath(path) {
  if (!Array.isArray(path) || !path.length || path.some(key => typeof key !== 'string' || !key || forbidden.has(key))) throw new Error('Invalid control path');
}

export function readControlValue(definition, parameters) {
  assertPath(definition.path);
  let value = parameters;
  for (const key of definition.path) {
    if (!value || typeof value !== 'object' || !own(value,key)) return definition.default;
    value = value[key];
  }
  if (definition.type === 'range') return Number.isFinite(value) ? value : definition.default;
  if(definition.type==='toggle')return typeof value==='boolean'?value:definition.default;
  return typeof value === 'string' ? value : definition.default;
}

/** Mutates a caller-owned parameter clone; resolve composite value controls first. */
export function writeControlValue(parameters, definition, value) {
  assertPath(definition.path);
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('Parameters must be an object');
  if (definition.id === 'contrast') throw new Error('Contrast must be resolved through project control values');
  if (definition.type === 'range' && (!Number.isFinite(value) || value < definition.min || value > definition.max)) throw new Error(`Invalid value for control: ${definition.id}`);
  if (definition.type === 'color' && (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))) throw new Error(`Invalid color for control: ${definition.id}`);
  if(definition.type==='toggle'&&typeof value!=='boolean')throw new Error(`Invalid toggle for control: ${definition.id}`);
  if (definition.type === 'text' && typeof value !== 'string') throw new Error(`Invalid text for control: ${definition.id}`);
  let target = parameters;
  for (const key of definition.path.slice(0,-1)) {
    if (!own(target,key) || !target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
    target = target[key];
  }
  target[definition.path.at(-1)] = value;
  return parameters;
}

/** Generate panels cheaply from available capabilities; authored selections can refine them. */
export function buildControlPanels(scene,ids){
  const definitions=new Map(getControlCatalog(scene).map(c=>[c.id,c])),panels=[];
  for(const id of ids){const control=definitions.get(id);if(!control)throw new Error(`Unknown panel control: ${id}`);const category=control.category;
    let panel=panels.find(p=>p.category===category);if(!panel){panel={id:category,title:controlCategories[category],category,controls:[],advanced:false};panels.push(panel);}panel.controls.push(id);
  }
  return panels;
}
export function createControlManifest(scene,mode='recommended'){
  if(!['recommended','essential','all'].includes(mode))throw new Error(`Unknown control manifest mode: ${mode}`);
  const catalog=getControlCatalog(scene),selection=selections.scenes?.[scene];
  if(mode==='all'){const controls=catalog.map(c=>c.id);return validateControlManifest({version:1,scene,controls,panels:buildControlPanels(scene,controls)},scene);}
  if(!selection)throw new Error(`Scene ${scene} needs an agent-authored control selection`);
  return validateControlManifest({version:1,scene,controls:selection.controls,panels:selection.panels??buildControlPanels(scene,selection.controls),rationale:selection.rationale,...(selection.easy?{easy:selection.easy}:{})},scene);
}
export function validateControlManifest(manifest,scene){
  assertScene(scene);assertSafeControlDocument(manifest);
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||Object.keys(manifest).some(k=>!['version','scene','controls','panels','rationale','easy'].includes(k)))throw new Error('Invalid control manifest');
  if(manifest.version!==1||manifest.scene!==scene||!Array.isArray(manifest.controls))throw new Error('Control manifest version or scene does not match');
  const allowed=new Set(getControlCatalog(scene).map(c=>c.id)),seen=new Set();
  for(const id of manifest.controls){if(typeof id!=='string'||!allowed.has(id))throw new Error(`Unknown manifest control: ${id}`);if(seen.has(id))throw new Error(`Duplicate manifest control: ${id}`);seen.add(id);}
  if(!seen.size)throw new Error('A scene control selection must not be empty');
  const panels=manifest.panels??buildControlPanels(scene,[...seen]),panelIds=new Set(),panelControls=new Set();
  if(!Array.isArray(panels)||!panels.length||panels.length>30)throw new Error('Invalid control panels');
  const normalizedPanels=panels.map(panel=>{
    if(!panel||typeof panel!=='object'||Array.isArray(panel)||Object.keys(panel).some(k=>!['id','title','category','controls','advanced','help'].includes(k)))throw new Error('Invalid control panel');
    if(typeof panel.id!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(panel.id)||panelIds.has(panel.id))throw new Error('Invalid or duplicate panel id');panelIds.add(panel.id);
    if(typeof panel.title!=='string'||!panel.title.trim()||panel.title.length>50||!Object.hasOwn(controlCategories,panel.category)||!Array.isArray(panel.controls)||!panel.controls.length||(panel.advanced!==undefined&&typeof panel.advanced!=='boolean'))throw new Error('Invalid panel metadata');
    for(const id of panel.controls){if(!seen.has(id)||panelControls.has(id))throw new Error('Panel controls must use the selected controls exactly once');panelControls.add(id);}
    if(panel.help!==undefined&&(typeof panel.help!=='string'||panel.help.length>240))throw new Error('Invalid panel help');
    return {id:panel.id,title:panel.title.trim(),category:panel.category,controls:[...panel.controls],advanced:panel.advanced??false,...(panel.help?{help:panel.help}:{})};
  });
  if(panelControls.size!==seen.size)throw new Error('Every selected control needs a panel');
  if(manifest.rationale!==undefined&&(typeof manifest.rationale!=='string'||manifest.rationale.length>600))throw new Error('Invalid selection rationale');
  return {version:1,scene,controls:[...seen],panels:normalizedPanels,...(manifest.easy!==undefined?{easy:validateEasyControls(manifest.easy,getControlCatalog(scene),[...seen])}:{}),...(manifest.rationale?{rationale:manifest.rationale}:{})};
}
/** Upgrade early draft recipes that stored an empty selection before adapters existed. */
export function resolveControlManifest(manifest,scene){
  if(manifest===undefined)return createControlManifest(scene);
  if(manifest?.version===1&&manifest.scene===scene&&Array.isArray(manifest.controls)&&!manifest.controls.length)return createControlManifest(scene);
  const result=validateControlManifest(manifest,scene);
  if(!perspectiveScenes.includes(scene))return result;
  const lensIds=['fov','fovScale','fisheye','lensStrength','lensDistortion'];
  const panel=result.panels.find(panel=>panel.controls.some(id=>lensIds.includes(id)));
  if(!panel)return result;
  for(const id of ['cameraDistance','keepSubjectSize'])if(!result.controls.includes(id)){result.controls.push(id);panel.controls.push(id);}
  return validateControlManifest(result,scene);
}
