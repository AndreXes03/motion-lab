import {createSceneCanvas} from '../engine/scene-canvas.js';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const physical=(color,metalness,roughness)=>new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:0});
const unitBox=new THREE.BoxGeometry(1,1,1);
const headGeo=new THREE.CylinderGeometry(1,1,1,16).rotateX(Math.PI/2);
const ringGeo=new THREE.TorusGeometry(1,.16,6,20);
const ledLensGeo=new THREE.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2);

export function createPulseHardwareKit(){
  return {
    rubber:physical('#101314',0,.88), plastic:physical('#202527',0,.68),
    board:physical('#173333',.08,.65), copper:physical('#a59155',.76,.36),
    metal:physical('#8e979c',.91,.29), pale:physical('#c8c9bd',0,.63),
    ceramic:physical('#a68e66',0,.67), ink:physical('#d1d4bf',0,.76),
  };
}

function block(parent,name,size,position,material,radius=.008){
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(...size,3,Math.min(radius,...size.map(v=>v*.45))),material);
  mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function outlinedRect(path,w,h,r,x=0,y=0){
  const l=x-w/2,b=y-h/2,R=x+w/2,t=y+h/2;
  path.moveTo(l+r,b);path.lineTo(R-r,b);path.quadraticCurveTo(R,b,R,b+r);path.lineTo(R,t-r);path.quadraticCurveTo(R,t,R-r,t);path.lineTo(l+r,t);path.quadraticCurveTo(l,t,l,t-r);path.lineTo(l,b+r);path.quadraticCurveTo(l,b,l+r,b);path.closePath();
}

function cutPanelGeometry(w,h,d,r,holes){
  const shape=new THREE.Shape();outlinedRect(shape,w,h,r);
  for(const hole of holes){const p=new THREE.Path();outlinedRect(p,hole.w,hole.h,hole.r??.025,hole.x??0,hole.y??0);shape.holes.push(p);}
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2,curveSegments:24});geometry.translate(0,0,-d/2);return geometry;
}

function batch(parent,name,geometry,material,items){
  if(!items.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,items.length),dummy=new THREE.Object3D();
  mesh.name=name;
  items.forEach((item,i)=>{dummy.position.set(...item.p);dummy.scale.set(...item.s);dummy.rotation.set(...(item.r||[0,0,0]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);return mesh;
}

function screwSet(parent,points,kit,r=.025){
  batch(parent,'recessed screw heads',headGeo,kit.metal,points.map(p=>({p,s:[r,r,.012]})));
  batch(parent,'screw driver slots',unitBox,kit.rubber,points.flatMap(([x,y,z])=>[
    {p:[x,y,z+.0064],s:[r*1.1,r*.20,.0015]},
    {p:[x,y,z+.0064],s:[r*.20,r*1.1,.0015]},
  ]));
}

function ring(parent,name,x,y,z,r,material){
  const o=new THREE.Mesh(ringGeo,material);o.name=name;o.position.set(x,y,z);o.scale.setScalar(r);parent.add(o);return o;
}

function compactStaticDetails(root){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),groups=new Map();
  root.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;
    const key=o.material.uuid+'|'+Object.keys(o.geometry.attributes).sort().join(',')+'|'+Boolean(o.geometry.index);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);
  });
  for(const meshes of groups.values()){
    if(meshes.length<2)continue;
    const parts=meshes.map(o=>o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
    if(!geometry)continue;
    const merged=new THREE.Mesh(geometry,meshes[0].material);
    merged.name='static hardware batch';merged.userData.components=meshes.map(o=>o.name);
    merged.castShadow=true;merged.receiveShadow=true;meshes.forEach(o=>o.removeFromParent());root.add(merged);
  }
}

function silkLabel(parent,name,text,w,h,p,kit){
  const canvas=createSceneCanvas();canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#c2ccbc';ctx.font='500 38px monospace';ctx.textBaseline='middle';ctx.fillText(text,5,64);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.82,metalness:0});
  const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);o.name=name;o.position.set(...p);parent.add(o);
}

