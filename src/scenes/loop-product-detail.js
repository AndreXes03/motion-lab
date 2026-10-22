import {createSceneCanvas} from '../engine/scene-canvas.js';
import * as T from 'three';
import {acousticClothGeometry,clothProfile,coatingField,coatingNoise,coatingFromField} from './loop-surface.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Scene-owned manufacturing detail. The assembly is constrained choreography,
// with component centres on the acoustic axis, not a physical simulation.
export function addLoopProductDetail({product,body,face,cone,knob,housing,shell,black,trim,grille,mat,mesh,cylinder,ring}){
  const textures=[];
  function surface(kind,size=512){
    const c=createSceneCanvas();c.width=c.height=size;const d=c.getContext('2d'),im=d.createImageData(size,size);
    let seed=1729;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const noise=rand(),v=kind==='turned'?174+24*Math.sin(Math.hypot(x-size/2,y-size/2)*2.6)+noise*10:kind==='brushed'?178+22*Math.sin(y*2.3)+noise*18:kind==='fibre'?158+36*Math.sin(x*.65)*Math.sin(y*.65)+noise*16:211+noise*39;
      const i=(y*size+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;
    }
    d.putImageData(im,0,0);const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(2,2);textures.push(tex);return tex;
  }
  const bead=surface('bead'),brush=surface('brushed'),fibre=surface('fibre');
  // Smooth pigmented lacquer. Brushing and microtexture belong to the metal
  // hardware and textile, never to this polished colour coat.
  shell.name='LOOP / polished tangerine lacquer';shell.normalMap=null;shell.bumpMap=null;shell.roughnessMap=null;shell.bumpScale=0;shell.clearcoat=1;shell.clearcoatRoughness=.045;shell.ior=1.49;
  trim.normalMap=null;trim.roughnessMap=brush;trim.bumpMap=brush;trim.bumpScale=.00008;trim.roughness=.29;trim.anisotropy=.65;
  // Low-contrast fibres run along each real yarn. Their geometry supplies the
  // weave and open pores; these maps only break up microscopic highlights.
  const clothCanvas=createSceneCanvas(),heightCanvas=createSceneCanvas();
  clothCanvas.width=clothCanvas.height=heightCanvas.width=heightCanvas.height=1024;
  const clothContext=clothCanvas.getContext('2d'),heightContext=heightCanvas.getContext('2d');
  const clothImage=clothContext.createImageData(1024,1024),heightImage=heightContext.createImageData(1024,1024);
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
    const fibre=Math.sin(y/1024*Math.PI*24+Math.sin(x*.032)*.38),grain=Math.sin(x*1.77+y*2.13)*Math.sin(x*.43-y*.77),i=(y*1024+x)*4;
    const value=212+fibre*15+grain*8,height=128+fibre*64+grain*14;
    clothImage.data[i]=clothImage.data[i+1]=clothImage.data[i+2]=value;clothImage.data[i+3]=255;
    heightImage.data[i]=heightImage.data[i+1]=heightImage.data[i+2]=height;heightImage.data[i+3]=255;
  }
  clothContext.putImageData(clothImage,0,0);heightContext.putImageData(heightImage,0,0);
  const cloth=new T.CanvasTexture(clothCanvas),clothHeight=new T.CanvasTexture(heightCanvas);
  cloth.colorSpace=T.SRGBColorSpace;textures.push(cloth,clothHeight);
  grille.name='LOOP / woven acoustic textile';grille.normalMap=null;grille.metalness=0;grille.roughness=.98;grille.roughnessMap=null;
  grille.bumpMap=clothHeight;grille.bumpScale=.00019;grille.map=cloth;grille.sheen=.24;grille.sheenRoughness=.92;grille.sheenColor=new T.Color('#a8adaa');
  const yarnTones=[.85,.93,.98,1.02,1.07,1.12],yarnMaterials=yarnTones.map((tone,i)=>{const m=grille.clone();m.name=`LOOP / acoustic yarn ${i+1}`;m.roughness=.95+(i%3)*.025;return m;});
  const clothGeometry=acousticClothGeometry(),clothMesh=mesh(clothGeometry,yarnMaterials,face);clothMesh.name='loop.woven-cloth';clothMesh.position.z=.424;
  const clothBase=Float32Array.from(clothGeometry.attributes.position.array);let previousRelief=1;
  const backingGeometry=new T.CircleGeometry(1.126,128),backingPositions=backingGeometry.attributes.position;
  for(let i=0;i<backingPositions.count;i++)backingPositions.setZ(i,clothProfile(backingPositions.getX(i),backingPositions.getY(i))*.85);
  backingGeometry.computeVertexNormals();
  const backingMaterial=mat('rubber',{name:'LOOP / acoustic shadow backing',color:'#090c0d',roughness:1,normalMap:null});
  const backing=mesh(backingGeometry,backingMaterial,face);backing.name='loop.acoustic-backing';backing.position.z=.414;
  ring(1.126,.0025,.430,black,face);
  const titanium=mat('brushedMetal',{name:'LOOP / micro-machined titanium',color:'#a6abb0',roughness:.27,anisotropy:.78,normalMap:null,roughnessMap:brush,bumpMap:brush,bumpScale:.00008});
  const graphite=mat('anodizedMetal',{name:'LOOP / bead-blasted graphite',color:'#222c32',roughness:.72,normalMap:null,roughnessMap:bead,bumpMap:bead,bumpScale:.00012});
  const copper=mat('copper',{name:'LOOP / wound copper',color:'#c47b47',roughness:.24});
  const pcbMat=mat('satinPlastic',{name:'LOOP / midnight PCB solder mask',color:'#15363a',roughness:.28,metalness:.12,clearcoat:.36});
  const ceramic=mat('ceramic',{name:'LOOP / ceramic capacitors',color:'#d7c7a5',roughness:.53});
  const carbon=mat('fibre',{name:'LOOP / woven driver diaphragm',color:'#1f262a',roughness:.56,normalMap:null,roughnessMap:fibre,bumpMap:fibre,bumpScale:.0003});
  const seal=mat('rubber',{name:'LOOP / elastomer seals',color:'#080d11',roughness:.94,normalScale:new T.Vector2(.03,.03)});
  const glass=mat('glass',{name:'LOOP / smoked rear window',color:'#586e76',roughness:.075,transmission:.45,thickness:.035});
  const polished=mat('brushedMetal',{name:'LOOP / diamond-cut edge',color:'#d6dce2',roughness:.105,normalMap:null,roughnessMap:null,anisotropy:.15});
  const screwGeo=new T.CylinderGeometry(.031,.032,.018,12);screwGeo.rotateX(Math.PI/2);
  const screwSlot=new T.BoxGeometry(.035,.006,.002);
  function screw(x,y,z,parent){const bolt=mesh(screwGeo,titanium,parent);bolt.position.set(x,y,z);const slot=mesh(screwSlot,black,parent);slot.position.set(x,y,z+.010);slot.rotation.z=Math.atan2(y,x)+.3;}
  function rounded(w,h,d,r,material,parent,x=0,y=0,z=0){const o=mesh(new RoundedBoxGeometry(w,h,d,2,r),material,parent);o.position.set(x,y,z);return o;}
  function bridge(a,b,width,depth,material,parent){const v=new T.Vector3().subVectors(b,a),o=rounded(width,v.length(),depth,.012,material,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function annulus(radius,inner,depth,z,material,parent){const profile=[[inner,-depth/2],[radius-.014,-depth/2],[radius,-depth/2+.014],[radius,depth/2-.014],[radius-.014,depth/2],[inner,depth/2],[inner,-depth/2]].map(([r,h])=>new T.Vector2(r,h));const o=mesh(new T.LatheGeometry(profile,96),material,parent);o.rotation.x=Math.PI/2;o.position.z=z;return o;}
  // Three-material chassis seam, recessed rear service window and keyed fasteners.
  ring(1.326,.014,-.16,graphite,body);ring(1.329,.007,-.13,polished,body);ring(1.315,.017,.21,seal,body);
  annulus(1.20,1.03,.035,-.307,graphite,body);cylinder(1.025,.018,-.325,glass,body);
  for(let i=0;i<6;i++){const a=i*Math.PI/3+.25;screw(Math.cos(a)*1.205,Math.sin(a)*1.205,.319,body);}
  for(let i=0;i<3;i++){const a=-.60+i*.12;const o=rounded(.055,.16,.012,.016,graphite,body,Math.cos(a)*1.325,Math.sin(a)*1.325,.02);o.rotation.z=a-Math.PI/2;}
  // Visible precision mounts under the floating grille, each with a dark isolation pad.
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+.18,x=Math.cos(a)*1.16,y=Math.sin(a)*1.16;
    const post=cylinder(.025,.080,.374,titanium,body);post.position.x=x;post.position.y=y;
    const pad=cylinder(.032,.008,.417,seal,body);pad.position.x=x;pad.position.y=y;
    const tab=rounded(.075,.026,.014,.006,polished,face,x,y,.430);tab.rotation.z=a;
  }
  // Recessed USB-C service port and a surrounding machined insert on the back.
  rounded(.36,.16,.035,.045,titanium,body,.50,-.68,-.34);rounded(.25,.095,.038,.026,seal,body,.50,-.68,-.364);rounded(.16,.016,.012,.005,graphite,body,.50,-.68,-.386);
  // A polished black cap over a tactile matte stainless grip. One recessed
  // laser index replaces the raised marker and decorative clock-face ticks.
  for(const child of [...knob.root.children])knob.root.remove(child);
  const capFinish=mat('ceramic',{name:'LOOP / polished obsidian crown',color:'#080a0d',roughness:.055,metalness:.38,clearcoat:1,clearcoatRoughness:.035,ior:1.52,normalMap:null,roughnessMap:null,bumpMap:null});
  const gripFinish=mat('brushedMetal',{name:'LOOP / satin blasted crown grip',color:'#879097',roughness:.68,metalness:.96,anisotropy:.72,normalMap:null,roughnessMap:brush,bumpMap:brush,bumpScale:.000045});
  const laserFinish=mat('anodizedMetal',{name:'LOOP / recessed laser index',color:'#9ca4a8',roughness:.76,metalness:.55,normalMap:null,roughnessMap:null});
  const basePath=new T.Path();basePath.moveTo(0,0);basePath.lineTo(.224,0);basePath.quadraticCurveTo(.247,0,.247,.018);basePath.lineTo(.247,.047);basePath.quadraticCurveTo(.247,.054,.238,.057);basePath.lineTo(0,.057);
  const collar=mesh(new T.LatheGeometry(basePath.getPoints(24),192),capFinish,knob.root);collar.rotation.x=Math.PI/2;
  // Fine rounded flutes are one continuous machined sleeve, not chunky blocks.
  const gripGeo=new T.CylinderGeometry(.252,.252,.106,768,8,true),gp=gripGeo.attributes.position;
  for(let i=0;i<gp.count;i++){
    const x=gp.getX(i),z=gp.getZ(i),angle=Math.atan2(x,z),h=gp.getY(i)/.106+.5;
    const bevel=Math.sin(Math.PI*Math.max(0,Math.min(1,h/.10))*.5)*Math.sin(Math.PI*Math.max(0,Math.min(1,(1-h)/.10))*.5);
    const r=.248+.0035*bevel+.00165*Math.cos(angle*96)*bevel;
    gp.setX(i,Math.sin(angle)*r);gp.setZ(i,Math.cos(angle)*r);
  }gripGeo.computeVertexNormals();
  const grip=mesh(gripGeo,gripFinish,knob.root);grip.rotation.x=Math.PI/2;grip.position.z=.104;
  ring(.246,.002,.158,polished,knob.root);ring(.245,.0025,.051,gripFinish,knob.root);
  const capShape=new T.Shape();capShape.absarc(0,0,.239,0,Math.PI*2,false);
  const slot=new T.Path(),sx=.006,cy=.143,hy=.029;
  slot.moveTo(-sx,cy-hy);slot.lineTo(-sx,cy+hy);slot.absarc(0,cy+hy,sx,Math.PI,0,true);slot.lineTo(sx,cy-hy);slot.absarc(0,cy-hy,sx,0,-Math.PI,true);slot.closePath();capShape.holes.push(slot);
  const capGeo=new T.ExtrudeGeometry(capShape,{depth:.029,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.0012,bevelThickness:.0012,curveSegments:96});
  const cap=mesh(capGeo,capFinish,knob.root);cap.position.z=.169;cap.name='loop.crown-polished-cap';
  const index=rounded(.010,.066,.001,.004,laserFinish,knob.root,0,cy,.195);index.name='loop.crown-recessed-index';
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
  // Secondary electronics and thermal hardware occupy different depth planes.
  // Their asymmetry makes the exploded view read as an actual assembly.
  const power=layer('loop.power-board',.27),heat=layer('loop.heat-spreader',.30),baffle=layer('loop.inner-baffle',.77);
  rounded(.40,.64,.035,.035,pcbMat,power,.56,-.22,.02);
  rounded(.22,.26,.10,.018,graphite,power,.56,-.16,.08);
  for(let i=0;i<8;i++)for(const side of [-1,1])rounded(.035,.018,.013,.003,titanium,power,.56+side*.14,-.27+i*.031,.07);
  for(let i=0;i<6;i++){
    const x=-.64+(i%3)*.19,y=-.10+Math.floor(i/3)*.22;
    const can=cylinder(.054,.14,-.012,graphite,board);can.position.set(x,y,-.012);
    const cap=cylinder(.050,.006,.061,titanium,board);cap.position.set(x,y,.061);
    rounded(.065,.005,.003,.001,black,board,x,y,.066);
  }
  for(let i=0;i<20;i++){
    const x=-.19+(i%5)*.085,y=-.67+Math.floor(i/5)*.095;
    rounded(.041,.054,.025,.004,i%4===0?ceramic:graphite,board,x,y,-.086);
    for(const side of [-1,1])rounded(.045,.010,.006,.001,titanium,board,x,y+side*.026,-.071);
  }
  rounded(.52,.50,.025,.03,copper,heat,-.36,.24,.02);
  for(let i=0;i<10;i++)rounded(.024,.46,.10,.007,titanium,heat,-.58+i*.049,.24,.08);
  annulus(1.04,.94,.026,.07,graphite,baffle);
  for(let i=0;i<6;i++){
    const a=i*Math.PI*2/6,x=Math.cos(a),y=Math.sin(a);
    bridge(new T.Vector3(x*.55,y*.55,.03),new T.Vector3(x*.98,y*.98,.07),.055,.026,titanium,baffle);
    const spacer=cylinder(.035,.12,.03,titanium,board);spacer.position.set(x*.82,y*.82,.03);
  }
  const wireBlack=mat('rubber',{name:'LOOP / braided graphite cable',color:'#111820',roughness:.78,normalMap:null,bumpMap:fibre,bumpScale:.00016});
  const wireOrange=mat('rubber',{name:'LOOP / silicone power cable',color:'#bd481b',roughness:.56,normalMap:null});
  const cables=[];
  function cable(name,material,radius,from,a,to,b,bow){
    const points=[new T.Vector3(),new T.Vector3(.1,.1,.1),new T.Vector3(.2,.2,.2),new T.Vector3(.3,.3,.3)];
    const curve=new T.CatmullRomCurve3(points),geometry=new T.TubeGeometry(curve,24,radius,6,false),wire=mesh(geometry,material,inner);
    wire.name=name;wire.userData.loopCable={from:from.name,to:to.name,a,b};
    cables.push({wire,geometry,curve,radius,from,to,a:new T.Vector3(...a),b:new T.Vector3(...b),bow:new T.Vector3(...bow)});
    for(const [parent,point] of [[from,a],[to,b]]){
      rounded(.072,.050,.046,.008,ceramic,parent,...point);
      rounded(.032,.032,.052,.004,titanium,parent,...point);
    }
  }
  cable('loop.cable.power-positive',wireOrange,.012,battery,[-.38,.48,-.13],power,[.56,.12,.04],[-.18,.46,.04]);
  cable('loop.cable.power-ground',wireBlack,.012,battery,[-.29,.48,-.13],power,[.65,.12,.04],[-.15,.51,.04]);
  cable('loop.cable.driver-positive',wireOrange,.009,board,[.67,-.35,-.07],coil,[.31,-.12,.05],[.62,-.38,.06]);
  cable('loop.cable.driver-ground',wireBlack,.010,board,[.61,-.44,-.07],coil,[.28,-.21,.05],[.65,-.39,.06]);
  for(let i=0;i<3;i++)cable('loop.cable.data-'+i,wireBlack,.0065,board,[-.70,.28+i*.028,-.07],power,[.38,-.40+i*.028,.04],[-.28,-.32,.035]);
  const labelCanvas=createSceneCanvas();labelCanvas.width=512;labelCanvas.height=128;const lc=labelCanvas.getContext('2d');lc.fillStyle='#b4bfc2';lc.font='500 20px monospace';lc.fillText('LOOP — S1 / 014',18,34);lc.font='12px monospace';lc.fillText('MODULAR ACOUSTIC SYSTEM',18,61);for(let i=0;i<36;i++)lc.fillRect(20+i*4,80,i%3===0?2:1,22);
  const labelTex=new T.CanvasTexture(labelCanvas);labelTex.colorSpace=T.SRGBColorSpace;textures.push(labelTex);const labelMat=mat('satinPlastic',{map:labelTex,transparent:true,roughness:.7,depthWrite:false});const plaque=mesh(new T.PlaneGeometry(.61,.153),labelMat,body);plaque.rotation.y=Math.PI;plaque.position.set(-.12,.72,-.342);
  // UV-attached paint film: tiny relief follows the exact colour boundary.
  const coating=createCoating({housing,shell,textures});
  return {
    update(spread=0,phase=null){inner.visible=spread>.025;for(const {g,factor} of layers){
      const offset=phase===null?0:Math.sin(phase*Math.PI)*Math.sin(factor*8)*.07;
      g.position.set(offset,offset*.3,spread*factor);g.rotation.set(0,phase===null?0:offset*.25,phase===null?0:(phase-.5)*.13*Math.sin(factor*6));
    }
      if(inner.visible)for(const c of cables){
        const a=c.a.clone().applyEuler(c.from.rotation).add(c.from.position),b=c.b.clone().applyEuler(c.to.rotation).add(c.to.position);
        c.curve.points=[a,a.clone().lerp(b,.30).add(c.bow),a.clone().lerp(b,.72).add(c.bow.clone().multiplyScalar(.85)),b];
        const next=new T.TubeGeometry(c.curve,24,c.radius,6,false);
        c.geometry.attributes.position.copy(next.attributes.position);c.geometry.attributes.normal.copy(next.attributes.normal);
        c.geometry.attributes.position.needsUpdate=true;c.geometry.attributes.normal.needsUpdate=true;
        c.geometry.computeBoundingBox();c.geometry.computeBoundingSphere();next.dispose();
      }
    },
    surface(relief=1,metal=1){
      if(relief!==previousRelief){const a=clothGeometry.attributes.position,base=clothGeometry.userData.clothProfile;for(let i=0;i<a.count;i++)a.setZ(i,base[i]+(clothBase[i*3+2]-base[i])*relief);a.needsUpdate=true;clothGeometry.computeVertexNormals();clothGeometry.computeBoundingBox();previousRelief=relief;}
      grille.bumpScale=.00019*relief;yarnMaterials.forEach((m,i)=>{m.color.copy(grille.color).multiplyScalar(yarnTones[i]);m.bumpScale=grille.bumpScale;});
      titanium.roughness=Math.min(1,.27*metal);trim.roughness=Math.min(1,.29*metal);gripFinish.roughness=Math.min(.94,.68*metal);capFinish.roughness=Math.min(.16,.055*metal);polished.roughness=Math.min(1,.105*metal);
    },
    coat:coating.update,
    dispose(){coating.dispose();textures.forEach(t=>t.dispose());yarnMaterials.forEach(m=>m.dispose());}
  };
}

