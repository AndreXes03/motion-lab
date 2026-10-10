// Restore the last frame's offsets before sampling authored animation again.
// This keeps scrubbing deterministic and never rewrites the authored tracks.
export function createObjectEditor(scene) {
  let previous=[];
  const ids=new Set(['device.root','bax.emblem','bax.kinetic']);
  const finite=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  return {
    restore(){for(const {object,position,rotation,scale} of previous){object.position.copy(position);object.quaternion.copy(rotation);object.scale.copy(scale);}previous=[];},
    apply(edits={}){
      for(const [id,edit] of Object.entries(edits??{})){
        if(!ids.has(id)||!edit||typeof edit!=='object')continue;
        const object=scene.getObjectByName(id);if(!object)continue;
        previous.push({object,position:object.position.clone(),rotation:object.quaternion.clone(),scale:object.scale.clone()});
        for(const axis of ['x','y','z'])object.position[axis]+=finite(edit[axis],0,-5,5);
        object.rotation.y+=finite(edit.yaw,0,-180,180)*Math.PI/180;
        object.scale.multiplyScalar(finite(edit.scale,1,.25,2));
      }
    }
  };
}
