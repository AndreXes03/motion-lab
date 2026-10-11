import * as T from 'three';
import {createStudioMaterials} from '../engine/studio-lookdev.js';
import {STUDIO_BASELINE,configureStudioRenderer,createStudioLighting} from '../engine/studio-baseline.js';
import {createComposite} from '../engine/composite.js';
import {configureDetailSampling} from '../engine/detail-sampling.js';

/** Shared render stage; the caller owns renderer and model geometry. */
export function createProductStage(renderer,{width=960,height=540,colors={},lighting={},look={},background='#070c17'}={}) {
  configureStudioRenderer(renderer);
  const scene=new T.Scene();scene.background=new T.Color(background);
  const camera=new T.PerspectiveCamera(65,width/height,.025,150);camera.position.set(0,0,4);
  const kit=createStudioMaterials(renderer,{colors});scene.environment=kit.environment;
  const lights=createStudioLighting(scene,lighting);
  const baseLook={...STUDIO_BASELINE.look,dofAuto:false,dofFocus:4,...look};
  const composite=createComposite(renderer,scene,camera,{width,height,look:baseLook});
  const clay=new T.MeshStandardMaterial({color:'#989ca3',roughness:.65});const normals=new T.MeshNormalMaterial();
  let size='',disposed=false;
  return {scene,camera,kit,lights,composite,prepare(){return configureDetailSampling(renderer,scene);},
    render(time,{width=960,height=540,review='beauty',look={}}={}){
      if(disposed)throw Error('Product stage disposed');
      const next=`${width}x${height}`;if(next!==size){renderer.setSize(width,height,false);composite.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();size=next;}
      scene.overrideMaterial=review==='clay'?clay:review==='normals'?normals:null;
      composite.applyLook({...baseLook,...look});composite.setReview(review);composite.render(time);
      return renderer.domElement;
    },
    dispose(){if(disposed)return;disposed=true;composite.dispose();lights.dispose();kit.dispose();clay.dispose();normals.dispose();scene.environment=null;}
  };
}
