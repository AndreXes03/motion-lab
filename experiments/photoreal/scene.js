import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {organicSurface} from '../../src/scenes/organic-surface.js';
import {detailHeadphones} from './headphone-detail.js';
import {createFilmAsset} from '../../src/product-kit/assets.js';

// Freeze visible geometry and expand instances for the pinned WebGL path tracer.
// Both renderers receive this exact scene; production assets are never mutated.
export function freezeScene(root){
 root.updateMatrixWorld(true);const out=new T.Group(),materials=new Map();
 const report={meshes:0,instances:0,triangles:0,basicMaterials:0,customShaders:0,disabledClearcoat:0};
 function material(source){if(materials.has(source))return materials.get(source);let result;
  if(source.isMeshStandardMaterial)result=source.clone();
  else if(source.isMeshBasicMaterial){result=new T.MeshStandardMaterial({color:source.color,map:source.map,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,side:source.side,roughness:.65,metalness:0});report.basicMaterials++;}
  else throw Error('Unsupported material: '+source.type);
  if(source.onBeforeCompile!==T.Material.prototype.onBeforeCompile)report.customShaders++;
  if(result.clearcoat>0)report.disabledClearcoat++;result.clearcoat=0;result.envMap=null;result.needsUpdate=true;materials.set(source,result);return result;
 }
 root.traverseVisible(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material.map(material):material(o.material);
  const count=o.isInstancedMesh?o.count:1;
  for(let i=0;i<count;i++){const matrix=o.matrixWorld.clone();if(o.isInstancedMesh){const local=new T.Matrix4();o.getMatrixAt(i,local);matrix.multiply(local);report.instances++;}
   const geometry=o.geometry.clone().applyMatrix4(matrix),mesh=new T.Mesh(geometry,mats);mesh.name=o.name;mesh.castShadow=mesh.receiveShadow=true;out.add(mesh);report.meshes++;report.triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
  }
 });
 return {root:out,report,dispose(){out.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());}};
}
export function createPhotoScene(renderer,{asset='headphones',width=960,height=720}={}){
 RectAreaLightUniformsLib.init();
 const source=createFilmAsset(asset,{renderer,size:3});source.root.rotation.y=-.1;
 const detailDispose=asset==='headphones'?detailHeadphones(source.root):()=>{};
 const frozen=freezeScene(source.root),scene=new T.Scene();
 // Surface maps are reused from Motion Lab; both comparison images get them.
 const leather=organicSurface('leather'),metal=organicSurface('metal'),seen=new Set();
 // Sparse hairline wear changes reflections, not the base metal color.
 const wear=metal.roughnessMap.image.data,n=metal.roughnessMap.image.width;let seed=731;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<90;i++){const x=Math.floor(rand()*n),y=Math.floor(rand()*n),length=10+Math.floor(rand()*34);for(let j=0;j<length;j++){const px=(x+j)%n,py=(y+Math.floor(j*.11))%n,index=(py*n+px)*4;wear[index]=wear[index+1]=wear[index+2]=Math.min(255,wear[index+1]+22);}}
 metal.roughnessMap.needsUpdate=true;
 frozen.root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m||seen.has(m)||m.map||m.userData.photoFinish)continue;seen.add(m);if(m.metalness>.5){m.normalMap=metal.normalMap;m.roughnessMap=metal.roughnessMap;m.normalScale.set(.08,.08);m.roughness=.30;}else{m.normalMap=leather.normalMap;m.roughnessMap=leather.roughnessMap;m.normalScale.set(.42,.42);m.roughness=.72;}}});scene.add(frozen.root);
 const bw=512,bh=256,bgData=new Float32Array(bw*bh*4);
 for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const v=y/(bh-1),q=T.MathUtils.smoothstep(1-v,.28,.83),s=q*q;bgData.set([.00018+.006*s,.00025+.019*s,.0005+.070*s,1],(y*bw+x)*4);}
 const backdrop=new T.DataTexture(bgData,bw,bh,T.RGBAFormat,T.FloatType);backdrop.mapping=T.EquirectangularReflectionMapping;backdrop.magFilter=T.LinearFilter;backdrop.minFilter=T.LinearFilter;backdrop.needsUpdate=true;scene.background=backdrop;
 // Linear HDR studio environment: broad softboxes and narrow strip reflections.
 const ew=512,eh=256,data=new Float32Array(ew*eh*4);
 for(let y=0;y<eh;y++)for(let x=0;x<ew;x++){const u=x/ew,v=y/eh;let r=.018,g=.025,b=.04;
  for(const [cx,cy,w,h,power,color] of [[.18,.42,.055,.22,3.5,[1,.92,.80]],[.64,.35,.028,.27,4,[.75,.88,1]],[.45,.18,.16,.06,2,[1,1,1]]]){const dx=Math.min(Math.abs(u-cx),1-Math.abs(u-cx))/w,dy=Math.abs(v-cy)/h,e=power*Math.exp(-Math.pow(dx,8)-Math.pow(dy,8));r+=e*color[0];g+=e*color[1];b+=e*color[2];}
  data.set([r,g,b,1],(y*ew+x)*4);
 }
 const env=new T.DataTexture(data,ew,eh,T.RGBAFormat,T.FloatType);env.mapping=T.EquirectangularReflectionMapping;env.needsUpdate=true;scene.environment=env;
 for(const [pos,w,h,intensity,color] of [[[2.3,2.6,.8],.75,2.2,22,'#fff0d5'],[[-2.4,1,-1],.22,2.7,42,'#7cb2ef'],[[1.6,.1,2.7],.18,1.7,5,'#dbeaff']]){
  const light=new T.RectAreaLight(color,intensity,w,h);light.position.fromArray(pos);light.lookAt(0,0,0);scene.add(light);
 }
 const camera=new T.PerspectiveCamera(114,width/height,.025,250);camera.position.set(1.6,-.1,.82);camera.lookAt(.55,-.25,0);camera.rotateZ(-.40);camera.updateMatrixWorld(true);
 return {scene,camera,report:{...frozen.report,lensFov:camera.fov,artDirection:'Extreme close wide angle, floating object, warm key and cool rim',finishes:['brushed gold','silver rails','embossed leather','matte rubber','satin ceramic grille','titanium fasteners','glossy RGB display'],surfaceDetail:'Fingerprint roughness on display, sparse metal wear, low-amplitude leather displacement, modeled stitches'},dispose(){frozen.dispose();source.dispose();detailDispose();for(const maps of [leather,metal])for(const texture of Object.values(maps))texture.dispose();env.dispose();backdrop.dispose();}};
}
