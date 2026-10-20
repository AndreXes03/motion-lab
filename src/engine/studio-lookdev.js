import * as T from 'three';
import {organicSurface} from '../scenes/organic-surface.js';
import {glossStudio} from '../scenes/gloss-studio.js';
// Create once per scene; reuse materials rather than generating maps per mesh.
// Ownership is explicit: dispose only after every mesh using this kit is removed.
export function createStudioMaterials(renderer,{colors={},environmentFactory=glossStudio}={}){
 const environment=environmentFactory(renderer,{owned:true}),env=environment.texture,leather=organicSurface('leather'),metal=organicSurface('metal'),paper=organicSurface('paper');
 const materials={
  leather:new T.MeshPhysicalMaterial({...leather,color:'#151617',roughness:.76,metalness:0,normalScale:new T.Vector2(.45,.45),envMap:env}),
  rubber:new T.MeshPhysicalMaterial({...leather,color:'#111212',roughness:.9,metalness:0,normalScale:new T.Vector2(.48,.48),envMap:env,envMapIntensity:.3}),
  mattePlastic:new T.MeshPhysicalMaterial({color:'#e8e2d8',roughness:.53,metalness:0,clearcoat:.04,envMap:env,envMapIntensity:.65}),
  satinPlastic:new T.MeshPhysicalMaterial({color:'#ff681c',roughness:.43,metalness:0,clearcoat:.08,clearcoatRoughness:.28,envMap:env,envMapIntensity:.65}),
  brushedMetal:new T.MeshPhysicalMaterial({...metal,color:'#ddd8d0',metalness:1,roughness:.2,normalScale:new T.Vector2(.12,.12),anisotropy:.45,envMap:env,envMapIntensity:1.1}),
  enamel:new T.MeshPhysicalMaterial({color:'#ff681c',metalness:0,roughness:.17,clearcoat:.65,clearcoatRoughness:.075,specularIntensity:.72,ior:1.46,envMap:env,envMapIntensity:1.35}),
  fibre:new T.MeshPhysicalMaterial({...paper,color:'#34363c',metalness:0,roughness:.86,normalScale:new T.Vector2(.65,.65),envMap:env})
 };
 materials.anodizedMetal=new T.MeshPhysicalMaterial({...metal,color:'#262b2d',metalness:.86,roughness:.34,normalScale:new T.Vector2(.10,.10),envMap:env,envMapIntensity:.75});
 materials.glass=new T.MeshPhysicalMaterial({color:'#d9e8e6',metalness:0,roughness:.065,transmission:.82,thickness:.16,ior:1.5,envMap:env,envMapIntensity:1.05});
 materials.copper=new T.MeshStandardMaterial({color:'#b6834a',metalness:.85,roughness:.28,envMap:env});
 materials.ceramic=new T.MeshPhysicalMaterial({color:'#c8c9bd',metalness:0,roughness:.4,envMap:env});
 for(const [name,color] of Object.entries(colors)){if(!materials[name])throw Error('Unknown studio material: '+name);materials[name].color.set(color);}
 const variants=new Set();
 let disposed=false;return {materials,environment:env,variant(name,overrides={}){if(disposed)throw Error('Material kit disposed');if(!materials[name])throw Error('Unknown studio material: '+name);const m=materials[name].clone();m.setValues(overrides);variants.add(m);return m;},dispose(){if(disposed)return;disposed=true;for(const m of [...Object.values(materials),...variants])m.dispose();for(const maps of [leather,metal,paper])for(const tex of Object.values(maps))tex.dispose();environment.dispose();}};
}
