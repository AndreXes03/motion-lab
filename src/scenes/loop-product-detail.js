import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Scene-owned manufacturing detail. The assembly is constrained choreography,
// with component centres on the acoustic axis, not a physical simulation.
export function addLoopProductDetail({product,body,face,cone,knob,shell,black,trim,grille,mat,mesh,cylinder,ring}){
  const textures=[];
  function surface(kind,size=512){
    const c=document.createElement('canvas');c.width=c.height=size;const d=c.getContext('2d'),im=d.createImageData(size,size);
    let seed=1729;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const noise=rand(),v=kind==='turned'?174+24*Math.sin(Math.hypot(x-size/2,y-size/2)*2.6)+noise*10:kind==='brushed'?178+22*Math.sin(y*2.3)+noise*18:kind==='fibre'?158+36*Math.sin(x*.65)*Math.sin(y*.65)+noise*16:211+noise*39;
      const i=(y*size+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;
    }
    d.putImageData(im,0,0);const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(2,2);textures.push(tex);return tex;
  }
  const bead=surface('bead'),brush=surface('brushed'),fibre=surface('fibre');
  shell.normalMap=null;shell.roughnessMap=bead;shell.bumpMap=bead;shell.bumpScale=.00018;shell.clearcoat=.18;shell.clearcoatRoughness=.25;
  trim.normalMap=null;trim.roughnessMap=brush;trim.bumpMap=brush;trim.bumpScale=.00008;trim.roughness=.29;trim.anisotropy=.65;
  // Fine woven acoustic cloth: alternating over/under yarns instead of thick bars.
  const clothCanvas=document.createElement('canvas');clothCanvas.width=clothCanvas.height=1024;
  const clothContext=clothCanvas.getContext('2d'),clothImage=clothContext.createImageData(1024,1024);
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
    const u=x/8,v=y/8,fx=u-Math.floor(u),fy=v-Math.floor(v),over=(Math.floor(u)+Math.floor(v))%2===0;
    const warp=Math.sin(fx*Math.PI)**1.7,weft=Math.sin(fy*Math.PI)**1.7;
    const yarn=over?Math.max(warp*.96,weft*.52):Math.max(weft*.96,warp*.52);
    const micro=Math.sin(x*2.5+y*.7)*Math.sin(y*2.1)*3;
    const value=112+yarn*128+micro,i=(y*1024+x)*4;
    clothImage.data[i]=clothImage.data[i+1]=clothImage.data[i+2]=value;clothImage.data[i+3]=255;
  }
  clothContext.putImageData(clothImage,0,0);
  const cloth=new T.CanvasTexture(clothCanvas);cloth.wrapS=cloth.wrapT=T.RepeatWrapping;cloth.repeat.set(2,2);textures.push(cloth);
  grille.normalMap=null;grille.metalness=0;grille.roughness=.88;grille.roughnessMap=null;
  grille.bumpMap=cloth;grille.bumpScale=.0011;grille.map=cloth;grille.sheen=.32;grille.sheenRoughness=.78;grille.sheenColor=new T.Color('#9ca9ba');
  cylinder(1.128,.007,.383,grille,face);ring(1.126,.0025,.390,black,face);
  const titanium=mat('brushedMetal',{name:'LOOP / micro-machined titanium',color:'#a6abb0',roughness:.32,anisotropy:.65,normalMap:null,roughnessMap:brush,bumpMap:brush,bumpScale:.00008});
  const graphite=mat('anodizedMetal',{name:'LOOP / bead-blasted graphite',color:'#222c32',roughness:.42,normalMap:null,roughnessMap:bead,bumpMap:bead,bumpScale:.00012});
  const copper=mat('copper',{name:'LOOP / wound copper',color:'#c47b47',roughness:.24});
  const pcbMat=mat('satinPlastic',{name:'LOOP / midnight PCB solder mask',color:'#15363a',roughness:.43,metalness:.12,clearcoat:.18});
  const ceramic=mat('ceramic',{name:'LOOP / ceramic capacitors',color:'#d7c7a5',roughness:.53});
  const carbon=mat('fibre',{name:'LOOP / woven driver diaphragm',color:'#1f262a',roughness:.56,normalMap:null,roughnessMap:fibre,bumpMap:fibre,bumpScale:.0003});
  const seal=mat('rubber',{name:'LOOP / elastomer seals',color:'#080d11',roughness:.76,normalScale:new T.Vector2(.03,.03)});
  const glass=mat('glass',{name:'LOOP / smoked rear window',color:'#586e76',roughness:.18,transmission:.45,thickness:.035});
  const screwGeo=new T.CylinderGeometry(.031,.032,.018,12);screwGeo.rotateX(Math.PI/2);
  const screwSlot=new T.BoxGeometry(.035,.006,.002);
  function screw(x,y,z,parent){const bolt=mesh(screwGeo,titanium,parent);bolt.position.set(x,y,z);const slot=mesh(screwSlot,black,parent);slot.position.set(x,y,z+.010);slot.rotation.z=Math.atan2(y,x)+.3;}
  function rounded(w,h,d,r,material,parent,x=0,y=0,z=0){const o=mesh(new RoundedBoxGeometry(w,h,d,2,r),material,parent);o.position.set(x,y,z);return o;}
  function bridge(a,b,width,depth,material,parent){const v=new T.Vector3().subVectors(b,a),o=rounded(width,v.length(),depth,.012,material,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function annulus(radius,inner,depth,z,material,parent){const profile=[[inner,-depth/2],[radius-.014,-depth/2],[radius,-depth/2+.014],[radius,depth/2-.014],[radius-.014,depth/2],[inner,depth/2],[inner,-depth/2]].map(([r,h])=>new T.Vector2(r,h));const o=mesh(new T.LatheGeometry(profile,96),material,parent);o.rotation.x=Math.PI/2;o.position.z=z;return o;}
  // Three-material chassis seam, recessed rear service window and keyed fasteners.
  ring(1.326,.014,-.16,graphite,body);ring(1.329,.010,-.13,titanium,body);ring(1.315,.017,.21,seal,body);
  annulus(1.20,1.03,.035,-.307,graphite,body);cylinder(1.025,.018,-.325,glass,body);
  for(let i=0;i<6;i++){const a=i*Math.PI/3+.25;screw(Math.cos(a)*1.205,Math.sin(a)*1.205,.319,body);}
  for(let i=0;i<3;i++){const a=-.60+i*.12;const o=rounded(.055,.16,.012,.016,graphite,body,Math.cos(a)*1.325,Math.sin(a)*1.325,.02);o.rotation.z=a-Math.PI/2;}
  // Recessed USB-C service port and a surrounding machined insert on the back.
  rounded(.36,.16,.035,.045,titanium,body,.50,-.68,-.34);rounded(.25,.095,.038,.026,seal,body,.50,-.68,-.364);rounded(.16,.016,.012,.005,graphite,body,.50,-.68,-.386);
  // Fine concentric turning marks and numbered detents on the crown.
  knob.root.traverse(o=>{if(o.isMesh&&o.material?.name!=='LOOP / crown marker'){if(o.material?.metalness>.8)o.material=titanium;else if(o.material?.clearcoat>.2&&o.material?.metalness<.1)o.material=shell;}});
  const turned=surface('turned');turned.repeat.set(1,1);
  const capFinish=mat('brushedMetal',{name:'LOOP / turned aluminium crown cap',color:'#bcc4cd',roughness:.32,normalMap:null,roughnessMap:turned,bumpMap:turned,bumpScale:.00006,anisotropy:.55});
  const cap=knob.root.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.position.z>.15);if(cap)cap.material=capFinish;
  for(const r of [.070,.206])ring(r,.00065,.194,graphite,knob.root);
  ring(.255,.006,.055,seal,knob.root);ring(.252,.005,.155,titanium,knob.root);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,o=rounded(.005,i%3===0?.028:.014,.002,.001,graphite,knob.root,Math.sin(a)*.195,Math.cos(a)*.195,.197);o.rotation.z=-a;}
  // A diaphragm with a real dish and flexible concentric surround.
  const membrane=mesh(new T.LatheGeometry([[.36,.17],[.55,.14],[.77,.18],[.94,.26],[1.02,.27]].map(([r,z])=>new T.Vector2(r,z)),96),carbon,cone);membrane.rotation.x=Math.PI/2;
  for(const r of [1.005,1.045,1.085])ring(r,.022,.255,seal,cone);
  const inner=new T.Group();inner.name='loop.internal-assembly';inner.userData.loopInternal=true;product.add(inner);
  const layers=[];
  const layer=(name,factor)=>{const g=new T.Group();g.name=name;g.userData.loopInternal=true;inner.add(g);layers.push({g,factor});return g;};
  const board=layer('loop.pcb',.19),magnet=layer('loop.magnet',.36),coil=layer('loop.voice-coil',.53),basket=layer('loop.driver-basket',.68),gasket=layer('loop.front-gasket',.90);
  // Circular multilayer PCB: keep real component height and routed copper traces.
  cylinder(.92,.045,-.13,pcbMat,board);annulus(.93,.89,.018,-.102,copper,board);
  rounded(.47,.40,.074,.035,graphite,board,0,.12,-.072);
  rounded(.37,.30,.005,.015,titanium,board,0,.12,-.032);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.cos(a)*.65,y=Math.sin(a)*.65;rounded(.105,.060,.045,.009,i%3===0?ceramic:graphite,board,x,y,-.071);const tr=rounded(.018,.25,.002,.003,copper,board,x*.76,y*.76,-.103);tr.rotation.z=-a+Math.PI/2;}
  for(let i=0;i<6;i++){const x=-.30+i*.12;rounded(.065,.11,.04,.008,ceramic,board,x,-.47,-.065);rounded(.018,.07,.004,.002,copper,board,x,-.34,-.103);}
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.75;screw(Math.cos(a)*.80,Math.sin(a)*.80,-.075,board);}
  for(let i=0;i<9;i++)for(const side of [-1,1]){
    rounded(.023,.044,.009,.002,titanium,board,-.19+i*.047,.12+side*.223,-.042);
    rounded(.045,.015,.008,.002,copper,board,side*.262,-.05+i*.04,-.062);
  }
  cylinder(.46,.19,-.04,graphite,magnet);annulus(.50,.34,.055,.07,titanium,magnet);annulus(.48,.37,.045,-.13,titanium,magnet);
  annulus(.34,.28,.20,.025,graphite,coil);
  for(let i=0;i<14;i++)ring(.348,.0055,-.06+i*.012,copper,coil);
  annulus(1.08,.97,.06,.10,titanium,basket);annulus(.48,.39,.07,-.10,graphite,basket);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;bridge(new T.Vector3(Math.cos(a)*.44,Math.sin(a)*.44,-.10),new T.Vector3(Math.cos(a)*1.00,Math.sin(a)*1.00,.10),.105,.055,graphite,basket);screw(Math.cos(a)*1.02,Math.sin(a)*1.02,.138,basket);}
  ring(1.10,.026,.28,seal,gasket);ring(1.13,.010,.28,copper,gasket);
  // Slim battery can, foil seam and isolated terminals behind the PCB.
  const battery=layer('loop.battery',-.13);rounded(.49,.99,.15,.045,graphite,battery,-.38,-.05,-.15);rounded(.013,.81,.003,.001,titanium,battery,-.12,-.05,-.071);rounded(.13,.12,.035,.01,copper,battery,-.38,.48,-.13);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;const lc=labelCanvas.getContext('2d');lc.fillStyle='#b4bfc2';lc.font='500 20px monospace';lc.fillText('LOOP — S1 / 014',18,34);lc.font='12px monospace';lc.fillText('MODULAR ACOUSTIC SYSTEM',18,61);for(let i=0;i<36;i++)lc.fillRect(20+i*4,80,i%3===0?2:1,22);
  const labelTex=new T.CanvasTexture(labelCanvas);labelTex.colorSpace=T.SRGBColorSpace;textures.push(labelTex);const labelMat=mat('satinPlastic',{map:labelTex,transparent:true,roughness:.7,depthWrite:false});const plaque=mesh(new T.PlaneGeometry(.61,.153),labelMat,body);plaque.rotation.y=Math.PI;plaque.position.set(-.12,.72,-.342);
  // UV-attached organic coating. A deterministic field grows into wet islands;
  // small droplets follow the same front on the real cylindrical housing.
  const coating=createCoating({product,shell,mat,textures});
  return {
    update(spread=0){inner.visible=spread>.025;for(const {g,factor} of layers){g.position.z=spread*factor;g.rotation.z=0;}},
    coat:coating.update,
    dispose(){coating.dispose();textures.forEach(t=>t.dispose());}
  };
}

