import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {applyCameraLens,resolveCameraLens,perspectiveScenes} from '../src/engine/camera-lens.js';
import {getControlCatalog,createControlManifest,resolveControlManifest} from '../src/engine/control-catalog.js';
import {validateStudioParameters} from './studio-api.mjs';
import {resolveParameters} from '../src/engine/project-controls.js';
import {evaluateParameterAnimation} from '../src/engine/parameter-animation.js';
const eye=[2,1,8],target=[0,0,0],baseline=resolveCameraLens(eye,target,60);
assert.deepEqual(baseline,{position:eye,fov:60,ratio:1});
const wide=resolveCameraLens(eye,target,60,{},90);
assert.ok(wide.position[2]<eye[2]);
const projected=(distance,fov)=>1/(distance*Math.tan(fov*Math.PI/360));
assert.ok(Math.abs(projected(wide.position[2],90)-projected(8,60))<1e-12,'Wider angle plus real dolly preserves subject scale');
const free=resolveCameraLens(eye,target,60,{look:{camera:{keepSubjectSize:false}}},90);assert.deepEqual(free.position,eye);
const manual=resolveCameraLens(eye,target,60,{look:{camera:{distance:.7}}});assert.equal(manual.position[2],5.6);
const camera=new PerspectiveCamera(60);camera.position.fromArray(eye);camera.lookAt(...target);const rotation=camera.quaternion.toArray();applyCameraLens(camera,{look:{camera:{distance:.7}}},{target,referenceFov:60});assert.deepEqual(camera.quaternion.toArray(),rotation);
for(const scene of perspectiveScenes){
 const defs=getControlCatalog(scene),manifest=createControlManifest(scene);for(const id of ['cameraDistance','keepSubjectSize'])assert.ok(manifest.controls.includes(id),scene+' selects '+id);
 const lensPanel=manifest.panels.find(panel=>panel.controls.includes('cameraDistance'));assert.ok(lensPanel.controls.some(id=>['fov','fovScale'].includes(id)),scene+' pairs distance with angle');
 const lensId=defs.some(def=>def.id==='fov')?'fov':'fovScale';const legacy=resolveControlManifest({version:1,scene,controls:[lensId]},scene);assert.ok(legacy.controls.includes('cameraDistance')&&legacy.controls.includes('keepSubjectSize'));
 const p=resolveParameters(scene);p.look??={};p.look.camera={...p.look.camera,distance:.7,fovScale:1.2,keepSubjectSize:true};const validated=await validateStudioParameters(p);assert.equal(validated.look.camera.distance,.7);
 const animated=evaluateParameterAnimation({...validated,animation:{version:1,tracks:{cameraDistance:[{t:0,value:1,ease:'linear'},{t:1,value:.5}]}}},.5);assert.equal(animated.look.camera.distance,.75);
 await assert.rejects(()=>validateStudioParameters({...validated,look:{...validated.look,camera:{...validated.look.camera,distance:0}}}),/camera.distance/);
 await assert.rejects(()=>validateStudioParameters({...validated,look:{...validated.look,camera:{...validated.look.camera,keepSubjectSize:0}}}),/keepSubjectSize/);
}
assert.ok(!getControlCatalog('procedural').some(def=>def.id==='fovScale'),'No invented 3D lens for the purely 2D scene');
console.log(JSON.stringify({passed:true,perspectiveScenes:perspectiveScenes.length,physicalDolly:true,subjectSizeCompensation:true,manualDistance:true,recipes:true,keyframes:true,legacyLayouts:true,defaultsPreserved:true}));
