import {createSceneCanvas} from '../engine/scene-canvas.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const mat=(color,metalness=0,roughness=.3)=>new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:.35,clearcoatRoughness:.2});
const make=(g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;return o;};
const box=(w,h,d,r,m,x,y,z)=>make(new RoundedBoxGeometry(w,h,d,6,r),m,x,y,z);
export function buildInstruments(){
 const mixer=new THREE.Group(),knurl=mat('#464b56',.75,.32),blue=mat('#467ab4',.32,.21),cream=mat('#eae5ce',.03,.25),metal=mat('#d1d8e0',.92,.22),black=mat('#101827',.1,.36),orange=mat('#d77a49',.35,.24),knobs=[],pads=[],meters=[];
 mixer.add(box(3.9,.26,1.55,.12,blue,.65,.1,-.1));
 const gloss=new Reflector(new THREE.PlaneGeometry(3.55,1.25),{textureWidth:512,textureHeight:256,multisample:0,color:'#54789a',clipBias:.0002});gloss.rotation.x=-Math.PI/2;gloss.position.set(.65,.234,-.1);gloss.material.fragmentShader=gloss.material.fragmentShader.replace('blendOverlay( base.rgb, color ), 1.0','blendOverlay( base.rgb, color ), 0.25');gloss.material.transparent=true;gloss.material.depthWrite=false;const reflectionUpdate=gloss.onBeforeRender;gloss.onBeforeRender=function(r,s,c,g,m,group){if(m===gloss.material&&!s.overrideMaterial)reflectionUpdate.call(this,r,s,c,g,m,group);};mixer.add(gloss);
 const padColors=['#eed387','#b8d870','#c2b8e9','#adcfe7'];
 mixer.add(box(1.7,.12,2.1,.12,black,-.8,.0,.66));
 for(let j=0;j<12;j++){let c=j%3,r=Math.floor(j/3);const p=box(.45,.2,.44,.10,mat(padColors[(j+r)%4],.02,.48),-1.3+c*.5,.19,1.42-r*.49);mixer.add(p);pads.push(p);}
 for(let j=0;j<5;j++){let px=-.88+j*.78,pz=-.25+j*.10;const knob=new THREE.Group();knob.position.set(px,.24,pz);knob.add(make(new THREE.CylinderGeometry(.24,.27,.15,48),black,0,.075,0));for(let k=0;k<32;k++){let a=k/32*Math.PI*2;const ridge=box(.027,.13,.03,.008,knurl,Math.sin(a)*.258,.078,Math.cos(a)*.258);ridge.rotation.y=a;knob.add(ridge);}knob.add(make(new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.18,0),new THREE.Vector2(.205,.02),new THREE.Vector2(.205,.23),new THREE.Vector2(.18,.26),new THREE.Vector2(0,.26)],48),mat(['#adc86c','#9d8ac7','#f4f1e4','#e7ce8a','#e78557'][j],j===2?.7:.12,.23),0,.15,0));knob.add(box(.025,.009,.09,.004,cream,0,.418,-.085));mixer.add(knob);knobs.push(knob);}
 const eq=new THREE.Group();eq.position.set(-.35,.32,-1.45);eq.rotation.y=-.16;eq.add(box(2.55,.73,.25,.12,orange,0,.2,0));const screen=box(1.48,.42,.03,.05,black,-.52,.24,.143);eq.add(screen);
 const emissive=new THREE.MeshStandardMaterial({color:'#d4ff8d',emissive:'#a5f95d',emissiveIntensity:1.25});for(let i=0;i<18;i++){let h=.06+(1+Math.sin(i*.9))*.1;const meter=box(.055,h,.012,.01,emissive,-1.17+i*.072,.12+h/2,.17);meter.userData.height=h;eq.add(meter);meters.push(meter);}for(let i=0;i<3;i++)eq.add(make(new THREE.CylinderGeometry(.12,.12,.13,32),metal,-.5+i*.5,.64,0));mixer.add(eq);
 const cables=new THREE.Group(),jack=new THREE.Group(),wall=new THREE.Mesh(new THREE.PlaneGeometry(16,10),new THREE.MeshStandardMaterial({color:'#eee8dc',roughness:.7}));wall.position.z=-.75;wall.receiveShadow=true;cables.add(wall);
 const cableRuns=[];
 const addTube=(points,r,color)=>{const c=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));const o=make(new THREE.TubeGeometry(c,96,r,14,false),mat(color,.06,.34));cables.add(o);cableRuns.push({mesh:o,curve:c,base:c.points.map(p=>p.clone()),radius:r});};
 addTube([[-3,-1.7,.25],[-1.4,-1.3,.32],[-.75,-.65,.35],[-.32,-.17,.35]],.095,'#315bbb');
 addTube([[-1.5,3,-.05],[-1.35,1.3,-.02],[-1.42,-1.2,.04],[-2.5,-1.55,.05]],.07,'#c7dc69');
 addTube([[1.05,3,-.10],[.9,.9,-.03],[1.25,-1.2,-.01],[2.6,-1.28,-.05]],.085,'#9180c2');
 const coil=[];for(let i=0;i<=190;i++){let a=i/190*Math.PI*13;coil.push([-.1+Math.sin(a)*.16,2.8-i/190*2.15,-.12+Math.cos(a)*.16]);}addTube(coil,.04,'#426baa');
 addTube([[2.6,2.5,-.25],[2.05,.8,-.2],[2.65,-.65,-.1]],.055,'#d9814c');
 const cylinder=(r1,r2,h,m,y)=>jack.add(make(new THREE.CylinderGeometry(r1,r2,h,48),m,0,y,0));
 cylinder(.14,.12,.4,blue,-.53);cylinder(.26,.22,.25,orange,-.29);for(let j=0;j<32;j++){let a=j/32*Math.PI*2;const r=box(.025,.23,.026,.008,mat('#b95a32',.12,.36),Math.sin(a)*.255,-.29,Math.cos(a)*.255);r.rotation.y=a;jack.add(r);}cylinder(.23,.23,.44,mat('#adc963',.12,.28),.055);cylinder(.25,.25,.025,metal,.29);cylinder(.10,.105,.61,metal,.62);for(let y of [.51,.72])cylinder(.111,.111,.043,black,y);jack.add(make(new THREE.SphereGeometry(.108,32,20),metal,0,.95,0));jack.rotation.z=-.72;jack.position.set(-.2,.0,.40);cables.add(jack);
 // Follow the connector in parent space; the strain relief and cable share one endpoint.
 function updateCableMotion(u){
  jack.updateMatrix();
  const end=new THREE.Vector3(0,-.72,0).applyMatrix4(jack.matrix);
  const tangent=new THREE.Vector3(0,-1,0).transformDirection(jack.matrix);
  cableRuns.forEach((run,k)=>{
   const points=run.curve.points;
   points.forEach((p,j)=>{p.copy(run.base[j]);const a=j/(points.length-1),envelope=Math.sin(a*Math.PI);p.x+=envelope*.045*Math.sin(u*6-k*.7-a*2);p.z+=envelope*.035*Math.sin(u*5-k-a*2.5);});
   if(k===0){points[points.length-1].copy(end);points[points.length-2].copy(end).addScaledVector(tangent,.52);points[1].x+=.09*Math.sin(u*4-.4);}
   run.mesh.geometry.dispose();run.mesh.geometry=new THREE.TubeGeometry(run.curve,96,run.radius,14,false);
  });
 }
 return{mixer,cables,wall,jack,knobs,updateCableMotion,update(t){knobs.forEach((o,j)=>{const x=Math.max(0,(t-2.52-j*.025)/.20),spring=1-Math.exp(-9*x)*(Math.cos(10*x)+.9*Math.sin(10*x));o.rotation.y=(j===2?.7:.24)*spring+.05*Math.sin(t*4+j);});pads.forEach((p,j)=>{const press=[3.08,2.64,2.8,2.50,2.94,2.75,2.58,2.88,3.0,2.7,2.98,2.84][j],push=Math.exp(-Math.pow((t-press)/.075,2));p.position.y=.19-.050*push;p.material.emissive.set(p.material.color);p.material.emissiveIntensity=.10*push;});meters.forEach((m,j)=>{const s=.3+.7*Math.pow(Math.max(0,Math.sin(t*Math.PI*4+j*.64)),2);m.scale.y=s;m.position.y=.12+m.userData.height*s/2;});jack.rotation.set(0,0,-.72+.075*Math.sin((t-4.2)*9)*Math.exp(-Math.max(0,t-4.2)*2));jack.position.set(-.2,.035*Math.sin(t*1.7),.4);}};
}
export function buildHeadphones(){
 const group=new THREE.Group(),gold=mat('#c7ae61',.88,.21),silver=mat('#bfc8d5',.93,.21),leather=mat('#0c101d',.03,.36);const band=new THREE.Mesh(new THREE.TorusGeometry(1.05,.10,20,96,Math.PI),gold);band.position.y=.2;group.add(band);for(const z of [-.08,.08]){const rail=new THREE.Mesh(new THREE.TorusGeometry(1.05,.033,12,96,Math.PI),silver);rail.position.set(0,.2,z);group.add(rail);}const pad=new THREE.Mesh(new THREE.TorusGeometry(.98,.07,16,96,Math.PI),leather);pad.position.set(0,.2,0);group.add(pad);
 const c=createSceneCanvas();c.width=256;c.height=256;const x=c.getContext('2d');x.fillStyle='#030609';x.fillRect(0,0,256,256);for(let j=0;j<25;j++){let xx=19+j*9,h=40+115*Math.pow(Math.max(0,Math.cos((xx-128)/110*Math.PI/2)),2);x.fillStyle=['#ffd994','#d89443','#79562c'][j%3];x.fillRect(xx,128-h/2,3.5,h);}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const grille=new THREE.MeshPhysicalMaterial({map:tex,emissiveMap:tex,emissive:'#ffd18b',emissiveIntensity:1.8,metalness:.25,roughness:.3,side:THREE.DoubleSide});
 for(const side of [-1,1]){const cup=new THREE.Group();cup.position.set(side*1.0,-.10,0);cup.rotation.z=side*.10;const outer=make(new THREE.CylinderGeometry(.57,.57,.44,64),leather);outer.rotation.z=Math.PI/2;cup.add(outer);for(const k of [-1,1]){const rim=make(new THREE.TorusGeometry(.535,.045,16,72),gold,k*.24,0,0);rim.rotation.y=Math.PI/2;cup.add(rim);const face=make(new THREE.CircleGeometry(.5,64),grille,k*.285,0,0);face.rotation.y=k*Math.PI/2;cup.add(face);}const fork=box(.10,.76,.15,.035,gold,side*.10,.49,-.14);cup.add(fork);for(let j=0;j<7;j++)cup.add(box(.045,.055,.157,.008,leather,side*.10,.25+j*.07,-.139));group.add(cup);}
 return group;
}
export function buildGlints(){const g=new THREE.Group();for(let j=0;j<3;j++){const o=make(new THREE.SphereGeometry([.66,.48,.78][j],48,32),mat(['#090c13','#ad4d24','#11264f'][j],.98,.12));o.userData.index=j;g.add(o);}for(let j=0;j<22;j++){const o=make(new THREE.IcosahedronGeometry(.025+(j%3)*.012,0),mat('#bed5f3',.95,.12));o.userData.small=j;g.add(o);}return g;}
