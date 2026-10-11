import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { Raycaster, Vector3, HalfFloatType, Vector2, WebGLRenderTarget, DataTexture, RGBAFormat, RepeatWrapping } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const LOOK = Object.freeze({
  bloomStrength: 0.12,
  bloomThreshold: 1.15,
  bloomRadius: 0.25,
  aberrationPx: 1.1,
  grain: 0.002,
  vignette: 0.12,
  lensDistortion: 0,
  fisheye: 0,
  edgeSoftness: 0,
  aoIntensity: 0.4
});

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2(1920, 1080) },
    aberrationPx: { value: LOOK.aberrationPx },
    vignette: { value: LOOK.vignette },
    lensDistortion: { value: 0 },
    fisheye: { value: 0 },
    edgeSoftness: { value: 0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float aberrationPx;
    uniform float vignette;
    uniform float lensDistortion;
    uniform float fisheye;
    uniform float edgeSoftness;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;
      float radius = length(centered);
      vec2 radial = radius > 0.0 ? centered / radius : vec2(0.0);
      float edge = clamp(radius * 1.41421356, 0.0, 1.0);
      vec2 offset = radial * (edge * edge) * aberrationPx / (vec2(resolution.x/resolution.y,1.0)*1080.0);

      // Inverse barrel mapping: edge compression bends straight lines.
      // Overscan keeps every sample inside the source image, without black corners.
      vec2 p = centered * 2.0;
      float r2 = dot(p,p);
      vec2 lensUV = 0.5 + 0.5 * p * (1.0 + lensDistortion*r2)/(1.0+2.0*lensDistortion);
      // Aspect-correct equidistant lens approximation; bounded inverse mapping
      // keeps the full frame covered without mirroring or clamping black corners.
      if (fisheye > 0.0) {
        float aspect = resolution.x / resolution.y;
        vec2 optical = p * vec2(aspect, 1.0);
        float radialLength = length(optical);
        float diagonal = length(vec2(aspect, 1.0));
        float theta = clamp(fisheye, 0.0, 1.0) * 1.32;
        float normalizedRadius = radialLength / diagonal;
        float magnification = normalizedRadius > 0.0001
          ? tan(normalizedRadius * theta) / (normalizedRadius * tan(theta))
          : theta / tan(theta);
        lensUV = .5 + .5 * optical * magnification / vec2(aspect, 1.0);
      }
      vec3 color;
      color.r = texture2D(tDiffuse, clamp(lensUV + offset,vec2(.001),vec2(.999))).r;
      color.g = texture2D(tDiffuse, lensUV).g;
      color.b = texture2D(tDiffuse, clamp(lensUV - offset,vec2(.001),vec2(.999))).b;
      if (edgeSoftness > 0.0) {
        // Off-axis loss of definition, with a small tangential component.
        // The optical center stays sharp; no uniform full-frame blur.
        vec2 soft = (radial + .45 * vec2(-radial.y, radial.x))
          * edge * edge * edgeSoftness / (vec2(resolution.x/resolution.y,1.0)*1080.0);
        vec3 wings = texture2D(tDiffuse, clamp(lensUV+soft,vec2(.001),vec2(.999))).rgb
          + texture2D(tDiffuse, clamp(lensUV-soft*.65,vec2(.001),vec2(.999))).rgb;
        color = color*.6 + wings*.2;
      }

      float falloff = smoothstep(0.28, 1.0, edge);
      color *= 1.0 - vignette * falloff;
      // Grain is applied once to the resolved frame, after motion integration.
      gl_FragColor = vec4(color, texture2D(tDiffuse, vUv).a);
    }
  `
};

/** Builds the 3D image treatment; composited 2D titles can be drawn afterward. */
export function createComposite(renderer, scene, camera, config) {
  const width = config.width ?? 1920;
  const height = config.height ?? 1080;
  const look = { ...LOOK, ...(config.look ?? {}) };
  const target = new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    depthBuffer: true,
    stencilBuffer: false,
    samples: Math.min(8, renderer.capabilities.maxSamples)
  });
  target.texture.name = 'Signal.Composite.LinearMSAA';

  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new Vector2(width, height),
    look.bloomStrength,
    look.bloomRadius,
    look.bloomThreshold
  );
  const outputPass = new OutputPass();
  const finishPass = new ShaderPass(FinishShader);
  finishPass.material.toneMapped = false;
  finishPass.uniforms.resolution.value.set(width, height);
  for (const key of ['aberrationPx', 'vignette', 'lensDistortion', 'fisheye', 'edgeSoftness']) {
    finishPass.uniforms[key].value = look[key];
  }

  composer.addPass(renderPass);
  const aoPass = new GTAOPass(scene,camera,width,height,undefined,{radius:.22,thickness:1,distanceExponent:2,scale:1},{radius:4});
  // Fixed denoise texture: identical across fresh sessions, not just repeat seeks.
  const noise=new Uint8Array(64*64*4);let seed=73821;
  for(let i=0;i<noise.length;i++){seed=(1664525*seed+1013904223)>>>0;noise[i]=seed>>>24;}
  const noiseTex=new DataTexture(noise,64,64,RGBAFormat);noiseTex.wrapS=noiseTex.wrapT=RepeatWrapping;noiseTex.needsUpdate=true;
  aoPass.pdNoiseTexture.dispose();aoPass.pdNoiseTexture=noiseTex;aoPass.pdMaterial.uniforms.tNoise.value=noiseTex;
  composer.addPass(aoPass);
  // Luminance-preserving soft knee controls extreme specular energy before bloom.
  const highlights=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:FinishShader.vertexShader,fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float peak=max(c.r,max(c.g,c.b));float excess=max(peak-2.0,0.0);float compressed=2.0+excess/(1.0+excess/6.0);c.rgb*=peak>2.0?compressed/peak:1.0;gl_FragColor=c;}`});
  highlights.material.toneMapped=false;composer.addPass(highlights);
  const dofPass=new BokehPass(scene,camera,{focus:8,aperture:.001,maxblur:.012});
  dofPass.enabled=false;dofPass.materialBokeh.toneMapped=false;
  composer.addPass(dofPass);
  const focusRay=new Raycaster(),focusPoint=new Vector3();let dofSettings={};
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  composer.addPass(finishPass);
  // Resolve contrast edges after lens distortion, before 2D overlays and grain.
  // One lightweight spatial pass; no additional scene/time samples.
  const aaPass = new ShaderPass(FXAAShader);
  aaPass.material.toneMapped = false;
  aaPass.uniforms.resolution.value.set(1 / width, 1 / height);
  composer.addPass(aaPass);

  let disposed=false;
  return {
    dispose(){if(disposed)return;disposed=true;for(const pass of composer.passes)pass.dispose?.();noiseTex.dispose();composer.dispose();},
    applyLook(next) {
      dofSettings=next;dofPass.enabled=next.dofEnabled===true;
      dofPass.uniforms.aperture.value=(next.dofStrength??.35)*.006;
      dofPass.uniforms.maxblur.value=(next.dofMaxBlur??12)/1080;
      aaPass.enabled=next.antialias!==false;
      bloomPass.strength=next.bloomStrength;bloomPass.threshold=next.bloomThreshold;bloomPass.radius=next.bloomRadius;
      aoPass.blendIntensity=next.aoIntensity??.4;aoPass.enabled=aoPass.blendIntensity>0;
      for(const key of ['aberrationPx','vignette','lensDistortion','fisheye','edgeSoftness'])finishPass.uniforms[key].value=next[key]??LOOK[key];
    },
    setReview(mode) {
      const clean=mode&&mode!=='beauty';bloomPass.enabled=!clean;finishPass.enabled=!clean;highlights.enabled=!clean;if(clean){aoPass.enabled=false;dofPass.enabled=false;}
    },
    render() {
      if(dofPass.enabled){
        scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        let focus=dofSettings.dofFocus??8;
        if(dofSettings.dofAuto!==false){
          focusRay.setFromCamera(new Vector2(0,0),camera);
          const hit=focusRay.intersectObjects(scene.children,true).find(hit=>{
            for(let o=hit.object;o;o=o.parent)if(!o.visible)return false;
            const m=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
            return hit.object.isMesh&&m?.visible!==false&&m?.depthWrite!==false;
          });
          if(hit)focus=-focusPoint.copy(hit.point).applyMatrix4(camera.matrixWorldInverse).z;
        }
        dofPass.uniforms.focus.value=Math.max(camera.near,Math.min(camera.far,focus));
      }
      composer.render(0);
    },
    setSize(w, h) {
      composer.setSize(w, h);
      finishPass.uniforms.resolution.value.set(w, h);
      aaPass.uniforms.resolution.value.set(1 / w, 1 / h);
    }
  };
}
