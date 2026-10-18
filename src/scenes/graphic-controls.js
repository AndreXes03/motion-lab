import {studyControlDefinitions} from '../engine/scene-capabilities.js';

/** Resolve bounded scene-owned controls once per frame; no state crosses seeks. */
export function graphicControls(scene,parameters={}) {
 const source=parameters.sceneControls??{};
 return Object.fromEntries((studyControlDefinitions[scene]??[]).map(({id,min,max,default:fallback})=>[id,Number.isFinite(source[id])?Math.max(min,Math.min(max,source[id])):fallback]));
}
const overlay=id=>/^lab\.(brand$|chapter$|footer$|timecode$|top\.rule$|meter\.|tick\.)/.test(id);
/** Apply styling to freshly generated nodes, preserving identities and sound hooks. */
export function styleProceduralNodes(nodes,controls) {
 for(const node of nodes) {
  if(overlay(node.id)){if(controls.overlayOpacity!==1)node.opacity=(node.opacity??1)*controls.overlayOpacity;continue;}
  if(node.id==='lab.background'||node.id.startsWith('lab.edit.'))continue;
  if(node.type==='text') {
   if(controls.typeScale!==1)node.font=node.font.replace(/([\d.]+)px/,(match,n)=>`${Number(n)*controls.typeScale}px`);
   if(/^lab\.kinetic\.word\.[1-3]$/.test(node.id)&&controls.echoOpacity!==1)node.opacity=Math.min(1,(node.opacity??1)*controls.echoOpacity);
   continue;
  }
  if(controls.strokeWidth!==1&&node.lineWidth!==undefined)node.lineWidth*=controls.strokeWidth;
  if(controls.particleSize!==1&&(/^lab\.(flow\.head\.|torus\.orbit\.|swarm\.|interference\.marker\.)/.test(node.id))) {
   if(node.radius!==undefined)node.radius*=controls.particleSize;
   if(node.width!==undefined)node.width*=controls.particleSize;
   if(node.height!==undefined)node.height*=controls.particleSize;
  }
  if(controls.shapeScale!==1) {
   const scale=controls.shapeScale;
   if(node.x!==undefined)node.x=960+(node.x-960)*scale;
   if(node.y!==undefined)node.y=540+(node.y-540)*scale;
   if(node.type==='path')node.commands=node.commands.map(([kind,x,y])=>[kind,960+(x-960)*scale,540+(y-540)*scale]);
   for(const key of ['width','height','radius'])if(node[key]!==undefined)node[key]*=scale;
  }
 }
 return nodes;
}
