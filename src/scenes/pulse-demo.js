import {createSceneCanvas} from '../engine/scene-canvas.js';
import {applyCameraLens} from '../engine/camera-lens.js';
import {createPulseSurfaceControls, pulseControlGain} from './pulse-surface-controls.js';
import {createReviewMaterials} from '../engine/preview-review.js';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
import {refineTurntableArm} from './pulse-hardware-detail.js';
import {pulseImpactCues} from '../engine/impact-motion.js';
import {pulseLanding,pulseExplosion,lensCameraTime} from './pulse-finish-v15.js';
import {configureDetailSampling} from '../engine/detail-sampling.js';
import {addSpeakerHardware} from './speaker-hardware-detail.js';
import {glossStudio} from './gloss-studio.js';
import {organicSurface} from './organic-surface.js';
import {finishMap} from './refined-finishes.js';
import {buildInstruments,buildHeadphones,buildGlints} from './pulse-instruments.js';
import {direction,centralDirection} from './pulse-direction.js';
import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createComposite} from '../engine/composite.js';
function canvasTexture(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
import {buildPulseProps,buildVinylBase} from './pulse-props.js';
export const config={id:'pulse',duration:13.9,fps:30,width:1920,height:1080};
export const cuts=[0,1.46,2.45,3.45,4.25,5.25,5.9,6.675,13.9];
// Delete only the connector shot; all surviving poses retain their authored clock.
export const editTime=t=>t<4.25?t:t+1.1;
const retimeKeys=[[2.45,2.45],[3.45,3.15],[4.25,4.2],[5.35,4.85],[6.35,6.15],[7,6.72],[7.775,7.775]];
export function sourceTime(t){if(t<2.45||t>=7.775)return t;let j=0;while(j<retimeKeys.length-2&&t>=retimeKeys[j+1][0])j++;const[a,x]=retimeKeys[j],[b,y]=retimeKeys[j+1];return x+(y-x)*(t-a)/(b-a);}
const originalShutter=t=>t>=8.55&&t<14.6?110:(t>=1.15&&t<1.78)||(t>=3.02&&t<3.62)||(t>=4.82&&t<5.85)||(t>=6.15&&t<7.775)||(t>=8.75&&t<11.8)?180:(t>=11.8&&t<14.6)?120:60;
export const shutterAngleAt=t=>{const clock=editTime(t);return Math.max(270,Math.min(320,originalShutter(sourceTime(clock))*1.8));};
export const temporalSamplesAt=(t,base)=>{if(base<=8)return base;const clock=editTime(t);return clock>=1.20&&clock<=1.72?Math.max(base,32):shutterAngleAt(t)>=160?Math.max(base,16):base;};
const spring=x=>x<=0?0:x>=1.5?1:1-Math.exp(-9*x)*(Math.cos(10*x)+.9*Math.sin(10*x));
const impulse=x=>x<=0?0:Math.exp(-4.8*x)*Math.sin(11*x);
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// Public gains leave the authored film intact at one and never retime its cuts.
const controlGain=pulseControlGain;
export function createDemo({rendererFactory=()=>new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}),compositeFactory=createComposite,environmentFactory=null,glossEnvironmentFactory=glossStudio}={}){
 const reviews=createReviewMaterials();
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,16/9,.1,100);scene.background=new THREE.Color('#08277b');
 const sky=createSceneCanvas();sky.width=512;sky.height=512;const sk=sky.getContext('2d'),g=sk.createRadialGradient(256,230,20,256,256,390);g.addColorStop(0,'#164db4');g.addColorStop(1,'#030e3c');sk.fillStyle=g;sk.fillRect(0,0,512,512);scene.background=canvasTexture(sky);const rig=new THREE.Group();scene.add(rig);
 const mats={orange:new THREE.MeshPhysicalMaterial({color:'#ff681c',metalness:.6,roughness:.2}),black:new THREE.MeshStandardMaterial({color:'#111523',metalness:.2,roughness:.3}),silver:new THREE.MeshStandardMaterial({color:'#d3dfea',metalness:.95,roughness:.19}),lime:new THREE.MeshStandardMaterial({color:'#d8ff43',metalness:.15,roughness:.28}),purple:new THREE.MeshStandardMaterial({color:'#806bff',metalness:.4,roughness:.2})};
 const parts=[];
 function mesh(g,m,z){const o=new THREE.Mesh(g,m);o.position.z=z;rig.add(o);parts.push({o,z});return o;}
 mesh(new THREE.CylinderGeometry(1.6,1.6,.38,96),mats.orange,-.15).rotation.x=Math.PI/2;
 const tor=(r,t,m,z)=>mesh(new THREE.TorusGeometry(r,t,24,100),m,z);
 tor(1.57,.055,mats.silver,.1);tor(1.43,.14,mats.orange,.16);tor(1.27,.09,mats.black,.22);
 const coneProfile=[];for(let i=0;i<=100;i++){const r=.29+i/100*1.0;const depth=.59-.43*(r-.29)+.019*Math.sin((r-.29)*Math.PI*18);coneProfile.push(new THREE.Vector2(r,depth));}const grain=createSceneCanvas();grain.width=256;grain.height=256;const gc=grain.getContext('2d'),noise=gc.createImageData(256,256);for(let i=0;i<256*256;i++){let n=127+Math.floor(((Math.sin(i*12.9898)*43758.5453)%1)*24);noise.data[i*4]=noise.data[i*4+1]=noise.data[i*4+2]=n;noise.data[i*4+3]=255;}gc.putImageData(noise,0,0);const bump=new THREE.CanvasTexture(grain);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(4,4);const coneMat=new THREE.MeshPhysicalMaterial({side:THREE.DoubleSide,color:'#0b0d14',metalness:.05,roughness:.45,clearcoat:.18,clearcoatRoughness:.3,bumpMap:bump,bumpScale:.005});const cone=mesh(new THREE.LatheGeometry(coneProfile.reverse(),128),coneMat,0);cone.rotation.x=Math.PI/2;tor(1.26,.075,mats.black,.16);tor(1.60,.045,mats.black,-.38);
 const dome=mesh(new THREE.SphereGeometry(.36,128,96),new THREE.MeshPhysicalMaterial({color:'#dccba6',metalness:.8,roughness:.26,clearcoat:.18,clearcoatRoughness:.23,anisotropy:.35}),.57);dome.geometry.computeTangents();dome.scale.z=.45;
 for(let i=0;i<8;i++){const a=i*Math.PI/4,o=mesh(new THREE.CylinderGeometry(.065,.065,.025,6),mats.silver,.21);o.rotation.x=Math.PI/2;o.position.set(Math.sin(a)*1.43,Math.cos(a)*1.43,.21);const slot=mesh(new THREE.BoxGeometry(.06,.008,.009),mats.black,.226);slot.position.set(Math.sin(a)*1.43,Math.cos(a)*1.43,.226);slot.rotation.z=a;}for(let i=0;i<12;i++){const a=i*Math.PI/6,vent=mesh(new THREE.BoxGeometry(.035,.17,.1),mats.black,-.15);vent.position.set(Math.sin(a)*1.59,Math.cos(a)*1.59,-.15);vent.rotation.z=-a;const clip=mesh(new THREE.BoxGeometry(.14,.19,.04),mats.silver,-.08);clip.position.set(Math.sin(a)*1.63,Math.cos(a)*1.63,-.08);clip.rotation.z=-a;}
 const cables=new THREE.Group();scene.add(cables);
 const cableSimulations=[];const routes=[[[ -1.5,.55,-.25],[-2.4,1.6,-.65],[-2.9,-.2,-.8],[-2.1,-1.7,-.65],[.6,-2.0,-.6],[1.5,-.5,-.25]],[[1.55,.3,-.25],[2.35,1.1,-.7],[1.55,2.3,-.8],[-.65,2.1,-.9],[-1.45,1,-.25]],[[1.45,-.75,-.3],[2.1,-1.5,-.7],[1.55,-2.35,-.8],[-.8,-2.15,-.65],[-1.5,-.45,-.25]]];
 for(let k=0;k<3;k++){const points=routes[k].map(p=>new THREE.Vector3(...p)),curve=new THREE.CatmullRomCurve3(points,false,'centripetal');const wire=new THREE.Mesh(new THREE.TubeGeometry(curve,96,[.062,.078,.053][k],24,false),[mats.orange,mats.lime,mats.purple][k]);cables.add(wire);cableSimulations.push({wire,curve,k,points:points.map(p=>p.clone())});for(const end of [0,1]){const plug=new THREE.Group(),p=curve.getPoint(end),tan=curve.getTangent(end).multiplyScalar(end?1:-1);for(let j=0;j<3;j++){const segment=new THREE.Mesh(new THREE.CylinderGeometry(j===2?.09:.085,j===2?.09:.085,j===2?.13:.1,24),j===0?mats.black:mats.silver);segment.position.y=j*.09;plug.add(segment);}plug.position.copy(p);plug.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tan);cables.add(plug);}}
 rig.add(cables);
 const vinyl=new THREE.Group();rig.add(vinyl);vinyl.add(buildVinylBase());const platter=new THREE.Group();vinyl.add(platter);const vinylBlack=new THREE.MeshPhysicalMaterial({color:'#03050a',metalness:.35,roughness:.12,clearcoat:1,clearcoatRoughness:.075});const recordProfile=[];for(let i=0;i<=1200;i++){const r=i/1200*1.45;recordProfile.push(new THREE.Vector2(r,.35+.024*(1-r*r/(1.45*1.45))));}recordProfile.push(new THREE.Vector2(1.45,.325),new THREE.Vector2(0,.325));const disk=new THREE.Mesh(new THREE.LatheGeometry(recordProfile.reverse(),512),vinylBlack);disk.rotation.x=Math.PI/2;disk.position.z=0;platter.add(disk);vinylBlack.roughness=.085;vinylBlack.metalness=.15;const grooveCanvas=createSceneCanvas();grooveCanvas.width=64;grooveCanvas.height=2048;const gx=grooveCanvas.getContext('2d');for(let y=0;y<2048;y++){const v=Math.round(128+68*Math.sin(y/2048*Math.PI*2*36));gx.fillStyle=`rgb(${v},${v},${v})`;gx.fillRect(0,y,64,1);}vinylBlack.bumpMap=canvasTexture(grooveCanvas);vinylBlack.bumpScale=.00010;vinylBlack.bumpMap.colorSpace=THREE.NoColorSpace;
 const labelCanvas=createSceneCanvas();labelCanvas.width=256;labelCanvas.height=256;const lx=labelCanvas.getContext('2d');lx.fillStyle='#dd8052';lx.fillRect(0,0,256,256);lx.strokeStyle='#f7ddb6';lx.lineWidth=2;for(const r of[99,109]){lx.beginPath();lx.arc(128,128,r,0,Math.PI*2);lx.stroke();}lx.fillStyle='#382721';lx.textAlign='center';lx.font='700 24px Arial';lx.fillText('PULSE',128,94);lx.font='600 11px Arial';lx.fillText('STEREO / 33⅓',128,173);const labelGeometry=new THREE.BufferGeometry(),labelVertices=[],labelUV=[],labelIndices=[];for(let ring=0;ring<=16;ring++)for(let j=0;j<=64;j++){const r=ring/16*.31,a=j/64*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r;labelVertices.push(x,y,.35+.024*(1-r*r/(1.45*1.45))+.0015);labelUV.push(x/.62+.5,y/.62+.5);}for(let ring=0;ring<16;ring++)for(let j=0;j<64;j++){const a=ring*65+j,b=a+1,c=a+65,d=c+1;labelIndices.push(a,c,b,b,c,d);}labelGeometry.setAttribute('position',new THREE.Float32BufferAttribute(labelVertices,3));labelGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(labelUV,2));labelGeometry.setIndex(labelIndices);labelGeometry.computeVertexNormals();const label=new THREE.Mesh(labelGeometry,new THREE.MeshStandardMaterial({map:canvasTexture(labelCanvas),roughness:.64}));platter.add(label);const pin=new THREE.Mesh(new THREE.SphereGeometry(.038,20,12),mats.silver);pin.position.z=.41;platter.add(pin);

 scene.add(new THREE.HemisphereLight('#ffffff','#070707',.12));RectAreaLightUniformsLib.init();const areaKey=new THREE.RectAreaLight('#ffffff',12,1.2,4.5);areaKey.position.set(-3.8,3,1);areaKey.lookAt(0,.35,0);scene.add(areaKey);
 for(const [pos,c,intensity] of [[[-4,4,1],'#ffffff',85],[[4,1,-3],'#dceaff',135],[[1,-4,-2],'#ffffff',65]]){let l=new THREE.PointLight(c,intensity);l.position.set(...pos);scene.add(l);}
 const renderer=rendererFactory();renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
 const composite=compositeFactory(renderer,scene,camera,{...config,look:{bloomStrength:.06,bloomRadius:.18,bloomThreshold:1.8,aoIntensity:.35,aberrationPx:.25,vignette:.12}});
 let renderWidth=0,renderHeight=0;
 
 const env=createSceneCanvas();env.width=512;env.height=256;const ec=env.getContext('2d');ec.fillStyle='#030303';ec.fillRect(0,0,512,256);for(const [x,ww,color] of [[35,18,'#ffffff'],[180,8,'#ffffff'],[280,12,'#dceaff'],[450,8,'#ffffff']]){ec.fillStyle=color;ec.fillRect(x,38,ww,150);}const et=canvasTexture(env);et.mapping=THREE.EquirectangularReflectionMapping;const makeEnvironment=environmentFactory??(texture=>{const generator=new THREE.PMREMGenerator(renderer);const result=generator.fromEquirectangular(texture).texture;generator.dispose();return result;});const mainEnvironment=makeEnvironment(et);scene.environment=mainEnvironment;scene.environmentIntensity=.75;const vinylEnvCanvas=createSceneCanvas();vinylEnvCanvas.width=1024;vinylEnvCanvas.height=512;const ve=vinylEnvCanvas.getContext('2d');ve.fillStyle='#02040a';ve.fillRect(0,0,1024,512);for(const [x,y,ww,hh,c] of [[90,145,65,28,'#ffffff'],[175,145,18,50,'#ffffff'],[495,185,55,16,'#dfeaff'],[825,145,70,24,'#fff1d3']]){ve.fillStyle=c;ve.fillRect(x,y,ww,hh);}const vt=canvasTexture(vinylEnvCanvas);vt.mapping=THREE.EquirectangularReflectionMapping;const vinylEnvironment=makeEnvironment(vt);
 const ledCanvas=createSceneCanvas();ledCanvas.width=256;ledCanvas.height=256;const lc=ledCanvas.getContext('2d');lc.fillStyle='#020513';lc.fillRect(0,0,256,256);lc.fillStyle='#a58bff';lc.font='900 58px Arial';lc.textAlign='center';for(let i=0;i<3;i++)lc.fillText('PULSE',128,78+i*63);const ledData=lc.getImageData(0,0,256,256).data;lc.clearRect(0,0,256,256);lc.fillStyle='#020513';lc.fillRect(0,0,256,256);for(let y=3;y<256;y+=5)for(let x=3;x<256;x+=5){lc.fillStyle=ledData[(y*256+x)*4]>50?'#ac8aff':'#132041';lc.beginPath();lc.arc(x,y,1.6,0,6.3);lc.fill();}const ledMap=canvasTexture(ledCanvas),ledMaterial=new THREE.MeshPhysicalMaterial({map:ledMap,emissiveMap:ledMap,emissive:'#ffffff',emissiveIntensity:1.55,color:'#040404',roughness:.22,clearcoat:1,clearcoatRoughness:.1});const ledBack=new THREE.MeshStandardMaterial({color:'#060b1a',roughness:.2});const led=new THREE.Mesh(new RoundedBoxGeometry(2.91,2.75,.08,10,.22),[ledBack,ledBack,ledBack,ledBack,ledMaterial,ledBack]);led.position.z=.37;rig.add(led);const ledFrame=new THREE.Group();const ledBody=new THREE.Mesh(new RoundedBoxGeometry(3.29,3.13,.42,8,.32),mats.orange);ledBody.position.z=.05;ledFrame.add(ledBody);const ledTrim=new THREE.Mesh(new RoundedBoxGeometry(3.12,2.96,.08,8,.25),mats.silver);ledTrim.position.z=.285;ledFrame.add(ledTrim);const ledBezel=new THREE.Mesh(new RoundedBoxGeometry(3.04,2.88,.065,8,.24),ledBack);ledBezel.position.z=.322;ledFrame.add(ledBezel);rig.add(ledFrame);led.visible=false;ledFrame.visible=false;
 const vinylCream=new THREE.MeshStandardMaterial({color:'#fff5dc',metalness:.15,roughness:.23});const knob=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.25,0),new THREE.Vector2(.28,.035),new THREE.Vector2(.275,.18),new THREE.Vector2(.245,.23),new THREE.Vector2(.18,.26),new THREE.Vector2(0,.275)],64),new THREE.MeshPhysicalMaterial({color:'#b2ce55',metalness:.15,roughness:.17,clearcoat:1,clearcoatRoughness:.10}));knob.rotation.x=Math.PI/2;knob.position.set(1.40,-.35,.32);vinyl.add(knob);const knobTop=new THREE.Mesh(new THREE.CircleGeometry(.24,64),mats.lime);knobTop.position.set(1.40,-.35,.555);knobTop.visible=false;vinyl.add(knobTop);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:'#f0eae1'}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.62;scene.add(floor);const shadowCanvas=createSceneCanvas();shadowCanvas.width=256;shadowCanvas.height=256;const sh=shadowCanvas.getContext('2d'),sg=sh.createRadialGradient(128,128,8,128,128,125);sg.addColorStop(0,'#31253766');sg.addColorStop(1,'#31253700');sh.fillStyle=sg;sh.fillRect(0,0,256,256);const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(4.6,3.2),new THREE.MeshBasicMaterial({map:canvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=-1.615;scene.add(contactShadow);
 const props=buildPulseProps();scene.add(props.monitor,props.row,props.atmosphere);const monitorCables=cables.clone();props.monitor.add(monitorCables);
 const instruments=buildInstruments(),headphones=buildHeadphones(),glints=buildGlints();const satellites=new THREE.Group();const distantMonitor=props.monitor.clone();distantMonitor.scale.setScalar(.5);distantMonitor.position.set(-5,2.5,-5);satellites.add(distantMonitor);const distantLed=new THREE.Group();distantLed.add(led.clone(),ledFrame.clone());distantLed.children.forEach(o=>o.visible=true);distantLed.scale.setScalar(.5);distantLed.position.set(4,3,-7);satellites.add(distantLed);const distantCups=headphones.clone();distantCups.scale.setScalar(.7);distantCups.position.set(-4,-3,-3);satellites.add(distantCups);scene.add(satellites);scene.add(instruments.mixer,instruments.cables,headphones,glints);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;const sun=new THREE.DirectionalLight('#fff7dd',2.5);sun.position.set(-3,5,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.bias=-.00015;scene.add(sun);
 const arm=new THREE.Group();scene.add(arm);function pipe(a,b,r){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),16),mats.silver);o.position.copy(av.clone().add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());arm.add(o);}pipe([-1.2,.36,-.8],[-1.2,.68,-.8],.07);pipe([-1.2,.68,-.8],[.65,.68,.65],.045);pipe([.65,.68,.65],[.65,.505,.65],.055);const cartridge=new THREE.Mesh(new THREE.BoxGeometry(.15,.12,.21),mats.black);cartridge.position.set(.65,.500,.65);arm.add(cartridge);const stylus=new THREE.Mesh(new THREE.CylinderGeometry(.008,.006,.075,12),mats.silver);stylus.position.set(.65,.401,.65);arm.add(stylus);const counter=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.25,24),mats.silver);counter.rotation.z=Math.PI/2;counter.position.set(-1.43,.68,-.91);arm.add(counter);refineTurntableArm(arm,cartridge,stylus,counter);
