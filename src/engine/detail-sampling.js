// Sampling quality only: preserve the authored lighting, materials and exposure.
export function configureDetailSampling(renderer,scene){
 const anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
 const textures=new Set();
 scene.traverse(object=>{
  if(object.isLight&&object.castShadow&&object.shadow&&(object.shadow.mapSize.x!==4096||object.shadow.mapSize.y!==4096)){object.shadow.mapSize.set(4096,4096);object.shadow.needsUpdate=true;}
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!material)continue;
   for(const key of ['map','normalMap','bumpMap','roughnessMap','metalnessMap','alphaMap','emissiveMap']){
    const texture=material[key];if(!texture?.isTexture||textures.has(texture))continue;
    if(texture.anisotropy!==anisotropy){texture.anisotropy=anisotropy;texture.needsUpdate=true;}textures.add(texture);
   }
  }
 });
 return {anisotropy,textures:textures.size,shadowMapSize:4096};
}
