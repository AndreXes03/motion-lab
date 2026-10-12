import {sceneRegistry} from '../scene-registry.js';
import {sampleParameterTrack} from './parameter-animation.js';
import {clamp} from './timeline.js';

const groupDefinitions={
  bax:[['camera','Camera','Camera position, target and roll.'],['radio','Radio','Radio assembly and rotary controls.'],['gyro','Gyro','Gyro assembly and its constrained mechanism.'],['emblem','Emblem','Emblem assembly and cover mechanism.']],
  pulse:[['camera','Camera','Lens choreography within an authored shot.'],['mechanisms','Mechanisms','Speaker, record, connector and device movement.']],
  camera:[['camera','Camera','Camera flight within an authored shot.'],['city','City vehicles','Vehicle and fan motion independent of camera flight.']],
  starter:[['camera','Camera','Product camera travel.'],['product','Product','Product assembly, impact and rotary controls.']],
  dot:[['camera','Camera','Camera framing and movement.'],['character','Character','Character movement and performance.']],
  replay:[['camera','Camera','Editorial camera movement.'],['cards','Cards','Card and paper animation.']],
  pop:[['camera','Camera','Camera movement through the composition.'],['lettering','Lettering & player','Lettering and player motion.']],
  procedural:[['graphics','Graphics','Procedural shape and lettering movement.']]
};
const fallbackCuts={bax:[0,2.2,4.5,7.5,10],pop:[0,2.5,5,7.5,10],procedural:[0,20/11,40/11,60/11,80/11,100/11,10]};

/** Discover scene-owned animation groups and recommended shot windows. */
export function getAnimationGroups(scene) {
  if (!Object.prototype.hasOwnProperty.call(groupDefinitions,scene)) throw new Error(`Unknown animation group scene: ${scene}`);
  const duration=sceneRegistry[scene].duration;
  const cuts=[...new Set([0,...(sceneRegistry[scene].cuts??fallbackCuts[scene]??[]),duration])].filter(t=>t>=0&&t<=duration).sort((a,b)=>a-b);
  const windows=cuts.slice(0,-1).map((start,index)=>({label:`Shot ${index+1}`,start,end:cuts[index+1]}));
  return groupDefinitions[scene].map(([id,label,description])=>({id,label,description,...(scene==='camera'&&id==='city'?{preferredWindow:{start:2.4,end:4.4}}:{}),windows:windows.map(window=>({...window}))}));
}

/** Map this group's pose clock only; film time, cuts and other groups stay fixed. */
export function sampleAnimationGroupTime(parameters,groupId,outputTime) {
  const animation=parameters?.animation,group=animation?.groups?.[groupId];
  if (!animation || animation.enabled===false || !group || outputTime<group.start || outputTime>group.end) return outputTime;
  const duration=group.end-group.start,rate=group.rate??1;
  const keys=group.keys.some(key=>key.ease===undefined)?group.keys.map(key=>({...key,ease:key.ease??'linear'})):group.keys;
  const progress=sampleParameterTrack(keys,clamp((outputTime-group.start)*rate,0,duration));
  const sourceTime=group.start+clamp(progress)*duration;
  // Identity curves retain the exact authored timestamp, avoiding round-trip drift.
  return Math.abs(sourceTime-outputTime)<1e-10?outputTime:sourceTime;
}
