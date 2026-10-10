import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Functional photographic hardware. Repeated ridges, vents and fasteners are
// instanced, so the extra model construction adds only a few dozen draw calls.
export function addCameraHardware({housing,nameplate,wings,clapper,hinge,materials}) {
  const {black,grip,anodized,chrome,white,orange}=materials;
  const geometries=new Set(),textures=new Set(),ownMaterials=new Set();
  const contactsMetal=new T.MeshStandardMaterial({color:'#b6834a',metalness:.85,roughness:.28,envMap:chrome.envMap});ownMaterials.add(contactsMetal);
  const insulation=new T.MeshStandardMaterial({color:'#161716',metalness:0,roughness:.79,envMap:chrome.envMap});ownMaterials.add(insulation);
  const q=new T.Quaternion(),m=new T.Matrix4(),e=new T.Euler(),p=new T.Vector3(),s=new T.Vector3();
  function mesh(parent,geometry,material,position=[0,0,0],rotation=[0,0,0]) {
    geometries.add(geometry);
    const object=new T.Mesh(geometry,material);
    object.position.set(...position);object.rotation.set(...rotation);
    object.castShadow=object.receiveShadow=true;parent.add(object);return object;
  }
  function batch(parent,name,geometry,material,placements) {
    geometries.add(geometry);
    const object=new T.InstancedMesh(geometry,material,placements.length);
    object.name=name;object.castShadow=object.receiveShadow=true;
    placements.forEach((item,index)=>{
      p.set(...item.p);e.set(...(item.r??[0,0,0]));q.setFromEuler(e);s.set(...(item.s??[1,1,1]));
      object.setMatrixAt(index,m.compose(p,q,s));
    });object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();parent.add(object);return object;
  }
  const rounded=(w,h,d,r=.025)=>new RoundedBoxGeometry(w,h,d,3,r);
  const root=new T.Group();root.name='camera.functional-hardware';housing.add(root);
  const crown=new T.Group();crown.name='camera.nameplate-hardware';nameplate.add(crown);
  const faceZ=x=>2.5-.033*x*x;
  const circle=(count,r,z,phase=0)=>Array.from({length:count},(_,i)=>{
    const a=i/count*Math.PI*2+phase;return {p:[Math.cos(a)*r,Math.sin(a)*r,z],r:[0,0,a-Math.PI/2]};
  });
  // The lens locks into a beveled chassis boss; rubber is limited to separate
  // ergonomic grips rather than covering the whole structural front casting.
  const frameShape=new T.Shape(),fw=6.55,fh=5.4,fr=.62;
  frameShape.moveTo(-fw/2+fr,-fh/2);frameShape.lineTo(fw/2-fr,-fh/2);frameShape.quadraticCurveTo(fw/2,-fh/2,fw/2,-fh/2+fr);frameShape.lineTo(fw/2,fh/2-fr);frameShape.quadraticCurveTo(fw/2,fh/2,fw/2-fr,fh/2);frameShape.lineTo(-fw/2+fr,fh/2);frameShape.quadraticCurveTo(-fw/2,fh/2,-fw/2,fh/2-fr);frameShape.lineTo(-fw/2,-fh/2+fr);frameShape.quadraticCurveTo(-fw/2,-fh/2,-fw/2+fr,-fh/2);frameShape.closePath();
  const bore=new T.Path();bore.absarc(0,0,2.345,0,Math.PI*2,true);frameShape.holes.push(bore);
  const mountMat=anodized.clone();mountMat.color.set('#262b2d');mountMat.roughness=.34;ownMaterials.add(mountMat);
  mesh(root,new T.ExtrudeGeometry(frameShape,{depth:.16,bevelEnabled:true,bevelSize:.07,bevelThickness:.05,bevelSegments:4,curveSegments:96}),mountMat,[0,0,2.145]);
  const gripSkin=grip.clone();gripSkin.normalScale.set(.24,.24);ownMaterials.add(gripSkin);
  for(const side of [-1,1]) {
    mesh(root,rounded(1.82,4.62,.69,.30),black,[side*4.11,-.2,1.97]);
    mesh(root,rounded(1.52,4.25,.48,.28),gripSkin,[side*4.12,-.27,2.19]);
    mesh(root,rounded(1.39,.92,.29,.19),mountMat,[side*4.11,1.79,2.06]);
    mesh(root,rounded(1.04,.49,.07,.09),insulation,[side*4.10,1.82,2.24]);
  }
  // A shallow controls cassette with a genuine recessed rotary wheel and
  // gasket, sufficiently large to read in the approved ultra-wide flyby.
  mesh(root,rounded(.93,1.04,.16,.15),mountMat,[-3.91,.91,2.46]);
  mesh(root,new T.CylinderGeometry(.315,.315,.055,48),insulation,[-3.91,.94,2.57],[Math.PI/2,0,0]);
  mesh(root,new T.CylinderGeometry(.245,.255,.095,48),anodized,[-3.91,.94,2.609],[Math.PI/2,0,0]);
  const thumbRidges=Array.from({length:30},(_,i)=>{const a=i/30*Math.PI*2;return{p:[-3.91+Math.cos(a)*.251,.94+Math.sin(a)*.251,2.614],r:[0,0,a-Math.PI/2]};});
  batch(root,'body.thumb-control-knurl',rounded(.029,.034,.062,.005),black,thumbRidges);
  mesh(root,rounded(.034,.11,.01,.004),white,[-3.91,1.075,2.665]);
  mesh(root,rounded(.1,.034,.012,.004),orange,[-3.91,.635,2.553]);
  // A split shoulder casting exposes its panel break around the mode control.
  mesh(root,rounded(2.10,.41,1.72,.16),mountMat,[3.75,2.91,.36]);
  mesh(root,rounded(2.08,.045,1.7,.015),insulation,[3.75,3.129,.36]);
  // The focus barrel is gripped rubber between separate machined collars.
  batch(root,'lens.focus-ring-knurl',rounded(.045,.085,.48,.01),grip,circle(96,2.302,2.1));
  batch(root,'lens.aperture-ring-knurl',rounded(.033,.052,.16,.006),anodized,circle(80,2.17,2.49,Math.PI/80));
  for(const [radius,z] of [[2.313,1.86],[2.313,2.35],[2.185,2.6]]) {
    mesh(root,new T.TorusGeometry(radius,.022,8,128),anodized,[0,0,z]);
  }
  const bezelShape=new T.Shape();bezelShape.absarc(0,0,2.32,0,Math.PI*2,false);
  const bezelHole=new T.Path();bezelHole.absarc(0,0,2.025,0,Math.PI*2,true);bezelShape.holes.push(bezelHole);
  mesh(root,new T.ExtrudeGeometry(bezelShape,{depth:.085,curveSegments:128,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2}),anodized,[0,0,2.47]);
  // One thin print map supplies engraved focal/aperture scales, with a clear
  // optical center and no additional bright reflection cards.
  const scaleCanvas=document.createElement('canvas');scaleCanvas.width=scaleCanvas.height=1024;
  const c=scaleCanvas.getContext('2d');c.clearRect(0,0,1024,1024);c.translate(512,512);
  c.strokeStyle='#969b93';c.fillStyle='#c1c6bc';c.lineWidth=2.4;
  for(let i=0;i<72;i++) {const a=i/72*Math.PI*2;
    c.save();c.rotate(a);c.beginPath();c.moveTo(0,-474);c.lineTo(0,i%6===0?-457:-466);c.stroke();c.restore();
  }
  c.font='500 22px Arial';c.textAlign='center';c.textBaseline='middle';
  ['0.5','0.7','1','1.5','2','3','5','10','∞','35 mm','T 1.8','M/L'].forEach((text,i)=>{
    c.save();c.rotate(i/12*Math.PI*2);c.fillText(text,0,-444);c.restore();
  });
  const scaleMap=new T.CanvasTexture(scaleCanvas);scaleMap.colorSpace=T.SRGBColorSpace;textures.add(scaleMap);
  const scaleMaterial=new T.MeshStandardMaterial({map:scaleMap,transparent:true,depthWrite:false,roughness:.6,metalness:.1});ownMaterials.add(scaleMaterial);
  const scale=mesh(root,new T.PlaneGeometry(4.85,4.85),scaleMaterial,[0,0,2.575]);scale.castShadow=false;
  // Optical mounting hardware is real geometry and survives the ultra-wide
  // flyby: radial pockets, screws, contact pads and a keyed bayonet shoulder.
  const mountScrews=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2+.13;return{p:[Math.cos(a)*2.265,Math.sin(a)*2.265,2.581],r:[Math.PI/2,0,0]};});
  batch(root,'lens.mount-screw-sockets',new T.CylinderGeometry(.047,.047,.018,6),insulation,mountScrews);
  batch(root,'lens.mount-screw-heads',new T.CylinderGeometry(.028,.028,.017,6),chrome,mountScrews.map(v=>({...v,p:[v.p[0],v.p[1],v.p[2]+.009]})));
  const focusGrooves=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return{p:[Math.cos(a)*2.333,Math.sin(a)*2.333,2.478],r:[0,0,a-Math.PI/2]};});
  batch(root,'lens.precision-bayonet-keyways',rounded(.037,.048,.07,.006),black,focusGrooves);
  const contacts=Array.from({length:9},(_,i)=>{const a=2.63+i*.025;return{p:[Math.cos(a)*2.255,Math.sin(a)*2.255,2.592],r:[0,0,a-Math.PI/2]};});
  batch(root,'lens.electrical-contact-inlays',rounded(.026,.098,.014,.004),contactsMetal,contacts);
  const sideCodes=[];for(let j=0;j<3;j++)for(let i=0;i<7;i++)sideCodes.push({p:[-3.05+i*.073,-.42-j*.11,2.146-.024*(-3.05+i*.073)**2]});
  batch(root,'body.precision-vent-array',rounded(.033,.045,.022,.008),grip,sideCodes);
  // The top crown is visible in the first macro shot. Small recessed hardware
  // stays outside the text band so the approved opening remains legible.
  const crownBolts=[];
  for(const x of [-4.8,-2.4,0,2.4,4.8]) for(const y of [1.52,3.29]) crownBolts.push({p:[x,y,faceZ(x)+.015]});
  batch(crown,'nameplate.captive-washers',new T.CylinderGeometry(.075,.075,.018,16),anodized,crownBolts.map(x=>({...x,r:[Math.PI/2,0,0]})));
  batch(crown,'nameplate.torx-heads',new T.CylinderGeometry(.041,.041,.021,6),chrome,crownBolts.map(x=>({p:[x.p[0],x.p[1],x.p[2]+.012],r:[Math.PI/2,0,0]})));
  const crownSlots=[];
  for(const x of [-4.48,-4.08,-3.68,3.68,4.08,4.48]) crownSlots.push({p:[x,3.39,faceZ(x)-.11],r:[-.55,0,0]});
  batch(crown,'nameplate.crown-heat-slots',rounded(.2,.035,.045,.012),black,crownSlots);
  // Fine seams reveal the layered shell and molded grip panels without coating
  // or displacing any existing surface.
  for(const side of [-1,1]) {
    const seam=[];for(let i=0;i<=30;i++){const y=-2.25+i/30*3.65;seam.push(new T.Vector3(side*3.56,y,1.985));}
    mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(seam),30,.022,6,false),anodized);
    const shoulder=mesh(root,rounded(.52,1.02,.25,.09),anodized,[side*5.02,1.6,.88]);shoulder.rotation.y=side*.12;
    mesh(root,new T.TorusGeometry(.23,.065,10,32),chrome,[side*5.18,1.65,1.045],[0,side*.32,0]);
    // Side access hatch, surrounded by an actual gasket.
    mesh(root,rounded(.09,1.84,1.64,.12),grip,[side*5.425,-.52,-.44]);
    mesh(root,rounded(.11,1.64,1.42,.1),black,[side*5.47,-.52,-.44]);
  }
  const ventPos=[];
  for(let i=0;i<9;i++) {const x=-4.55+i*.16;ventPos.push({p:[x,-1.78,2.144-.024*x*x],r:[0,.048*x,0]});}
  batch(root,'body.front-cooling-slots',rounded(.059,.4,.052,.02),grip,ventPos);
  const frontBolts=[];
  for(const x of [-4.48,4.48]) for(const y of [-2.35,1.35]) frontBolts.push({p:[x,y,1.62],r:[Math.PI/2,0,0]});
  batch(root,'body.hex-fasteners',new T.CylinderGeometry(.092,.092,.045,6),anodized,frontBolts);
  // Shutter assembly and knurled mode dial are intentionally separate parts.
  const dial=new T.Group();dial.name='camera.mode-dial';dial.position.set(3.62,3.18,.05);root.add(dial);
  mesh(dial,new T.CylinderGeometry(.69,.71,.12,64),anodized);
  mesh(dial,new T.CylinderGeometry(.59,.59,.26,64),black,[0,.16,0]);
  const dialRidges=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return{p:[Math.sin(a)*.602,.16,Math.cos(a)*.602],r:[0,a,0]};});
  batch(dial,'mode-dial.grip-ridges',rounded(.036,.2,.033,.009),grip,dialRidges);
  mesh(dial,new T.CylinderGeometry(.5,.5,.035,64),anodized,[0,.305,0]);
  mesh(dial,rounded(.045,.014,.17,.008),white,[0,.328,.29]);
  mesh(root,new T.CylinderGeometry(.32,.34,.12,40),anodized,[4.38,3.12,1.15]);
  mesh(root,new T.CylinderGeometry(.23,.23,.11,40),black,[4.38,3.22,1.15]);
  mesh(root,new T.TorusGeometry(.245,.022,8,40),chrome,[4.38,3.215,1.15],[Math.PI/2,0,0]);
  // Front lens-release button with its inset seat.
  mesh(root,new T.CylinderGeometry(.19,.19,.06,32),anodized,[2.79,-1.07,2.035],[Math.PI/2,0,0]);
  mesh(root,new T.CylinderGeometry(.125,.125,.065,24),black,[2.79,-1.07,2.077],[Math.PI/2,0,0]);
  mesh(root,rounded(.055,.24,.022,.009),orange,[2.78,.54,2.078]);
  // Every grip rib follows the existing fold-out wing transform.
  for(const {pivot,s:side} of wings) {
    const ribs=Array.from({length:11},(_,i)=>({p:[side*.95,-1.9+i*.38,.137]}));
    batch(pivot,'grip.molded-ribs',rounded(1.1,.025,.025,.01),black,ribs);
    mesh(pivot,rounded(.32,.46,.042,.05),anodized,[side*1.53,-1.7,.145]);
  }
  // Clapper plates/rivets are children of their actual moving hinge/body.
  const boardBolts=[];for(const x of [-4.25,4.25])for(const y of [-3.9,.3])boardBolts.push({p:[x,y,.81-.055*x*x],r:[Math.PI/2,0,0]});
  batch(clapper,'slate.corner-fasteners',new T.CylinderGeometry(.082,.082,.024,6),anodized,boardBolts);
  mesh(hinge,rounded(.74,.76,.1,.08),anodized,[.12,0,.51]);
  const pinPoints=[-.2,.44].map(x=>({p:[x,0,.575],r:[Math.PI/2,0,0]}));
  batch(hinge,'slate.hinge-fixings',new T.CylinderGeometry(.075,.075,.022,6),chrome,pinPoints);
  return {dispose(){for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();for(const material of ownMaterials)material.dispose();}};
}
