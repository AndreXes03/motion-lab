import * as T from 'three';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
import defaultLook from '../../project/look.json';

/** Small, self-contained 3D study for the web trial. No textures, shadows or post passes. */
export function createDemoRuntime(canvas) {
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene();scene.background=new T.Color('#202826');
 const camera=new T.PerspectiveCamera(48,16/9,.1,50),root=new T.Group();scene.add(root);root.scale.setScalar(1.3);
 const shell=new T.MeshStandardMaterial({color:'#d2d3c8',roughness:.48}),accent=new T.MeshStandardMaterial({color:'#d7f56b',roughness:.32}),dark=new T.MeshStandardMaterial({color:'#273630',roughness:.5});
 const body=new T.Mesh(new T.CylinderGeometry(1.18,1.18,.45,40),shell);body.rotation.x=Math.PI/2;root.add(body);
 const face=new T.Mesh(new T.CylinderGeometry(.98,.98,.12,40),dark);face.rotation.x=Math.PI/2;face.position.z=.28;root.add(face);
 const ring=new T.Mesh(new T.TorusGeometry(.77,.07,10,40),accent);ring.position.z=.37;root.add(ring);
 const dial=new T.Group();dial.position.z=.42;root.add(dial);const knob=new T.Mesh(new T.CylinderGeometry(.49,.49,.24,32),accent);knob.rotation.x=Math.PI/2;dial.add(knob);
 const mark=new T.Mesh(new T.BoxGeometry(.055,.2,.03),dark);mark.position.set(0,.3,.14);dial.add(mark);
 const ground=new T.Mesh(new T.CircleGeometry(7,48),new T.MeshStandardMaterial({color:'#303a33',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-1.6;scene.add(ground);
 const key=new T.DirectionalLight('#fff8e3',3.3);key.position.set(-3,4,5);const fill=new T.HemisphereLight('#dce7ff','#47563c',1.8);scene.add(key,fill);
 const pose=(group,time,parameters={})=>{
  const t=sampleAnimationGroupTime(parameters,group,time);
  return group==='camera'?{'camera.position.x':Math.sin(t*.5)*1.8,'camera.position.y':.75+Math.sin(t*.3)*.18,'camera.position.z':4.7}: {'product.rotation.y':-.2+Math.sin(t*.65)*.4,'product.rotation.z':Math.sin(t*.5)*.08};
 };
 function render(time,{width=640,height=360,parameters={}}={}) {
  const p=parameters.product??{},c=pose('camera',time,parameters),o=pose('product',time,parameters);
  if(canvas.width!==width||canvas.height!==height)renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.fov=p.fov??65;camera.position.set(c['camera.position.x'],c['camera.position.y'],c['camera.position.z']);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  root.rotation.set(-.1,o['product.rotation.y'],o['product.rotation.z']);dial.rotation.z=time*.5;
  shell.color.set(p.shell??'#d2d3c8');accent.color.set(p.accent??'#d7f56b');key.intensity=3.3*(p.keyStrength??1);fill.intensity=.8+(p.fill??.1)*6;
  renderer.toneMappingExposure=parameters.look?.post?.exposure??1;renderer.render(scene,camera);
  return {time,width,height};
 }
 function sampleAuthoredAnimation(parameters,group,{start=0,end=6,count=25}={}) {
  const values=pose(group,0),channels=Object.keys(values);
  return channels.map(id=>({id,label:id.split('.').slice(1).join(' '),source:'samples',editable:false,keys:Array.from({length:count+1},(_,i)=>{const t=start+(end-start)*i/count;return {t,value:pose(group,t,{})[id],ease:'linear'};})}));
 }
 return {render,sampleAuthoredAnimation,getLook:()=>structuredClone(defaultLook),dispose(){scene.traverse(node=>{node.geometry?.dispose();for(const material of [node.material].flat())material?.dispose();});renderer.dispose();}};
}
