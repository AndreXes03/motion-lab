import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// The parts below use the same radial crown as the original stamped blades.
// They are children of each blade mesh, so every approved assembly move is
// inherited without a new animation channel or a competing transform.
export function addApertureHardware({blades,chassis,materials}) {
  const geometries=new Set(),textures=new Set(),ownMaterials=new Set();
  const steel=materials.brushed,edge=materials.cream;
  const seat=new T.MeshStandardMaterial({color:'#131718',metalness:0,roughness:.76,envMap:steel.envMap});ownMaterials.add(seat);
  const ceramic=new T.MeshPhysicalMaterial({color:'#aab3ac',metalness:0,roughness:.35,clearcoat:.15,envMap:steel.envMap});ownMaterials.add(ceramic);
  const crown=(x,y)=>.72*.32+.48*Math.sin(Math.min(18,Math.hypot(x,y))/18*Math.PI);
  const dummy=new T.Object3D();
  function mesh(parent,geometry,material,p=[0,0,0],r=[0,0,0]) {
    geometries.add(geometry);const object=new T.Mesh(geometry,material);object.position.set(...p);object.rotation.set(...r);
    object.castShadow=object.receiveShadow=true;parent.add(object);return object;
  }
  function batch(parent,name,geometry,material,placements) {
    geometries.add(geometry);const object=new T.InstancedMesh(geometry,material,placements.length);object.name=name;
    object.castShadow=object.receiveShadow=true;
    placements.forEach(({p,r=[0,0,0]},i)=>{dummy.position.set(...p);dummy.rotation.set(...r);dummy.scale.setScalar(1);dummy.updateMatrix();object.setMatrixAt(i,dummy.matrix);});
    object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();parent.add(object);return object;
  }
  const anchors=[[10.2,6.6],[14.55,4.0]],angle=Math.atan2(anchors[1][1]-anchors[0][1],anchors[1][0]-anchors[0][0]);
  const distance=Math.hypot(anchors[1][0]-anchors[0][0],anchors[1][1]-anchors[0][1]);
  // Rounded, genuinely open slot rather than a dark decal pretending to be one.
  function capsule(path,x0,x1,r,clockwise=false) {
    if(clockwise){path.moveTo(x0,-r);path.absarc(x0,0,r,-Math.PI/2,Math.PI/2,true);path.lineTo(x1,r);path.absarc(x1,0,r,Math.PI/2,-Math.PI/2,true);}
    else{path.moveTo(x0,-r);path.lineTo(x1,-r);path.absarc(x1,0,r,-Math.PI/2,Math.PI/2,false);path.lineTo(x0,r);path.absarc(x0,0,r,Math.PI/2,Math.PI*1.5,false);}
    path.closePath();return path;
  }
  const linkShape=capsule(new T.Shape(),0,distance,.3),slot=capsule(new T.Path(),.68,distance-.68,.105,true);linkShape.holes.push(slot);
  const linkGeo=new T.ExtrudeGeometry(linkShape,{depth:.075,curveSegments:24,bevelEnabled:true,bevelThickness:.022,bevelSize:.018,bevelSegments:3,steps:8});
  const lp=linkGeo.attributes.position;
  for(let i=0;i<lp.count;i++){const lx=lp.getX(i),ly=lp.getY(i),x=anchors[0][0]+lx*Math.cos(angle)-ly*Math.sin(angle),y=anchors[0][1]+lx*Math.sin(angle)+ly*Math.cos(angle);lp.setXYZ(i,x,y,lp.getZ(i)+crown(x,y)+.055);}linkGeo.computeVertexNormals();
  // Low-profile molded carriage: the slotted steel arm sits between two
  // raised guide cheeks, with a continuous load-bearing mounting flange.
  const guideShape=capsule(new T.Shape(),-.12,distance+.12,.61),guideOpening=capsule(new T.Path(),.5,distance-.5,.305,true);guideShape.holes.push(guideOpening);
  const guideGeo=new T.ExtrudeGeometry(guideShape,{depth:.032,curveSegments:24,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2}),gp=guideGeo.attributes.position;
  for(let i=0;i<gp.count;i++){const lx=gp.getX(i),ly=gp.getY(i),x=anchors[0][0]+lx*Math.cos(angle)-ly*Math.sin(angle),y=anchors[0][1]+lx*Math.sin(angle)+ly*Math.cos(angle);gp.setXYZ(i,x,y,gp.getZ(i)+crown(x,y)+.012);}guideGeo.computeVertexNormals();
  const washerGeo=new T.TorusGeometry(.24,.054,10,40);
  const capGeo=new T.CylinderGeometry(.135,.145,.07,6);capGeo.rotateX(Math.PI/2);
  const socketGeo=new T.CylinderGeometry(.057,.057,.012,6);socketGeo.rotateX(Math.PI/2);
  const footGeo=new T.CylinderGeometry(.34,.37,.04,40);footGeo.rotateX(Math.PI/2);
  const tickGeo=new T.BoxGeometry(.028,.19,.011);
  const textCanvas=document.createElement('canvas');textCanvas.width=512;textCanvas.height=128;const c=textCanvas.getContext('2d');c.clearRect(0,0,512,128);
  c.fillStyle='#69716c';c.font='500 36px monospace';c.fillText('ML  /  IRIS',14,49);c.font='24px monospace';c.fillText('35 / PRECISION ASSEMBLY',14,94);
  const labelMap=new T.CanvasTexture(textCanvas);labelMap.colorSpace=T.SRGBColorSpace;textures.add(labelMap);
  const labelMat=new T.MeshStandardMaterial({map:labelMap,transparent:true,depthWrite:false,roughness:.65,metalness:.25,polygonOffset:true,polygonOffsetFactor:-1});ownMaterials.add(labelMat);
  const labelGeo=new T.PlaneGeometry(2.4,.6,20,4),lpos=labelGeo.attributes.position;
  for(let i=0;i<lpos.count;i++){const x=lpos.getX(i)+11.75,y=lpos.getY(i)+3.28;lpos.setXYZ(i,x,y,crown(x,y)+.026);}labelGeo.computeVertexNormals();
  // A real low-profile flex circuit ties the mechanical carriage to the
  // outer sensor rail. Its layered construction reads during the macro pass.
  const flexPath=new T.CatmullRomCurve3([new T.Vector3(10.3,7.32,0),new T.Vector3(11.0,8.38,0),new T.Vector3(12.6,9.0,0),new T.Vector3(14.0,8.65,0)]);
  const flexGeo=new T.TubeGeometry(flexPath,56,.15,8,false),fp=flexGeo.attributes.position;
  for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i);fp.setZ(i,fp.getZ(i)*.23+crown(x,y)+.055);}flexGeo.computeVertexNormals();
  const copper=new T.MeshStandardMaterial({color:'#9a713b',metalness:.85,roughness:.37,envMap:steel.envMap});ownMaterials.add(copper);
  const traces=[];for(const offset of [-.055,0,.055]){const path=new T.CatmullRomCurve3(flexPath.getPoints(56).map((p,i)=>{const tangent=flexPath.getTangent(i/56),x=p.x-tangent.y*offset,y=p.y+tangent.x*offset;return new T.Vector3(x,y,crown(x,y)+.096);}));traces.push(new T.TubeGeometry(path,56,.009,6,false));}
  blades.forEach((pivot,index)=>{
    const blade=pivot.children[0];
    const detail=new T.Group();detail.name=`iris.blade-${index+1}.mechanics`;blade.add(detail);
    mesh(detail,guideGeo,seat);
    mesh(detail,flexGeo,seat);for(const trace of traces)mesh(detail,trace,copper);
    const terminals=[0,1].map(u=>{const p=flexPath.getPoint(u),t=flexPath.getTangent(u);return{p:[p.x,p.y,crown(p.x,p.y)+.07],r:[0,0,Math.atan2(t.y,t.x)]};});
    batch(detail,'iris.flex-connectors',new RoundedBoxGeometry(.52,.40,.085,3,.035),seat,terminals);
    batch(detail,'iris.connector-clamps',new RoundedBoxGeometry(.065,.43,.032,2,.01),steel,terminals.map(t=>({...t,p:[t.p[0],t.p[1],t.p[2]+.048]})));
    mesh(detail,linkGeo,steel);
    batch(detail,'iris.pivot-seats',footGeo,seat,anchors.map(([x,y])=>({p:[x,y,crown(x,y)+.035]})));
    batch(detail,'iris.retaining-washers',washerGeo,ceramic,anchors.map(([x,y])=>({p:[x,y,crown(x,y)+.105]})));
    batch(detail,'iris.hex-drive-pins',capGeo,steel,anchors.map(([x,y])=>({p:[x,y,crown(x,y)+.145]})));
    batch(detail,'iris.pin-sockets',socketGeo,seat,anchors.map(([x,y])=>({p:[x,y,crown(x,y)+.187]})));
    const ticks=Array.from({length:18},(_,i)=>{const a=.1+i*.044,r=17.2;const x=Math.cos(a)*r,y=Math.sin(a)*r;return{p:[x,y,crown(x,y)+.018],r:[0,0,a-Math.PI/2]};});
    batch(detail,'iris.travel-calibration',tickGeo,seat,ticks);
    const label=mesh(detail,labelGeo,labelMat);label.castShadow=false;
  });
  // A stationary retaining race is genuinely concentric with the chassis.
  const ringShape=new T.Shape();ringShape.absarc(0,0,17.72,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,17.18,0,Math.PI*2,true);ringShape.holes.push(hole);
  mesh(chassis,new T.ExtrudeGeometry(ringShape,{depth:.095,curveSegments:128,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2}),steel,[0,-.21,0],[-Math.PI/2,0,0]);
  const perimeter=Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return{p:[Math.sin(a)*17.46,-.12,Math.cos(a)*17.46],r:[-Math.PI/2,0,0]};});
  batch(chassis,'iris.retainer-fasteners',capGeo,edge,perimeter);
  batch(chassis,'iris.race-gear-teeth',new T.BoxGeometry(.12,.16,.24),steel,Array.from({length:96},(_,i)=>{const a=i/96*Math.PI*2;return{p:[Math.sin(a)*17.07,-.18,Math.cos(a)*17.07],r:[0,a,0]};}));
  // Six continuous service covers follow the barrel curvature and remain
  // below the lowest blade envelope; the gaps are true assembly seams.
  const serviceShape=new T.Shape();serviceShape.absarc(0,0,18.42,-.14,.14,false);serviceShape.absarc(0,0,18.355,.14,-.14,true);serviceShape.closePath();
  const serviceGeo=new T.ExtrudeGeometry(serviceShape,{depth:.63,curveSegments:32,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2});
  for(let i=0;i<6;i++){const cover=mesh(chassis,serviceGeo,seat,[0,-1.36,0],[-Math.PI/2,0,0]);cover.rotateZ(i*Math.PI/3);}
  return {dispose(){for(const geo of geometries)geo.dispose();for(const tex of textures)tex.dispose();for(const mat of ownMaterials)mat.dispose();}};
}
