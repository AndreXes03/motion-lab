/** Scene-owned public controls. Register only parameters consumed by the renderer. */
const gain=(id,label,min,max,step,group,help)=>({id,label,type:'range',path:['sceneControls',id],min,max,step,default:1,group,help,animatable:true});
const optical=[
 gain('lensStrength','Lens distortion',0,1.25,.01,'Lens','Gain of the authored optical distortion. Zero gives a clean lens.'),
 gain('focusBlur','Focus blur',0,1.5,.05,'Lens','Gain of the authored depth of field; shot focus targets remain intact.')
];
const lighting=[
 gain('keyLight','Key light',0,2,.05,'Lights','Gain of the authored main light. One preserves the original shot.'),
 gain('fillLight','Fill and rim',0,2,.05,'Lights','Gain of authored supporting lights. One preserves the original shot.')
];
const finish=[
 gain('exposure','Exposure',.25,3,.01,'Compositing','Exposure gain after the authored scene lighting.'),
 gain('bloomStrength','Highlight bloom',0,8,.05,'Compositing','Gain of the authored highlight bloom. Zero disables bloom.')
];
export const studyControlDefinitions={
 pulse:[gain('mechanismMotion','Speaker and record motion',0,1.5,.05,'Motion','Gain of speaker vibration and platter rotation; film timing stays intact.'),...optical,...lighting,...finish],
 camera:[gain('cityMotion','City vehicle motion',0,1.5,.05,'Motion','Gain of miniature vehicle, pod and fan movement; the camera sequence stays intact.'),...optical,...lighting,...finish,gain('grainStrength','Film grain',0,4,.05,'Compositing','Gain of the original film grain. Zero disables grain.')],
 dot:[gain('actingStrength','Acting strength',0,1.5,.05,'Character','Gain of character performance around its authored pose.'),gain('characterScale','Character size',.8,1.15,.01,'Character','Relative character size; one preserves the original framing.'),gain('lensMotion','Camera movement',0,1.5,.05,'Lens','Gain of authored camera motion.'),gain('glowStrength','Character glow',0,1.5,.05,'Compositing','Gain of the character glow.')],
 replay:[gain('cardSpread','Card spread',.75,1.25,.01,'Graphics','Spacing of card collection layouts.'),gain('cardTilt','Card tilt',0,1.5,.05,'Graphics','Gain of card rotation in collection layouts.'),gain('cardScale','Card size',.8,1.2,.01,'Graphics','Card size in collection layouts; the final lockup stays intact.'),gain('threadStrength','Connecting threads',0,1.5,.05,'Compositing','Gain of the connecting graphic threads.'),gain('finishPush','Final camera push',0,1.5,.05,'Lens','Gain of the final composition push.')]
};
export const controlCategories={motion:'Motion',lens:'Lens',lights:'Lights',compositing:'Compositing',character:'Character',graphics:'Graphics',appearance:'Appearance'};
export function controlCategory(control){
 if(control.category)return control.category;
 if(control.id==='exposure')return 'compositing';
 if(control.path?.[0]==='objectEdits'||['energy','speed','cameraMotion','cityMotion','mechanismMotion'].includes(control.id))return 'motion';
 if(['Camera','Lens'].includes(control.group))return 'lens';
 if(['Lighting','Lights'].includes(control.group))return 'lights';
 if(['Finish','Compositing'].includes(control.group))return 'compositing';
 if(control.group==='Character')return 'character';
 if(control.group==='Graphics'||['density','title'].includes(control.id))return 'graphics';
 return 'appearance';
}
