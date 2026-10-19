import {sceneConfig,sceneRegistry} from '../scene-registry.js';
import {getAnimationGroups} from './animation-groups.js';

export const editorialLimits=Object.freeze({clips:64,duration:300});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const only=(value,keys)=>Object.keys(value).every(key=>keys.includes(key));
const sceneOf=parameters=>sceneConfig(parameters.scene??'objects');

/** A portable, same-scene edit. All times are seconds; sourceEnd is exclusive. */
export function validateEditorialEdit(edit,scene){
 const cfg=sceneConfig(scene);
 if(!object(edit)||!only(edit,['version','clips'])||edit.version!==1)throw new Error('Edit must be a version 1 editorial document');
 if(!Array.isArray(edit.clips)||edit.clips.length<1||edit.clips.length>editorialLimits.clips)throw new Error('Edit must contain 1–64 clips');
 const ids=new Set();let total=0;
 const clips=edit.clips.map(clip=>{
  if(!object(clip)||!only(clip,['id','sourceStart','sourceEnd','duration']))throw new Error('Invalid editorial clip');
  if(typeof clip.id!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(clip.id)||ids.has(clip.id))throw new Error('Editorial clip IDs must be unique safe identifiers');
  ids.add(clip.id);
  const {sourceStart,sourceEnd,duration}=clip;
  if(!Number.isFinite(sourceStart)||!Number.isFinite(sourceEnd)||sourceStart<0||sourceEnd<=sourceStart||sourceEnd>cfg.duration)throw new Error(`Editorial source window must satisfy 0 <= start < end <= ${cfg.duration}`);
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Editorial clip duration must be finite and positive');
  // Reject subnormal spans/rates as well as overflow before interpolation.
  if(!Number.isFinite((sourceEnd-sourceStart)/duration)||(sourceEnd-sourceStart)/duration===0)throw new Error('Editorial clip playback rate must be finite and positive');
  const next=total+duration;if(next===total)throw new Error('Editorial clip duration is too small for this timeline');total=next;
  if(total>editorialLimits.duration)throw new Error('Editorial duration must not exceed 300 seconds');
  return {id:clip.id,sourceStart,sourceEnd,duration};
 });
 if(total<1/cfg.fps)throw new Error('Editorial duration must contain at least one authored frame');
 return {version:1,clips};
}

/** Recommended authored shot windows, initially preserving the exact film. */
export function defaultEditorialEdit(scene){
 const cfg=sceneConfig(scene),windows=getAnimationGroups(cfg.scene)[0]?.windows??[{start:0,end:cfg.duration}];
 return validateEditorialEdit({version:1,clips:windows.map(({start,end},i)=>({id:`shot-${i+1}`,sourceStart:start,sourceEnd:end,duration:end-start}))},cfg.scene);
}

export function editorialDuration(parameters={}){
 const cfg=sceneOf(parameters);
 return parameters.edit===undefined?cfg.duration:validateEditorialEdit(parameters.edit,cfg.scene).clips.reduce((sum,clip)=>sum+clip.duration,0);
}

export function isIdentityEditorialEdit(edit,scene){
 if(edit===undefined)return true;
 let offset=0;
 for(const clip of validateEditorialEdit(edit,scene).clips){
  if(clip.sourceStart!==offset||clip.duration!==clip.sourceEnd-clip.sourceStart)return false;
  offset=clip.sourceEnd;
 }
 return offset===sceneConfig(scene).duration;
}

/** Output-to-source mapping; exact boundaries enter the next clip. */
export function mapEditorialTime(time,parameters={}){
 if(!Number.isFinite(time))throw new Error('Editorial time must be finite');
 if(parameters.edit===undefined)return time;
 const clips=validateEditorialEdit(parameters.edit,sceneOf(parameters).scene).clips;
 const duration=clips.reduce((sum,clip)=>sum+clip.duration,0),t=Math.max(0,Math.min(duration,time));
 let start=0;
 for(let i=0;i<clips.length;i++){
  const clip=clips[i],end=start+clip.duration;
  if(t<end||i===clips.length-1){
   // Avoid arithmetic drift for untouched shot windows and exact endpoints.
   if(start===clip.sourceStart&&clip.duration===clip.sourceEnd-clip.sourceStart)return t;
   if(t===start)return clip.sourceStart;if(t===end)return clip.sourceEnd;
   return clip.sourceStart+(t-start)/clip.duration*(clip.sourceEnd-clip.sourceStart);
  }
  start=end;
 }
}

function sourceCuts(parameters,cfg){
 const cuts=sceneRegistry[cfg.scene].cuts??(cfg.scene==='procedural'?getAnimationGroups(cfg.scene)[0].windows.map(window=>window.start).filter(t=>t>0):parameters.motion?.cuts??[]);
 if(!Array.isArray(cuts))throw new Error('Motion cuts must be an array');
 const times=cuts.map(c=>typeof c==='number'?c:c?.time??c?.t);
 if(times.some(t=>!Number.isFinite(t)||t<0||t>cfg.duration))throw new Error('Motion cuts must be finite times within the source scene');
 return times;
}

/** Preserve authored hard cuts inside clips and add every edit boundary. */
export function editorialCuts(parameters={}){
 const cfg=sceneOf(parameters),cuts=sourceCuts(parameters,cfg);
 if(isIdentityEditorialEdit(parameters.edit,cfg.scene))return cuts;
 const edit=validateEditorialEdit(parameters.edit,cfg.scene),result=[0];let offset=0;
 for(const clip of edit.clips){
  for(const cut of cuts)if(cut>clip.sourceStart&&cut<clip.sourceEnd)result.push(offset+(cut-clip.sourceStart)/(clip.sourceEnd-clip.sourceStart)*clip.duration);
  offset+=clip.duration;result.push(offset);
 }
 return [...new Set(result)].sort((a,b)=>a-b);
}
