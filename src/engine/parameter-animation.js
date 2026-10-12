import {getControlCatalog,writeControlValue,assertSafeControlDocument} from './control-catalog.js';
import {getAnimationGroups} from './animation-groups.js';
import {sceneRegistry} from '../scene-registry.js';
import {clamp,smooth} from './timeline.js';

export const parameterEasings = ['smooth','linear','hold','in','out','inOut','bezier'];
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const validBezier = curve => Array.isArray(curve) && curve.length === 4 && curve.every(Number.isFinite) && curve.every(value => value >= 0 && value <= 1);
const cubic = (t,a,b) => 3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;

/** Cubic curves invert x before sampling y; all easings retain finite endpoints. */
export function easeProgress(u, ease = 'smooth', bezier) {
  u = Number.isFinite(u) ? clamp(u) : 0;
  if (u === 0 || u === 1) return u;
  switch (ease) {
    case 'linear': return u;
    case 'hold': return 0;
    case 'in': return u*u*u;
    case 'out': return 1-(1-u)**3;
    case 'inOut': return u < .5 ? 4*u*u*u : 1-(-2*u+2)**3/2;
    case 'bezier': {
      if (!validBezier(bezier)) throw new Error('Bezier easing needs four values between zero and one');
      let lo=0,hi=1;
      for (let i=0;i<40;i++) {const middle=(lo+hi)/2;if(cubic(middle,bezier[0],bezier[2]) < u)lo=middle;else hi=middle;}
      return cubic((lo+hi)/2,bezier[1],bezier[3]);
    }
    case 'smooth': return smooth(u);
    default: throw new Error(`Unknown easing: ${ease}`);
  }
}

/** Each key controls the easing leaving that key. Sampling has no accumulated state. */
export function sampleParameterTrack(keys,time) {
  if (!Array.isArray(keys) || !keys.length) throw new Error('An animation track needs at least one key');
  if (time <= keys[0].t) return keys[0].value;
  if (time >= keys.at(-1).t) return keys.at(-1).value;
  let i=0;
  while(i < keys.length-2 && time >= keys[i+1].t)i++;
  const a=keys[i],b=keys[i+1],u=easeProgress((time-a.t)/(b.t-a.t),a.ease ?? 'smooth',a.bezier);
  return a.value+(b.value-a.value)*u;
}

