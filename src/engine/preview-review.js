import {MeshStandardMaterial,MeshNormalMaterial,MeshBasicMaterial} from 'three';

// Explicit adapter support: hybrid Canvas films do not necessarily expose a mesh scene.
const meshScenes=new Set(['bax','starter','pulse','camera','pop']);
const modes=Object.freeze([
 {id:'beauty',label:'Final look'},
 {id:'clean',label:'Without effects'},
 {id:'clay',label:'Clay'},
 {id:'wireframe',label:'Wireframe'},
 {id:'normals',label:'Normals'},
]);
export function previewReviewModes(scene){return modes.filter(mode=>mode.id==='beauty'||meshScenes.has(scene));}
export function resolvePreviewReview(scene,mode){return previewReviewModes(scene).some(option=>option.id===mode)?mode:'beauty';}
export function isDiagnosticReview(mode){return ['clay','wireframe','normals'].includes(mode);}
export function createReviewMaterials(){
 const materials={
  clay:new MeshStandardMaterial({color:'#a4a6ab',roughness:.65}),
  wireframe:new MeshBasicMaterial({color:'#a8b3be',wireframe:true,toneMapped:false}),
  normals:new MeshNormalMaterial(),
 };
 return {materialFor:mode=>materials[mode]??null,isDiagnostic:isDiagnosticReview,dispose(){for(const material of Object.values(materials))material.dispose();}};
}