function boardUnderside(parent,kit,width,height,z,label){
  const rear=new THREE.Group();rear.name='PCB solder side';rear.rotation.y=Math.PI;rear.position.z=z;parent.add(rear);
  const pads=[],traces=[];
  for(let bank=0;bank<2;bank++)for(let i=0;i<9;i++){
    const x=(bank?1:-1)*width*.22,y=-height*.32+i*height*.080;
    pads.push({p:[x,y,.0035],s:[.014,.014,.008]});
    traces.push({p:[x+(bank?1:-1)*width*.12,y,.001],s:[width*.22,.006,.002]});
  }
  batch(rear,'through-hole solder domes',headGeo,kit.metal,pads);
  batch(rear,'back-side etched tracks',unitBox,kit.copper,traces);
  for(const side of [-1,1])block(rear,'ground return',[.012,height*.77,.002],[side*width*.39,0,.001],kit.copper,.001);
  silkLabel(rear,'underside service marks',label,width*.64,height*.12,[0,-height*.405,.0025],kit);
}

function flexHarness(parent,kit){
  const route=new THREE.CatmullRomCurve3([new THREE.Vector3(-.36,.32,-.065),new THREE.Vector3(-.385,.05,.025),new THREE.Vector3(-.24,-.18,.035),new THREE.Vector3(.225,-.27,-.060)]);
  const vertices=[],uv=[],indices=[],width=.095;
  for(let i=0;i<=48;i++){const u=i/48,p=route.getPoint(u),t=route.getTangent(u),across=new THREE.Vector3(-t.y,t.x,0).normalize();for(const side of [-1,1]){const v=p.clone().addScaledVector(across,side*width/2);vertices.push(v.x,v.y,v.z);uv.push((side+1)/2,u);}if(i<48){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const kapton=new THREE.MeshPhysicalMaterial({color:'#75542c',metalness:.26,roughness:.40,clearcoat:.28,clearcoatRoughness:.20,side:THREE.DoubleSide});
  const ribbon=new THREE.Mesh(geometry,kapton);ribbon.name='folded Kapton display bus';parent.add(ribbon);
  for(let j=0;j<6;j++){const points=[];for(let i=0;i<=32;i++){const u=i/32,p=route.getPoint(u),t=route.getTangent(u);p.addScaledVector(new THREE.Vector3(-t.y,t.x,0).normalize(),(j-2.5)*.013);p.z+=.0015;points.push(p);}const wire=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.0019,5,false),kit.copper);wire.name='flex copper conductor';parent.add(wire);}
  block(parent,'locking flex header',[.16,.068,.075],[-.36,.32,-.104],kit.pale,.01);
  block(parent,'flex header locking bar',[.13,.018,.017],[-.36,.34,-.061],kit.plastic,.004);
}

