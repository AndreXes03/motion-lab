import {canonicalScene} from './engine/legacy-scene.js';
import {studyControlDefinitions} from './engine/scene-capabilities.js';
import {config} from './config.js';
/** Browser/Node-safe scene metadata shared by viewer, CLI and export service. */
export const sceneRegistry={
 loop:{duration:22,title:'LOOP / From brief to feeling',kind:'hybrid',shutterAngle:306,cuts:[0,3,119/30,4.8,5.3,7.7,259/30,9.6,316/30,12.4,13.3,428/30,15.2,470/30,17.1,18,568/30,20.6,22],source:'loop-launch.js'},
 starter:{duration:6,title:'Product starter',kind:'3d',shutterAngle:270,cuts:[0,6],source:'product-starter.js'},
 objects:{duration:10,title:'Objects in play'},procedural:{duration:10,title:'Procedural motion'},pop:{duration:10,title:'Pop motion'},
 dot:{shutterAngle:72,duration:16,title:'DOT / Character study',kind:'hybrid',cuts:[0,6.32,16],source:'mascot-demo.js'},
 pulse:{shutterAngle:180,duration:13.9,title:'PULSE / Sound sculpture',kind:'3d',cuts:[0,1.46,2.45,3.45,4.25,5.25,5.9,6.675,13.9],source:'pulse-demo.js'},
 camera:{shutterAngle:55,duration:15.4,title:'CAMERA / Miniature worlds',kind:'3d',cuts:[0,2.4,4.4,6,8.1,9.2,10.4,11.1],source:'afterhours-demo.js'},
 replay:{duration:15,title:'REPLAY / Editorial motion',kind:'hybrid',cuts:[0,2.4,5.4,7.7,9.4,11.4,13.2],source:'replay-demo.js'}
};
export const sceneIds=Object.keys(sceneRegistry);
export const isNewScene=id=>['dot','pulse','camera','replay','starter','loop'].includes(id);
export function sceneConfig(id='objects'){id=canonicalScene(id);if(!sceneRegistry[id])throw Error('Unknown scene: '+id);return {...config,...sceneRegistry[id],scene:id,id};}
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
