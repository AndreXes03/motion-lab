import * as T from 'three';
import {createProductStage,createRotaryControl,createOpticalCell,createHousingPanel,createImpactMotion,createProductCameraMove} from '../product-kit/index.js';

// Copy this scene for a new product. Shared kit changes belong in src/product-kit.
export function createProductStarter(){
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);
  const stage=createProductStage(renderer,{colors:{satinPlastic:'#d7f56b',mattePlastic:'#d2d3c8'},look:{dofStrength:.055,dofMaxBlur:5}});
  const {materials}=stage.kit,assembly=new T.Group();stage.scene.add(assembly);
  const panel=createHousingPanel(materials,{holes:[{x:-.55,y:0,radius:.63}]});
  const optic=createOpticalCell(materials,{radius:.68,depth:.65});optic.root.position.set(-.55,0,.2);
  const dial=createRotaryControl(materials);dial.root.position.set(.94,.36,.2);
  const dial2=createRotaryControl(materials,{radius:.22,depth:.25});dial2.root.position.set(.94,-.38,.2);
  const parts=[panel,optic,dial,dial2];parts.forEach(p=>assembly.add(p.root));
  const impact=createImpactMotion({start:0,hit:1.4,end:1.85,travel:.75,recoil:.065});
  const move=createProductCameraMove({points:[[-2.7,1.1,3.2],[-.8,.45,3.25],[1.8,.7,3.4]],target:[0,0,.3],duration:6,fov:65,bank:.06});
  stage.prepare();
  return {scene:stage.scene,camera:stage.camera,renderer,
    render(ctx,time,parameters={},width=1920,height=1080){
      const p=parameters.product??{};
      materials.satinPlastic.color.set(p.accent??'#d7f56b');materials.mattePlastic.color.set(p.shell??'#d2d3c8');
      stage.lights.key.intensity=12*(p.keyStrength??1);stage.lights.fill.intensity=p.fill??.10;
      assembly.rotation.set(.05*Math.sin(time*.65),.12*Math.sin(time*.7),-.055);
      optic.root.position.z=.2+impact(time);dial.root.rotation.z=-.25+time*.45;dial2.root.rotation.z=.3-time*.32;
      move.apply(stage.camera,time);stage.camera.fov=p.fov??65;stage.camera.updateProjectionMatrix();
      stage.camera.updateMatrixWorld(true);const focus=-new T.Vector3(-.55,0,.55).applyMatrix4(stage.camera.matrixWorldInverse).z;
      const canvas=stage.render(time,{width,height,review:parameters.review,look:{fisheye:p.fisheye??.08,dofFocus:focus}});ctx.drawImage(canvas,0,0,width,height);
    },dispose(){parts.forEach(p=>p.dispose());stage.dispose();renderer.dispose();}
  };
}
