import {createBrandTexture} from './brand.js';
import {createMicroSurfaceMaps} from './materials.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createDevice(config){
 const group=new T.Group();group.name='device.root';
 // Seeded, seamless multiscale finish: broad enough to register in close-ups,
 // but confined to shading so the approved silhouette and dimensions stay fixed.
 let seed=173;function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
 const shellMaps=createMicroSurfaceMaps({seed:0xBA581,resolution:512,repeat:[2.4,2.4],heightAmplitude: 85,roughnessBase:237,roughnessAmplitude: 28});
 const gripMaps=createMicroSurfaceMaps({seed:0x0A61E,resolution:512,repeat:[3.2,2.2],heightAmplitude: 85,roughnessBase:239,roughnessAmplitude: 28});
 const plastic=new T.MeshPhysicalMaterial({color:config.palette.shell,roughness:.46,metalness:0,clearcoat:.12,clearcoatRoughness:.38,bumpMap:shellMaps.bumpMap,bumpScale:.001,roughnessMap:shellMaps.roughnessMap});
 const orange=new T.MeshPhysicalMaterial({color:config.palette.knob,roughness:.54,metalness:0,clearcoat:.08,clearcoatRoughness:.45,bumpMap:gripMaps.bumpMap,bumpScale:.00075,roughnessMap:gripMaps.roughnessMap});
 const brushed=document.createElement('canvas');brushed.width=brushed.height=512;
 const br=brushed.getContext('2d');br.fillStyle='#e4e4e4';br.fillRect(0,0,512,512);
 for(let i=0;i<512;i++){const v=220+Math.round(random()*20);br.strokeStyle=`rgb(${v},${v},${v})`;br.beginPath();br.moveTo(0,i+.5);br.lineTo(512,i+.5);br.stroke();}
 const brush=new T.CanvasTexture(brushed);brush.wrapS=brush.wrapT=T.RepeatWrapping;brush.repeat.set(1,4);brush.anisotropy=8;
 const metal=new T.MeshPhysicalMaterial({color:'#c6d2de',roughness:.31,metalness:1,roughnessMap:brush,bumpMap:brush,bumpScale:.0006,anisotropy:.55});
 const black=new T.MeshStandardMaterial({color:'#131a21',roughness:.45});const darkMetal=new T.MeshStandardMaterial({color:'#303c49',roughness:.35,metalness:.8});
 function add(name,g,m,p,parent=group){const o=new T.Mesh(g,m);o.name=name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 function box(name,size,pos,mat,r=.1,smoothness=8){return add(name,new RoundedBoxGeometry(...size,smoothness,r),mat,pos)}
 function cyl(name,r,depth,pos,mat,parent=group){const m=add(name,new T.CylinderGeometry(r,r,depth,96),mat,pos,parent);m.rotation.x=Math.PI/2;return m}
 function ring(name,r,t,pos,mat,parent=group){return add(name,new T.TorusGeometry(r,t,16,100),mat,pos,parent)}
 box('shell.back',[3.6,4.5,.91],[0,0,-.08],darkMetal,.32,12);
 box('shell.gasket',[3.64,4.54,.12],[0,0,.11],black,.32);
 box('shell.front',[3.66,4.56,.67],[0,0,.37],plastic,.33,12);
 box('display.frame',[3.06,1.1,.14],[0,1.28,.729],metal,.16);
 box('display.rubber',[2.94,.98,.16],[0,1.28,.779],black,.13);
 const ledCanvas=document.createElement('canvas');ledCanvas.width=1024;ledCanvas.height=256;const texture=new T.CanvasTexture(ledCanvas);texture.colorSpace=T.SRGBColorSpace;
 add('display.led',new T.PlaneGeometry(2.69,.68),new T.MeshBasicMaterial({map:texture}),[0,1.28,.868]);
 let lastText='';function setDisplay(text){if(text===lastText)return;lastText=text;const mask=document.createElement('canvas');mask.width=128;mask.height=32;const c=mask.getContext('2d');c.fillStyle='#fff';c.font='bold 22px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text.slice(0,10),64,17,120);const data=c.getImageData(0,0,128,32).data;const ctx=ledCanvas.getContext('2d');ctx.fillStyle='#050c09';ctx.fillRect(0,0,1024,256);for(let y=0;y<32;y++)for(let x=0;x<128;x++){ctx.fillStyle=data[(y*128+x)*4+3]>110?config.palette.led:'#14231b';ctx.beginPath();ctx.arc(x*8+4,y*8+4,2.65,0,Math.PI*2);ctx.fill()}texture.needsUpdate=true;}
 // Static collar and moving cap share one centre but have a visible radial clearance.
 cyl('dial.recess',1.075,.065,[.34,-.51,.744],black);
 cyl('dial.machined-ring',1.025,.10,[.34,-.51,.80],metal);
 ring('dial.edge',.992,.018,[.34,-.51,.854],metal);
 cyl('dial.shadow-gap',.932,.026,[.34,-.51,.873],black);
 const knob=new T.Group();knob.name='dial.rotor';knob.position.set(.34,-.51,.882);group.add(knob);
 // A +90-degree X rotation maps the lathe's +Y axis to +Z. The softly crowned face catches a broad highlight.
 const profile=[[0,0],[.82,0],[.867,.012],[.894,.04],[.90,.075],[.90,.265],[.892,.295],[.876,.317],[.84,.332],[.70,.349],[.46,.362],[.20,.369],[0,.371]].map(([r,y])=>new T.Vector2(r,y));
 const dial=add('dial.orange',new T.LatheGeometry(profile,160),orange,[0,0,0],knob);dial.rotation.x=Math.PI/2;
 // Axial ribs sit within the cylindrical grip, ending before the top shoulder.
 // The old .013-radius capsules at r=.90 projected beyond the face as a crown of spikes.
 const ridgeGeometry=new T.CapsuleGeometry(.008,.158,4,8);
 for(let i=0;i<72;i++){
  const a=i*Math.PI*2/72;
  const ridge=add(`dial.knurl.${i}`,ridgeGeometry,orange,[Math.sin(a)*.899,Math.cos(a)*.899,.17],knob);
  ridge.rotation.x=-Math.PI/2;
 }
 const pointer=add('dial.pointer',new RoundedBoxGeometry(.045,.20,.007,3,.003),black,[0,.63,.356],knob);
 pointer.rotation.x=.077;
 for(let i=0;i<29;i++){const a=(-135+i*270/28)*Math.PI/180;const mark=add(`dial.scale.${i}`,new T.BoxGeometry(.018,i%7===0?.10:.05,.009),metal,[.34+Math.sin(a)*1.17,-.51+Math.cos(a)*1.17,.714]);mark.rotation.z=-a;}
 // A recessed perforated steel grille, not dots painted on the shell.
 box('speaker.cavity',[.42,2.17,.055],[-1.30,-.56,.717],black,.12);
 const grille=new T.MeshStandardMaterial({color:'#657387',metalness:.9,roughness:.36});
 for(let r=0;r<34;r++)for(let c=0;c<4;c++){ring(`speaker.perforation.${r}.${c}`,.022,.008,[-1.425+c*.081,-1.51+r*.059,.754],grille)}
 function label(name,text,w,h,pos,color='#d8e5ff'){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='500 58px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;add(name,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),pos)}
 if(config.deviceBrand){const logo=createBrandTexture({color:'#d8e5ff'});add('brand',new T.PlaneGeometry(1.14,1.14/logo.userData.aspect),new T.MeshStandardMaterial({map:logo,transparent:true,depthWrite:false,roughness:.5}),[-.8,1.99,.755])}else label('brand','S I G N A L',1.14,.17,[-.8,1.99,.755]);label('model','P O R T A B L E   S Y N T H',1.29,.10,[.74,1.99,.755]);label('serial','01 / ANALOG FEEL. DIGITAL SOUL.',2.7,.13,[0,-1.98,.755]);
 label('control','F R E Q U E N C Y',1.1,.10,[.34,-1.79,.714]);
 for(const x of [-1.53,1.53])for(const y of [-1.99,1.99]){cyl(`screw.${x}.${y}`,.052,.018,[x,y,.698],metal);add(`screw.slot.${x}.${y}`,new T.BoxGeometry(.05,.012,.01),black,[x,y,.711]);}
 for(let i=0;i<2;i++){const x=-.65+i*1.3;const socket=cyl(`port.${i}`,.17,.16,[x,-2.26,.02],metal);socket.rotation.x=0;const plug=add(`plug.${i}`,new T.CylinderGeometry(.125,.14,.42,32),black,[x,-2.53,.02]);for(let k=0;k<4;k++){const r=ring(`plug.ring.${i}.${k}`,.126,.013,[x,-2.43-k*.06,.02],darkMetal);r.rotation.x=Math.PI/2;}
 const pts=i===0?[[x,-2.74,.02],[-.8,-3.5,.03],[-2.4,-3.6,.15],[-3.6,-2.7,.0],[-4.5,-4.2,-.3],[-8,-6,0],[-20,-10,0]]:[[x,-2.74,.02],[.85,-3.25,.05],[2.0,-3.5,-.3],[2.9,-2.4,-.5],[2.5,-1.1,-.7],[3.2,-.2,-.9],[4.8,.3,-1.5]];
 add(`cable.${i}`,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),160,.065,12,false),i?black:orange,[0,0,0]);}
 // Side inset and heat sink fins visibly establish thickness.
 for(let i=0;i<12;i++)box(`side.fin.${i}`,[.018,.045,.42],[1.814,-.7+i*.12,-.10],black,.012);
 return {group,knob,plastic,orange,setDisplay};
}
