import defaultMotion from '../../project/motion.json' with {type:'json'};
import {sceneRegistry} from '../scene-registry.js';
import {getAnimationGroups} from './animation-groups.js';
import {assertSafeControlDocument} from './control-catalog.js';
import {parameterEasings,easeProgress,validateParameterAnimation} from './parameter-animation.js';

const axes=['x','y','z'];
const names={'camera.position':'Camera position','camera.target':'Look target','camera.roll':'Camera roll','device.root.position':'Radio position','device.root.rotation':'Radio rotation','dial.rotor.rotation.z':'Dial rotation','objects.kinetic.position':'Gyro position','objects.kinetic.rotation':'Gyro rotation','objects.emblem.position':'Emblem position','objects.emblem.rotation':'Emblem rotation','objects.cover.hinge.rotation.z':'Cover rotation'};
function assertGroup(scene,groupId){
 if(!getAnimationGroups(scene).some(group=>group.id===groupId))throw new Error(`Unknown authored animation group: ${scene}/${groupId}`);
}
function objectsGroup(target){
 if(target.startsWith('camera.'))return 'camera';
 if(target.startsWith('objects.gyro.')||target.startsWith('objects.kinetic'))return 'gyro';
 if(target.startsWith('objects.emblem')||target.startsWith('objects.cover.'))return 'emblem';
 return 'radio';
}
function keyCopy(key,value){
 return{t:key.t,value,ease:key.ease??'smooth',...(key.bezier?{bezier:[...key.bezier]}:{})};
}

/** Shared source-key validation for the renderer recipe, editor and agent bridge.
 * Reading does not normalize keys: omitted easing remains the authored smooth default.
 */
export function validateAuthoredMotion(motion,{allowedTracks=new Set(Object.keys(defaultMotion.tracks)),duration=sceneRegistry.objects.duration,cutDuration=duration}={}){
 assertSafeControlDocument(motion);
 if(!motion||typeof motion!=='object'||Array.isArray(motion)||!motion.tracks||typeof motion.tracks!=='object'||Array.isArray(motion.tracks))throw new Error('motion must be an object with a tracks map');
 if(Object.keys(motion).some(key=>!['name','cuts','tracks'].includes(key)))throw new Error('motion contains unsupported fields');
 if(motion.name!==undefined&&typeof motion.name!=='string')throw new Error('motion.name must be text');
 if(motion.cuts!==undefined){
  if(!Array.isArray(motion.cuts)||motion.cuts.length>1000)throw new Error('motion.cuts must contain at most 1000 cut times');
  for(const cut of motion.cuts){const time=typeof cut==='number'?cut:cut?.time??cut?.t;if(!Number.isFinite(time)||time<0||time>cutDuration)throw new Error(`Every motion cut must be a finite time from 0 to ${cutDuration} seconds`);}
 }
 const entries=Object.entries(motion.tracks);
 if(entries.length>100)throw new Error('motion has too many tracks');
 for(const [target,keys]of entries){
  if(!allowedTracks.has(target))throw new Error(`Unsupported motion track: ${target}`);
  if(!Array.isArray(keys)||!keys.length||keys.length>1000)throw new Error(`Invalid motion track: ${target}`);
  const vector=!target.endsWith('.z')&&target!=='camera.roll';let previous=-1;
  for(const key of keys){
   if(!key||typeof key!=='object'||Array.isArray(key)||Object.keys(key).some(k=>!['t','value','ease','bezier'].includes(k)))throw new Error(`Invalid key in motion track ${target}`);
   if(!Number.isFinite(key.t)||key.t<0||key.t>duration||key.t<=previous)throw new Error(`Authored key times must increase within scene duration: ${target}`);
   previous=key.t;
   if(vector?(!Array.isArray(key.value)||key.value.length!==3||!key.value.every(Number.isFinite)):!Number.isFinite(key.value))throw new Error(`Invalid value in motion track ${target}`);
   const ease=key.ease??'smooth';
   if(!parameterEasings.includes(ease))throw new Error(`Invalid easing in motion track ${target}`);
   if(key.bezier!==undefined&&ease!=='bezier')throw new Error(`Bezier values require bezier easing: ${target}`);
   if(ease==='bezier')easeProgress(.5,ease,key.bezier);
  }
 }
 return motion;
}

/** Native source keys, independent of editable timing curves and additive controls.
 * Function-authored scenes must supply evaluated samples; no approximate keys are invented.
 */
