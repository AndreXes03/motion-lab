import * as T from 'three';
// Dedicated photographic reflection cards: dark gaps preserve specular shape.
export function glossStudio(renderer){
 const s=new T.Scene();s.background=new T.Color('#05070b');
 for(const [p,w,h,color,power] of [[[-4,3,6],1.1,7,'#e5efff',3],[[5,1,3],.55,5,'#a9caff',2],[[0,7,-2],5,1.1,'#fff1d8',2.8],[[-6,-2,-4],2,3,'#33455c',.5]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(power),side:T.DoubleSide,toneMapped:false}));m.position.set(...p);m.lookAt(0,0,0);s.add(m);}
 const gen=new T.PMREMGenerator(renderer);const out=gen.fromScene(s,.015);gen.dispose();s.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return out.texture;
}
