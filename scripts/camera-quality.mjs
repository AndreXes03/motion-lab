#!/usr/bin/env node
import {browserLaunchOptions} from './browser-runtime.mjs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(ROOT,'renders/camera-quality.json');
let server,browser;
try{
 server=await createServer({root:ROOT,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 browser=await chromium.launch({...await browserLaunchOptions(),headless:true,args:['--disable-gpu-sandbox']});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?render=1`);await page.waitForFunction(()=>window.motion?.ready);await page.evaluate(()=>window.motion.ready);
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {createScene}=await import('/src/scenes/objects.js'),{config}=await import('/src/config.js');
  const look=await fetch('/project/look.json').then(r=>r.json()),motion=await fetch('/project/motion.json').then(r=>r.json());
  const renderer=new T.WebGLRenderer({antialias:false});const app=createScene(renderer,config);
  const roots=['device.root','objects.emblem','objects.kinetic'];const meshes=[];
  roots.forEach(name=>app.scene.getObjectByName(name).traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();meshes.push(o);}}));
  const triangle=new T.Triangle(),nearest=new T.Vector3(),local=new T.Vector3(),inverse=new T.Matrix4(),worldBox=new T.Box3(),point=new T.Vector3(),ray=new T.Raycaster();
  const samples=[],risks=[];let min={distance:Infinity};
  for(let frame=0;frame<=1200;frame++){
   const time=frame/120;app.update(time,{look,motion});app.scene.updateMatrixWorld(true);app.camera.updateMatrixWorld(true);
   const camera=app.camera.position.clone(),candidates=[];let distance=Infinity,meshName=null,inside=[];
   for(const mesh of meshes){
    if(!mesh.visible)continue;worldBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    const bound=worldBox.distanceToPoint(camera);if(bound>.4)continue;candidates.push(mesh);
    inverse.copy(mesh.matrixWorld).invert();local.copy(camera).applyMatrix4(inverse);
    const position=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?index.count:position.count;
    const read=(v,i)=>v.fromBufferAttribute(position,index?index.getX(i):i);
    let meshDistance=Infinity;
    for(let i=0;i<count;i+=3){read(triangle.a,i);read(triangle.b,i+1);read(triangle.c,i+2);triangle.closestPointToPoint(local,nearest);point.copy(nearest).applyMatrix4(mesh.matrixWorld);meshDistance=Math.min(meshDistance,point.distanceTo(camera));}
    if(meshDistance<distance){distance=meshDistance;meshName=mesh.name;}
    if(worldBox.containsPoint(camera)){
     const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material],sides=mats.map(m=>m.side);mats.forEach(m=>m.side=T.DoubleSide);
     ray.set(camera,new T.Vector3(.8321,.2719,.4831).normalize());ray.near=.00001;ray.far=100;
     const hits=ray.intersectObject(mesh,false);mats.forEach((m,i)=>m.side=sides[i]);
     const unique=hits.filter((h,i)=>i===0||Math.abs(h.distance-hits[i-1].distance)>1e-5);
     if(unique.length%2===1)inside.push(mesh.name);
    }
   }
   let nearHit=null;
   // Dense screen-grid rays detect surfaces within the actual camera near clip depth.
   for(const x of [-1,-.5,0,.5,1])for(const y of [-1,-.5,0,.5,1]){
    ray.setFromCamera(new T.Vector2(x,y),app.camera);ray.near=.00001;
    const forward=app.camera.getWorldDirection(new T.Vector3());ray.far=app.camera.near/ray.ray.direction.dot(forward);
    const hits=ray.intersectObjects(candidates,false);if(hits.length&&(!nearHit||hits[0].distance<nearHit.distance))nearHit={mesh:hits[0].object.name,distance:hits[0].distance,ndc:[x,y]};
   }
   if(distance<min.distance)min={distance,time,mesh:meshName,camera:camera.toArray()};
   const sample={time,clearance:distance===Infinity?null:distance,mesh:meshName,inside,nearHit};
   if(inside.length||nearHit)risks.push(sample);
   if(frame%12===0||inside.length||nearHit)samples.push(sample);
  }
  const intervals=[];for(const risk of risks){let last=intervals.at(-1);if(!last||risk.time-last.end>1/120+.000001){last={start:risk.time,end:risk.time,meshes:[],inside:false,nearClip:false};intervals.push(last);}last.end=risk.time;for(const name of [...risk.inside,...(risk.nearHit?[risk.nearHit.mesh]:[])])if(!last.meshes.includes(name))last.meshes.push(name);last.inside ||= risk.inside.length>0;last.nearClip ||= !!risk.nearHit;}
  renderer.dispose();return {rateHz:120,duration:10,sampleCount:1201,meshCount:meshes.length,method:'Exact point-to-triangle clearance when world bounding-box lower bound <0.4; double-sided odd intersection parity for containment; 25 view rays to near clip plane. Bounding boxes are never treated as solids, so holes remain clear.',limits:'Nearest distance omitted when all mesh bbox bounds exceed 0.4. Near clip sampled on 5x5 screen grid, not continuous plane. Odd parity applies per closed mesh; open decorative meshes could be ambiguous.',minimumClearance:min,riskIntervals:intervals,riskSampleCount:risks.length,samples};
 });
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({type:'complete',path:output,minimum:report.minimumClearance,intervals:report.riskIntervals,riskSamples:report.riskSampleCount}));
}catch(error){console.log(JSON.stringify({type:'error',message:error.message}));process.exitCode=1;}finally{await browser?.close();await server?.close();}
