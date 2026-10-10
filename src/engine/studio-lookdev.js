import * as T from 'three';
import {organicSurface} from '../scenes/organic-surface.js';
import {glossStudio} from '../scenes/gloss-studio.js';
// Create once per scene; reuse materials rather than generating maps per mesh.
// Ownership is explicit: dispose only after every mesh using this kit is removed.
export function createStudioMaterials(renderer){
 const env=glossStudio(renderer),leather=organicSurface('leather'),metal=organicSurface('metal'),paper=organicSurface('paper');
 const materials={
  leather:new T.MeshPhysicalMaterial({...leather,color:'#161b24',roughness:.66,metalness:0,normalScale:new T.Vector2(.45,.45),envMap:env}),
  brushedMetal:new T.MeshPhysicalMaterial({...metal,color:'#ddd8d0',metalness:1,roughness:.2,normalScale:new T.Vector2(.12,.12),anisotropy:.45,envMap:env,envMapIntensity:1.1}),
  enamel:new T.MeshPhysicalMaterial({color:'#ff681c',metalness:0,roughness:.17,clearcoat:.65,clearcoatRoughness:.075,specularIntensity:.72,ior:1.46,envMap:env,envMapIntensity:1.35}),
  fibre:new T.MeshPhysicalMaterial({...paper,color:'#34363c',metalness:0,roughness:.86,normalScale:new T.Vector2(.65,.65),envMap:env})
 };
 let disposed=false;return {materials,environment:env,dispose(){if(disposed)return;disposed=true;for(const m of Object.values(materials))m.dispose();for(const maps of [leather,metal,paper])for(const tex of Object.values(maps))tex.dispose();env.dispose();}};
}
