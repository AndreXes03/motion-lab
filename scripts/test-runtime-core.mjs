import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import * as editorial from '../src/engine/editorial.js';
import {dotSoundTelemetry} from '../src/scenes/dot-sound.js';

// Test actual runtime orchestration with explicit scene/Canvas/GPU doubles.
// These checks do not exercise WebGL or claim pixel/visual correctness.
if (!vm.SourceTextModule) {
 const child=spawnSync(process.execPath,['--experimental-vm-modules',fileURLToPath(import.meta.url)],{stdio:'inherit'});
 if(child.error)throw child.error;
 process.exit(child.status??1);
}
const source=await readFile(new URL('../src/engine/runtime.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

async function harness({fonts=Promise.resolve(),prepare=async()=>true}={}){
 const calls={frames:[],prepared:[],evaluated:[],finishes:[],hints:[],gpu:0,sizes:[],targets:[],disposed:0,contextsLost:0};
 const config={scene:'objects',width:1920,height:1080,duration:10,fps:30,palette:{ink:'#000'},text:{eyebrow:'',title:'',footer:''},animation:{reveal:[0,1]}};
 const savedLook={post:{exposure:1,grain:0}};
 const sceneRegistry=Object.fromEntries(['objects','procedural','pop','launch','starter','dot','pulse','camera','replay'].map(id=>[id,{duration:10,cuts:[0,5,10]}]));
 const isNewScene=id=>['launch','starter','dot','pulse','camera','replay'].includes(id);
 const context2d={save(){},restore(){},scale(){},drawImage(){},putImageData(){},getImageData(){return {data:[]};},translate(){},fillText(){},fillRect(){}};
 const makeCanvas=()=>({width:300,height:150,getContext:()=>context2d});
 const camera={aspect:16/9,updateProjectionMatrix(){}};
 const scene={traverse(){},traverseVisible(){}};
 const factory=id=>()=>({
  render(...args){calls.frames.push({scene:id,time:args[1],...(args[2]?.edit?{parameters:args[2]}:{})});},
  prepare:async parameters=>{calls.prepared.push(parameters);await prepare(parameters);},
  nodesAt(){return [];},config:{seed:1},dispose(){calls.disposed++;},
 });
 class WebGLRenderer {
  constructor(){calls.gpu++;this.shadowMap={};this.domElement=makeCanvas();}
  setPixelRatio(){} setSize(w,h){calls.sizes.push([w,h]);} dispose(){calls.disposed++;} forceContextLoss(){calls.contextsLost++;}
 }
 const createScene=()=>({scene,camera,update:time=>time,drawOverlay(){}});
 const modules={
  './legacy-scene.js':{canonicalScene:id=>id==='bax'?'objects':id,migrateLegacyScene:p=>({...p,scene:'objects'})},
  './preview-review.js':{createReviewMaterials:()=>({materialFor:()=>null,dispose(){calls.disposed++;}}),resolvePreviewReview:(_,mode)=>mode},
  './authored-animation.js':{getAuthoredAnimationTracks:()=>[],getAuthoredCameraChannels:()=>[],buildSampledAuthoredTracks:()=>[]},
  './animation.js':{sampleTrack:()=>0},
  './display-grade.js':{applyDisplayGrade(){}},
  './parameter-animation.js':{evaluateParameterAnimation:(p,time)=>{calls.evaluated.push(time);return p;}},
  './editorial.js':editorial,
  '../scenes/product-starter.js':{createProductStarter:factory('starter')},
  '../scenes/launch-demo.js':{createLaunchDemo:factory('launch')},
  '../scene-registry.js':{sceneConfig:id=>({...config,...sceneRegistry[id],scene:id}),sceneIds:Object.keys(sceneRegistry),isNewScene,sceneRegistry},
  '../scenes/dot-sound.js':{dotSoundTelemetry},
  '../scenes/mascot-demo.js':{createMascotDemo:factory('dot'),mascotShutterAt:()=>72},
  '../scenes/pulse-demo.js':{createDemo:factory('pulse'),shutterAngleAt:t=>{calls.hints.push(t);return 180;},temporalSamplesAt:(t,n)=>{calls.hints.push(t);return n;}},
  '../scenes/afterhours-demo.js':{createAfterhoursDemo:factory('camera'),afterhoursShutter:()=>55},
  '../scenes/replay-demo.js':{createReplayDemo:factory('replay')},
  '../scenes/pop-demo.js':{createPopDemo:factory('pop')},
  './sound-procedural.js':{sampleProceduralMotion:(_nodes,options)=>options},
  '../scenes/procedural-demo.js':{createProceduralDemo:factory('procedural'),proceduralTempo:()=>120,proceduralCuts:[0,2,10],proceduralShutter:()=>96},
  'three':{WebGLRenderer,PCFSoftShadowMap:1,ACESFilmicToneMapping:2,SRGBColorSpace:3},
  '../config.js':{config},
  '../../project/look.json':{default:savedLook},
  '../scenes/signal.js':{createScene},'../scenes/objects.js':{createScene},
  './composite.js':{createComposite:()=>({setSize(w,h){calls.targets.push([w,h]);},applyLook(){},setReview(){},render(time){calls.frames.push({scene:'objects',time});},dispose(){calls.disposed++;}})},
  './film-grain.js':{applyFilmGrain:(_ctx,time)=>calls.finishes.push(time)},'./timeline.js':{smooth:x=>x},
 };
 const context=vm.createContext({structuredClone,document:{fonts:{ready:fonts},createElement:makeCanvas}});
 const module=new vm.SourceTextModule(source,{context,identifier:'runtime.js'});
 await module.link(specifier=>{
  assert.ok(modules[specifier],`Unexpected runtime dependency: ${specifier}`);
  const exports=modules[specifier];return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context});
 });
 await module.evaluate();
 return {createRuntime:module.namespace.createRuntime,canvas:makeCanvas(),calls};
}

