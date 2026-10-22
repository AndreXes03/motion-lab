import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {createNativeCanvas} from '../native/canvas.mjs';
import {setSceneCanvasFactory} from '../../src/engine/scene-canvas.js';
import {evaluateParameterAnimation} from '../../src/engine/parameter-animation.js';
import {createGlossStudioScene} from '../../src/scenes/gloss-studio.js';
import {createProductStage} from '../../src/product-kit/stage.js';
import {bakeScene} from './bake-browser.js';

// This renderer records scene preparation state only. Raster calls are an error:
// Cycles receives the original geometry, authored pose and light data instead.
function createBakeState(){return {shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},setPixelRatio(){},setClearColor(){},setSize(){},dispose(){},render(){throw Error('Native bake attempted a WebGL raster render');}};}
function createBakeComposite(){return {setSize(){},applyLook(){},setReview(){},dispose(){},render(){throw Error('Native bake attempted browser postprocessing');}};}

// Project the actual authored emissive cards from the origin into linear HDR.
// This replaces the browser PMREM capture, not the authored environment scene.
function glossEnvironment(_renderer,{owned=false}={}){
 const scene=createGlossStudioScene();scene.updateMatrixWorld(true);
 const width=1024,height=512,data=new Float32Array(width*height*4),ray=new THREE.Raycaster(),direction=new THREE.Vector3(),origin=new THREE.Vector3();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const azimuth=((x+.5)/width-.5)*Math.PI*2,elevation=((y+.5)/height-.5)*Math.PI;
  direction.set(Math.cos(elevation)*Math.cos(azimuth),Math.sin(elevation),Math.cos(elevation)*Math.sin(azimuth));ray.set(origin,direction);
  const hit=ray.intersectObjects(scene.children,false)[0],color=hit?hit.object.material.color:scene.background,index=(y*width+x)*4;
  data[index]=color.r;data[index+1]=color.g;data[index+2]=color.b;data[index+3]=1;
 }
 scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);texture.mapping=THREE.EquirectangularReflectionMapping;texture.flipY=false;texture.needsUpdate=true;
 return owned?{texture,dispose:()=>texture.dispose()}:texture;
}
let preparing=false;
export async function bakeNativeScene(options,{directory,saveBake,reportBake=async()=>{}}={}){
 if(!['pulse','loop'].includes(options.scene))throw Error('Native Cycles preparation supports PULSE and LOOP only');
 if(!saveBake&&!directory)throw Error('Native bake requires an output directory or saveBake callback');
 const save=saveBake??(async(relative,contents)=>{const output=path.resolve(directory,relative);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,contents);});
 if(preparing)throw Error('Native scene preparation is already running in this process');
 preparing=true;const restore=setSceneCanvasFactory(createNativeCanvas);
 try{
  const sceneModule=await import(options.scene==='loop'?'../../src/scenes/loop-launch.js':'../../src/scenes/pulse-demo.js');
  const worldOptions={rendererFactory:createBakeState,compositeFactory:createBakeComposite,environmentFactory:texture=>texture,glossEnvironmentFactory:glossEnvironment,stageFactory:(renderer,configuration)=>createProductStage(renderer,{...configuration,environmentFactory:glossEnvironment,compositeFactory:createBakeComposite})};
  return await bakeScene({...options,runtime:{THREE,sceneModule,evaluateParameterAnimation,worldOptions,createCanvas:createNativeCanvas,saveBake:save,reportBake,report:{preparation:'node-native',canvasBackend:'skia-canvas-cpu',browserUsed:false,environmentAdaptation:'Authored equirectangular canvases and CPU projection of original gloss cards; no GPU PMREM filtering/roundtrip. Cycles evaluates roughness.',visualParity:'unverified',hemisphereLights:'Excluded, matching existing Cycles adapter'}}});
 }finally{restore();preparing=false;}
}
