import {studyControlDefinitions} from '../engine/scene-capabilities.js';
const defaults=Object.fromEntries(studyControlDefinitions.loop.map(c=>[c.id,c.default]));
export function isLoopPreviewCurrent(p){
  if(p?.scene!=='loop')return false;
  if(Object.entries(p.sceneControls??{}).some(([key,value])=>!(key in defaults)||value!==defaults[key]))return false;
  const c=p.look?.camera??{},post=p.look?.post??{};
  if((c.fovScale??1)!==1||(c.distance??1)!==1||c.keepSubjectSize===false)return false;
  if((post.colorContrast??1)!==1||(post.colorSaturation??1)!==1)return false;
  if(p.animation&&Object.keys(p.animation).length)return false;
  if(p.objectEdits&&Object.keys(p.objectEdits).length)return false;
  return true;
}