// Material-only preview: woven cone, rubber surround, enamel basket and brushed metal.
 const woven=finishMap('rubber'),brushed=finishMap('brush'),paintGrain=finishMap('satin');
 coneMat.roughness=.92;coneMat.metalness=0;coneMat.clearcoat=0;coneMat.bumpMap=woven;coneMat.bumpScale=.025;coneMat.roughnessMap=null;
 mats.black.metalness=0;mats.black.roughness=.88;mats.black.bumpMap=woven;mats.black.bumpScale=.018;
 mats.orange.metalness=.08;mats.orange.roughness=.38;mats.orange.clearcoat=1;mats.orange.clearcoatRoughness=.16;mats.orange.bumpMap=paintGrain;mats.orange.bumpScale=.018;
 mats.silver.roughness=.42;mats.silver.bumpMap=brushed;mats.silver.bumpScale=.022;mats.silver.roughnessMap=brushed;
 dome.material.roughness=.42;dome.material.anisotropy=.85;dome.material.bumpMap=brushed;dome.material.bumpScale=.018;dome.material.clearcoat=0;
const paperFinish=organicSurface('paper'),rubberFinish=organicSurface('leather'),metalFinish=organicSurface('metal');
 Object.assign(coneMat,paperFinish);coneMat.color.set('#34363c');coneMat.roughness=.86;coneMat.bumpMap=null;coneMat.clearcoat=0;coneMat.normalScale.set(.65,.65);
 Object.assign(mats.black,rubberFinish);mats.black.bumpMap=null;mats.black.roughness=.82;mats.black.normalScale.set(.45,.45);
 Object.assign(dome.material,metalFinish);dome.material.bumpMap=null;dome.material.roughness=.31;dome.material.normalScale.set(.35,.35);dome.material.anisotropy=.7;
 mats.orange.bumpMap=null;mats.orange.roughness=.25;mats.orange.clearcoat=.85;mats.orange.clearcoatRoughness=.17;
