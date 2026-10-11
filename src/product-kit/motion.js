import * as T from 'three';
import {createCameraPath} from '../engine/camera-path.js';
const clamp = value => Math.max(0, Math.min(1, value));
const finite = (...values) => values.every(Number.isFinite);

// Offset from an assembled seat. Recoil remains on the outward side of contact.
export function createImpactMotion({start=0,hit=1,end=1.4,travel=1,power=5,recoil=.055,decay=5,bounces=2}={}) {
  if (!finite(start,hit,end,travel,power,recoil,decay,bounces) || start>=hit || hit>=end || travel<0 || power<1 || recoil<0 || recoil>1 || decay<0 || bounces<1) throw Error('Invalid impact timing or travel');
  return time => {
    if (!Number.isFinite(time)) throw Error('Impact time must be finite');
    if (time<=hit) return travel*(1-clamp((time-start)/(hit-start))**power);
    if (time>=end) return 0;
    const q=(time-hit)/(end-hit);
    return travel*recoil*Math.exp(-decay*q)*Math.abs(Math.sin(Math.PI*bounces*q))*(1-q)**2;
  };
}

// Absolute-time camera move; no accumulating transforms, including bank.
export function createProductCameraMove({points,target,start=0,duration=4,power=1,pace='linear',fov=65,bank=0,lookAhead=.5}={}) {
  if (!finite(start,duration,power,fov,bank) || duration<=0 || power<1 || fov<=0 || fov>=150 || !['linear','accelerate','decelerate'].includes(pace)) throw Error('Invalid camera move');
  if (target && (!Array.isArray(target) || target.length!==3 || !finite(...target))) throw Error('Target needs three finite coordinates');
  const path=createCameraPath(points,{duration,lookAhead});
  const aim=target?new T.Vector3(...target):null;
  function sample(time) {
    if (!Number.isFinite(time)) throw Error('Camera time must be finite');
    const q=clamp((time-start)/duration);
    const progress=pace==='accelerate'?q**power:pace==='decelerate'?1-(1-q)**power:q;
    const pose=path.sample(progress*duration);
    return {...pose,target:aim?.clone()??pose.target,fov,bank:bank*Math.sin(q*Math.PI)};
  }
  return {sample,apply(camera,time){const pose=sample(time);camera.position.copy(pose.position);camera.up.set(0,1,0);camera.lookAt(pose.target);camera.rotateZ(pose.bank);camera.fov=pose.fov;camera.updateProjectionMatrix();return pose;}};
}
