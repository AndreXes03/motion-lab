import {applyCameraLens} from '../engine/camera-lens.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
/** Physical enclosure only. The character remains an emissive 2D matrix. */
export function createDotDevice(drawFace,drawClock){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(800,800);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,30);camera.position.set(0,0,8.5);
 const pm=new T.PMREMGenerator(renderer),env=new RoomEnvironment();scene.environment=pm.fromScene(env,.04).texture;env.dispose();pm.dispose();scene.environmentIntensity=.65;
 const rig=new T.Group();scene.add(rig);
 function rounded(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2,n=20;s.moveTo(x+r,y);for(let i=1;i<=n;i++)s.lineTo(x+r+(w-2*r)*i/n,y);s.quadraticCurveTo(x+w,y,x+w,y+r);for(let i=1;i<=n;i++)s.lineTo(x+w,y+r+(h-2*r)*i/n);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);for(let i=1;i<=n;i++)s.lineTo(x+w-r-(w-2*r)*i/n,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);for(let i=1;i<=n;i++)s.lineTo(x,y+h-r-(h-2*r)*i/n);s.quadraticCurveTo(x,y,x+r,y);return s;}
 const white=new T.MeshPhysicalMaterial({color:'#f2eee3',roughness:.38,metalness:.03,clearcoat:.22,clearcoatRoughness:.34});
 const back=new T.Mesh(new T.ExtrudeGeometry(rounded(3.7,3.7,1.02),{depth:.45,bevelEnabled:true,bevelSize:.11,bevelThickness:.11,bevelSegments:5,curveSegments:28}),white);rig.add(back);
 const gasket=new T.Mesh(new T.ExtrudeGeometry(rounded(3.43,3.43,.92),{depth:.035,bevelEnabled:true,bevelSize:.024,bevelThickness:.022,bevelSegments:3,curveSegments:24}),new T.MeshStandardMaterial({color:'#393741',roughness:.54,metalness:.18}));gasket.position.z=.59;rig.add(gasket);
 const display=document.createElement('canvas');display.width=display.height=768;const ctx=display.getContext('2d');const texture=new T.CanvasTexture(display);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const glass=new T.Mesh(new T.ShapeGeometry(rounded(3.31,3.31,.88),32),new T.MeshPhysicalMaterial({map:texture,emissiveMap:texture,emissive:'#ffffff',emissiveIntensity:.85,color:'#181822',roughness:.32,metalness:0,specularIntensity:.08,envMapIntensity:.04,clearcoat:.025,clearcoatRoughness:.35}));const uv=glass.geometry.attributes.uv,pos=glass.geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/3.31+.5,pos.getY(i)/3.31+.5);uv.needsUpdate=true;glass.position.z=.67;rig.add(glass);
 const light=new T.DirectionalLight('#fff9e9',3.5);light.position.set(-4,5,6);scene.add(light);const rim=new T.DirectionalLight('#b2b9ff',1.5);rim.position.set(3,-1,2);scene.add(rim);
 const attachment=new T.Mesh(new T.TorusGeometry(.115,.032,12,32),new T.MeshStandardMaterial({color:'#ada8b5',metalness:.9,roughness:.24}));attachment.position.set(-1.65,1.46,.05);rig.add(attachment);
 const cordMat=new T.MeshStandardMaterial({color:'#292239',roughness:.65});
 const cordCurve=new T.CatmullRomCurve3([new T.Vector3(-1.7,1.46,.05),new T.Vector3(-2.31,1.23,-.08),new T.Vector3(-2.54,.25,-.1),new T.Vector3(-2.34,-1.48,.05),new T.Vector3(-1.88,-.6,.16),new T.Vector3(-1.85,.7,.05),new T.Vector3(-1.7,1.46,.05)]);
 const cord=new T.Mesh(new T.TubeGeometry(cordCurve,100,.037,8,false),cordMat);rig.add(cord);
 const key=new T.Mesh(new RoundedBoxGeometry(.32,.065,.12,2,.027),new T.MeshStandardMaterial({color:'#a8a0b5',metalness:.6,roughness:.25}));key.position.set(1.85,.61,-.08);rig.add(key);

 function circleMorph(mesh,half,corner){
  const g=mesh.geometry,p=g.attributes.position,base=Float32Array.from(p.array),circle=Float32Array.from(p.array),cornerCenter=half-corner;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),r=Math.hypot(x,y);if(r<1e-8)continue;const dx=Math.abs(x/r),dy=Math.abs(y/r),edge=half/Math.max(dx,dy);let boundary=edge;
   if(Math.min(dx,dy)*edge>cornerCenter){const dot=cornerCenter*(dx+dy);boundary=dot+Math.sqrt(Math.max(0,dot*dot-(2*cornerCenter*cornerCenter-corner*corner)));}
   const k=half/boundary;circle[i*3]=x*k;circle[i*3+1]=y*k;
  }
  const target=g.clone();target.setAttribute('position',new T.BufferAttribute(circle,3));target.computeVertexNormals();g.morphAttributes.position=[new T.BufferAttribute(circle,3)];g.morphAttributes.normal=[target.attributes.normal.clone()];target.dispose();mesh.updateMorphTargets();return {mesh,base,circle,half};
 }
 const morphs=[circleMorph(back,1.85,1.02),circleMorph(gasket,1.715,.92),circleMorph(glass,1.655,.88)];
 return {camera,render(c,x,y,r,t,amount=1,clock=0,parameters={}){
  const q=1-clock;
  for(const {mesh,base,circle,half} of morphs){mesh.morphTargetInfluences[0]=clock;if(mesh===glass){const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(base[i*3]*q+circle[i*3]*clock)/(half*2)+.5,(base[i*3+1]*q+circle[i*3+1]*clock)/(half*2)+.5);uv.needsUpdate=true;}}
  ctx.fillStyle='#f1ede5';ctx.fillRect(0,0,768,768);if(clock>0&&drawClock)drawClock(ctx,t,q);
  ctx.save();if(clock>0){ctx.beginPath();ctx.arc(384,400,Math.max(.01,q*670),0,Math.PI*2);ctx.clip();}
  ctx.fillStyle='#10121c';ctx.fillRect(0,0,768,768);ctx.fillStyle='#a5caba28';for(let j=0;j<768;j+=7)for(let i=0;i<768;i+=7){ctx.beginPath();ctx.arc(i,j,1.1,0,Math.PI*2);ctx.fill();}
  const faceScale=64+256*q;ctx.save();ctx.translate(384,400);ctx.scale(faceScale,faceScale);drawFace(ctx,faceScale,t,{mood:'wild',joy:Math.max(0,Math.min(1,(t-14.65)/.72)),look:.4*Math.sin((t-14)*2),blink:Math.max(0,1-Math.abs(t-14.85)/.075)});ctx.restore();ctx.restore();texture.needsUpdate=true;
  // Reveal attachment continuously; the previous binary q>.2 switch popped in one frame.
  const reveal=Math.max(0,Math.min(1,(q-.14)/.14)),accessoryAlpha=reveal*reveal*(3-2*reveal);
  for(const mesh of [cord,attachment,key]){mesh.visible=accessoryAlpha>.0001;mesh.material.transparent=true;mesh.material.opacity=accessoryAlpha;}
  cord.scale.setScalar(.88+.12*q);cord.rotation.z=.04*Math.sin((t-13.3)*3)*q;
  const opticalClock=clock*Math.max(0,Math.min(1,(t-12.19)/.6));rig.rotation.set((-.12+.065*Math.sin((t-13.3)*1.1))*q-.04*opticalClock,(-.15-.24*Math.max(0,Math.min(1,(t-13.3)/2.7)))*q+.12*Math.sin((t-12.19)*.8)*opticalClock,.075*Math.sin((t-13.3)*1.5)*q+.025*Math.sin((t-12.19)*1.2)*opticalClock);camera.position.set(0,0,8.5);camera.lookAt(-.18*q,0,0);applyCameraLens(camera,parameters,{target:[-.18*q,0,0],referenceFov:34});renderer.render(scene,camera);c.save();c.globalAlpha=amount;c.drawImage(renderer.domElement,x-r*1.46,y-r*1.46,r*2.92,r*2.92);c.restore();
  // Project the exact rounded/morphed glass boundary for physical foreground occlusion.
  const displayContour=rounded(3.31,3.31,.88).getPoints(40).map(p=>{const rad=Math.hypot(p.x,p.y),dx=Math.abs(p.x/rad),dy=Math.abs(p.y/rad),half=1.655,cc=half-.88,edge=half/Math.max(dx,dy),dot=cc*(dx+dy);let boundary=edge;if(Math.min(dx,dy)*edge>cc)boundary=dot+Math.sqrt(Math.max(0,dot*dot-(2*cc*cc-.88*.88)));const k=half/boundary,point=new T.Vector3(p.x*(q+k*clock),p.y*(q+k*clock),0);glass.localToWorld(point);point.project(camera);return[x+(point.x)*r*1.46,y-(point.y)*r*1.46];});
  return {displayContour};
 },dispose(){renderer.dispose();texture.dispose();}};
}
