import {config} from './config.js';
/** Browser/Node-safe scene metadata shared by viewer, CLI and export service. */
export const sceneRegistry={
 bax:{duration:10,title:'Objects in play'},procedural:{duration:10,title:'Procedural motion'},pop:{duration:10,title:'Pop motion'},
 dot:{shutterAngle:72,duration:16,title:'DOT / Character study',kind:'hybrid',cuts:[0,6.32,16],source:'mascot-demo.js'},
 pulse:{shutterAngle:180,duration:13.9,title:'PULSE / Sound sculpture',kind:'3d',cuts:[0,1.46,2.45,3.45,4.25,5.25,5.9,6.675,13.9],source:'pulse-demo.js'},
 camera:{shutterAngle:55,duration:15.4,title:'CAMERA / Miniature worlds',kind:'3d',cuts:[0,2.4,4.4,6,8.1,9.2,10.4,11.1],source:'afterhours-demo.js'},
 replay:{duration:15,title:'REPLAY / Editorial motion',kind:'hybrid',cuts:[0,2.4,5.4,7.7,9.4,11.4,13.2],source:'replay-demo.js'}
};
export const sceneIds=Object.keys(sceneRegistry);
export const isNewScene=id=>['dot','pulse','camera','replay'].includes(id);
export function sceneConfig(id='bax'){if(!sceneRegistry[id])throw Error('Unknown scene: '+id);return {...config,...sceneRegistry[id],scene:id,id};}
export const newStudioProjects=Object.entries(sceneRegistry).filter(([id])=>isNewScene(id)).map(([id,s])=>({id,title:s.title,kind:s.kind,subtitle:'Editable reference study',duration:s.duration,controls:[],presets:[{id:'original',label:'Original',values:{}}],moments:s.cuts.filter(t=>t<s.duration).map((time,i)=>({time,label:String(i+1).padStart(2,'0')}))}));