function createCoating({product,shell,mat,textures}){
  const size=384,canvas=document.createElement('canvas'),roughCanvas=document.createElement('canvas');
  canvas.width=canvas.height=roughCanvas.width=roughCanvas.height=size;
  const ctx=canvas.getContext('2d'),rc=roughCanvas.getContext('2d'),pixels=ctx.createImageData(size,size),rough=rc.createImageData(size,size);
  const colorMap=new T.CanvasTexture(canvas);colorMap.colorSpace=T.SRGBColorSpace;
  const roughMap=new T.CanvasTexture(roughCanvas);textures.push(colorMap,roughMap);
  shell.map=colorMap;shell.roughnessMap=roughMap;
  const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const noise=(u,v,scale)=>.5+.24*Math.sin(u*137*scale+Math.sin(v*29)*1.8)+.16*Math.sin(v*31*scale+Math.sin(u*113)*2.1)+.10*Math.sin(u*241*scale-v*53*scale);
  const field=(u,v,scale)=>.50+(u-.50)*1.5+(noise(u,v,scale)-.5)*.40+.055*Math.sin(v*19+u*11);
  const dropMaterial=mat('ceramic',{name:'LOOP / wet coating microdroplets',color:'#a7c2de',roughness:.18,clearcoat:.6,clearcoatRoughness:.12});
  const dropGeo=new T.SphereGeometry(1,8,5),drops=new T.InstancedMesh(dropGeo,dropMaterial,220),dummy=new T.Object3D();
  drops.name='loop.coating-front';drops.userData.loopCoating=true;drops.visible=false;product.add(drops);
  let last='';
  function update(progress=-1,hue=0,scale=1,edge=1){
    const key=[progress,hue,scale,edge].join(':');drops.visible=progress>=0&&progress<1;
    if(key===last)return;last=key;
    const active=progress>=0,from=new T.Color('#f55b18').offsetHSL(hue/360,0,0).convertLinearToSRGB().toArray(),to=new T.Color('#9fbad9').offsetHSL(hue/360,0,0).convertLinearToSRGB().toArray();
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/(size-1),v=1-y/(size-1),i=(y*size+x)*4,f=field(u,v,scale),n=noise(u*2.8,v*2.8,scale);
      const delta=progress-f,w=smooth((delta+.025*edge)/(.05*edge));
      const seeds=active&&delta<0&&delta>-.10*edge&&n>.79?smooth((n-.79)*13)*smooth((delta+.10*edge)/(.10*edge)):0;
      const blend=Math.max(w,seeds),wet=Math.exp(-((delta/.026)**2));
      for(let ch=0;ch<3;ch++){pixels.data[i+ch]=active?(from[ch]+(to[ch]-from[ch])*blend)*255:255;rough.data[i+ch]=active?240-wet*135:238;}
      pixels.data[i+3]=rough.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);rc.putImageData(rough,0,0);colorMap.needsUpdate=true;roughMap.needsUpdate=true;
    for(let i=0;i<220;i++){
      const u=((i*.61803398875)%1),z=-.13+((i*.41421356237)%1)*.36,v=.4+(z+.13)/.36*.2;
      const delta=progress-field(u,v,scale),life=Math.exp(-((delta/.065)**2)),radius=(.005+(i%7)*.0015)*life*edge;
      const a=u*Math.PI*2,r=1.343+radius*.5;dummy.position.set(Math.sin(a)*r,-Math.cos(a)*r,z);dummy.scale.setScalar(Math.max(.00001,radius));dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);
    }
    drops.instanceMatrix.needsUpdate=true;
  }
  update();
  return {update,dispose(){dropGeo.dispose();}};
}
