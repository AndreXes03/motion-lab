import {getAuthoredAnimationTracks,getAuthoredCameraChannels,buildSampledAuthoredTracks} from './authored-animation.js';
import {sampleTrack} from './animation.js';
import {applyDisplayGrade} from './display-grade.js';
import {evaluateParameterAnimation} from './parameter-animation.js';
import {createProductStarter} from '../scenes/product-starter.js';
import {sceneConfig,sceneIds,isNewScene,sceneRegistry} from '../scene-registry.js';
import {dotSoundTelemetry} from '../scenes/dot-sound.js';
import {createMascotDemo,mascotShutterAt} from '../scenes/mascot-demo.js';
import {createDemo as createPulseDemo,shutterAngleAt as pulseShutterAt,temporalSamplesAt as pulseTemporalSamplesAt} from '../scenes/pulse-demo.js';
import {createAfterhoursDemo,afterhoursShutter} from '../scenes/afterhours-demo.js';
import {createReplayDemo} from '../scenes/replay-demo.js';
import {createPopDemo} from '../scenes/pop-demo.js';
import {sampleProceduralMotion} from './sound-procedural.js';
import {createProceduralDemo,proceduralTempo,proceduralCuts,proceduralShutter} from '../scenes/procedural-demo.js';
import * as T from 'three';
import {config} from '../config.js';
import savedLook from '../../project/look.json';
import {createScene as createSignal} from '../scenes/signal.js';
import {createScene as createBax} from '../scenes/bax.js';
import {createComposite} from './composite.js';
import {applyFilmGrain} from './film-grain.js';
import {smooth} from './timeline.js';
export function createRuntime(canvas,{initialScene="bax"}={}){
 let activeScene=initialScene;const studies={};const studyFactories={starter:createProductStarter,dot:createMascotDemo,pulse:createPulseDemo,camera:createAfterhoursDemo,replay:createReplayDemo};
 const graphics=createProceduralDemo(config); let pop;
 let renderer,scene,camera,update,drawOverlay,composite,proceduralCanvas,proceduralContext;
 let look=structuredClone(savedLook);const ctx=canvas.getContext('2d',{willReadFrequently:true});let width=0,height=0;const diagnosticHidden=[];const clay=new T.MeshStandardMaterial({color:'#a4a6ab',roughness:.65});const normals=new T.MeshNormalMaterial();
 function init3d(){if(renderer)return;renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;const createScene=config.scene==='bax'?createBax:createSignal;({scene,camera,update,drawOverlay}=createScene(renderer,config));composite=createComposite(renderer,scene,camera,{...config,look:savedLook.post});}
 function finishFrame(targetCtx,time,w,h,parameters={}){parameters=evaluateParameterAnimation({...parameters,scene:parameters.scene??activeScene},time);const id=parameters.scene??activeScene;if(!parameters.review||parameters.review==='beauty')applyDisplayGrade(targetCtx,w,h,parameters.look?.post);if(id==='camera'){const study=studies.camera??=studyFactories.camera();study.finishFrame?.(targetCtx,time,w,h,parameters);return;}if(isNewScene(id)&&id!=='replay')return;const activeLook=parameters.look||look;if(parameters.review&&parameters.review!=='beauty')return;applyFilmGrain(targetCtx,time,w,h,{amount:id==='replay'?.018:activeLook.post.grain??0,size:id==='replay'?1.1:activeLook.post.grainSize??1.1,fps:parameters.renderSample?.fps??config.fps});}
 function render(time,{width:w=config.width,height:h=config.height,parameters={},previewQuality='full'}={}){
 if(!Number.isFinite(time))throw new Error('Render time must be finite');
 if(parameters.scene && !sceneIds.includes(parameters.scene))throw new Error('Unknown scene: '+parameters.scene);
 activeScene=parameters.scene??activeScene;parameters=evaluateParameterAnimation({...parameters,scene:activeScene},time);if(previewQuality==='fast'){parameters=structuredClone(parameters);parameters.previewQuality='fast';if(parameters.look?.post)Object.assign(parameters.look.post,{dofEnabled:false,bloomStrength:0,bloomEnabled:false,aoIntensity:0,antialias:false});if(parameters.sceneControls)Object.assign(parameters.sceneControls,{focusBlur:0,bloomStrength:0});}
 if(isNewScene(activeScene)){const cfg=sceneConfig(activeScene),t=Math.max(0,Math.min(cfg.duration,time));const study=studies[activeScene]??=studyFactories[activeScene]();if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}if(activeScene==='pulse')study.render(ctx,t,w,h,parameters);else study.render(ctx,t,parameters,w,h);if(parameters.renderSample?.grain!==false)finishFrame(ctx,t,w,h,parameters);width=0;height=0;return{scene:activeScene,time:t,frame:Math.min(cfg.duration*cfg.fps-1,Math.floor(t*cfg.fps)),width:w,height:h};}
 if(parameters.scene==='pop'){pop??=createPopDemo();if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const t=Math.max(0,Math.min(config.duration,time));pop.render(ctx,t,parameters,w,h);width=0;height=0;if(parameters.renderSample?.grain!==false)finishFrame(ctx,t,w,h,parameters);return {scene:'pop',time:t,frame:Math.min(config.duration*config.fps-1,Math.floor(t*config.fps)),width:w,height:h};}
 if(parameters.scene==='procedural'){const t=Math.max(0,Math.min(config.duration,time));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}// Keep procedural rasterization separate: WebGL draws change Chrome's 2D raster backend.
 proceduralCanvas??=document.createElement('canvas');proceduralContext??=proceduralCanvas.getContext('2d',{willReadFrequently:true});
 if(proceduralCanvas.width!==w||proceduralCanvas.height!==h){proceduralCanvas.width=w;proceduralCanvas.height=h;}
 proceduralContext.save();proceduralContext.scale(w/config.width,h/config.height);try{graphics.render(proceduralContext,t,parameters);}finally{proceduralContext.restore();}
 ctx.putImageData(proceduralContext.getImageData(0,0,w,h),0,0);width=0;height=0;if(parameters.renderSample?.grain!==false)finishFrame(ctx,t,w,h,parameters);return {scene:'procedural',time:t,frame:Math.min(config.duration*config.fps-1,Math.floor(t*config.fps)),width:w,height:h};}
 init3d();
 if(width!==w||height!==h){width=w;height=h;canvas.width=w;canvas.height=h;renderer.setSize(w,h,false);composite.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}
 for(const o of diagnosticHidden)o.visible=true;diagnosticHidden.length=0;
 const activeLook=parameters.look||look;renderer.toneMappingExposure=activeLook.post.exposure;composite.applyLook(activeLook.post);const t=update(time,{...parameters,look:activeLook});if(['clay','normals'].includes(parameters.review))scene.traverseVisible(o=>{if(o.isMesh&&o.material?.transparent){diagnosticHidden.push(o);o.visible=false}});scene.overrideMaterial=parameters.review==='clay'?clay:parameters.review==='normals'?normals:null;composite.setReview(parameters.review);composite.render(t);ctx.drawImage(renderer.domElement,0,0,w,h);ctx.save();ctx.scale(w/1920,h/1080);
 if(drawOverlay){drawOverlay(ctx,t);}else{
 ctx.fillStyle=config.palette.ink;ctx.font='600 18px Arial';ctx.fillText(config.text.eyebrow,88,80);ctx.textAlign='right';ctx.fillText('DESIGNED TO BE PLAYED.',1832,80);ctx.textAlign='left';
 const a=smooth((t-config.animation.reveal[0])/(config.animation.reveal[1]-config.animation.reveal[0]));ctx.globalAlpha=a;ctx.save();ctx.translate(0,25*(1-a));ctx.font='900 150px Arial';config.text.title.split('\n').forEach((line,i)=>ctx.fillText(line,80,426+i*140));ctx.font='500 21px Arial';ctx.fillText(config.text.footer,88,632);ctx.fillStyle='#ff570c';ctx.fillRect(88,674,64,6);ctx.restore();
 ctx.globalAlpha=1;ctx.fillStyle=config.palette.ink;ctx.font='500 15px Arial';ctx.fillText('01 — SOUND, IN YOUR HANDS.',88,1005);ctx.textAlign='right';ctx.fillText('FORM STUDY  /  2026',1832,1005);}
 ctx.restore();if(parameters.renderSample?.grain!==false)finishFrame(ctx,t,w,h,parameters);return {time:t,frame:Math.min(config.duration*config.fps-1,Math.floor(t*config.fps)),width:w,height:h};
 }
 function sampleAuthoredAnimation(parameters,groupId,{start=0,end=sceneConfig(parameters.scene??activeScene).duration,count=25,restoreTime=0,previewQuality='full'}={}){
  const id=parameters.scene??activeScene,original=structuredClone(parameters),baseline=structuredClone(parameters),oldSize={width:canvas.width,height:canvas.height};
  delete baseline.animation;delete baseline.inspect;delete baseline.review;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>sceneConfig(id).duration||!Number.isInteger(count)||count<2||count>100)throw new Error('Invalid authored motion inspection window');
  const native=getAuthoredAnimationTracks(id,groupId,{motion:baseline.motion}),frames=[];let channels=[];
  try{
   for(let i=0;i<count;i++){
    const timelineTime=start+(end-start)*i/(count-1),t=i===count-1&&end<sceneConfig(id).duration?Math.max(start,end-1e-7):timelineTime,values={};let data;
    if(id==='bax'){
     channels=native.map(({id,label,unit})=>({id,label,unit}));
     for(const track of native){
      values[track.id]=sampleTrack(track.keys,t,groupId==='camera'?(baseline.look?.motion?.amount??1):(baseline.objectMotion??baseline.look?.motion?.amount??1));
     }
    }else{
     const factory=id==='procedural'?graphics:id==='pop'?(pop??=createPopDemo()):(studies[id]??=studyFactories[id]());
     if(factory.animationState&&factory.animationChannels){data={values:factory.animationState(groupId,t,baseline),channels:factory.animationChannels(groupId)};}
     if(!data?.channels?.length){
      render(t,{width:64,height:36,previewQuality:'fast',parameters:{...baseline,review:'clean',renderSample:{grain:false}}});
      if(groupId==='camera'&&factory.camera){const actual=factory.camera;channels=getAuthoredCameraChannels();for(const [index,axis]of ['x','y','z'].entries()){values['camera.position.'+axis]=actual.position.getComponent(index);values['camera.rotation.'+axis]=actual.rotation[axis];}values['camera.fov']=actual.fov;}
      else data=factory.captureAuthoredAnimation?.(groupId);
     }
     if(data?.channels?.length){channels=data.channels;Object.assign(values,data.values);}
    }
    if(!channels.length)return native;
    frames.push({t:timelineTime,values});
   }
   const sampled=buildSampledAuthoredTracks(id,groupId,frames,channels);
   return [...native.map(track=>({...track,...(sampled.find(s=>s.id===track.id)?{samples:sampled.find(s=>s.id===track.id).keys}:{})})),...sampled.filter(track=>!native.some(n=>n.id===track.id))];
  }finally{
   render(restoreTime,{...oldSize,previewQuality,parameters:original});
  }
 }
 function sampleMotion(parameters={},rate=60){
  const id=parameters.scene??activeScene;if(isNewScene(id)){const cfg=sceneConfig(id);if(id==='dot')return dotSoundTelemetry(rate);if(id==='replay'){const study=studies[id]??=studyFactories[id]();return{...sampleProceduralMotion(t=>study.nodesAt(t,evaluateParameterAnimation({...parameters,scene:id},t)),{duration:cfg.duration,rate,width:1920,height:1080,seed:16}),musicBpm:120};}const frames=Array.from({length:Math.ceil(cfg.duration*rate)+1},(_,i)=>({time:Math.min(cfg.duration,i/rate),camera:{position:[0,0,0],quaternion:[0,0,0,1]},objects:{}}));return{duration:cfg.duration,rate,frames,cuts:sceneRegistry[id].cuts};}

  if(parameters.scene==='pop'){pop??=createPopDemo();return {...sampleProceduralMotion(t=>pop.nodesAt(t,evaluateParameterAnimation(parameters,t)),{duration:config.duration,rate,width:1920,height:1080,seed:42}),musicBpm:120};}
  if(parameters.scene==='procedural')return {...sampleProceduralMotion(t=>graphics.nodesAt(t,evaluateParameterAnimation(parameters,t)),{duration:config.duration,rate,width:1920,height:1080,seed:graphics.config.seed}),musicBpm:proceduralTempo(parameters)};
  init3d();const previousAspect=camera.aspect;const frames=[],v=new T.Vector3(),q=new T.Quaternion();
  const names=['device.root','dial.rotor','bax.kinetic','bax.gyro.outer-gimbal-pivot','bax.gyro.inner-gimbal-pivot','bax.gyro.rotor','bax.emblem','bax.cover.hinge'];
  const profiles={'dial.rotor':'dial','bax.cover.hinge':'hinge','bax.gyro.rotor':'rotor','bax.gyro.outer-gimbal-pivot':'bearing','bax.gyro.inner-gimbal-pivot':'bearing'};
  // Discover authored tracks and optional sound tags for future scene elements too.
  for(const key of Object.keys(parameters.motion?.tracks||{}))if(!key.startsWith('camera.'))names.push(key.replace(/\.(position|rotation)(\.[xyz])?$/,''));
  scene.traverse(o=>{if(o.userData.sound)names.push(o.name);});
  const targets=[...new Set(names)].map(name=>scene.getObjectByName(name)).filter(Boolean);
  for(let i=0;i<=Math.ceil(config.duration*rate);i++){
   const t=Math.min(config.duration,i/rate);camera.aspect=16/9;
   const sampled=evaluateParameterAnimation({...parameters,scene:id},t);update(t,{...sampled,look:sampled.look||look});scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
   const objects={};for(const object of targets){object.getWorldPosition(v);const position=v.toArray();const distance=v.distanceTo(camera.position);v.project(camera);object.getWorldQuaternion(q);
    const visibility=v.z< -1||v.z>1?0:Math.max(0,1-Math.max(0,Math.abs(v.x)-.75)*1.6)*Math.max(0,1-Math.max(0,Math.abs(v.y)-.8)*1.6)/(1+distance*.13);
    objects[object.name]={position,quaternion:q.toArray(),localPosition:object.position.toArray(),localQuaternion:object.quaternion.toArray(),localRotation:object.rotation.toArray().slice(0,3),soundProfile:object.userData.sound?.profile||profiles[object.name]||'generic',pan:Math.max(-.9,Math.min(.9,v.x*.75)),visibility};
   }
   frames.push({time:t,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},objects});
  }
  camera.aspect=previousAspect;camera.updateProjectionMatrix();return {duration:config.duration,rate,frames,cuts:parameters.motion?.cuts||[]};
 }
 function pickObject(x,y){if(!scene||!camera)return null;const ray=new T.Raycaster();scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);ray.setFromCamera(new T.Vector2(x*2-1,1-y*2),camera);for(const hit of ray.intersectObjects(scene.children,true)){let object=hit.object;if(!object.visible)continue;while(object){if(['device.root','bax.emblem','bax.kinetic'].includes(object.name))return object.name;if(!object.visible)break;object=object.parent;}}return null;}
 let disposed=false;
 function dispose(){
  if(disposed)return;disposed=true;
  const seen=new Set(),release=resource=>{if(resource?.dispose&&!seen.has(resource)){seen.add(resource);resource.dispose();}};
  const releaseScene=root=>{root?.traverse(object=>{release(object.geometry);for(const material of [object.material].flat().filter(Boolean)){for(const value of Object.values(material))if(value?.isTexture)release(value);release(material);}});release(root?.environment);release(root?.background);};
  for(const study of Object.values(studies)){releaseScene(study.scene);study.dispose?.();study.renderer?.forceContextLoss();}
  pop?.dispose?.();releaseScene(scene);composite?.dispose();release(clay);release(normals);renderer?.dispose();renderer?.forceContextLoss();
  if(proceduralCanvas){proceduralCanvas.width=1;proceduralCanvas.height=1;}canvas.width=1;canvas.height=1;
 }
 const ready=document.fonts.ready.then(()=>{render(0,{parameters:{scene:initialScene}});return true});return {get config(){return sceneConfig(activeScene)},ready,render,dispose,pickObject,finishFrame,sampleMotion,sampleAuthoredAnimation,temporalSamplesAt:(time,samples,parameters={})=>(parameters.scene??activeScene)==='pulse'?pulseTemporalSamplesAt(time,samples):samples,shutterAngleAt:(time,parameters={})=>isNewScene(parameters.scene??activeScene)?((parameters.scene??activeScene)==='pulse'?pulseShutterAt(time):(parameters.scene??activeScene)==='camera'?afterhoursShutter(time):(parameters.scene??activeScene)==='dot'?mascotShutterAt(time):(parameters.scene??activeScene)==='starter'?270:0):parameters.scene==='procedural'?proceduralShutter(time,parameters.look?.post?.shutterAngle??210):parameters.look?.post?.shutterAngle??210,cutTimes:(parameters={})=>isNewScene(parameters.scene??activeScene)?sceneRegistry[parameters.scene??activeScene].cuts:parameters.scene==='procedural'?proceduralCuts:parameters.motion?.cuts??[],get scene(){init3d();return scene},get camera(){init3d();return camera},setLook(next){look=structuredClone(next)},getLook(){return structuredClone(look)}};
}