// These components inherit the existing shell/front/back/support choreography.
// No new independently animated explosion parts or screen overlays are introduced.
export function addPulseTileHardware({shell,seal,panel,mask,color,back,support,index,kit}){
  // A stamped open carrier replaces the opaque rear slab, exposing real depth.
  const carrier=back.children.find(o=>o.geometry?.type==='ExtrudeGeometry');
  if(carrier){const old=carrier.geometry;carrier.geometry=cutPanelGeometry(1.11,1.21,.045,.18,[{w:.86,h:.96,r:.11}]);carrier.material=kit.plastic;carrier.name='open stamped electronics carrier';old.dispose();}
  const lenses=[],activeColor=new THREE.Color(color).multiplyScalar(1.65),darkColor=new THREE.Color('#10191b');
  for(let yy=4;yy<184;yy+=5)for(let xx=4;xx<156;xx+=5){
    const x=(xx/160-.5)*1.04,y=(.5-yy/188)*1.11;
    const cornerX=Math.max(0,Math.abs(x)-.37),cornerY=Math.max(0,Math.abs(y)-.405);
    if(cornerX*cornerX+cornerY*cornerY>.143*.143)continue;
    lenses.push({p:[x,y,.0105],s:[.0090,.0084,.0062],active:mask[(yy*160+xx)*4]>100});
  }
  const optics=new THREE.MeshPhysicalMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:.75,roughness:.21,metalness:0,clearcoat:.32,clearcoatRoughness:.12});
  optics.userData.preserveOptics=true;
  optics.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');};
  optics.customProgramCacheKey=()=> 'pulse-led-epoxy-v10';
  const lensMesh=batch(panel,'individual LED epoxy lenses',ledLensGeo,optics,lenses);
  lenses.forEach((p,i)=>lensMesh.setColorAt(i,p.active?activeColor:darkColor));
  lensMesh.instanceColor.needsUpdate=true;lensMesh.castShadow=false;
  const frontHardware=new THREE.Group();frontHardware.name='LED optical carrier and gasket';seal.add(frontHardware);
  const gasketZ=-.042; // Relative to the original seal at z .208.
  for(const side of [-1,1]){
    block(frontHardware,'gasket lip',[.018,.96,.017],[side*.48,0,gasketZ],kit.rubber);
    block(frontHardware,'gasket lip',[.91,.018,.017],[0,side*.525,gasketZ],kit.rubber);
  }
  const shellDetail=new THREE.Group();shellDetail.name='LED cast shell fasteners';shell.add(shellDetail);
  const corners=[[-.46,-.50],[.46,-.50],[-.46,.50],[.46,.50]];
  screwSet(shellDetail,corners.map(([x,y])=>[x,y,.265]),kit,.020);
  batch(shellDetail,'shell inner mounting bosses',headGeo,kit.metal,corners.map(([x,y])=>({p:[x,y,-.02],s:[.038,.038,.23]})));

  const pcb=new THREE.Group();pcb.name='LED driver PCB assembly';back.add(pcb);
  const driverBoard=new THREE.Mesh(cutPanelGeometry(.98,1.06,.028,.04,[{x:.035,y:.29,w:.07,h:.18,r:.025},{x:.031,y:-.26,w:.075,h:.20,r:.025}]),kit.board);driverBoard.name='routed FR4 driver board';driverBoard.position.z=-.17;pcb.add(driverBoard);
  block(pcb,'FR4 exposed edge',[.982,.012,.031],[0,-.525,-.17],kit.ceramic,.002);
  const chips=[[-.15,.18,.29,.27], [.24,.24,.16,.21], [-.16,-.26,.29,.16]];
  const leads=[];
  chips.forEach(([x,y,w,h],ci)=>{
    block(pcb,ci===0?'LED matrix driver IC':'power and timing IC',[w,h,.073],[x,y,-.113],kit.plastic,.012);
    block(pcb,'IC pin-one marker',[.017,.017,.002],[x-w*.33,y+h*.30,-.075],kit.ink,.003);
    for(let k=0;k<7;k++)for(const side of [-1,1])leads.push({p:[x+side*(w/2+.018),y-h*.37+k*h*.123,-.151],s:[.047,.010,.012]});
  });
  batch(pcb,'IC gull-wing terminals',unitBox,kit.metal,leads);
  const traces=[];
  for(let k=0;k<8;k++){
    const y=-.42+k*.111;
    traces.push({p:[.325,y,-.1535],s:[.19,.006,.002]}, {p:[.425,y+.027,-.1535],s:[.006,.06,.002]});
    traces.push({p:[-.34,y,-.1535],s:[.145,.006,.002]});
  }
  batch(pcb,'etched copper routing',unitBox,kit.copper,traces);
  const passives=[],solder=[];
  for(let i=0;i<10;i++){
    const x=-.38+(i%5)*.152,y=i<5?.442:-.424;
    passives.push({p:[x,y,-.134],s:[.051,.025,.025]});
    for(const s of [-1,1])solder.push({p:[x+s*.028,y,-.134],s:[.015,.028,.027]});
  }
  batch(pcb,'ceramic bypass capacitors',unitBox,kit.ceramic,passives);
  batch(pcb,'passive solder terminations',unitBox,kit.metal,solder);
  batch(pcb,'mounting stand-offs',headGeo,kit.copper,corners.map(([x,y])=>({p:[x*.89,y*.91,-.225],s:[.032,.032,.105]})));
  screwSet(pcb,corners.map(([x,y])=>[x*.89,y*.91,-.145]),kit,.021);
  block(pcb,'board connector housing',[.25,.105,.09],[.225,-.27,-.105],kit.pale,.010);
  batch(pcb,'board connector gold contacts',unitBox,kit.copper,Array.from({length:6},(_,i)=>({p:[.14+i*.034,-.22,-.10],s:[.012,.05,.011]})));
  silkLabel(pcb,'PCB silkscreen',`P / ${index+1}    REV.02`,.49,.123,[0,-.055,-.151],kit);
  boardUnderside(pcb,kit,.98,1.06,-.185,`DRIVER / ${index+1}`);
  flexHarness(pcb,kit);

  const sink=new THREE.Group();sink.name='rear heat spreader';back.add(sink);
  block(sink,'anodized heat spreader',[.81,.56,.028],[0,-.045,-.317],kit.plastic,.014);
  batch(sink,'heat sink fins',unitBox,kit.metal,Array.from({length:11},(_,i)=>({p:[-.35+i*.07,-.045,-.357],s:[.014,.48,.07]})));
  const rearScrews=new THREE.Group();rearScrews.rotation.y=Math.PI;back.add(rearScrews);
  screwSet(rearScrews,corners.map(([x,y])=>[x*.9,y*.89,.30]),kit,.023);

  const bus=new THREE.Group();bus.name='rear power bus and carrier';support.add(bus);
  const busBoard=new THREE.Mesh(cutPanelGeometry(.78,.87,.018,.025,[{x:0,y:.11,w:.27,h:.25,r:.028}]),kit.board);busBoard.name='open-centre power bus PCB';busBoard.position.z=-.50;bus.add(busBoard);
  const busTraces=[];
  for(let i=0;i<6;i++){const x=-.29+i*.116;if(Math.abs(x)>.14)busTraces.push({p:[x,.0,-.488],s:[.017,.68,.004]});}
  batch(bus,'parallel power traces',unitBox,kit.copper,busTraces);
  block(bus,'power header',[.40,.11,.10],[0,.32,-.443],kit.plastic,.011);
  batch(bus,'header contacts',headGeo,kit.copper,Array.from({length:8},(_,i)=>({p:[-.151+i*.043,.32,-.368],s:[.009,.009,.095]})));
  block(bus,'voltage regulator',[.33,.23,.10],[.04,-.15,-.434],kit.plastic,.01);
  batch(bus,'regulator fins',unitBox,kit.metal,Array.from({length:7},(_,i)=>({p:[-.098+i*.046,-.15,-.375],s:[.011,.19,.03]})));
  screwSet(bus,corners.map(([x,y])=>[x*.83,y*.78,-.475]),kit,.022);
  boardUnderside(bus,kit,.78,.87,-.510,'12V / GND');
  for(const group of [frontHardware,pcb,sink,bus])compactStaticDetails(group);
}