const glossEnv=glossEnvironmentFactory(renderer);
 for(const m of [mats.orange,mats.silver,dome.material]){m.envMap=glossEnv;m.envMapIntensity=.65;}
 mats.orange.metalness=.0;mats.orange.roughness=.17;mats.orange.clearcoat=.65;mats.orange.clearcoatRoughness=.075;mats.orange.specularIntensity=.72;mats.orange.ior=1.46;
 mats.silver.roughness=.16;mats.silver.bumpMap=null;
 dome.material.roughness=.2;dome.material.anisotropy=.45;dome.material.normalScale.set(.12,.12);dome.material.clearcoat=0;
// Material contrast: satin molded shells, rubber rims, retained metal accents.
 mats.orange.roughness=.43;mats.orange.clearcoat=.08;mats.orange.clearcoatRoughness=.28;
 mats.black.color.set('#101112');mats.black.roughness=.88;mats.black.metalness=0;
 mats.lime.metalness=0;mats.lime.roughness=.57;mats.purple.metalness=0;mats.purple.roughness=.56;
 const refinedMaterials=new Set();
 for(const group of [props.monitor,props.row,headphones,instruments.mixer])group.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m||refinedMaterials.has(m)||!m.isMeshPhysicalMaterial||m.metalness>.4||m.emissiveMap||m.transmission>0||m.userData.preserveOptics)continue;refinedMaterials.add(m);m.roughness=Math.max(m.roughness,.48);m.clearcoat=.06;m.clearcoatRoughness=.3;}});
 const speakerHardware=addSpeakerHardware(rig,mats,ledFrame);configureDetailSampling(renderer,scene);
 const applySurfaceControls=createPulseSurfaceControls({shells:[mats.orange,mats.lime,mats.purple,...refinedMaterials],metals:[mats.silver,dome.material]});
 function render(ctx,t,w,h,p={}){const controls=p.sceneControls,exposure=controlGain(controls,'exposure',.25,3),lensStrength=controlGain(controls,'lensStrength',0,1.25),focusBlur=controlGain(controls,'focusBlur',0,1.5),mechanismMotion=controlGain(controls,'mechanismMotion',0,1.5),keyLight=controlGain(controls,'keyLight',0,2),fillLight=controlGain(controls,'fillLight',0,2),bloomStrength=controlGain(controls,'bloomStrength',0,8);const speakerVibration=controlGain(controls,'speakerVibration',0,2),recordSpeed=controlGain(controls,'recordSpeed',0,2),ledBrightness=controlGain(controls,'ledBrightness',0,3),cameraFraming=controlGain(controls,'cameraFraming',.85,1.2),keySize=controlGain(controls,'keySize',.5,2),rimLight=controlGain(controls,'rimLight',0,2),backgroundBrightness=controlGain(controls,'backgroundBrightness',.25,2);applySurfaceControls(controls);areaKey.width=1.2*keySize;areaKey.height=4.5*keySize;renderer.toneMappingExposure=1.05*exposure;const frameTime=t,clock=editTime(t),mechanismFrameTime=sampleAnimationGroupTime(p,'mechanisms',t),mechanismClock=editTime(mechanismFrameTime),mechanismTime=sourceTime(mechanismClock),cameraFrameTime=sampleAnimationGroupTime(p,'camera',t);t=sourceTime(clock);props.update(t);instruments.update(t);const cream=t>=4.2&&t<6.15?1:0;const dark=t>=6.72&&t<7.775?.05:1;const mix=(a,b)=>Math.min(255,Math.round((a+(b-a)*cream)*dark*backgroundBrightness));const skygrad=sk.createRadialGradient(256,230,20,256,256,390);skygrad.addColorStop(0,`rgb(${mix(20,248)},${mix(66,240)},${mix(170,215)})`);skygrad.addColorStop(1,`rgb(${mix(1,215)},${mix(5,207)},${mix(40,186)})`);sk.fillStyle=skygrad;sk.fillRect(0,0,512,512);scene.background.needsUpdate=true;renderer.setSize(w,h);camera.aspect=w/h;let beat=Math.pow(Math.max(0,Math.sin(t*Math.PI*4)),8);
 const lerp=(a,b,x)=>a+(b-a)*x;
 const ledStart=1.46,mixerStart=2.45,vinylStart=3.15,cableStart=4.2,crtStart=4.85,headStart=6.15,tileStart=7.775;
 satellites.visible=t>=7.775&&t<12.4;satellites.children.forEach((o,j)=>{o.rotation.set(.25*Math.sin(mechanismTime+j),mechanismTime*.3+j,.14*Math.cos(mechanismTime+j));const retreat=ease((mechanismTime-10.2)/1.5);o.position.z=[-5,-7,-3][j]-30*retreat;o.position.y=[2.5,3,-3][j]+[15,15,-15][j]*retreat;});const sp=t<ledStart,ld=t>=ledStart&&t<mixerStart,mi=t>=mixerStart&&t<vinylStart,vi=t>=vinylStart&&t<cableStart,ca=t>=cableStart&&t<crtStart,cr=t>=crtStart&&t<headStart,he=t>=headStart&&t<6.72,or=t>=6.72&&t<tileStart,ti=t>=tileStart;speakerHardware.visible=sp;instruments.mixer.visible=mi;instruments.cables.visible=ca;headphones.visible=he;glints.visible=or;glints.children.forEach((o,j)=>{const a=(mechanismTime-6.72)*4.2+j*1.9;if(j<3){o.position.set(Math.sin(a)*1.15,Math.cos(a*1.1)*.55,Math.cos(a)*.9);o.rotation.y=a;}else{o.position.set(Math.sin(j*2.4+a)*2.4,Math.cos(j*1.7+a)*1.4,Math.sin(j*.7+a)*1.2);}});sun.visible=ca;areaKey.visible=true;areaKey.intensity=12*keyLight;scene.environment=vi?vinylEnvironment:mainEnvironment;scene.environmentIntensity=(vi?1.5:ca?.12:or?.12:.20)*fillLight;scene.children.forEach(o=>{if(o.isPointLight){o.userData.originalIntensity??=o.intensity;o.intensity=o.userData.originalIntensity*(ca?.35:1)*(o.position.x<0?keyLight:fillLight*rimLight);}if(o.isHemisphereLight)o.intensity=.10*fillLight;});headphones.rotation.set(.15*Math.sin(mechanismTime*3), (mechanismTime-6.15)*3.8,-.17+.07*Math.sin(mechanismTime*3));
 floor.visible=cr;contactShadow.visible=cr;rig.visible=sp||ld||vi;props.monitor.visible=cr;props.row.visible=ti;props.atmosphere.visible=ti;cables.visible=sp||ld;vinyl.visible=vi;arm.visible=vi;led.visible=ld;ledFrame.visible=ld;
 for(const p of parts){p.o.position.z=p.z;p.o.visible=sp;}
 function applyMechanismPose(frameTime){const clock=editTime(frameTime),t=sourceTime(clock),beat=Math.pow(Math.max(0,Math.sin(t*Math.PI*4)),8);instruments.update(t);
 cone.scale.y=1+.048*beat*mechanismMotion*speakerVibration;dome.position.z=.57+.026*beat*mechanismMotion*speakerVibration;dome.scale.z=.45;ledMaterial.emissiveIntensity=(1.6+.08*beat)*ledBrightness;
 rig.rotation.set(.13,-.3,0);rig.position.set(0,0,0);if(sp){rig.rotation.z=.105*Math.sin(t*5.2)*mechanismMotion;rig.position.set(.10*Math.sin(t*4.1)*mechanismMotion,.055*Math.sin(t*3.1)*mechanismMotion,0);}for(const sim of cableSimulations){for(let j=1;j<sim.points.length-1;j++){const a=Math.sin(j/(sim.points.length-1)*Math.PI),p=sim.points[j];sim.curve.points[j].set(p.x+.14*a*Math.sin(t*6.5-sim.k*.5-j*.45),p.y+.095*a*Math.sin(t*5.5-sim.k*.7-j*.6),p.z+.13*a*Math.sin(t*4.8-sim.k*.5-j*.4));}if(sp||ld){sim.wire.geometry.dispose();sim.wire.geometry=new THREE.TubeGeometry(sim.curve,96,[.062,.078,.053][sim.k],24,false);}}rig.scale.setScalar(1);vinyl.rotation.z=0;platter.rotation.z=t*3.49*mechanismMotion*recordSpeed;arm.position.set(0,0,0);arm.rotation.set(0,.065*Math.sin((t-3.3)*.9),0);props.monitor.position.set(0,-.12,0);props.monitor.rotation.set(.04*Math.sin((t-4.85)*4),-.08-.23*spring((t-4.85)/.24),.06*Math.sin((t-4.85)*5));props.monitor.position.y=-.12+(cr?pulseLanding(frameTime):.11*impulse(t-4.9));props.row.position.set(0,0,0);props.row.rotation.set(0,0,0);
 // A fast edge-on product turn hides the surface exchange; no visible asset pop.
 if(t>=1.235&&t<1.685){const q=ease((t-1.235)/.45);const cameraYaw=Math.atan2(direction(t).position[0],direction(t).position[2]);rig.rotation.y=cameraYaw+Math.PI*q+(-.3-cameraYaw)*(1-q)**2*Math.cos(q*Math.PI)-(ld?Math.PI:0);rig.rotation.z=.10*Math.sin(q*Math.PI);rig.position.set(.10*Math.sin(t*4.1)*(1-q),.055*Math.sin(t*3.1)*(1-q),0);}
 if(t>=1.685&&t<2.45){const q=spring((t-1.685)/.55),a=Math.atan2(direction(t).position[0],direction(t).position[2]);rig.rotation.y=a-.43*q;rig.rotation.z=-.13*Math.sin((t-1.685)*5.5);rig.position.set(.15*Math.sin((t-1.685)*5),.10*Math.sin((t-1.685)*4),0);}
 if(vi){const yaw=.10*Math.sin((t-3.15)*4.5);rig.quaternion.setFromEuler(new THREE.Euler(-Math.PI/2,yaw,0,'YXZ'));arm.rotation.y=yaw+.065*Math.sin((t-3.3)*.9);}
 // Knob, record and connector macros relay the forward impulse; the later orbit releases the stacked devices.
 if(ti){props.row.rotation.y=.18*Math.sin((t-10.75)*1.6)*ease((t-10.65)/.5);props.row.rotation.z=.045*Math.sin((t-10.75)*2.0)*ease((t-10.65)/.5);for(let j=0;j<5;j++){let q=spring((t-9.28-j*.055)/.62);props.tiles[j].position.x=lerp(-1.34+(j-1)*.28,(j-2)*1.34,q);const reaction=.30*impulse((t-10.72-j*.022)*2.8)+.65*impulse(t-13.1-j*.095)+.55*impulse(t-14.15-j*.065);props.tiles[j].position.y=.22*reaction+lerp(.055,.20,ease((t-10.0)/.6))*Math.sin(t*2.6+j*.7)+.10*Math.sin(t*2+j)*(1-q);props.tiles[j].position.z=lerp([- .65,0,-1.3,-1.95,-2.6][j],.16*Math.sin(t*2.3+j*.8),q);props.tiles[j].rotation.set(.09*reaction+.035*Math.sin(t*.7+j),lerp((j-1)*.18,.22*Math.sin(t*1.8+j*.7),q),.09*Math.sin(t*2.1+j*.8));}}

 // A short impulse releases each mechanical layer; the lock accelerates into
 // its seat and recoils only outward. Authored trajectories and hierarchy stay intact.
 if(ti){const burst=pulseExplosion(frameTime,2,'shell');for(let j=0;j<5;j++){const tile=props.tiles[j],phase=j*.82,follow=Math.sin((t-8.7)*5.2-phase)*.10*burst;tile.position.y+=burst*(j-2)*.20;tile.position.z+=burst*(.26*Math.sin(phase)+(j-2)*.20);tile.rotation.y+=burst*((j-2)*.11+.18*Math.sin(phase));tile.position.x=lerp(tile.position.x,(j-2)*2.12,burst);for(const part of tile.userData.explosion){const partBurst=pulseExplosion(frameTime,j,part.kind);part.o.position.copy(part.p);part.o.rotation.copy(part.r);const vectors={shell:[.14*Math.sin(phase),.28*Math.cos(phase),-.18],front:[.14*Math.sin(phase),-.10*Math.cos(phase),.82],back:[.25*Math.cos(phase),.30*Math.sin(phase),-1.15],cable:[.32*Math.sin(phase),-.25,-.6],support:[.48*Math.cos(phase),.62*Math.sin(phase),-1.8]},v=vectors[part.kind];part.o.position.x+=(v[0]+follow)*partBurst;part.o.position.y+=v[1]*partBurst;part.o.position.z+=v[2]*partBurst;part.o.rotation.y+=partBurst*(part.kind==='support'?.65:part.kind==='back'?-.35:.08)*Math.sin(phase+.5);part.o.rotation.z+=partBurst*(part.kind==='support'?.34:.13)*Math.cos(phase);}}
 const wave=ease((t-11.15)/.28)*(1-ease((t-14.6)/.4)),fold=ease((t-11.45)/.30)*(1-ease((t-12.65)/.45));for(let j=0;j<5;j++){const tile=props.tiles[j],beatPhase=(t-11.15)*5.4-j*.95;tile.position.x*=1-.18*fold;tile.position.y+=fold*.15*(j-2);tile.position.z+=fold*.55*(j-2)+wave*.20*Math.sin(beatPhase);tile.rotation.y+=fold*.16*(j-2)+wave*.12*Math.sin(beatPhase+.4);}
 }
 instruments.mixer.rotation.set(0,0,0);instruments.mixer.position.set(0,0,0);instruments.cables.rotation.set(0,0,0);instruments.cables.position.set(0,0,0);
 if(mi){const u=(clock-2.45);instruments.mixer.rotation.y=.065*Math.sin(u*5.2);instruments.mixer.rotation.z=.025*Math.sin(u*6.2);instruments.knobs.forEach((o,j)=>o.rotation.y+=.18*Math.sin(u*7.4-j*.9));}
 if(ca){const u=(clock-4.25)/1.1;
  instruments.cables.rotation.y=.055*Math.sin(u*4.3);
  instruments.jack.rotation.set(.10*Math.sin(u*Math.PI),-.12+.31*u,-.88+.50*u+.055*Math.sin(u*Math.PI*2));
  instruments.jack.position.set(-.2+.16*Math.sin(u*Math.PI),.025+.12*Math.sin(u*Math.PI),.4+.13*Math.sin(u*Math.PI));
  instruments.updateCableMotion(u);
 }
 }
 applyMechanismPose(frameTime);
 ledMaterial.emissiveIntensity=(1.6+.08*beat)*ledBrightness;
 const target=(()=>{const t=sourceTime(editTime(cameraFrameTime)),clock=editTime(cameraFrameTime);
 const lensClock=editTime(lensCameraTime(cameraFrameTime)),lensTime=sourceTime(lensClock);
 const directed=lensClock>=2.45&&lensClock<7.775?centralDirection(lensClock):direction(lensTime),target=new THREE.Vector3(...directed.target),roll=directed.roll;camera.position.set(...directed.position);// Wide lens, compensated subject framing; original timing and poses are untouched.
 const originalFov=directed.fov;camera.fov=Math.min(116,originalFov+46);
 const distanceRatio=Math.tan(THREE.MathUtils.degToRad(originalFov/2))/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 camera.position.sub(target).multiplyScalar(Math.max(ti?.85:.65,distanceRatio)).add(target);
 // Brief lens-led pushes are layered onto the approved motion, with zero slope
 // at their endpoints. Camera positions stay in front of the actual surfaces.
 const macroWeight=(a,b)=>t<=a||t>=b?0:Math.sin((t-a)/(b-a)*Math.PI)**2;
 if(sp){
   const q=macroWeight(.62,1.18);
   rig.updateWorldMatrix(true,false);
   const localEye=rig.worldToLocal(camera.position.clone()).lerp(new THREE.Vector3(1.75,.64,-2.10),q);
   if(q>0&&localEye.length()<2.60)localEye.setLength(2.60);
   camera.position.copy(rig.localToWorld(localEye));
   target.lerp(rig.localToWorld(new THREE.Vector3(.12,0,-.28)),q);
   camera.fov=THREE.MathUtils.lerp(camera.fov,112,q);
 }
 if(cr){
   const q=clock<=5.43||clock>=6.18?0:Math.sin((clock-5.43)/.75*Math.PI)**2;
   props.monitor.updateWorldMatrix(true,false);
   const slide=(clock-5.43)/.75;
   const macroTarget=props.monitor.localToWorld(new THREE.Vector3(-.40+.15*slide,.06,1.06));
   const macroEye=props.monitor.localToWorld(new THREE.Vector3(.22-.42*slide,.20,2.02));
   target.lerp(macroTarget,q);camera.position.lerp(macroEye,q);camera.fov=THREE.MathUtils.lerp(camera.fov,106,q);
 }
 if(ti){
   const q=macroWeight(7.80,8.53),panel=props.tiles[1].userData.explosion[1].o;
   panel.updateWorldMatrix(true,false);
   const slide=(t-7.80)/.73;
   const macroTarget=panel.localToWorld(new THREE.Vector3(.12-.19*slide,.035,.01));
   const macroEye=panel.localToWorld(new THREE.Vector3(-.29+.26*slide,.16,.70));
   target.lerp(macroTarget,q);camera.position.lerp(macroEye,q);camera.fov=THREE.MathUtils.lerp(camera.fov,110,q);
   // The original orbit skimmed through the rear plate during the explosion.
   // Give that crossing a little more clearance without changing its arc.
   const clearanceWeight=macroWeight(8.78,9.34),clearance=clearanceWeight*1.10;
   camera.position.addScaledVector(camera.position.clone().sub(target).normalize(),clearance);camera.position.y+=.58*clearanceWeight;
   const boardPass=macroWeight(9.52,10.38);
   camera.position.addScaledVector(camera.position.clone().sub(target).normalize(),1.42*boardPass);camera.position.y+=.72*boardPass;
 }
 if(cameraFraming!==1)camera.position.sub(target).multiplyScalar(cameraFraming).add(target);
 camera.up.set(Math.sin(roll),Math.cos(roll),0);camera.lookAt(target);applyCameraLens(camera,p,{target,referenceFov:camera.fov});camera.updateProjectionMatrix();
 return target;})();
 if(mechanismFrameTime!==frameTime)applyMechanismPose(mechanismFrameTime);
 if(w!==renderWidth||h!==renderHeight){composite.setSize(w,h);renderWidth=w;renderHeight=h;}
 const macro=t<1.5||mi||vi||ca||(t>=8.3&&t<10.5),finalHold=t>=12.5;
 const post={bloomStrength:(sp?.025:ti?.065:.045)*bloomStrength,bloomThreshold:1.7,bloomRadius:.18,aoIntensity:mi?.45:ti?.14:or?0:ca?.14:.35,dofEnabled:true,dofAuto:false,dofFocus:mi?new THREE.Vector3(-.55,.29,.9).lerp(new THREE.Vector3(.68,.52,-.05),ease((t-2.45)/.32)).sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())):camera.position.distanceTo(target),dofStrength:(mi?.7:sp?.28:vi?.24:macro?.24:ti?.15:.16)*focusBlur,dofMaxBlur:mi?14:sp?10:macro?12:7,aberrationPx:(mi||vi?1.65:ti?1.15:1.2)*(w/960),fisheye:(p.look?.post?.fisheye??(sp?.64:ld?.56:mi?.64:vi?.53:cr?.43:he?.62:or?.48:ti?(t<10.5?.59:.37):.45))*lensStrength,edgeSoftness:(p.look?.post?.edgeSoftness??1.4)*lensStrength,vignette:.14,lensDistortion:0,antialias:!sp};
 if(p.previewQuality==='fast'){post.dofEnabled=false;post.aoIntensity=0;post.bloomStrength=0;post.bloomEnabled=false;post.antialias=false;}
 composite.applyLook(post);
 composite.setReview(p.review);
 scene.overrideMaterial=reviews.materialFor(p.review);
 const diagnostic=reviews.isDiagnostic(p.review);
 if(!p.cyclesBake){if(diagnostic||p.review==='clean')renderer.render(scene,camera);else composite.render();ctx.drawImage(renderer.domElement,0,0,w,h);}
 // Deliberately crisp vector graphics, rendered after 3D: zero temporal blur.
 ctx.save();ctx.scale(w/1920,h/1080);if(!diagnostic&&t>12.7){ctx.globalAlpha=ease((t-12.7)/.5);ctx.fillStyle='#f4f3df';ctx.textAlign='center';ctx.font='600 25px Arial';ctx.fillText('MOTION LAB',960,978);ctx.font='400 16px Arial';ctx.fillText('YOUR IDEAS. FULL VOLUME.',960,1014);}
 ctx.restore();}
 const cameraChannels=[
  ...['x','y','z'].map(axis=>({id:`camera.position.${axis}`,label:`Camera position ${axis.toUpperCase()}`,unit:'scene units'})),
  ...['x','y','z'].map(axis=>({id:`camera.rotation.${axis}`,label:`Camera rotation ${axis.toUpperCase()}`,unit:'rad'})),
  {id:'camera.fov',label:'Camera field of view',unit:'deg'}
 ];
 const mechanismChannels=[
  {id:'pulse.device.rotation.z',label:'Speaker turn',unit:'rad'},
  {id:'pulse.record.rotation.z',label:'Record rotation',unit:'rad'},
  {id:'pulse.speaker.cone.scale.y',label:'Speaker cone movement',unit:'scale'},
  {id:'pulse.dome.position.z',label:'Dome movement',unit:'scene units'},
  {id:'pulse.mixer.rotation.y',label:'Mixer rotation Y',unit:'rad'},
  {id:'pulse.mixer.rotation.z',label:'Mixer rotation Z',unit:'rad'},
  {id:'pulse.headphones.rotation.y',label:'Headphone rotation Y',unit:'rad'}
 ];
 function captureAuthoredAnimation(groupId){
  if(groupId==='camera')return{channels:cameraChannels.map(channel=>({...channel})),values:{'camera.position.x':camera.position.x,'camera.position.y':camera.position.y,'camera.position.z':camera.position.z,'camera.rotation.x':camera.rotation.x,'camera.rotation.y':camera.rotation.y,'camera.rotation.z':camera.rotation.z,'camera.fov':camera.fov}};
  if(groupId==='mechanisms')return{channels:mechanismChannels.map(channel=>({...channel})),values:{'pulse.device.rotation.z':rig.rotation.z,'pulse.record.rotation.z':platter.rotation.z,'pulse.speaker.cone.scale.y':cone.scale.y,'pulse.dome.position.z':dome.position.z,'pulse.mixer.rotation.y':instruments.mixer.rotation.y,'pulse.mixer.rotation.z':instruments.mixer.rotation.z,'pulse.headphones.rotation.y':headphones.rotation.y}};
  return{channels:[],values:{}};
 }
 return {render,scene,camera,renderer,shutterAngleAt,state:()=>({camera:camera.position.toArray(),direction:camera.getWorldDirection(new THREE.Vector3()).toArray(),fov:camera.fov,rigEuler:[rig.rotation.x,rig.rotation.y,rig.rotation.z],impactCues:pulseImpactCues}),animationChannels(groupId){return(groupId==='camera'?cameraChannels:groupId==='mechanisms'?mechanismChannels:[]).map(channel=>({...channel}));},captureAuthoredAnimation,actualState:captureAuthoredAnimation,dispose:()=>{reviews.dispose();renderer.dispose();}};
}
