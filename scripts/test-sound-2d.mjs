import assert from 'node:assert/strict';
import {sampleProceduralMotion,sampleGraph} from '../src/engine/sound-procedural.js';
import {planSound,renderSound,soundDefaults} from '../src/engine/sound-design.js';
const graph=(speed=1)=>t=>[{id:'moving',type:'circle',x:150+600*Math.sin(t*speed),y:300,radius:50,fill:'#fff'}];
const quiet=planSound(sampleProceduralMotion(graph(0),{duration:2}));assert.equal(quiet.events.length,0);
const moving=planSound(sampleProceduralMotion(graph(),{duration:2}));assert(moving.events.some(e=>e.module==='objects'));assert.equal(moving.curves.camera.every(x=>x===0),true);
const hidden=sampleGraph([...graph()(1),{id:'cover',type:'rect',x:0,y:0,width:1920,height:1080,fill:'#000'}],1);assert.equal(hidden.moving.visibility,0);
const occluded=planSound(sampleProceduralMotion(t=>[...graph()(t),{id:'cover',type:'rect',width:1920,height:1080,fill:'#000'}],{duration:2}));assert.equal(occluded.events.length,0);
const clipped=sampleGraph([{id:'group',type:'group',clip:{type:'rect',width:100,height:100},children:[{id:'outside',type:'circle',x:500,y:500,radius:10,fill:'#fff'}]}],1);assert.equal(clipped.outside.visibility,0);
const wipe=planSound(sampleProceduralMotion(t=>[{id:'wipe',type:'group',clip:{type:'rect',width:Math.min(1920,t*1920),height:1080},children:[]}],{duration:2}));assert(wipe.events.some(e=>e.module==='camera'));
const scale=planSound(sampleProceduralMotion(t=>[{id:'grow',type:'circle',radius:20+t*100,x:400,y:400,fill:'#fff'}],{duration:2}));assert(scale.events.some(e=>e.module==='objects'));
const dynamic=planSound(sampleProceduralMotion(t=>t>.5?[{id:'enter',type:'text',text:'TEST',font:'80px Arial',x:400,y:400}]:[],{duration:2}));assert(dynamic.events.some(e=>e.graphic==='pop'));
const a=renderSound(moving,{sampleRate:12000}),b=renderSound(moving,{sampleRate:12000});assert.deepEqual(a.channels,b.channels);assert(a.stats.peak<.9);
const off=renderSound(planSound(sampleProceduralMotion(graph(),{duration:2}),{enabled:false}),{sampleRate:12000});assert.equal(off.stats.peak,0);
console.log(JSON.stringify({passed:true,checks:['static silence','moving shapes','no invented camera','occlusion','clips','wipe','size changes','dynamic node arrival','determinism','mute'],events:moving.events.length}));

const mutedGroup=planSound(sampleProceduralMotion(t=>[{id:"mute",type:"group",sound:false,children:graph()(t)}],{duration:2}));assert.equal(mutedGroup.events.length,0);
