import {easeProgress} from './parameter-animation.js';
/** Absolute keyframes. Values are scalar or vectors; no accumulated state. */
export function sampleTrack(keys,t,amount=1){
 if(!Array.isArray(keys)||!keys.length)throw new Error('An animation track needs at least one key');
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[Math.min(i+1,keys.length-1)];const u=b.t===a.t?0:easeProgress((t-a.t)/(b.t-a.t),a.ease??'smooth',a.bezier);
 const blend=(x,y,base)=>base+((x+(y-x)*u)-base)*amount;
 return Array.isArray(a.value)?a.value.map((x,j)=>blend(x,b.value[j],keys[0].value[j])):blend(a.value,b.value,keys[0].value);
}
export function applyTracks(scene,camera,motion,time,amount=1,timeForTarget){
 let lookTarget=null,roll=0;
 for(const [target,keys] of Object.entries(motion.tracks)){
  const value=sampleTrack(keys,timeForTarget?timeForTarget(target,time):time,amount);
  if(target==='camera.target'){lookTarget=value;continue}
  if(target==='camera.roll'){roll=value;continue}
  if(target==='camera.position'){camera.position.set(...value);continue}
  const axis=target.endsWith('.z')?'z':null;
  const suffix=axis?'.rotation.z':target.endsWith('.rotation')?'.rotation':'.position';
  const object=scene.getObjectByName(target.slice(0,-suffix.length));if(!object)throw new Error(`Unknown animation target: ${target}`);
  if(axis)object.rotation.z=value;else object[suffix.slice(1)].set(...value);
 }
 if(lookTarget)camera.lookAt(...lookTarget);camera.rotateZ(roll);
}
