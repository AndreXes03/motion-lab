import {applyCameraLens,resolveCameraLens} from '../engine/camera-lens.js';
import * as T from 'three';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
import defaultLook from '../../project/look.json';

const TAU=Math.PI*2;
const palettes={electric:['#e3fa63','#fe69bd','#63dce7','#e3ddff'],candy:['#ffc84f','#83ecdf','#9481ff','#f5d5e5'],sunset:['#b8ee62','#f5a1d8','#7acddd','#f1dbcf']};
/** A small kinetic sculpture: shared geometry, solid materials, no downloaded textures or post passes. */
export function createDemoRuntime(canvas) {
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(65,16/9,.1,50),root=new T.Group();scene.add(root);
 const material=color=>new T.MeshStandardMaterial({color,roughness:.3,metalness:.05});
 const shell=material('#6864ff'),accent=material('#ff7142'),lime=material('#e3fa63'),pink=material('#fe69bd'),cyan=material('#63dce7'),floor=material('#e3ddff');
 const mesh=(geometry,mat,parent=root)=>{const object=new T.Mesh(geometry,mat);parent.add(object);return object;};
 const ring=mesh(new T.TorusGeometry(.98,.23,12,48),accent);
 const core=mesh(new T.IcosahedronGeometry(.67,2),shell);core.material.roughness=.23;
 const orbit=new T.Group();root.add(orbit);
 const pillGeometry=new T.CapsuleGeometry(.16,.54,4,12),satellites=[];
 for(let i=0;i<5;i++){const object=mesh(pillGeometry,[lime,pink,cyan,accent,shell][i],orbit);satellites.push(object);}
 const beads=[],beadGeometry=new T.IcosahedronGeometry(.12,0);
 for(let i=0;i<6;i++)beads.push(mesh(beadGeometry,i%2?pink:cyan));
 const pedestal=mesh(new T.CylinderGeometry(1.42,1.52,.16,40),shell,scene);pedestal.position.y=-1.65;
 const foot=mesh(new T.CylinderGeometry(1.06,1.25,.13,40),lime,scene);foot.position.y=-1.8;
 const ground=mesh(new T.PlaneGeometry(100,100),floor,scene);ground.rotation.x=-Math.PI/2;ground.position.y=-1.89;
 const key=new T.DirectionalLight('#fff5e9',3.3);key.position.set(-3,5,5);
 const fill=new T.HemisphereLight('#ffffff','#9c83b9',2.2),rim=new T.DirectionalLight('#c1e3ff',1.8);rim.position.set(3,2,-3);scene.add(key,fill,rim);
 const pose=(group,time,parameters={})=>{
  const t=sampleAnimationGroupTime(parameters,group,time),phase=t/6*TAU,energy=parameters.demo?.energy??1,travel=parameters.demo?.cameraTravel??1;
  return group==='camera'?{'camera.position.x':Math.sin(phase)*1.25*travel,'camera.position.y':1.05+Math.cos(phase)*.35*travel,'camera.position.z':5.1+Math.sin(phase)*.25*travel}: {'product.rotation.y':phase+Math.sin(phase)*(energy-1)*.8,'product.rotation.z':.25+Math.sin(phase)*.22*energy,'product.position.y':.08+Math.sin(phase*2)*.16*energy};
 };
 function render(time,{width=640,height=360,parameters={}}={}) {
  const p=parameters.product??{},c=pose('camera',time,parameters),o=pose('product',time,parameters),t=sampleAnimationGroupTime(parameters,'product',time),phase=t/6*TAU,energy=parameters.demo?.energy??1;
  if(canvas.width!==width||canvas.height!==height)renderer.setSize(width,height,false);
  const palette=palettes[parameters.demo?.palette]??palettes.electric;
  scene.background??=new T.Color();scene.background.set(palette[3]);floor.color.set(palette[3]);lime.color.set(palette[0]);pink.color.set(palette[1]);cyan.color.set(palette[2]);
  shell.color.set(p.shell??'#6864ff');accent.color.set(p.accent??'#ff7142');
  camera.aspect=width/height;camera.fov=p.fov??65;camera.position.set(c['camera.position.x'],c['camera.position.y'],c['camera.position.z']);camera.lookAt(0,-.1,0);applyCameraLens(camera,parameters,{target:[0,-.1,0],referenceFov:65,fov:p.fov??65});camera.updateProjectionMatrix();
  root.position.y=o['product.position.y'];root.rotation.z=o['product.rotation.z'];
  ring.rotation.set(.55+Math.sin(phase)*.55*energy,o['product.rotation.y'],.35);
  core.rotation.set(phase+Math.sin(phase)*(energy-1)*.5,-phase,.2);core.scale.setScalar(1+Math.sin(phase*2)*.08*energy);
  orbit.rotation.z=-Math.sin(phase)*.35*energy;
  satellites.forEach((object,i)=>{const angle=i/5*TAU+phase+Math.sin(phase)*(energy-1)*.6;object.position.set(Math.cos(angle)*1.8,Math.sin(angle)*1.1,Math.sin(angle+phase)*(.3+.3*energy));object.rotation.set(.4,angle,angle+Math.PI/2);object.scale.setScalar(.85+Math.sin(phase*2+i)*.15*energy);});
  beads.forEach((object,i)=>{const angle=i/6*TAU-phase-Math.sin(phase)*(energy-1)*.5;object.position.set(Math.cos(angle)*2.18,Math.sin(angle)*1.36,Math.cos(angle)*.45);object.rotation.set(phase,angle,phase);});
  pedestal.rotation.y=Math.sin(phase)*.3*energy;
  key.intensity=3.3*(p.keyStrength??1);fill.intensity=1.4+(p.fill??.1)*6;
  renderer.toneMappingExposure=1;renderer.render(scene,camera);
  return {time,width,height,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 }
 function sampleAuthoredAnimation(parameters,group,{start=0,end=6,count=25}={}) {
  const sourcePose=time=>{const values=pose(group,time,{...parameters,animation:undefined});if(group!=='camera')return values;const lens=resolveCameraLens(['x','y','z'].map(axis=>values['camera.position.'+axis]),[0,-.1,0],65,parameters,parameters.product?.fov??65);return {...Object.fromEntries(lens.position.map((value,i)=>['camera.position.'+['x','y','z'][i],value])),'camera.fov':lens.fov};};
  return Object.keys(sourcePose(0)).map(id=>({id,label:id.split('.').slice(1).join(' '),source:'samples',editable:false,keys:Array.from({length:count+1},(_,i)=>{const t=start+(end-start)*i/count;return {t,value:sourcePose(t)[id],ease:'linear'};})}));
 }
 return {render,sampleAuthoredAnimation,getLook:()=>structuredClone(defaultLook),dispose(){const resources=new Set();scene.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of [node.material].flat())if(material)resources.add(material);});for(const resource of resources)resource.dispose();renderer.dispose();}};
}
