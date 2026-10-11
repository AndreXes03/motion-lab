import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Approved wide/contrast look: neutral fill, narrow highlights and dark unlit faces.
export const STUDIO_BASELINE=Object.freeze({
  exposure:1.05,
  look:Object.freeze({bloomStrength:.045,bloomThreshold:1.8,bloomRadius:.18,
    aoIntensity:.35,aberrationPx:.35,vignette:.14,lensDistortion:.065,
    dofEnabled:true,dofAuto:true,dofStrength:.12,dofMaxBlur:10,antialias:true}),
  final:Object.freeze({width:1920,height:1080,temporalSamples:24,bitrateMbps:28}),
  shutterAngle:270
});
export function configureStudioRenderer(renderer){
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.AgXToneMapping;
  renderer.toneMappingExposure=STUDIO_BASELINE.exposure;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
}
// Units are relative to a roughly 3-unit product. Scale the rig with the subject.
export function createStudioLighting(scene,{scale=1,keyStrength=1,rimStrength=1,fillIntensity=.10,environmentIntensity=.20}={}){
  if(!Number.isFinite(scale)||scale<=0)throw Error('Lighting scale must be positive');
  if([keyStrength,rimStrength,fillIntensity,environmentIntensity].some(v=>!Number.isFinite(v)||v<0))throw Error('Lighting intensities must be non-negative');
  RectAreaLightUniformsLib.init();
  const rig=new T.Group();rig.name='Studio contrast lighting';
  const fill=new T.HemisphereLight('#ffffff','#070707',fillIntensity);rig.add(fill);
  const key=new T.RectAreaLight('#ffffff',12*keyStrength,1.2*scale,4.5*scale);
  key.position.set(-3.8*scale,3*scale,scale);key.lookAt(0,.35*scale,0);rig.add(key);
  const rims=[];
  for(const [position,color,intensity] of [[[4,1,-3],'#dceaff',135],[[1,-4,-2],'#ffffff',65]]){
    const light=new T.PointLight(color,intensity*scale*scale*rimStrength);light.position.fromArray(position).multiplyScalar(scale);rig.add(light);rims.push(light);
  }
  scene.add(rig);const oldIntensity=scene.environmentIntensity;scene.environmentIntensity=environmentIntensity;
  let disposed=false;
  return {rig,key,fill,rims,dispose(){if(disposed)return;disposed=true;scene.remove(rig);scene.environmentIntensity=oldIntensity;rig.traverse(o=>{if(o.isLight)o.dispose();});}};
}
// Start from the authored pose on every frame; never apply this cumulatively.
export function applyWideStudioLens(camera,target,{baseFov=camera.fov,boost=36,minDistanceRatio=.65,maxFov=110}={}){
  if(!(baseFov>0&&baseFov<180)||!(maxFov>0&&maxFov<180)||!Number.isFinite(boost)||!(minDistanceRatio>0&&minDistanceRatio<=1))throw Error('Invalid wide lens settings');
  const fov=T.MathUtils.clamp(baseFov+boost,1,maxFov);
  const ratio=Math.max(minDistanceRatio,Math.tan(T.MathUtils.degToRad(baseFov/2))/Math.tan(T.MathUtils.degToRad(fov/2)));
  camera.position.sub(target).multiplyScalar(ratio).add(target);
  camera.fov=fov;camera.updateProjectionMatrix();
  return ratio;
}
