import {applyCameraLens,resolveCameraLens} from '../engine/camera-lens.js';
import * as T from 'three';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
import defaultLook from '../../project/look.json';

const TAU=Math.PI*2;
const palettes={electric:['#e3fa63','#fe69bd','#63dce7','#171329','#4e3978'],candy:['#ffc84f','#83ecdf','#9481ff','#eadff3','#d1b7dd'],sunset:['#b8ee62','#f5a1d8','#7acddd','#f4d4bb','#d59aa3']};
const focus=[0,-.1,0];
/** Kinetic bloom: instanced petals/sparks, generated softboxes, one small soft shadow map, no full-frame post passes. */
export function createDemoRuntime(canvas) {
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(65,16/9,.1,50),root=new T.Group();scene.add(root);
 const material=color=>new T.MeshPhysicalMaterial({color,roughness:.28,metalness:.05,clearcoat:.45,clearcoatRoughness:.24,envMapIntensity:.7});
 const shell=material('#6864ff'),accent=material('#ff7142'),lime=material('#e3fa63'),pink=material('#fe69bd'),cyan=material('#63dce7'),pearl=material('#fff4da');
 const mesh=(geometry,mat,parent=root)=>{const object=new T.Mesh(geometry,mat);parent.add(object);return object;};
 const arcGeometry=new T.TorusGeometry(.95,.115,10,64,Math.PI*1.65),arcs=[lime,pink,cyan].map(mat=>mesh(arcGeometry,mat));
 const knot=mesh(new T.TorusKnotGeometry(.48,.135,96,10,2,3),accent);knot.castShadow=true;
 const core=mesh(new T.IcosahedronGeometry(.46,1),pearl);
 const petalGeometry=new T.CapsuleGeometry(.18,.85,4,12),petals=new T.InstancedMesh(petalGeometry,material('#ffffff'),12);petals.instanceMatrix.setUsage(T.DynamicDrawUsage);petals.frustumCulled=false;petals.castShadow=true;root.add(petals);
 const caps=new T.InstancedMesh(new T.SphereGeometry(.115,10,6),material('#ffffff'),6);caps.frustumCulled=false;caps.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(caps);
 const sparks=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),pearl,28);sparks.frustumCulled=false;sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(sparks);
 const halo=mesh(new T.TorusGeometry(2.45,.012,6,96),new T.MeshBasicMaterial({color:'#c6a9fa',transparent:true,opacity:.35}));halo.rotation.set(.45,.2,.1);
 const dock=mesh(new T.TorusGeometry(1.28,.045,8,64),accent,scene);dock.rotation.x=Math.PI/2;dock.position.y=-2.24;
 const stage=mesh(new T.CylinderGeometry(1.1,1.25,.09,48),shell,scene);stage.position.y=-2.34;stage.castShadow=true;stage.receiveShadow=true;
 const backdrop=document.createElement('canvas');backdrop.width=backdrop.height=128;const backdropCtx=backdrop.getContext('2d'),backdropTexture=new T.CanvasTexture(backdrop);backdropTexture.colorSpace=T.SRGBColorSpace;scene.background=backdropTexture;let backgroundPalette;
 const softbox=document.createElement('canvas');softbox.width=128;softbox.height=64;const env=softbox.getContext('2d');env.fillStyle='#292731';env.fillRect(0,0,128,64);env.filter='blur(4px)';env.fillStyle='#fff1d6';env.fillRect(10,9,15,35);env.fillStyle='#dce9ff';env.fillRect(76,12,8,32);env.fillStyle='#a092c5';env.fillRect(35,2,45,5);const environment=new T.CanvasTexture(softbox);environment.colorSpace=T.SRGBColorSpace;environment.mapping=T.EquirectangularReflectionMapping;scene.environment=environment;scene.environmentIntensity=.75;
 const shadow=mesh(new T.PlaneGeometry(10,10),new T.ShadowMaterial({transparent:true,depthWrite:false,opacity:.18}),scene);shadow.rotation.x=-Math.PI/2;shadow.position.y=-2.42;shadow.receiveShadow=true;
 const key=new T.DirectionalLight('#fff0d8',3);key.position.set(-3.5,5.5,4);key.castShadow=true;key.shadow.mapSize.set(256,256);key.shadow.radius=5;key.shadow.blurSamples=8;Object.assign(key.shadow.camera,{left:-3.4,right:3.4,top:3.4,bottom:-3.4,near:.5,far:18});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.035;key.shadow.bias=-.0002;
 const fill=new T.HemisphereLight('#e2deff','#51437c',1.4),rim=new T.DirectionalLight('#a9cfff',3.2);rim.position.set(3,2,-3);const bounce=new T.PointLight('#ff96d1',5,10,2);bounce.position.set(-3,-.3,1.5);scene.add(key,fill,rim,bounce);
 const dummy=new T.Object3D();
 const pose=(group,time,parameters={})=>{
  const t=sampleAnimationGroupTime(parameters,group,time),phase=t/6*TAU,energy=parameters.demo?.energy??1,travel=parameters.demo?.cameraTravel??1;
  return group==='camera'?{'camera.position.x':Math.sin(phase)*1.8*travel,'camera.position.y':.8+Math.cos(phase)*.65*travel,'camera.position.z':5.1-Math.sin(phase)*.9*travel}: {'product.rotation.y':phase+Math.sin(phase)*(energy-1)*.8,'product.rotation.z':Math.sin(phase)*.25*energy,'product.position.y':.08+Math.sin(phase*2)*.14*energy,'product.expansion':(.5-.5*Math.cos(phase))*energy};
 };
 function render(time,{width=640,height=360,parameters={}}={}) {
  const p=parameters.product??{},c=pose('camera',time,parameters),o=pose('product',time,parameters),t=sampleAnimationGroupTime(parameters,'product',time),phase=t/6*TAU,energy=parameters.demo?.energy??1;
  if(canvas.width!==width||canvas.height!==height)renderer.setSize(width,height,false);
  const palette=palettes[parameters.demo?.palette]??palettes.electric;
  if(backgroundPalette!==palette){backgroundPalette=palette;const gradient=backdropCtx.createLinearGradient(0,0,0,128);gradient.addColorStop(0,palette[3]);gradient.addColorStop(1,palette[4]);backdropCtx.fillStyle=gradient;backdropCtx.fillRect(0,0,128,128);const glow=backdropCtx.createRadialGradient(64,65,0,64,65,80);glow.addColorStop(0,'#baa3ff38');glow.addColorStop(1,'#baa3ff00');backdropCtx.fillStyle=glow;backdropCtx.fillRect(0,0,128,128);backdropTexture.needsUpdate=true;}
  lime.color.set(palette[0]);pink.color.set(palette[1]);cyan.color.set(palette[2]);
  shell.color.set(p.shell??'#6864ff');accent.color.set(p.accent??'#ff7142');
  camera.aspect=width/height;camera.fov=p.fov??65;camera.position.set(c['camera.position.x'],c['camera.position.y'],c['camera.position.z']);camera.lookAt(...focus);applyCameraLens(camera,parameters,{target:focus,referenceFov:65,fov:p.fov??65});camera.updateProjectionMatrix();
  root.position.y=o['product.position.y'];root.rotation.z=o['product.rotation.z'];
  const bloom=o['product.expansion'];
  arcs.forEach((arc,i)=>{arc.rotation.set(.45+Math.sin(phase+i*TAU/3)*(.7+bloom*.3),o['product.rotation.y']+i*TAU/3,i*TAU/3+phase);arc.scale.setScalar(1+bloom*.14);arc.updateMatrix();for(let end=0;end<2;end++){const angle=end*Math.PI*1.65;dummy.position.set(Math.cos(angle)*.95,Math.sin(angle)*.95,0).applyMatrix4(arc.matrix);dummy.rotation.set(0,0,0);dummy.scale.copy(arc.scale);dummy.updateMatrix();caps.setMatrixAt(i*2+end,dummy.matrix);caps.setColorAt(i*2+end,arc.material.color);}});caps.instanceMatrix.needsUpdate=true;caps.instanceColor.needsUpdate=true;
  knot.rotation.set(Math.sin(phase)*.8,-phase,phase);knot.scale.setScalar(1+bloom*.2);
  core.rotation.set(phase,-phase,.2);core.scale.setScalar(.85+.15*Math.cos(phase*2));
  for(let i=0;i<12;i++){const angle=i/12*TAU+phase+Math.sin(phase)*.35*energy,radius=1.03+bloom*.83;dummy.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,Math.sin(angle*2+phase)*(.45-bloom*.18));dummy.rotation.set(.35+(.95-bloom*.75)*Math.sin(angle),.65*Math.cos(angle+phase),angle-Math.PI/2);dummy.scale.set(.82,1+bloom*.2,.65);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);petals.setColorAt(i,[shell,lime,pink,cyan][i%4].color);}petals.instanceMatrix.needsUpdate=true;petals.instanceColor.needsUpdate=true;
  for(let i=0;i<28;i++){const angle=i/28*TAU-phase,r=2.52+Math.sin(i*2.4)*.2,z=Math.sin(angle*2+phase)*.65;dummy.position.set(Math.cos(angle)*r,Math.sin(angle)*r*.7+.05,z);dummy.rotation.set(phase,angle,phase);dummy.scale.setScalar((i%5===0?.075:.028)*(1+.2*Math.sin(phase*2+i)));dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix);}sparks.instanceMatrix.needsUpdate=true;
  halo.rotation.set(.45+Math.sin(phase)*.35,.2+Math.sin(phase)*.25,phase);halo.scale.setScalar(1+bloom*.06);dock.rotation.z=phase;
  key.intensity=3*(p.keyStrength??1);fill.intensity=.9+(p.fill??.1)*5;
  renderer.toneMappingExposure=1;renderer.render(scene,camera);
  return {time,width,height,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 }
 function sampleAuthoredAnimation(parameters,group,{start=0,end=6,count=25}={}) {
  const sourcePose=time=>{const values=pose(group,time,{...parameters,animation:undefined});if(group!=='camera')return values;const lens=resolveCameraLens(['x','y','z'].map(axis=>values['camera.position.'+axis]),focus,65,parameters,parameters.product?.fov??65);return {...Object.fromEntries(lens.position.map((value,i)=>['camera.position.'+['x','y','z'][i],value])),'camera.fov':lens.fov};};
  return Object.keys(sourcePose(0)).map(id=>({id,label:id.split('.').slice(1).join(' '),source:'samples',editable:false,keys:Array.from({length:count+1},(_,i)=>{const t=start+(end-start)*i/count;return {t,value:sourcePose(t)[id],ease:'linear'};})}));
 }
 return {render,sampleAuthoredAnimation,getLook:()=>structuredClone(defaultLook),dispose(){const resources=new Set([backdropTexture,environment]);scene.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of [node.material].flat())if(material)resources.add(material);});for(const resource of resources)resource.dispose();key.shadow.map?.dispose();renderer.dispose();}};
}
