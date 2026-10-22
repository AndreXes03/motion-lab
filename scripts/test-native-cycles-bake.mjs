import assert from 'node:assert/strict';
import {bakeNativeScene} from './cycles/bake-native.mjs';

// Preparation only: no runtime download, browser, Cycles render or media export.
assert.equal(typeof globalThis.document,'undefined');
assert.equal(typeof globalThis.window,'undefined');
for(const [scene,time,duration] of [['pulse',.5,13.9],['loop',8,24]]){
 const snapshots=[];let sceneData;
 const report=await bakeNativeScene({scene,command:'frame',time,width:64,height:36,fps:30,count:1,duration,parameters:{}},{saveBake:async(name,contents)=>{
  if(name.startsWith('baked/'))snapshots.push(JSON.parse(contents));
  if(name==='scene.json')sceneData=JSON.parse(contents);
 }});
 assert.equal(report.browserUsed,false);assert.equal(report.canvasBackend,'skia-canvas-cpu');
 assert.equal(report.visualParity,'unverified');assert.equal(snapshots.length,3);
 assert.ok(report.geometries>0);assert.ok(report.meshes>0);
 for(const snapshot of snapshots){
  assert.ok(snapshot.visible.length>0);assert.equal(snapshot.camera.matrix.length,16);
  assert.ok(snapshot.background.startsWith('data:image/png;base64,'));
  if(scene==='loop')assert.ok(snapshot.overlay.startsWith('data:image/png;base64,'));
 }
 assert.equal(snapshots[1].time,time);
 assert.ok(sceneData.textures.length>0);assert.equal(sceneData.options.runtime,undefined);
 assert.ok(sceneData.textures.some(texture=>texture.float),'Authored studio environment must retain linear HDR card powers');
 console.log(`${scene}: 3 native snapshots, ${report.geometries} geometries, ${report.meshes} mesh entries`);
}
await assert.rejects(()=>bakeNativeScene({scene:'unsupported'}),/supports PULSE and LOOP only/);