function createCoating({housing,shell,textures}){
  const size=384,canvas=createSceneCanvas(),roughCanvas=createSceneCanvas(),bumpCanvas=createSceneCanvas();
  canvas.width=canvas.height=roughCanvas.width=roughCanvas.height=bumpCanvas.width=bumpCanvas.height=size;
  const ctx=canvas.getContext('2d'),rc=roughCanvas.getContext('2d'),bc=bumpCanvas.getContext('2d'),pixels=ctx.createImageData(size,size),rough=rc.createImageData(size,size),bump=bc.createImageData(size,size);
  const colorMap=new T.CanvasTexture(canvas);colorMap.colorSpace=T.SRGBColorSpace;
  const roughMap=new T.CanvasTexture(roughCanvas),bumpMap=new T.CanvasTexture(bumpCanvas);textures.push(colorMap,roughMap,bumpMap);
  shell.map=colorMap;shell.roughnessMap=roughMap;shell.bumpMap=bumpMap;shell.bumpScale=.0004;
  const geometry=housing.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
  const base=position.array.slice(),baseNormals=normal.array.slice(),surfaceFields=new Float32Array(position.count),surfaceNoise=new Float32Array(position.count);
  const atlas=new Float32Array(size*size),noiseAtlas=new Float32Array(size*size);
  let cachedScale=null;
  function prepareField(scale){
    if(cachedScale===scale)return;cachedScale=scale;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,u=x/(size-1),v=1-y/(size-1);atlas[i]=coatingField(u,v,scale);noiseAtlas[i]=coatingNoise(u,v,scale*2.8);}
    for(let i=0;i<position.count;i++){surfaceFields[i]=coatingField(uv.getX(i),uv.getY(i),scale);surfaceNoise[i]=coatingNoise(uv.getX(i),uv.getY(i),scale*2.8);}
  }
  let last='';
  function update(progress=-1,hue=0,scale=1,edge=1,relief=1){
    const key=[progress,hue,scale,edge,relief].join(':');
    if(key===last)return;last=key;
    prepareField(scale);
    const active=progress>=0,from=new T.Color('#f55b18').offsetHSL(hue/360,0,0).convertLinearToSRGB().toArray(),to=new T.Color('#9fbad9').offsetHSL(hue/360,0,0).convertLinearToSRGB().toArray();
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*4;
      const {blend,wet}=coatingFromField(atlas[y*size+x],noiseAtlas[y*size+x],progress,edge);
      const micro=Math.sin(x*1.77+y*1.13)*Math.sin(y*.70-x*.57);
      for(let ch=0;ch<3;ch++){pixels.data[i+ch]=active?(from[ch]+(to[ch]-from[ch])*blend)*255:255;rough.data[i+ch]=active?255-wet*65:255;bump.data[i+ch]=128+(active?wet*micro*30:0);}
      pixels.data[i+3]=rough.data[i+3]=bump.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);rc.putImageData(rough,0,0);bc.putImageData(bump,0,0);colorMap.needsUpdate=true;roughMap.needsUpdate=true;bumpMap.needsUpdate=true;shell.bumpScale=.0004*relief;
    // A paint-thin meniscus, not a swollen shell. Endpoints restore the exact
    // profile; fine detail comes from the shallow wet-film bump/reflection.
    for(let i=0;i<position.count;i++){
      const {wet}=coatingFromField(surfaceFields[i],surfaceNoise[i],progress,edge),r=Math.hypot(base[i*3],base[i*3+2]);
      const height=.0015*wet*relief*Math.max(0,Math.min(1,(r-1.11)/.18));
      for(let axis=0;axis<3;axis++)position.array[i*3+axis]=base[i*3+axis]+baseNormals[i*3+axis]*height;
    }
    position.needsUpdate=true;
    if(progress>0&&progress<1&&relief>0)geometry.computeVertexNormals();else{normal.array.set(baseNormals);normal.needsUpdate=true;}
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
  }
  update();
  return {update,dispose(){}};
}
