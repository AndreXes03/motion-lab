import {smoother} from './replay-motion-curves.js';
import {replayCameraPose} from './replay-camera-rail.js';
import {replayPaperFormat} from './replay-paper-format.js';
import {replayCardPose,replayRecordSpin,replayStockPose} from './replay-motion-direction.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createReplayCardWorld(getImage,getModel){
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;renderer.setClearColor('#000000',0);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(33.398,16/9,.1,100);
 // PMREM belongs to this renderer: render-target textures cannot supply
 // lighting across the separate thumbnail renderer's WebGL context.
 const studio=document.createElement('canvas');studio.width=1024;studio.height=512;
 const e=studio.getContext('2d');e.fillStyle='#74717a';e.fillRect(0,0,1024,512);
 for(const [x,y,w,h]of[[35,45,170,365],[610,10,85,470],[825,180,180,110]]){const g=e.createLinearGradient(x,y,x+w,y);g.addColorStop(0,'#afb0b8');g.addColorStop(.22,'#fff9f0');g.addColorStop(.72,'#ffffff');g.addColorStop(1,'#afb0b8');e.fillStyle=g;e.fillRect(x,y,w,h);}
 const environment=new T.CanvasTexture(studio);environment.colorSpace=T.SRGBColorSpace;environment.mapping=T.EquirectangularReflectionMapping;
 const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromEquirectangular(environment).texture;scene.environment=env;
 function lightModel(model){model.traverse(o=>{if(o.material){o.material.envMap=env;o.material.envMapIntensity=.95;o.material.needsUpdate=true;}});return model;}
 scene.add(new T.HemisphereLight('#fff5e9','#9489a4',1.9));
 const key=new T.DirectionalLight('#fff7ed',2.4);key.position.set(-4,5,9);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-10;key.shadow.camera.right=10;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.camera.near=.1;key.shadow.camera.far=30;key.shadow.bias=-.0005;key.shadow.radius=5;key.shadow.blurSamples=8;scene.add(key);
 const fill=new T.DirectionalLight('#d5e5ff',.55);fill.position.set(5,-1,6);scene.add(fill);
 const ground=new T.Mesh(new T.PlaneGeometry(40,30),new T.ShadowMaterial({color:'#392c28',opacity:.065}));ground.position.z=-.45;ground.receiveShadow=true;scene.add(ground);
 const cards=new Map(),edge=new T.MeshStandardMaterial({color:'#e5dfce',roughness:.84});
 function make(id){const group=new T.Group(),model=getModel(id),[width,height]=replayPaperFormat(id);
  let image=model?null:getImage(id);
  if(model){image=document.createElement('canvas');image.width=Math.round(width*750);image.height=Math.round(height*750);const c=image.getContext('2d');const hex=['#efb4c6','#777bdb','#f4df87','#acd4b9','#a6bace','#b95a57','#cfbfe6','#e2b27d'][id%8];c.fillStyle=hex;c.fillRect(0,0,image.width,image.height);const glow=c.createRadialGradient(280,130,0,280,130,850);glow.addColorStop(0,'#ffffff28');glow.addColorStop(.6,'#ffffff00');glow.addColorStop(1,'#14143815');c.fillStyle=glow;c.fillRect(0,0,image.width,image.height);}
  const tex=new T.CanvasTexture(image);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const backing=new T.Mesh(new RoundedBoxGeometry(width,height,.025,2,.009),edge.clone());backing.castShadow=backing.receiveShadow=true;group.add(backing);
  const front=new T.Mesh(new T.PlaneGeometry(width-.01,height-.01),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,toneMapped:false}));front.position.z=.014;front.castShadow=false;group.add(front);const contact=new T.Mesh(new T.PlaneGeometry(width-.01,height-.01),new T.ShadowMaterial({color:'#49352f',opacity:.16}));contact.position.z=.016;contact.receiveShadow=true;group.add(contact);if(model){lightModel(model);model.scale.setScalar(.32);model.position.z=.12;model.userData.baseRotation=model.rotation.clone();model.name='artwork';group.add(model);}
  group.children.forEach(m=>{if(m.material)m.userData.baseOpacity=m.material.opacity;});scene.add(group);cards.set(id,group);return group;}
 const threads=Array.from({length:21},()=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(25*3),3));const line=new T.Line(g,new T.LineBasicMaterial({color:'#8b7767',transparent:true,opacity:.3}));scene.add(line);return line;});
 const extractedScene=new T.Scene(),extracted=new Map();
 extractedScene.add(new T.HemisphereLight('#fff5e9','#9489a4',1.9));
 const objectKey=new T.DirectionalLight('#fff7ed',2.4);objectKey.position.copy(key.position);extractedScene.add(objectKey);
 extractedScene.add(fill.clone());
 let sw=0,sh=0;
 return {
  render(ctx,poses,t,wireAlpha,cameraTime=t){
   const w=ctx.canvas.width,h=ctx.canvas.height;
   if(w!==sw||h!==sh){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();sw=w;sh=h;}
   // A camera moving through the same world: dolly, lateral track and a shallow
   // crane. The rhythm follows objects, rather than scaling each chapter canvas.
   const lens=replayCameraPose(cameraTime);
   camera.position.fromArray(lens.position);camera.lookAt(new T.Vector3(...lens.target));camera.rotation.z=lens.roll;
   ground.visible=false;
   for(let id=0;id<21;id++){
    const a=poses[id],b=poses[(id+1)%21],line=threads[id];line.visible=wireAlpha>.01;
    line.material.opacity=.38*wireAlpha;
    const start=new T.Vector3((a.x-960)/250,(540-a.y)/250,a.z/250-.04);
    const end=new T.Vector3((b.x-960)/250,(540-b.y)/250,b.z/250-.04);
    const direction=end.clone().sub(start);
    const c1=start.clone().addScaledVector(direction,.33);c1.z-=.12;
    const c2=start.clone().addScaledVector(direction,.67);c2.z-=.12;
    const curve=new T.CubicBezierCurve3(start,c1,c2,end),points=line.geometry.attributes.position;
    curve.getPoints(24).forEach((p,j)=>points.setXYZ(j,p.x,p.y,p.z));points.needsUpdate=true;line.geometry.computeBoundingSphere();
   }
   for(let p of poses){
    if(p.id===5&&t>=11.4){p=replayStockPose(5,t);}
    const card=cards.get(p.id)??make(p.id);card.visible=!(p.id===5&&t>=12.1)&&p.x>-700&&p.x<2620&&p.y>-700&&p.y<1780;card.position.set((p.x-960)/250,(540-p.y)/250,(p.z??0)/250);card.rotation.set(-p.pitch,p.yaw,-p.rotation);card.scale.setScalar(p.scale);card.children.forEach(m=>{if(m.material)m.material.opacity=m.userData.baseOpacity;});}

   for(const [id,card] of cards){const art=card.getObjectByName('artwork');if(!art)continue;art.visible=!([3,8,11].includes(id)&&t>=7.7&&t<8.9)&&!(id===5&&t>=11.4);const r=art.userData.baseRotation;art.rotation.copy(r);const wheel=art.getObjectByName('wheel');if(wheel){wheel.rotation.z=t*.17;for(const cabin of wheel.children)if(cabin.geometry?.type==='RoundedBoxGeometry')cabin.rotation.z=-wheel.rotation.z;}for(const name of ['bike-left','bike-right']){const wheel=art.getObjectByName(name);if(wheel)wheel.rotation.z=-t*.32;}for(let j=0;j<5;j++){const lens=art.getObjectByName('lens-'+j);if(lens)lens.position.z=.39+j*.065+.018*Math.sin(t*.8);}if(id===8)art.rotation.z=r.z+t*.035;if(id===5)art.rotation.z=r.z-replayRecordSpin(t);for(const name of ['reel-left','reel-right']){const reel=art.getObjectByName(name);if(reel)reel.rotation.z=-t*.24;}}
   renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,1920,1080);
  },
  renderObjects(ctx,poses,t){
   for(const art of extracted.values())art.visible=false;
   for(const p of poses){let art=extracted.get(p.id);if(!art){art=getModel(p.id);if(!art)continue;lightModel(art);art.userData.baseRotation=art.rotation.clone();extractedScene.add(art);extracted.set(p.id,art);}
    art.visible=true;const r=art.userData.baseRotation,parent=new T.Quaternion().setFromEuler(new T.Euler(-p.pitch,p.yaw,-p.rotation)),child=new T.Quaternion().setFromEuler(new T.Euler(r.x,r.y,r.z+(p.id===8?t*.035:0)));const offset=new T.Vector3(0,0,.12).applyQuaternion(parent).multiplyScalar(p.scale);art.position.set((p.x-960)/250,(540-p.y)/250,p.z/250).add(offset);art.quaternion.copy(parent).multiply(child);art.scale.setScalar(.32*p.scale);for(const name of ['bike-left','bike-right']){const wheel=art.getObjectByName(name);if(wheel)wheel.rotation.z=-t*.32;}
    if(p.screenLock>0){
     const locked=new T.Vector3((p.screenX-960)/250,(540-p.screenY)/250,-7.2).applyMatrix4(camera.matrixWorld);
     art.position.lerp(locked,p.screenLock);
     const local=new T.Quaternion().setFromEuler(new T.Euler(r.x,r.y,r.z-(p.id===3?-.28:0)));
     art.quaternion.slerp(camera.quaternion.clone().multiply(local),p.screenLock);
     art.scale.lerp(new T.Vector3().setScalar(.32*p.screenScale),p.screenLock);
    }
   }
   renderer.render(extractedScene,camera);ctx.drawImage(renderer.domElement,0,0,1920,1080);
  },
  renderRecord(ctx,hero,t){
   for(const art of extracted.values())art.visible=false;
   let record=extracted.get(5);if(!record){record=lightModel(getModel(5));extractedScene.add(record);extracted.set(5,record);}
   record.visible=true;
   // Extract from the actual card plane before progressively taking ownership
   // in screen space. The centre and label use this exact projected geometry.
   const p=hero.record,cardPose=replayCardPose(5,t),lock=smoother((t-11.4)/.76),parent=new T.Quaternion().setFromEuler(new T.Euler(-cardPose.pitch,cardPose.yaw,-cardPose.rotation));
   const offset=new T.Vector3(0,0,.12).applyQuaternion(parent).multiplyScalar(p.scale);
   const source=new T.Vector3((p.x-960)/250,(540-p.y)/250,(p.z??0)/250).add(offset);
   const destination=new T.Vector3((p.x-960)/250,(540-p.y)/250,-7.2).applyMatrix4(camera.matrixWorld);
   record.position.copy(source).lerp(destination,lock);
   const sourceRotation=parent.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0,0,-hero.record.rotation)));
   const destinationRotation=camera.quaternion.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0,0,-hero.record.rotation)));
   record.quaternion.copy(sourceRotation).slerp(destinationRotation,lock);
   record.scale.setScalar((1-lock)*.32*p.scale+lock*hero.blackRadius/(250*1.3));
   record.getObjectByName('record-label').visible=false;record.getObjectByName('record-hole').visible=false;
   renderer.render(extractedScene,camera);ctx.drawImage(renderer.domElement,0,0,1920,1080);
   record.updateMatrixWorld(true);const center=record.localToWorld(new T.Vector3(0,0,.04)).project(camera),edgePoint=record.localToWorld(new T.Vector3(1.3,0,.04)).project(camera);
   return {x:(center.x+1)*960,y:(1-center.y)*540,radius:Math.hypot((edgePoint.x-center.x)*960,(edgePoint.y-center.y)*540)};
  },
  scene,camera,renderer
 };
}
