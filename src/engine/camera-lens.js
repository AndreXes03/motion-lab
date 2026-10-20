/** Shared physical lens/dolly controls. Defaults preserve every authored pose. */
export const perspectiveScenes = ['objects','loop','starter','pulse','camera','pop','replay','dot'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function resolveCameraLens(position,target,referenceFov,parameters={},explicitFov) {
 const settings=parameters.look?.camera??{};
 const fov=clamp(explicitFov??referenceFov*(settings.fovScale??1),15,125);
 const compensation=settings.keepSubjectSize===false?1:Math.tan(referenceFov*Math.PI/360)/Math.tan(fov*Math.PI/360);
 const ratio=(settings.distance??1)*compensation;
 return {fov,ratio,position:ratio===1?[...position]:position.map((value,i)=>target[i]+(value-target[i])*ratio)};
}
/** Call after resetting the authored camera, before depth of field or rendering. */
export function applyCameraLens(camera,parameters,{target,referenceFov=camera.fov,fov}={}) {
 const focus=Array.isArray(target)?target:target.toArray();
 const lens=resolveCameraLens(camera.position.toArray(),focus,referenceFov,parameters,fov);
 if(lens.ratio!==1)camera.position.fromArray(lens.position);
 if(camera.fov!==lens.fov){camera.fov=lens.fov;camera.updateProjectionMatrix();}
 camera.updateMatrixWorld(true);
 return lens;
}