export function validateParameterAnimation(animation,scene) {
  const catalog=getControlCatalog(scene),definitions=new Map(catalog.map(control => [control.id,control]));
  assertSafeControlDocument(animation);
  if (!animation || typeof animation !== 'object' || Array.isArray(animation) || Object.keys(animation).some(key => !['version','enabled','rate','tracks','rates','groups'].includes(key))) throw new Error('Invalid parameter animation');
  if (animation.version !== 1) throw new Error('Unsupported parameter animation version');
  const enabled=animation.enabled===undefined?true:animation.enabled,legacyRate=animation.rate===undefined?1:animation.rate;
  if (typeof enabled !== 'boolean') throw new Error('Animation enabled must be a boolean');
  if (!Number.isFinite(legacyRate) || legacyRate < .25 || legacyRate > 2.5) throw new Error('Animation rate must be between 0.25 and 2.5');
  const inputTracks=animation.tracks===undefined?{}:animation.tracks;
  if (!inputTracks || typeof inputTracks !== 'object' || Array.isArray(inputTracks)) throw new Error('Animation tracks must be an object');
  if (Object.keys(inputTracks).length > 100) throw new Error('Animation has too many tracks');
  const tracks={};let keyCount=0;
  for (const [id,keys] of Object.entries(inputTracks)) {
    const definition=definitions.get(id);
    if (!definition?.animatable || definition.type !== 'range') throw new Error(`Control cannot be animated: ${id}`);
    if (!Array.isArray(keys) || !keys.length || (keyCount += keys.length) > 1000) throw new Error('Animation must contain 1–1000 keys');
    let previous=-1;
    tracks[id]=keys.map(key => {
      if (!key || typeof key !== 'object' || Array.isArray(key) || Object.keys(key).some(name => !['t','value','ease','bezier'].includes(name))) throw new Error(`Invalid animation key: ${id}`);
      if (!Number.isFinite(key.t) || key.t < 0 || key.t > sceneRegistry[scene].duration || key.t <= previous) throw new Error(`Animation times must increase within scene duration: ${id}`);
      previous=key.t;
      if (!Number.isFinite(key.value) || key.value < definition.min || key.value > definition.max) throw new Error(`Animation value is outside control bounds: ${id}`);
      const ease=key.ease ?? 'smooth';
      if (!parameterEasings.includes(ease)) throw new Error(`Unknown animation easing: ${ease}`);
      if (ease === 'bezier' && !validBezier(key.bezier)) throw new Error(`Invalid animation bezier: ${id}`);
      if (key.bezier !== undefined && (ease !== 'bezier' || !validBezier(key.bezier))) throw new Error(`Bezier values require bezier easing: ${id}`);
      return {t:key.t,value:key.value,ease,...(ease === 'bezier' ? {bezier:[...key.bezier]} : {})};
    });
  }
  const inputRates=animation.rates===undefined?{}:animation.rates,rates={};
  if (!inputRates || typeof inputRates !== 'object' || Array.isArray(inputRates)) throw new Error('Animation rates must be an object');
  for (const [id,rate] of Object.entries(inputRates)) {
    if (!own(tracks,id)) throw new Error(`Animation rate requires a parameter track: ${id}`);
    if (!Number.isFinite(rate) || rate < .25 || rate > 2.5) throw new Error('Parameter rate must be between 0.25 and 2.5');
    rates[id]=rate;
  }
  for (const id of Object.keys(tracks)) rates[id]??=legacyRate;
  const inputGroups=animation.groups===undefined?{}:animation.groups,groups={},allowedGroups=new Set(getAnimationGroups(scene).map(group=>group.id));
  if (!inputGroups || typeof inputGroups !== 'object' || Array.isArray(inputGroups)) throw new Error('Animation groups must be an object');
  for (const [id,group] of Object.entries(inputGroups)) {
    if (!allowedGroups.has(id)) throw new Error(`Unknown animation group: ${id}`);
    if (!group || typeof group !== 'object' || Array.isArray(group) || Object.keys(group).some(key=>!['start','end','rate','keys'].includes(key))) throw new Error(`Invalid animation group: ${id}`);
    const {start,end}=group,rate=group.rate===undefined?1:group.rate;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start<0 || end<=start || end>sceneRegistry[scene].duration) throw new Error(`Invalid animation group window: ${id}`);
    if (!Number.isFinite(rate) || rate<.25 || rate>2.5) throw new Error('Group rate must be between 0.25 and 2.5');
    if (!Array.isArray(group.keys) || !group.keys.length || (keyCount+=group.keys.length)>1000) throw new Error('Animation must contain 1–1000 total keys');
    let previous=-1;
    const keys=group.keys.map(key=>{
      if (!key || typeof key!=='object' || Array.isArray(key) || Object.keys(key).some(name=>!['t','value','ease','bezier'].includes(name))) throw new Error(`Invalid animation group key: ${id}`);
      if (!Number.isFinite(key.t) || key.t<0 || key.t>end-start+1e-9 || key.t<=previous) throw new Error(`Group key times must increase within the local window: ${id}`);
      const localTime=Math.min(key.t,end-start);
      if(localTime<=previous)throw new Error(`Group key times must increase within the local window: ${id}`);
      previous=localTime;
      if (!Number.isFinite(key.value) || key.value<0 || key.value>1) throw new Error(`Group progress must be between zero and one: ${id}`);
      const ease=key.ease??'linear';
      if (!parameterEasings.includes(ease)) throw new Error(`Unknown animation easing: ${ease}`);
      if (ease==='bezier' && !validBezier(key.bezier)) throw new Error(`Invalid animation bezier: ${id}`);
      if (key.bezier!==undefined && (ease!=='bezier' || !validBezier(key.bezier))) throw new Error(`Bezier values require bezier easing: ${id}`);
      return {t:localTime,value:key.value,ease,...(ease==='bezier'?{bezier:[...key.bezier]}:{})};
    });
    groups[id]={start,end,rate,keys};
  }
  // Old global rate controls only migrate to parameter tracks, never film/group clocks.
  return {version:1,enabled,rate:1,tracks,rates,groups};
}

/** Apply absolute parameter tracks to a clone; a disabled animation is a no-op. */
export function evaluateParameterAnimation(parameters,time) {
  const animation=parameters?.animation;
  if (!animation || animation.enabled === false) return parameters;
  const scene=parameters.scene;
  if (typeof scene !== 'string' || !own(sceneRegistry,scene)) throw new Error(`Unknown animation scene: ${scene}`);
  if (!Number.isFinite(time)) throw new Error('Animation time must be finite');
  const normalized=validateParameterAnimation(animation,scene);
  const definitions=new Map(getControlCatalog(scene).map(control => [control.id,control]));
  if (!Object.keys(normalized.tracks).length) return parameters;
  const result=structuredClone(parameters);result.animation=normalized;
  for (const [id,keys] of Object.entries(normalized.tracks)) {
    const definition=definitions.get(id),sampledTime=clamp(time*normalized.rates[id],0,sceneRegistry[scene].duration);let value=sampleParameterTrack(keys,sampledTime);
    if (Number.isInteger(definition.step)) value=Math.round(value);
    writeControlValue(result,definition,clamp(value,definition.min,definition.max));
  }
  return result;
}