export function getAuthoredAnimationTracks(scene,groupId,{motion=defaultMotion}={}){
 assertGroup(scene,groupId);
 if(scene!=='objects')return [];
 validateAuthoredMotion(motion);
 const tracks=[];
 for(const [target,keys]of Object.entries(motion.tracks)){
  if(objectsGroup(target)!==groupId)continue;
  if(!Array.isArray(keys)||!keys.length)throw new Error(`Missing authored keys: ${target}`);
  const vector=Array.isArray(keys[0].value),count=vector?keys[0].value.length:1;
  if(vector&&count!==3)throw new Error(`Unsupported authored vector: ${target}`);
  let previous=-1;
  for(const key of keys){
   if(!Number.isFinite(key.t)||key.t<0||key.t>sceneRegistry[scene].duration||key.t<=previous)throw new Error(`Invalid authored key times: ${target}`);
   previous=key.t;
   if(vector?(!Array.isArray(key.value)||key.value.length!==count||!key.value.every(Number.isFinite)):!Number.isFinite(key.value))throw new Error(`Invalid authored values: ${target}`);
  }
  const unit=target.includes('rotation')||target==='camera.roll'?'rad':'scene units';
  for(let index=0;index<count;index++)tracks.push({
   id:vector?`${target}.${axes[index]}`:target,
   label:(names[target]??target)+(vector?` ${axes[index].toUpperCase()}`:''),unit,source:'keys',
   editable:true,timeDomain:'scene-seconds',easingOwner:'outgoing-key',sharedTiming:vector,
   binding:{kind:'native-motion',track:target,component:vector?index:null,path:['motion','tracks',target]},
   keys:keys.map(key=>keyCopy(key,vector?key.value[index]:key.value)),
   description:vector?'Native source keys. Value edits affect this axis; time and outgoing easing are shared by X, Y and Z. Timing overrides are separate.':'Native source keys. Time and outgoing easing are editable; timing overrides are separate.'
  });
 }
 return tracks;
}

/** Edit one existing source key without inventing a retiming curve or touching other tracks.
 * A vector track has one shared clock/easing and three values. This is exposed in
 * its descriptor, never silently presented as three independently timed tracks.
 */
export function editAuthoredKey(scene,groupId,channelId,keyIndex,patch,{motion=defaultMotion}={}){
 const track=getAuthoredAnimationTracks(scene,groupId,{motion}).find(track=>track.id===channelId);
 if(!track?.editable)throw new Error(`Authored channel is not editable: ${scene}/${channelId}`);
 assertSafeControlDocument(patch);
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||Object.keys(patch).some(key=>!['t','value','ease','bezier'].includes(key)))throw new Error('Invalid authored key patch');
 if(!Number.isInteger(keyIndex)||keyIndex<0||keyIndex>=track.keys.length)throw new Error('Invalid authored key index');
 const result=structuredClone(motion),key=result.tracks[track.binding.track][keyIndex];
 if(Object.hasOwn(patch,'t'))key.t=patch.t;
 if(Object.hasOwn(patch,'value')){
  if(!Number.isFinite(patch.value))throw new Error('Authored channel value must be finite');
  if(track.binding.component===null)key.value=patch.value;else key.value[track.binding.component]=patch.value;
 }
 if(Object.hasOwn(patch,'ease')){key.ease=patch.ease;if(patch.ease!=='bezier')delete key.bezier;}
 if(Object.hasOwn(patch,'bezier'))key.bezier=structuredClone(patch.bezier);
 validateAuthoredMotion(result);
 return result;
}

/** Apply a multi-key gesture atomically so shared vector clocks remain valid. */
export function editAuthoredKeys(scene, groupId, channelId, patches, {motion = defaultMotion} = {}) {
 const track = getAuthoredAnimationTracks(scene, groupId, {motion}).find(track => track.id === channelId);
 if (!track?.editable || !Array.isArray(patches) || !patches.length) throw Error('Invalid source selection');
 const result = structuredClone(motion);
 for (const {index, t, value} of patches) {
  if (!Number.isInteger(index) || !track.keys[index] || !Number.isFinite(t) || !Number.isFinite(value)) throw Error('Invalid source key');
  const key = result.tracks[track.binding.track][index]; key.t = t;
  if (track.binding.component === null) key.value = value; else key.value[track.binding.component] = value;
 }
 validateAuthoredMotion(result); return result;
}

