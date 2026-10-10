import {MeshPhysicalMaterial,Vector2} from 'three';

// A dark studio ground that dissolves before the far clip plane. This avoids
// exposing either a finite plinth edge or a hard horizon against a gradient.
export function shadowGroundMaterial({fadeNear=50,fadeFar=115}={}) {
  const material=new MeshPhysicalMaterial({color:'#010203',roughness:1,metalness:0,
    envMapIntensity:0,ior:1.02,specularIntensity:.02,transparent:true,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.groundFade={value:new Vector2(fadeNear,fadeFar)};
    shader.fragmentShader='uniform vec2 groundFade;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\ngl_FragColor.a *= 1.0-smoothstep(groundFade.x,groundFade.y,length(vViewPosition));');
  };
  material.customProgramCacheKey=()=>`shadow-ground-v1-${fadeNear}-${fadeFar}`;
  return material;
}