export function addCrtHardware(monitor,kit){
  const hardware=new THREE.Group();hardware.name='CRT service hardware';monitor.add(hardware);
  const rear=new THREE.Group();rear.rotation.y=Math.PI;rear.position.z=-1.187;hardware.add(rear);
  block(rear,'rear IO recess',[1.48,.46,.015],[0,-.62,.006],kit.rubber,.07);
  block(rear,'rear IO insert',[1.34,.36,.025],[0,-.62,.022],kit.plastic,.04);
  block(rear,'shielded display socket',[.45,.165,.11],[-.30,-.62,.07],kit.metal,.023);
  block(rear,'display socket tongue',[.37,.11,.012],[-.30,-.62,.13],kit.plastic,.018);
  batch(rear,'display connector contacts',headGeo,kit.copper,Array.from({length:15},(_,i)=>({p:[-.44+(i%5)*.07,-.65+Math.floor(i/5)*.035,.139],s:[.007,.007,.006]})));
  for(const xx of [.26,.46]){
    ring(rear,'audio jack ferrule',xx,-.62,.061,.059,kit.metal);
    block(rear,'audio jack core',[.06,.06,.008],[xx,-.62,.06],kit.rubber,.025);
  }
  screwSet(rear,[[-.62,-.62,.047],[.63,-.62,.047],[-1.15,.86,.006],[1.15,.86,.006],[-1.15,-.86,.006],[1.15,-.86,.006]],kit,.033);
  const vents=[];
  for(let row=0;row<3;row++)for(let i=0;i<13;i++)vents.push({p:[-.92+i*.152,.22+row*.17,.001],s:[.075,.085,.009]});
  batch(rear,'rear ventilation grille',unitBox,kit.rubber,vents);
  silkLabel(rear,'CRT service label','PULSE  CRT-15   /   VIDEO IN',1.22,.18,[0,-.94,.008],kit);
  const top=new THREE.Group();top.name='CRT recessed top cooling bank';top.position.set(0,1.267,-.20);top.rotation.x=-Math.PI/2-.184;hardware.add(top);
  block(top,'ventilation cavity',[2.31,.59,.022],[0,0,.004],kit.rubber,.035);
  const topFrame=new THREE.Mesh(cutPanelGeometry(2.38,.66,.043,.06,[{w:2.22,h:.50,r:.022}]),kit.pale);topFrame.position.z=.022;top.add(topFrame);
  batch(top,'moulded cooling louvers',unitBox,kit.pale,Array.from({length:9},(_,i)=>({p:[0,-.218+i*.0545,.027],s:[2.21,.025,.046]})));
  for(const side of [-1,1]){
    const grille=new THREE.Group();grille.name='CRT recessed side cooling bank';grille.position.set(side*1.684,-.05,-.12);grille.rotation.y=side*(Math.PI/2+.176);hardware.add(grille);
    block(grille,'side grille cavity',[.72,1.30,.026],[0,0,.006],kit.rubber,.04);
    const frame=new THREE.Mesh(cutPanelGeometry(.78,1.37,.045,.07,[{w:.62,h:1.18,r:.025}]),kit.pale);frame.position.z=.020;grille.add(frame);
    batch(grille,'moulded side louvers',unitBox,kit.pale,Array.from({length:10},(_,i)=>({p:[0,-.526+i*.117,.024],s:[.62,.047,.049]})));
  }
  for(const side of [-1,1]){
    block(hardware,'case side parting seam',[.008,1.85,.013],[side*1.758,0,.381],kit.plastic,.003);
    for(const z of [-.68,.43])block(hardware,'anti-slip foot',[.43,.13,.34],[side*1.16,-1.422,z],kit.rubber,.053);
  }
  block(hardware,'lower control strip',[1.64,.096,.031],[.10,-1.265,.82],kit.plastic,.017);
  batch(hardware,'tactile adjustment keys',unitBox,kit.pale,Array.from({length:4},(_,i)=>({p:[-.43+i*.23,-1.265,.843],s:[.115,.055,.025]})));
  block(hardware,'power switch',[.20,.085,.041],[.67,-1.26,.83],kit.pale,.02);
  const led=new THREE.Mesh(new THREE.SphereGeometry(.018,12,8),new THREE.MeshStandardMaterial({color:'#b9d36d',emissive:'#9bb946',emissiveIntensity:.35,roughness:.4}));
  led.position.set(.93,-1.25,.835);hardware.add(led);
  compactStaticDetails(hardware);
}

