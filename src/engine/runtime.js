import {sampleProceduralMotion} from './sound-procedural.js';
import {createProceduralDemo} from '../scenes/procedural-demo.js';
import * as T from 'three';
import {config} from '../config.js';
import savedLook from '../../project/look.json';
import {createScene as createSignal} from '../scenes/signal.js';
import {createScene as createBax} from '../scenes/bax.js';
import {createComposite} from './composite.js';
import {applyFilmGrain} from './film-grain.js';
import {smooth} from './timeline.js';
export function createRuntime(canvas,{initialScene="bax"}={}){
 const graphics=createProceduralDemo(config);
 let renderer,scene,camera,update,drawOverlay,composite;
 let look=structuredClone(savedLook);const ctx=canvas.getContext('2d',{willReadFrequently:true});let width=0,height=0;const diagnosticHidden=[];const clay=new T.MeshStandardMaterial({color:'#a4a6ab',roughness:.65});const normals=new T.MeshNormalMaterial();
 function init3d(){if(renderer)return;renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;const createScene=config.scene==='bax'?createBax:createSignal;({scene,camera,update,drawOverlay}=createScene(renderer,config));composite=createComposite(renderer,scene,camera,{...config,look:savedLook.post});}
 function finishFrame(targetCtx,time,w,h,parameters={}){const activeLook=parameters.look||look;if(parameters.review&&parameters.review!=='beauty')return;applyFilmGrain(targetCtx,time,w,h,{amount:activeLook.post.grain??0,size:activeLook.post.grainSize??1.1,fps:parameters.renderSample?.fps??config.fps});}
 function render(time,{width:w=config.width,height:h=config.height,parameters={}}={}){
 if(!Number.isFinite(time))throw new Error('Render time must be finite');
 if(parameters.scene && !['bax','procedural'].includes(parameters.scene))throw new Error('Unknown scene: '+parameters.scene);
 if(parameters.scene==='procedural'){const t=Math.max(0,Math.min(config.duration,time));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}ctx.save();ctx.scale(w/config.width,h/config.height);try{graphics.render(ctx,t,parameters);}finally{ctx.restore();}width=0;height=0;if(parameters.renderSample?.grain!==false)finishFrame(ctx,t,w,h,parameters);return {scene:'procedural',time:t,frame:Math.min(config.duration*config.fps-1,Math.floor(t*config.fps)),width:w,height:h};}
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
 function sampleMotion(parameters={},rate=60){
  if(parameters.scene==='procedural')return sampleProceduralMotion(t=>graphics.nodesAt(t,parameters),{duration:config.duration,rate,width:1920,height:1080,seed:graphics.config.seed});
  init3d();const previousAspect=camera.aspect;const frames=[],v=new T.Vector3(),q=new T.Quaternion();
  const names=['device.root','dial.rotor','bax.kinetic','bax.gyro.outer-gimbal-pivot','bax.gyro.inner-gimbal-pivot','bax.gyro.rotor','bax.emblem','bax.cover.hinge'];
  const profiles={'dial.rotor':'dial','bax.cover.hinge':'hinge','bax.gyro.rotor':'rotor','bax.gyro.outer-gimbal-pivot':'bearing','bax.gyro.inner-gimbal-pivot':'bearing'};
  // Discover authored tracks and optional sound tags for future scene elements too.
  for(const key of Object.keys(parameters.motion?.tracks||{}))if(!key.startsWith('camera.'))names.push(key.replace(/\.(position|rotation)(\.[xyz])?$/,''));
  scene.traverse(o=>{if(o.userData.sound)names.push(o.name);});
  const targets=[...new Set(names)].map(name=>scene.getObjectByName(name)).filter(Boolean);
  for(let i=0;i<=Math.ceil(config.duration*rate);i++){
   const t=Math.min(config.duration,i/rate);camera.aspect=16/9;
   update(t,{...parameters,look:parameters.look||look});scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
   const objects={};for(const object of targets){object.getWorldPosition(v);const position=v.toArray();const distance=v.distanceTo(camera.position);v.project(camera);object.getWorldQuaternion(q);
    const visibility=v.z< -1||v.z>1?0:Math.max(0,1-Math.max(0,Math.abs(v.x)-.75)*1.6)*Math.max(0,1-Math.max(0,Math.abs(v.y)-.8)*1.6)/(1+distance*.13);
    objects[object.name]={position,quaternion:q.toArray(),localPosition:object.position.toArray(),localQuaternion:object.quaternion.toArray(),localRotation:object.rotation.toArray().slice(0,3),soundProfile:object.userData.sound?.profile||profiles[object.name]||'generic',pan:Math.max(-.9,Math.min(.9,v.x*.75)),visibility};
   }
   frames.push({time:t,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},objects});
  }
  camera.aspect=previousAspect;camera.updateProjectionMatrix();return {duration:config.duration,rate,frames,cuts:parameters.motion?.cuts||[]};
 }
 const ready=document.fonts.ready.then(()=>{render(0,{parameters:{scene:initialScene}});return true});return {config,ready,render,finishFrame,sampleMotion,get scene(){init3d();return scene},get camera(){init3d();return camera},setLook(next){look=structuredClone(next)},getLook(){return structuredClone(look)}};
}