/** Machine-readable contract for agents. This is a view of the existing recipe,
 * not a second save format. Native source keys and timing overrides stay distinct.
 */
export function getAuthoredAnimationProtocol(scene,{motion=defaultMotion,animation}={}){
 const groups=getAnimationGroups(scene),normalized=animation===undefined?undefined:validateParameterAnimation(animation,scene);
 return {
  version:1,scene,recipePaths:{source:['motion','tracks'],groupTiming:['animation','groups'],parameterTracks:['animation','tracks']},
  interpolation:{owner:'outgoing-key',defaultNative:'smooth',defaultGroup:'linear',easings:[...parameterEasings],smooth:'6u^5 - 15u^4 + 10u^3',bezier:'Normalized cubic Bezier; invert x before evaluating y. Four control values in [0,1].',hold:'Keep the left value until the next key time.'},
  groups:groups.map(group=>({...group,timeDomain:'clip-local-seconds',progressRange:[0,1],timing:normalized?.groups[group.id]??null,
   source:{timeDomain:'scene-seconds',channels:getAuthoredAnimationTracks(scene,group.id,{motion}),availability:scene==='objects'?'native-keys':'evaluated-samples',editable:scene==='objects'}})),
  parameterTracks:{timeDomain:'scene-seconds',sampling:'scene time multiplied by the per-track rate',tracks:normalized?.tracks??{},rates:normalized?.rates??{}},
  instructions:'Inspect the source curve before editing. A linear group progress curve means no retiming; it does not describe the source movement. Sampled function curves are read-only observations. Save native edits in parameters.motion; save retiming separately in parameters.animation.'
 };
}

/** Descriptors for actual evaluated camera transforms captured by the runtime. */
export function getAuthoredCameraChannels(){
 return[
  ...axes.map(axis=>({id:`camera.position.${axis}`,label:`Camera position ${axis.toUpperCase()}`,unit:'scene units'})),
  ...axes.map(axis=>({id:`camera.rotation.${axis}`,label:`Camera rotation ${axis.toUpperCase()}`,unit:'rad'})),
  {id:'camera.fov',label:'Camera field of view',unit:'deg'}
 ];
}

/** Convert real absolute-time pose observations into read-only scalar curves.
 * Frames: [{t:sceneSeconds,values:{channelId:number}}]. Linear joins are only
 * display interpolation of observations, never extra easing or renderer input.
 */
export function buildSampledAuthoredTracks(scene,groupId,frames,channels){
 assertGroup(scene,groupId);assertSafeControlDocument(frames);assertSafeControlDocument(channels);
 if(!Array.isArray(frames)||!Array.isArray(channels))throw new Error('Authored samples and channels must be arrays');
 if(!frames.length||!channels.length)return [];
 if(frames.length>1000||channels.length>100)throw new Error('Authored sample inspection is too large');
 const seen=new Set();
 for(const channel of channels){
  if(!channel||typeof channel.id!=='string'||!channel.id||typeof channel.label!=='string'||!channel.label.trim()||seen.has(channel.id))throw new Error('Invalid authored channel descriptor');
  if(channel.unit!==undefined&&typeof channel.unit!=='string')throw new Error('Invalid authored channel unit');
  seen.add(channel.id);
 }
 let previous=-1;
 for(const frame of frames){
  if(!frame||!Number.isFinite(frame.t)||frame.t<0||frame.t>sceneRegistry[scene].duration||frame.t<=previous)throw new Error('Authored sample times must increase within scene duration');
  previous=frame.t;
  if(!frame.values||typeof frame.values!=='object'||Array.isArray(frame.values))throw new Error('Authored sample values must be an object');
  for(const channel of channels)if(!Object.prototype.hasOwnProperty.call(frame.values,channel.id)||!Number.isFinite(frame.values[channel.id]))throw new Error(`Missing actual authored sample: ${channel.id}`);
 }
 return channels.map(channel=>({
  id:channel.id,label:channel.label,...(channel.unit?{unit:channel.unit}:{}),source:'samples',
  editable:false,timeDomain:'scene-seconds',interpolation:'observed-linear',easingOwner:null,
  keys:frames.map(frame=>({t:frame.t,value:frame.values[channel.id],ease:'linear'})),
  description:'Actual evaluated pose samples. Linear display joins do not alter the authored scene or add easing.'
 }));
}
