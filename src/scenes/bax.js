import {createBrandTexture} from '../components/brand.js';
import * as T from 'three';
import {createStudio} from '../engine/studio.js';
import {applyTracks,sampleTrack} from '../engine/animation.js';
import motion from '../../project/motion.json';
import {createDevice} from '../components/device.js';
import {createBaxEmblem} from '../components/bax-emblem.js';
import {createBaxKinetic} from '../components/bax-kinetic.js';
import {createLedSign} from '../components/led-sign.js';
import {clamp,smooth} from '../engine/timeline.js';
export function createScene(renderer,config){
 const studio=createStudio(renderer,{top:'#247ac5',bottom:'#c5d6e2'});const {scene}=studio;
 const brand=createBrandTexture({color:'#112438'});
 const camera=new T.PerspectiveCamera(60,16/9,.1,100);
 const device=createDevice({...config,text:{...config.text,display:'BAX'},deviceBrand:'B A X  S T U D I O'});device.group.scale.setScalar(.68);scene.add(device.group);
 for(const o of [...device.group.children])if(o.name.startsWith('cable.'))o.visible=false;
 const plush=createBaxEmblem();scene.add(plush);
 const keys=createBaxKinetic();keys.scale.setScalar(.83);scene.add(keys);
 const sign=createLedSign({width:3.0,height:1.3});sign.root.position.set(-1.2,3.0,-3.0);scene.add(sign.root);
 function update(time,parameters={}){
 const t=clamp(time,0,config.duration),look=parameters.look;studio.applyLook(look);camera.fov=look.camera.fov;camera.updateProjectionMatrix();
 const activeMotion=parameters.motion||motion;
 applyTracks(scene,camera,activeMotion,t,look.motion.amount);
 // Energy affects object tracks only. Camera tracks keep the authored look.
 const objectMotion=Number.isFinite(parameters.objectMotion)?clamp(parameters.objectMotion,0,1.8):look.motion.amount;
 if(parameters.objectMotion!==undefined)for(const [target,keys] of Object.entries(activeMotion.tracks)){
  if(target.startsWith('camera.'))continue;
  const rotationZ=target.endsWith('.rotation.z');
  const suffix=rotationZ?'.rotation.z':target.endsWith('.rotation')?'.rotation':'.position';
  const object=scene.getObjectByName(target.slice(0,-suffix.length));
  if(!object)throw new Error(`Unknown object motion target: ${target}`);
  const sampled=sampleTrack(keys,t,objectMotion);
  if(rotationZ)object.rotation.z=sampled;else object[suffix.slice(1)].set(...sampled);
 }
 device.plastic.color.set(parameters.shell||config.palette.shell);device.plastic.roughness=look.surface.shellRoughness;device.plastic.bumpScale=look.surface.grainScale;device.orange.color.set(parameters.knob||config.palette.knob);
 device.setDisplay(parameters.display??(t<1.15?'MAKE.':t<2.2?'PLAY.':'BAX.'));
 sign.setText(t<7.5?'IDEAS\nIN PLAY.':'@brand');
 plush.userData.update?.(t,{amount:objectMotion});
 keys.userData.update?.(t,{motion:activeMotion,amount:objectMotion});
 const roots=[device.group,plush,keys,sign.root];for(const root of roots)root.visible=true;
 if(parameters.inspect){
  const chosen=scene.getObjectByName(parameters.inspect.object);if(!chosen)throw new Error('Unknown inspection object');
  roots.forEach(root=>root.visible=root===chosen);
  chosen.updateWorldMatrix(true,true);const box=new T.Box3();chosen.traverseVisible(o=>{if(o.geometry){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  const yaw=(parameters.inspect.yaw??20)*Math.PI/180, distance=Math.max(size.y,size.x/camera.aspect)*1.8;
  camera.fov=40;camera.updateProjectionMatrix();camera.position.set(center.x+Math.sin(yaw)*distance,center.y+.2,center.z+Math.cos(yaw)*distance);camera.lookAt(center);
 }
 return t;
 }
 function drawOverlay(ctx,t){ctx.drawImage(brand.image,1590,42,252,252/brand.userData.aspect);}
 return {scene,camera,update,drawOverlay};
}
