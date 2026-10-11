import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Geometry is owned by each model. Materials are borrowed from a scene's kit.
function model(name,materials,required) {
  for (const key of required) if (!materials?.[key]?.isMaterial) throw Error(`Missing material: ${key}`);
  const root=new T.Group();root.name=name;const geometries=new Set();
  function mesh(geometry,material,position=[0,0,0]) {geometries.add(geometry);const o=new T.Mesh(geometry,material);o.position.fromArray(position);o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  function ring(radius,thickness,z,material) {return mesh(new T.TorusGeometry(radius,thickness,12,96),material,[0,0,z]);}
  function instances(name,geometry,material,poses) {geometries.add(geometry);const o=new T.InstancedMesh(geometry,material,poses.length),dummy=new T.Object3D();o.name=name;poses.forEach(({p,r=[0,0,0]},i)=>{dummy.position.fromArray(p);dummy.rotation.set(...r);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);});o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  let disposed=false;
  return {root,mesh,ring,instances,dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());}};
}
const radial=(count,radius,z)=>Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2;return {p:[Math.sin(a)*radius,Math.cos(a)*radius,z],r:[0,0,-a]};});
const positive=(value,name)=>{if(!Number.isFinite(value)||value<=0)throw Error(`${name} must be positive`);};

/** PULSE rotary-control construction, normalized to +Z with a rear mount at z=0. */
export function createRotaryControl(materials,{radius=.32,depth=.36,ridges=40}={}) {
  positive(radius,'radius');positive(depth,'depth');if(!Number.isInteger(ridges)||ridges<8||ridges>256)throw Error('ridges must be 8..256');
  const m=model('product.rotary-control',materials,['rubber','brushedMetal','satinPlastic','mattePlastic']);
  const body=m.mesh(new T.CylinderGeometry(radius*.93,radius,depth,64),materials.rubber,[0,0,depth/2]);body.rotation.x=Math.PI/2;
  m.ring(radius,.018,depth*.18,materials.brushedMetal);
  m.instances('knurled-grip',new RoundedBoxGeometry(radius*.08,radius*.10,depth*.66,3,radius*.015),materials.brushedMetal,radial(ridges,radius*.97,depth*.51));
  const cap=m.mesh(new T.CylinderGeometry(radius*.84,radius*.88,depth*.23,64),materials.satinPlastic,[0,0,depth*.90]);cap.rotation.x=Math.PI/2;
  m.mesh(new RoundedBoxGeometry(radius*.09,radius*.42,.008,3,.002),materials.mattePlastic,[0,radius*.4,depth*1.025]);
  return m;
}

/** CAMERA optical construction: open sleeve, baffles, spaced curved glass, collars. */
export function createOpticalCell(materials,{radius=.7,depth=.65,ridges=64}={}) {
  positive(radius,'radius');positive(depth,'depth');if(!Number.isInteger(ridges)||ridges<12||ridges>256)throw Error('ridges must be 12..256');
  const m=model('product.optical-cell',materials,['rubber','brushedMetal','anodizedMetal','glass']);
  const profile=[[radius*.88,0],[radius,0],[radius,depth],[radius*.90,depth],[radius*.88,0]].map(([r,z])=>new T.Vector2(r,z));
  const sleeve=m.mesh(new T.LatheGeometry(profile,96),materials.anodizedMetal);sleeve.rotation.x=Math.PI/2;
  for (const f of [.18,.40,.64]) m.ring(radius*.88,.022,depth*f,materials.rubber);
  m.ring(radius,.018,depth*.08,materials.brushedMetal);m.ring(radius,.022,depth*.94,materials.brushedMetal);
  m.instances('focus-ring-knurl',new RoundedBoxGeometry(radius*.035,radius*.045,depth*.45,3,.004),materials.rubber,radial(ridges,radius*1.01,depth*.48));
  const front=m.mesh(new T.SphereGeometry(radius*.87,64,32),materials.glass,[0,0,depth*.82]);front.scale.z=.10;
  const rear=m.mesh(new T.SphereGeometry(radius*.78,48,24),materials.glass,[0,0,depth*.28]);rear.scale.z=.055;
  m.instances('mount-fasteners',new T.CylinderGeometry(.023,.023,.014,6).rotateX(Math.PI/2),materials.brushedMetal,radial(8,radius*.97,depth+.012));
  return m;
}

/** PULSE housing method: bevelled panel with actual through-holes, not dark decals. */
export function createHousingPanel(materials,{width=3.4,height=2.2,depth=.18,radius=.16,holes=[]}={}) {
  for(const [k,v] of Object.entries({width,height,depth,radius}))positive(v,k);
  if(radius>=Math.min(width,height)/2)throw Error('Panel radius is too large');
  const shape=new T.Shape();
  const x=-width/2,y=-height/2,w=width,h=height,r=radius;
  shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  for(let i=0;i<holes.length;i++) {const hole=holes[i];if(!Number.isFinite(hole.x)||!Number.isFinite(hole.y))throw Error('Hole coordinates must be finite');positive(hole.radius,'hole radius');const margin=radius+.02;if(Math.abs(hole.x)+hole.radius>width/2-margin||Math.abs(hole.y)+hole.radius>height/2-margin)throw Error('Hole needs panel-edge clearance');for(const other of holes.slice(0,i))if(Math.hypot(hole.x-other.x,hole.y-other.y)<hole.radius+other.radius+.04)throw Error('Panel holes overlap');const p=new T.Path();p.absarc(hole.x,hole.y,hole.radius,0,Math.PI*2,true);shape.holes.push(p);}
  const m=model('product.housing-panel',materials,['mattePlastic','brushedMetal']);
  const bevel=Math.min(.025,depth*.15,radius*.25);
  m.mesh(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:4,curveSegments:64}),materials.mattePlastic);
  m.instances('panel-fasteners',new T.CylinderGeometry(.045,.045,.017,6).rotateX(Math.PI/2),materials.brushedMetal,[-1,1].flatMap(a=>[-1,1].map(b=>({p:[a*(width/2-radius),b*(height/2-radius),depth+.025]}))));
  return m;
}
