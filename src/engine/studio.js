import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
/** Shared product studio: large softboxes, narrow edge strip and black flags.
 * Reflection cards match the key direction; lighting recipe changes rebuild PMREM once.
 */
export function createStudio(renderer,{top='#327cc8',bottom='#c5d6e2'}={}){
 RectAreaLightUniformsLib.init();
 const scene=new T.Scene();const bg=document.createElement('canvas');bg.width=32;bg.height=1024;
 const ctx=bg.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,1024);gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);ctx.fillStyle=gradient;ctx.fillRect(0,0,32,1024);
 const tex=new T.CanvasTexture(bg);tex.colorSpace=T.SRGBColorSpace;scene.background=tex;
 const fill=new T.HemisphereLight('#c6d7ee','#02030a',.05);scene.add(fill);
 const key=new T.SpotLight('#fff1de',220,40,.85,.75,2);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00008;key.shadow.normalBias=.012;key.shadow.radius=3;scene.add(key,key.target);
 const softbox=new T.RectAreaLight('#fff1de',3,3,7);scene.add(softbox);
 const bounce=new T.RectAreaLight('#b6d3ff',1.3,3,5);bounce.position.set(6,3,5);bounce.lookAt(2,0,0);scene.add(bounce);
 const lowBounce=new T.RectAreaLight('#d5def1',.12,5,3);lowBounce.position.set(0,-4,6);lowBounce.lookAt(0,0,0);scene.add(lowBounce);
 const rim=new T.DirectionalLight('#badcff',1.8);scene.add(rim);
 let signature='',environmentTarget;
 function applyLook(look){const l=look.lighting,p=l.keyPosition||[-4,6,7],target=l.keyTarget||[0,0,0],rimP=l.rimPosition||[5,3,-4];
  key.intensity=l.key;fill.intensity=l.fill;rim.intensity=l.rim;bounce.intensity=.3;scene.environmentIntensity=l.environment;
  key.position.fromArray(p);key.target.position.fromArray(target);rim.position.fromArray(rimP);key.angle=l.keyAngle??.85;key.penumbra=l.keyPenumbra??.75;key.color.set(l.keyColor||'#fff1de');rim.color.set(l.rimColor||'#badcff');
  softbox.position.fromArray(p);softbox.lookAt(...target);softbox.color.copy(key.color);softbox.intensity=l.key/100;
  const sig=JSON.stringify([p,rimP,l.keyColor,l.rimColor]);if(sig===signature)return;signature=sig;
  const room=new T.Scene();room.background=new T.Color('#020307');
  for(const [w,h,pos,color,power] of [[3,8,p,l.keyColor||'#fff1de',3],[.8,7,rimP,l.rimColor||'#badcff',6],[6,.65,[0,7,-3],'#dceaff',4],[3,5,[6,3,5],'#b6d3ff',2]]){
   const card=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(power),side:T.DoubleSide}));card.position.fromArray(pos);card.lookAt(0,0,0);room.add(card);
  }
  const pmrem=new T.PMREMGenerator(renderer),next=pmrem.fromScene(room,.015);scene.environment=next.texture;environmentTarget?.dispose();environmentTarget=next;pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
 }
 return {scene,applyLook};
}
