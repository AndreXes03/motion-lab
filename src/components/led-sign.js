import {createBrandTexture} from './brand.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createLedSign({width=3.2,height=1.25,name='objects.sign'}={}){
 const root=new T.Group();root.name=name;
 const shell=new T.Mesh(new RoundedBoxGeometry(width+.22,height+.22,.24,6,.14),new T.MeshStandardMaterial({color:'#e8e5db',roughness:.25,metalness:.12}));shell.castShadow=true;root.add(shell);
 const border=new T.Mesh(new RoundedBoxGeometry(width,height,.04,4,.08),new T.MeshStandardMaterial({color:'#10151b',roughness:.55}));border.position.z=.14;root.add(border);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const face=new T.Mesh(new T.PlaneGeometry(width-.12,height-.10),new T.MeshBasicMaterial({map:tex}));face.position.z=.166;root.add(face);let last='';
 function setText(text){if(last===text)return;last=text;const mask=document.createElement('canvas');mask.width=128;mask.height=48;const m=mask.getContext('2d');m.fillStyle='#fff';m.font='bold 19px Arial';m.textAlign='center';m.textBaseline='middle';if(text==='@brand'){const logo=createBrandTexture();const markHeight=22,markWidth=markHeight*logo.userData.aspect;m.drawImage(logo.image,(128-markWidth)/2,5,markWidth,markHeight);m.font='bold 8px Arial';m.fillText('MOVING PIXELS',64,36,118);}else{const lines=text.split('\n');lines.forEach((s,i)=>m.fillText(s,64,24+(i-(lines.length-1)/2)*22,119));}const pixels=m.getImageData(0,0,128,48).data;const c=canvas.getContext('2d');c.fillStyle='#080c0c';c.fillRect(0,0,1024,384);for(let y=0;y<48;y++)for(let x=0;x<128;x++){c.fillStyle=pixels[(y*128+x)*4+3]>100?(y>25?'#ff8548':'#fff1d4'):'#1a2425';c.beginPath();c.arc(x*8+4,y*8+4,2.6,0,6.284);c.fill()}tex.needsUpdate=true;}
 return {root,setText};
}
