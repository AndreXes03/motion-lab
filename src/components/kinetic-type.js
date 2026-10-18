import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from '../assets/fonts/helvetiker_bold.typeface.json' with {type:'json'};
import {springIn,beatClock} from '../engine/beat-clock.js';
const font=new FontLoader().parse(fontData);
/** Real extruded glyphs, individual centered pivots and a centered word baseline. */
export function createKineticType(text,{colors=['#ff5a9d','#67d7f5','#ffe46b'],size=1.7,depth=.48}={}){
 const group=new T.Group(),letters=[];let advance=0;
 const side=new T.MeshStandardMaterial({color:'#151630',roughness:.3,metalness:.25});
 for(const [i,char]of [...text].entries()){
  const geometry=new TextGeometry(char,{font,size,depth,curveSegments:8,bevelEnabled:true,bevelThickness:.09,bevelSize:.065,bevelSegments:3});
  geometry.computeBoundingBox();const box=geometry.boundingBox,width=box.max.x-box.min.x;geometry.translate(-(box.min.x+box.max.x)/2,-size*.5,-depth/2);
  const face=new T.MeshPhysicalMaterial({color:colors[i%colors.length],roughness:.24,metalness:.12,clearcoat:1,clearcoatRoughness:.17});
  const mesh=new T.Mesh(geometry,[face,side]);mesh.position.x=advance+width/2;mesh.userData.homeX=mesh.position.x;mesh.name=`letter.${char}.${i}`;group.add(mesh);letters.push(mesh);advance+=width+.14;
 }
 for(const mesh of letters){mesh.userData.homeX-= (advance-.14)/2;mesh.position.x=mesh.userData.homeX;}
 group.name=`type.${text}`;
 return {group,letters,animate(t,{start=0,pulse=0,energy=1}={}){letters.forEach((mesh,i)=>{const p=springIn(t,start+i*.045),hit=beatClock(Math.max(0,t-i*.055),120).pulse;mesh.position.set(mesh.userData.homeX,(1-p)*-3+(hit*.24+Math.sin(t*4+i*.7)*.09)*energy,0);mesh.rotation.set((1-p)*1.1,Math.sin(t*4+i*.8)*.22*energy,(1-p)*.22+Math.sin(t*5+i)*.07*energy);mesh.scale.setScalar(Math.max(.001,p)*(1+hit*.10*energy));});}};
}
