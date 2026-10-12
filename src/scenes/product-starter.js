import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
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
  const cameraChannels=[
    ...['x','y','z'].map(axis=>({id:`camera.position.${axis}`,label:`Camera position ${axis.toUpperCase()}`,unit:'scene units'})),
    ...['x','y','z'].map(axis=>({id:`camera.rotation.${axis}`,label:`Camera rotation ${axis.toUpperCase()}`,unit:'rad'})),
    {id:'camera.fov',label:'Camera field of view',unit:'deg'}
  ];
  const productChannels=[
    ...['x','y','z'].map(axis=>({id:`product.rotation.${axis}`,label:`Assembly rotation ${axis.toUpperCase()}`,unit:'rad'})),
    {id:'product.optic.position.z',label:'Optic travel',unit:'scene units'},
    {id:'product.dial.rotation.z',label:'Main dial rotation',unit:'rad'},
    {id:'product.secondaryDial.rotation.z',label:'Secondary dial rotation',unit:'rad'}
  ];
  stage.prepare();
  return {scene:stage.scene,camera:stage.camera,renderer,
    render(ctx,time,parameters={},width=1920,height=1080){
      const p=parameters.product??{},productTime=sampleAnimationGroupTime(parameters,'product',time),cameraTime=sampleAnimationGroupTime(parameters,'camera',time);
      materials.satinPlastic.color.set(p.accent??'#d7f56b');materials.mattePlastic.color.set(p.shell??'#d2d3c8');
      stage.lights.key.intensity=12*(p.keyStrength??1);stage.lights.fill.intensity=p.fill??.10;
      assembly.rotation.set(.05*Math.sin(productTime*.65),.12*Math.sin(productTime*.7),-.055);
      optic.root.position.z=.2+impact(productTime);dial.root.rotation.z=-.25+productTime*.45;dial2.root.rotation.z=.3-productTime*.32;
      move.apply(stage.camera,cameraTime);stage.camera.fov=p.fov??65;stage.camera.updateProjectionMatrix();
      stage.camera.updateMatrixWorld(true);const focus=-new T.Vector3(-.55,0,.55).applyMatrix4(stage.camera.matrixWorldInverse).z;
      const canvas=stage.render(time,{width,height,review:parameters.review,look:{fisheye:p.fisheye??.08,dofFocus:focus,...(parameters.previewQuality==='fast'?{dofEnabled:false,aoIntensity:0,bloomStrength:0,bloomEnabled:false,antialias:false}:{})}});ctx.drawImage(canvas,0,0,width,height);
    },animationChannels(groupId){return(groupId==='camera'?cameraChannels:groupId==='product'?productChannels:[]).map(channel=>({...channel}));},captureAuthoredAnimation(groupId){
      if(groupId==='camera')return{channels:cameraChannels.map(channel=>({...channel})),values:{'camera.position.x':stage.camera.position.x,'camera.position.y':stage.camera.position.y,'camera.position.z':stage.camera.position.z,'camera.rotation.x':stage.camera.rotation.x,'camera.rotation.y':stage.camera.rotation.y,'camera.rotation.z':stage.camera.rotation.z,'camera.fov':stage.camera.fov}};
      if(groupId==='product')return{channels:productChannels.map(channel=>({...channel})),values:{'product.rotation.x':assembly.rotation.x,'product.rotation.y':assembly.rotation.y,'product.rotation.z':assembly.rotation.z,'product.optic.position.z':optic.root.position.z,'product.dial.rotation.z':dial.root.rotation.z,'product.secondaryDial.rotation.z':dial2.root.rotation.z}};
      return{channels:[],values:{}};
    },actualState(groupId){return this.captureAuthoredAnimation(groupId);},dispose(){parts.forEach(p=>p.dispose());stage.dispose();renderer.dispose();}
  };
}