{
 const fontGate=deferred(),h=await harness({fonts:fontGate.promise});
 const runtime=h.createRuntime(h.canvas,{initialScene:'launch'});
 runtime.render(3,{width:480,height:270,parameters:{scene:'procedural'}});
 fontGate.resolve();await runtime.ready;
 assert.equal(runtime.config.scene,'procedural','Async startup must not replace the selected scene');
 assert.equal(h.calls.frames.length,1,'Async startup must not rewind a newer explicit frame');
 assert.equal(h.calls.frames[0].time,3);
 assert.equal(h.calls.prepared[0].scene,'launch','Initial preparation still completes');
 assert.equal(runtime.shutterAngleAt(3),runtime.shutterAngleAt(3,{scene:'procedural'}));
 assert.deepEqual(runtime.cutTimes(),runtime.cutTimes({scene:'procedural'}));
 assert.equal(runtime.sampleMotion({},30).rate,30);
 assert.equal(h.calls.gpu,0,'Procedural telemetry must not allocate WebGL');
 runtime.dispose();
}
{
 const h=await harness(),runtime=h.createRuntime(h.canvas,{initialScene:'procedural'});await runtime.ready;
 const opts=scene=>({width:480,height:270,parameters:{scene}});
 runtime.render(2,opts('objects'));runtime.render(3,opts('procedural'));runtime.render(2,opts('objects'));
 assert.deepEqual(h.calls.sizes,[[480,270]],'Same-size scene switches retain GPU buffers');
 assert.deepEqual(h.calls.targets,[[480,270]],'Same-size scene switches retain postprocess targets');
 h.canvas.width=240;h.canvas.height=135;
 runtime.render(2,opts('objects'));
 assert.equal(h.canvas.width,480);assert.equal(h.canvas.height,270,'An externally displayed cached frame cannot leave the next render at its canvas size');
 assert.deepEqual(h.calls.sizes,[[480,270]],'Restoring output size after a cache display retains GPU buffers');
 assert.deepEqual(h.calls.targets,[[480,270]],'Restoring output size after a cache display retains postprocess targets');
 runtime.render(2,{...opts('objects'),width:960,height:540});
 assert.deepEqual(h.calls.targets,[[480,270],[960,540]],'Actual size changes resize postprocess targets');
 for(const rate of [Infinity,NaN,0,-1])assert.throws(()=>runtime.sampleMotion({},rate),/rate must be finite and positive/);
 for(const rate of [1e308,10000])assert.throws(()=>runtime.sampleMotion({},rate),/100000-frame limit/);
 assert.equal(runtime.sampleMotion({scene:'procedural'},120).rate,120);
 for(const [width,height]of [[0,1],[-1,1],[1.5,1],[1,Infinity],[1,NaN]])assert.throws(()=>runtime.render(1,{width,height}),/dimensions must be positive safe integers/);
 const frameCount=h.calls.frames.length;
 runtime.dispose();const disposed=h.calls.disposed;runtime.dispose();assert.equal(h.calls.disposed,disposed,'Dispose is idempotent');
 assert.throws(()=>runtime.render(1,opts('starter')),/disposed runtime/);
 assert.throws(()=>runtime.sampleMotion(),/disposed runtime/);
 assert.throws(()=>runtime.finishFrame({},1,1,1),/disposed runtime/);
 assert.throws(()=>runtime.scene,/disposed runtime/);
 assert.throws(()=>runtime.camera,/disposed runtime/);
 await assert.rejects(runtime.prepare({scene:'launch'}),/disposed runtime/);
 assert.equal(h.calls.frames.length,frameCount);
 assert.equal(h.calls.gpu,1,'Disposal cannot resurrect a renderer');
 assert.equal(h.calls.contextsLost,1);
}
{
 const fontGate=deferred(),h=await harness({fonts:fontGate.promise});
 const runtime=h.createRuntime(h.canvas,{initialScene:'launch'});
 const rejected=assert.rejects(runtime.ready,/disposed runtime/);runtime.dispose();fontGate.resolve();await rejected;
 assert.equal(h.calls.frames.length,0);assert.equal(h.calls.prepared.length,0);
}
{
 const h=await harness(),runtime=h.createRuntime(h.canvas,{initialScene:'launch'});await runtime.ready;
 assert.deepEqual(h.calls.frames,[{scene:'launch',time:0}],'Normal startup renders its initial frame');
 const recipe={scene:'launch',commercial:{brand:{name:'Original'}}};
 const prepared=runtime.prepare(recipe);recipe.commercial.brand.name='Changed';await prepared;
 assert.equal(h.calls.prepared.at(-1).commercial.brand.name,'Original','Preparation captures the recipe before waiting');
 runtime.dispose();
 assert.throws(()=>h.createRuntime(h.canvas,{initialScene:'missing'}),/Unknown scene/);
}
{
 const h=await harness(),runtime=h.createRuntime(h.canvas,{initialScene:'procedural'});await runtime.ready;
 const parameters={scene:'procedural',edit:{version:1,clips:[{id:'later',sourceStart:6,sourceEnd:8,duration:4}]},renderSample:{frameTime:1}};
 const original=structuredClone(parameters),frame=runtime.render(1,{width:480,height:270,parameters});
 assert.equal(frame.time,1);assert.equal(frame.sourceTime,6.5);assert.equal(frame.frame,30);
 assert.equal(h.calls.frames.at(-1).time,6.5);
 assert.equal(h.calls.frames.at(-1).parameters.renderSample.frameTime,6.5,'Graphics exposure center follows source time');
 assert.deepEqual(h.calls.evaluated.slice(-2),[6.5,6.5],'Animation and finishing map exactly once');
 assert.equal(h.calls.finishes.at(-1),6.5);
 runtime.finishFrame({},1,480,270,parameters);assert.equal(h.calls.finishes.at(-1),6.5,'External temporal finishing maps once');
 assert.equal(runtime.config.duration,4);assert.deepEqual(parameters,original);
 const telemetry=runtime.sampleMotion(parameters,60);assert.equal(telemetry.duration,4);assert.equal(telemetry.sourceTimeAt(1),6.5);
 const pulse={...parameters,scene:'pulse'};runtime.shutterAngleAt(1,pulse);runtime.temporalSamplesAt(1,8,pulse);assert.deepEqual(h.calls.hints,[6.5,6.5]);
 runtime.render(1,{parameters:{scene:'procedural'}});assert.equal(runtime.config.duration,10,'Removing the edit restores authored duration');
 runtime.dispose();
}
{
 const h=await harness(),runtime=h.createRuntime(h.canvas,{initialScene:'dot'});await runtime.ready;
 const original=dotSoundTelemetry(60),identity={scene:'dot',edit:editorial.defaultEditorialEdit('dot')};
 assert.deepEqual(runtime.sampleMotion(identity),original,'Identity edit preserves authored sound exactly');
 const parameters={scene:'dot',edit:{version:1,clips:[{id:'cue',sourceStart:6,sourceEnd:8,duration:4}]}};
 const telemetry=runtime.sampleMotion(parameters),sourceCue=original.authoredEvents.find(e=>e.time===6.33),outputCue=telemetry.authoredEvents.find(e=>Math.abs(e.time-.66)<1e-9);
 assert.equal(telemetry.duration,4);assert.ok(outputCue);assert.equal(outputCue.duration,sourceCue.duration*2);
 assert.ok(telemetry.authoredEvents.every(e=>e.time>=0&&e.time<4&&e.time+e.duration<=4+1e-12));
 runtime.dispose();
}
console.log('Runtime orchestration passed: startup ordering, prepare snapshots, retained GPU allocation, active-scene sampling, argument validation and terminal disposal. Dependency-isolated checks; no WebGL/pixel validation.');