export function addVinylHardware(g,kit){
  const hardware=new THREE.Group();hardware.name='turntable service and control hardware';g.add(hardware);
  // The record rests on a machined platter; its edge is readable in the macro.
  const platterProfile=[new THREE.Vector2(1.39,.286),new THREE.Vector2(1.465,.286),new THREE.Vector2(1.492,.304),new THREE.Vector2(1.492,.333),new THREE.Vector2(1.463,.351),new THREE.Vector2(1.435,.351)];
  const platterRim=new THREE.Mesh(new THREE.LatheGeometry(platterProfile,192).rotateX(Math.PI/2),kit.metal);platterRim.name='machined stepped platter rim';hardware.add(platterRim);
  const strobeGeo=new THREE.SphereGeometry(1,8,6),strobe=[];
  for(let row=0;row<2;row++)for(let i=0;i<96;i++){const a=(i+(row?.5:0))/96*Math.PI*2;strobe.push({p:[Math.sin(a)*1.493,Math.cos(a)*1.493,.307+row*.017],s:[.012,.007,.005],r:[0,0,-a]});}
  batch(hardware,'platter strobe markings',strobeGeo,kit.rubber,strobe);
  const feet=[];
  for(const x of [-1.32,1.32])for(const y of [-1.2,1.2]){
    feet.push({p:[x,y,-.33],s:[.215,.215,.20]});
    ring(hardware,'isolation foot trim',x,y,-.365,.19,kit.metal);
  }
  batch(hardware,'rubber isolation feet',headGeo,kit.rubber,feet);
  for(const side of [-1,1]){
    block(hardware,'chassis separation seam',[3.09,.009,.012],[0,side*1.718,-.035],kit.rubber,.002);
    block(hardware,'chassis separation seam',[.009,2.95,.012],[side*1.818,0,-.035],kit.rubber,.002);
  }
  block(hardware,'speed selector well',[.50,.17,.024],[-.50,-1.43,.299],kit.plastic,.033);
  block(hardware,'speed selector toggle',[.15,.112,.057],[-.59,-1.43,.33],kit.metal,.02);
  for(const x of [-.78,-.25])block(hardware,'selector legend mark',[.040,.007,.003],[x,-1.43,.298],kit.rubber,.001);
  block(hardware,'pitch fader surround',[.28,.77,.022],[1.51,-.80,.296],kit.plastic,.03);
  block(hardware,'pitch fader track',[.028,.60,.008],[1.51,-.80,.312],kit.rubber,.003);
  block(hardware,'pitch fader cap',[.17,.086,.07],[1.51,-.82,.35],kit.metal,.018);
  block(hardware,'fader cap marker',[.12,.009,.002],[1.51,-.82,.386],kit.rubber,.002);
  batch(hardware,'pitch scale ticks',unitBox,kit.rubber,Array.from({length:9},(_,i)=>({p:[1.29,-1.07+i*.069,.296],s:[i===4?.10:.053,.008,.002]})));
  screwSet(hardware,[[-1.55,-1.46,.302],[-1.55,1.46,.302],[1.55,1.46,.302]],kit,.027);
  const rear=new THREE.Group();rear.rotation.x=-Math.PI/2;rear.position.set(0,1.727,-.08);hardware.add(rear);
  block(rear,'rear signal panel',[1.0,.17,.017],[.4,0,0],kit.plastic,.02);
  for(const x of [.18,.47]){
    ring(rear,'RCA connector socket',x,0,.04,.05,kit.metal);
    ring(rear,'RCA insulation ring',x,0,.047,.03,kit.rubber);
  }
  block(rear,'ground terminal',[.045,.045,.07],[.76,0,.043],kit.metal,.015);
  compactStaticDetails(hardware);
}

