import defaultMotion from '../../project/motion.json' with {type:'json'};
import {sceneRegistry} from '../scene-registry.js';
import {getAnimationGroups} from './animation-groups.js';
import {assertSafeControlDocument} from './control-catalog.js';

const axes=['x','y','z'];
const names={'camera.position':'Camera position','camera.target':'Look target','camera.roll':'Camera roll','device.root.position':'Radio position','device.root.rotation':'Radio rotation','dial.rotor.rotation.z':'Dial rotation','bax.kinetic.position':'Gyro position','bax.kinetic.rotation':'Gyro rotation','bax.emblem.position':'Emblem position','bax.emblem.rotation':'Emblem rotation','bax.cover.hinge.rotation.z':'Cover rotation'};
function assertGroup(scene,groupId){
 if(!getAnimationGroups(scene).some(group=>group.id===groupId))throw new Error(`Unknown authored animation group: ${scene}/${groupId}`);
}
function baxGroup(target){
 if(target.startsWith('camera.'))return 'camera';
 if(target.startsWith('bax.gyro.')||target.startsWith('bax.kinetic'))return 'gyro';
 if(target.startsWith('bax.emblem')||target.startsWith('bax.cover.'))return 'emblem';
 return 'radio';
}
function keyCopy(key,value){
 return{t:key.t,value,ease:key.ease??'smooth',...(key.bezier?{bezier:[...key.bezier]}:{})};
}

/** Native source keys, independent of editable timing curves and additive controls.
 * Function-authored scenes must supply evaluated samples; no approximate keys are invented.
 */
export function getAuthoredAnimationTracks(scene,groupId,{motion=defaultMotion}={}){
 assertGroup(scene,groupId);
 if(scene!=='bax')return [];
 assertSafeControlDocument(motion);
 if(!motion?.tracks||typeof motion.tracks!=='object'||Array.isArray(motion.tracks))throw new Error('Authored motion must contain tracks');
 const tracks=[];
 for(const [target,keys]of Object.entries(motion.tracks)){
  if(baxGroup(target)!==groupId)continue;
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
   keys:keys.map(key=>keyCopy(key,vector?key.value[index]:key.value)),
   description:'Native authored channel. Added timing curves and parameter edits are displayed separately.'
  });
 }
 return tracks;
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
  keys:frames.map(frame=>({t:frame.t,value:frame.values[channel.id],ease:'linear'})),
  description:'Actual evaluated pose samples. Linear display joins do not alter the authored scene or add easing.'
 }));
}
