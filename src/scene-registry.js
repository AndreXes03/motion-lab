import {appDemoDuration} from './engine/app-demo.js';
import {loopDuration,loopCuts} from './scenes/loop-timing.js';
import {canonicalScene} from './engine/legacy-scene.js';
import {studyControlDefinitions} from './engine/scene-capabilities.js';
import {config} from './config.js';
/** Browser/Node-safe scene metadata shared by viewer, CLI and export service. */
export const sceneRegistry={
 appdemo:{duration:18,title:'App Demo / Your product in motion',kind:'2d',shutterAngle:0,cuts:[0,3,7,11,15,18],source:'app-demo.js'},
 loop:{duration:loopDuration,title:'LOOP / From brief to feeling',kind:'hybrid',shutterAngle:306,cuts:loopCuts,source:'loop-launch.js'},
 starter:{duration:6,title:'Product starter',kind:'3d',shutterAngle:270,cuts:[0,6],source:'product-starter.js'},
 objects:{duration:10,title:'Objects in play'},procedural:{duration:10,title:'Procedural motion'},pop:{duration:10,title:'Pop motion'},
 dot:{shutterAngle:72,duration:16,title:'DOT / Character study',kind:'hybrid',cuts:[0,6.32,16],source:'mascot-demo.js'},
 pulse:{shutterAngle:180,duration:13.9,title:'PULSE / Sound sculpture',kind:'3d',cuts:[0,1.46,2.45,3.45,4.25,5.25,5.9,6.675,13.9],source:'pulse-demo.js'},
 camera:{shutterAngle:55,duration:15.4,title:'CAMERA / Miniature worlds',kind:'3d',cuts:[0,2.4,4.4,6,8.1,9.2,10.4,11.1],source:'afterhours-demo.js'},
 replay:{duration:15,title:'REPLAY / Editorial motion',kind:'hybrid',cuts:[0,2.4,5.4,7.7,9.4,11.4,13.2],source:'replay-demo.js'}
};
export const sceneIds=Object.keys(sceneRegistry);
export const isNewScene=id=>['dot','pulse','camera','replay','starter','loop','appdemo'].includes(id);
export function sceneConfig(id='objects',parameters={}){id=canonicalScene(id);if(!sceneRegistry[id])throw Error('Unknown scene: '+id);return {...config,...sceneRegistry[id],...(id==='appdemo'?{duration:appDemoDuration(parameters.appDemo)}:{}),scene:id,id};}
export const newStudioProjects=Object.entries(sceneRegistry).filter(([id])=>isNewScene(id)).map(([id,s])=>({id,title:s.title,kind:s.kind,subtitle:'Editable reference study',duration:s.duration,controls:studyControlDefinitions[id]??[],presets:[{id:'original',label:'Original',values:{}}],moments:s.cuts.filter(t=>t<s.duration).map((time,i)=>({time,label:String(i+1).padStart(2,'0')}))}));

const starter=newStudioProjects.find(p=>p.id==='starter');
starter.subtitle='Reusable materials, lighting, hardware and motion';
starter.controls=[
 {id:'accent',label:'Control color',type:'color',default:'#d7f56b',help:'Satin plastic controls.'},
 {id:'shell',label:'Housing color',type:'color',default:'#d2d3c8',help:'Matte molded housing.'},
 {id:'fov',label:'Wide lens',type:'range',min:45,max:95,step:1,default:65,help:'Actual camera field of view in degrees.'},
 {id:'fisheye',label:'Lens distortion',type:'range',min:0,max:.6,step:.01,default:.08,help:'Optical finishing; separate from camera movement.'},
 {id:'keyStrength',label:'Key light',type:'range',min:.3,max:2,step:.05,default:1,help:'Studio key light intensity.'},
 {id:'fill',label:'Shadow fill',type:'range',min:0,max:.4,step:.01,default:.10,help:'Raise gently to reveal shadow detail.'}
];
starter.moments=[{time:.35,label:'Assembly'},{time:1.45,label:'Contact'},{time:3,label:'Materials'},{time:5.5,label:'Detail'}];