export function refineTurntableArm(arm,cartridge,stylus,counter){
  const kit=createPulseHardwareKit();
  // Smooth the original tubing while preserving its endpoints and transforms.
  for(const o of arm.children){const p=o.geometry?.parameters;if(o.geometry?.type==='CylinderGeometry'&&p.radiusTop<.08){const old=o.geometry;o.geometry=new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,64);old.dispose();}}
  const oldBody=cartridge.geometry;cartridge.geometry=new RoundedBoxGeometry(.15,.08,.21,5,.010).translate(0,.014,0);oldBody.dispose();
  cartridge.material=kit.plastic;cartridge.name='moving-magnet cartridge';
  const head=new THREE.Mesh(cutPanelGeometry(.18,.27,.015,.021,[{x:-.055,w:.018,h:.12,r:.008},{x:.055,w:.018,h:.12,r:.008}]).rotateX(-Math.PI/2),kit.metal);
  head.name='slotted aluminium headshell';head.position.set(0,.065,0);cartridge.add(head);
  const wedgeShape=new THREE.Shape();wedgeShape.moveTo(-.051,-.032);wedgeShape.lineTo(.051,-.032);wedgeShape.lineTo(.033,-.066);wedgeShape.lineTo(-.033,-.066);wedgeShape.closePath();
  const wedge=new THREE.Mesh(new THREE.ExtrudeGeometry(wedgeShape,{depth:.14,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:3}).translate(0,0,-.070),kit.pale);wedge.name='replaceable stylus carrier';cartridge.add(wedge);
  block(cartridge,'stylus assembly witness line',[.081,.005,.004],[0,-.05,.074],kit.rubber,.001);
  batch(cartridge,'headshell mounting bolts',headGeo,kit.metal,[-1,1].map(s=>({p:[s*.055,.080,.010],s:[.012,.012,.009],r:[-Math.PI/2,0,0]})));
  const guide=new THREE.CatmullRomCurve3([new THREE.Vector3(.065,.068,-.04),new THREE.Vector3(.115,.075,-.052),new THREE.Vector3(.126,.11,-.055)]);
  const lift=new THREE.Mesh(new THREE.TubeGeometry(guide,24,.007,8,false),kit.metal);lift.name='headshell finger lift';cartridge.add(lift);
  for(let i=0;i<4;i++){
    const x=-.035+i*.023;
    const wire=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,.022,-.108),new THREE.Vector3(x,.032,-.145),new THREE.Vector3(x*.4,.069,-.135)]),16,.003,6,false),i%2?kit.copper:kit.rubber);wire.name='cartridge signal leads';cartridge.add(wire);
  }
  const oldNeedle=stylus.geometry;stylus.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,.035,-.025),new THREE.Vector3(0,-.010,.007),new THREE.Vector3(0,-.035,.018)]),24,.0028,8,false);oldNeedle.dispose();stylus.name='angled aluminium cantilever';
  const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.0038),kit.pale);diamond.position.set(0,-.035,.018);stylus.add(diamond);
  const grooves=[];for(let i=0;i<13;i++)grooves.push({p:[counter.position.x-.113+i*.0188,counter.position.y,counter.position.z],s:[.122,.122,.006],r:[0,Math.PI/2,0]});
  batch(arm,'counterweight machined grooves',headGeo,kit.plastic,grooves);
  // PVC keeps a narrower reflection than the metal platter, with real shallow grooves.
  arm.parent?.traverse(o=>{
    if(o.geometry?.type!=='LatheGeometry'||o.geometry.parameters.points?.length!==1203)return;
    o.material.roughness=.21;o.material.metalness=.08;o.material.bumpScale=.00010;o.material.clearcoat=.55;o.material.clearcoatRoughness=.12;
    const positions=o.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const r=Math.hypot(positions.getX(i),positions.getZ(i));if(positions.getY(i)>.348&&r>.36&&r<1.425)positions.setY(i,positions.getY(i)+.000015*Math.sin(r*Math.PI*2/.006));}
    positions.needsUpdate=true;o.geometry.computeVertexNormals();
  });
  compactStaticDetails(cartridge);
}
