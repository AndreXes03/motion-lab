import * as T from 'three';
import {buildCameraProps} from '../scenes/camera-props.js';
import {buildVinylBase} from '../scenes/pulse-props.js';
import {buildHeadphones} from '../scenes/pulse-instruments.js';

/** Actual authored film models, isolated from their original timeline and scene.
 * Model geometry/materials are owned; the supplied environment is borrowed.
 * Camera construction currently also allocates its companion props offscreen.
 */
export function createFilmAsset(kind,{renderer,environment,size=3}={}) {
  if(!['camera','turntable','headphones'].includes(kind))throw Error('Unknown film asset: '+kind);
  if(!Number.isFinite(size)||size<=0)throw Error('Asset size must be positive');
  if(kind==='camera'&&!renderer)throw Error('Camera asset requires a renderer');
  let root,cleanup=()=>{},sourceRoots=[],parts={};
  if(kind==='camera'){
    const staging=new T.Scene(),props=buildCameraProps(staging,environment,renderer);
    root=props.housing;sourceRoots=[...staging.children];cleanup=()=>props.dispose();
    parts={body:root,crown:props.nameplate,leftWing:props.wings[0].pivot,rightWing:props.wings[1].pivot};
  }else{
    root=kind==='turntable'?buildVinylBase():buildHeadphones();
    sourceRoots=[root];parts={body:root};
  }
  // Legacy film builders share a few primitive geometries. Clone those once
  // per asset before attaching, so disposing one instance cannot affect another.
  const geometries=new Map(),materials=new Set(),textures=new Set();
  for(const source of sourceRoots)source.traverse(o=>{
    if(o.geometry){if(!geometries.has(o.geometry))geometries.set(o.geometry,o.geometry.clone());o.geometry=geometries.get(o.geometry);}
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);if(environment&&!m.envMap&&m.isMeshStandardMaterial)m.envMap=environment;for(const v of Object.values(m))if(v?.isTexture&&v!==environment)textures.add(v);}
  });
  root.removeFromParent();root.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(root),extent=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const group=new T.Group();group.name='asset.'+kind;root.position.sub(center);group.add(root);group.scale.setScalar(size/Math.max(extent.x,extent.y,extent.z));
  let disposed=false;
  return {root:group,parts,dispose(){if(disposed)return;disposed=true;group.removeFromParent();cleanup();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
