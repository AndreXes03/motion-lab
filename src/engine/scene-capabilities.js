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
 loop:[
  {...gain('waveCount','Concentric rings',28,90,1,'Graphics','Number of historical product contours.'),default:58,category:'graphics'},
  {...gain('waveTravel','Emitter travel',0,1.8,.05,'Graphics','Travel of the product and its projected contour trail.'),default:1,category:'graphics'},
  {...gain('waveSpeed','Wave speed',.25,2,.05,'Graphics','Speed of product travel, rotation and contour emission.'),default:1,category:'graphics'},
  {...gain('waveWarp','Field deformation',0,2,.05,'Graphics','Subtle local deformation of the projected product outline.'),default:1,category:'graphics'},
  {...gain('waveWeight','Contour weight',.4,2,.05,'Graphics','Weight of the major outlines and fine trailing contours.'),default:1,category:'graphics'},
  {...gain("introZoom","Opening zoom",1,5,0.05,"Graphics","Magnification before the pullback."),default:3,category:'graphics'},
  {...gain("introPullbackStart","Pullback start",0,1.8,0.05,"Graphics","Start in seconds on the three-second opening."),default:0.75,category:'graphics'},
  {...gain("introPullbackDuration","Pullback duration",0.4,2.4,0.05,"Graphics","Duration in seconds; keep the end before Send."),default:1.8,category:'graphics'},
  {...gain("introSigma","Gaussian softness",0.06,0.4,0.01,"Graphics","Smaller sigma concentrates velocity in the middle with longer soft tails."),default:0.16,category:'graphics'},
  {...gain("introPan","Text tracking",0,260,5,"Graphics","Horizontal camera travel while the text is written."),default:160,category:'graphics'},
  {...gain("introGlowSpeed","Glow motion",0.2,3,0.05,"Graphics","Speed of the independent brand-yellow glow fields."),default:1,category:'graphics'},
  {...gain("titleEntry","Title entrance",0.1,0.7,0.01,"Graphics","Entrance duration, limited to 43 percent of each title shot."),default:0.38,category:'graphics'},
  {...gain("titleExit","Title exit",0.08,0.5,0.01,"Graphics","Exit duration, limited to 30 percent of each title shot."),default:0.3,category:'graphics'},
  {...gain("letterStagger","Letter delay spread",0,0.3,0.01,"Graphics","Total delay from the first to last letter."),default:0.07,category:'graphics'},
  {...gain("letterRise","Letter reveal travel",0,0.65,0.01,"Graphics","Vertical reveal travel relative to the type size."),default:0.24,category:'graphics'},
  {...gain("titleDrift","Reading drift",0,100,1,"Graphics","Continuous leftward movement while the title is readable."),default:20,category:'graphics'},
  {...gain("titleEaseX1","Bezier handle 1 X",0.01,0.99,0.01,"Graphics","Horizontal position of the entrance curve first handle."),default:0.16,category:'graphics'},
  {...gain("titleEaseY1","Bezier handle 1 Y",0,1,0.01,"Graphics","Vertical position of the entrance curve first handle."),default:0.86,category:'graphics'},
  {...gain("titleEaseX2","Bezier handle 2 X",0.01,0.99,0.01,"Graphics","Horizontal position of the entrance curve second handle."),default:0.38,category:'graphics'},
  {...gain("titleEaseY2","Bezier handle 2 Y",0,1,0.01,"Graphics","Vertical position of the entrance curve second handle. Exit mirrors this curve."),default:1,category:'graphics'},
  {...gain('motionAmount','Product movement',0,1.5,.05,'Motion','Gain of speaker turns and graphic bounce.'),category:'motion'},
  {...gain('explodeAmount','Assembly separation',0,1.5,.05,'Motion','Travel of the acoustic assembly layers, with fixed cuts.'),category:'motion'},
  gain('typeScale','Kinetic type size',.8,1.05,.01,'Graphics','Type scale in the digital kinetic shot.'),
  {...gain('paletteHue','Shell hue',-180,180,1,'Appearance','Rotate the authored shell palette while preserving shot-to-shot variation.'),default:0},
  {...gain('shellRoughness','Shell roughness',.15,.8,.01,'Appearance','Roughness of the molded housing.'),default:.34},
  gain('coatingScale','Coating detail',.5,2,.05,'Appearance','Frequency of the organic paint islands in the Finish shot.'),
  gain('coatingEdge','Wet front width',.4,1.8,.05,'Appearance','Width of the advancing paint front and its attached microdroplets.'),
  gain('ledBrightness','Light ring',0,2,.05,'Appearance','Brightness of the narrow LED ring.'),
  ...lighting,
  {...gain('exposure','Exposure',.4,2,.01,'Compositing','Exposure of the 3D stage.'),default:1.15},
  gain('bloomStrength','Highlight bloom',0,2,.05,'Compositing','Restrained highlight bloom on 3D only.'),
  gain('renderAberration','Lens fringe',0,2,.05,'Compositing','Subpixel chromatic fringe on the 3D render only. Zero disables it.')
 ],
 procedural:[
  gain('typeScale','Type size',.7,1.2,.05,'Graphics','Scale of headlines; interface labels retain their size.'),
  gain('shapeScale','Composition size',.6,1.4,.05,'Graphics','Scale of the generated shapes around the canvas centre.'),
  gain('strokeWidth','Line weight',.25,3,.05,'Graphics','Width of generated vector strokes.'),
  {...gain('waveAmplitude','Wave amplitude',0,2,.05,'Motion','Strength of the flowing and interfering waves.'),category:'motion'},
  {...gain('beatStrength','Beat response',0,2,.05,'Motion','Strength of beat-driven pulses without changing the beat clock.'),category:'motion'},
  gain('particleSize','Particle size',.25,3,.05,'Graphics','Size of orbit markers, flow particles and swarm cells.'),
  gain('overlayOpacity','Labels and meters',0,1,.05,'Compositing','Opacity of the small labels, rules and beat meters.'),
  gain('echoOpacity','Type echoes',0,2,.05,'Compositing','Opacity of the repeated kinetic headline layers.')
 ],
 pop:[
  gain('typeScale','Hero type size',.6,1.3,.05,'Graphics','Scale of the PLAY, BASS and MOVE lettering.'),
  gain('captionScale','Caption size',.7,1.2,.05,'Graphics','Size of the bottom chapter caption.'),
  gain('halftoneSize','Halftone dots',0,2,.05,'Graphics','Radius of the background halftone dots; zero hides them.'),
  gain('burstScale','Sticker size',.5,1.5,.05,'Graphics','Size of both comic stickers, including their labels.'),
  gain('windowScale','Graphic windows',.5,1.25,.05,'Graphics','Scale of the spectrum and waveform windows.'),
  {...gain('tickerSpeed','Ticker speed',0,2,.05,'Motion','Scrolling speed of the lower ticker.'),category:'motion'}
 ],
 pulse:[
  gain('mechanismMotion','Overall movement',0,1.5,.05,'Motion','Overall speaker and record motion gain; film timing stays intact.'),
  {...gain('speakerVibration','Speaker vibration',0,2,.05,'Motion','Speaker cone and dome movement, independent of record speed.'),category:'motion'},
  {...gain('recordSpeed','Record rotation',0,2,.05,'Motion','Rotation gain of the record, preserving the authored shot timing.'),category:'motion'},
  ...optical,
  gain('cameraFraming','Camera distance',.85,1.2,.01,'Lens','Distance from the authored focus target; one preserves the original framing.'),
  ...lighting,
  gain('keySize','Key light size',.5,2,.05,'Lights','Size of the rectangular key light and its reflection. Intensity remains independently adjustable.'),
  gain('rimLight','Rim light',0,2,.05,'Lights','Gain of the rear supporting lights, in addition to the fill and rim master.'),
  gain('shellRoughness','Shell roughness',.25,2,.05,'Appearance','Roughness gain for the molded shells and colored speaker parts.'),
  gain('metalRoughness','Metal roughness',.25,3,.05,'Appearance','Roughness gain for the speaker hardware and metallic dome.'),
  gain('ledBrightness','LED brightness',0,3,.05,'Appearance','Brightness of the PULSE LED display during its shot.'),
  gain('backgroundBrightness','Backdrop brightness',.25,2,.05,'Appearance','Brightness of the authored background gradients, retaining each shot palette.'),
  ...finish
 ],
 camera:[gain('cityMotion','City vehicle motion',0,1.5,.05,'Motion','Gain of miniature vehicle, pod and fan movement; the camera sequence stays intact.'),...optical,...lighting,...finish,gain('grainStrength','Film grain',0,4,.05,'Compositing','Gain of the original film grain. Zero disables grain.')],
 dot:[gain('actingStrength','Acting strength',0,1.5,.05,'Character','Gain of character performance around its authored pose.'),gain('characterScale','Character size',.8,1.15,.01,'Character','Relative character size; one preserves the original framing.'),gain('lensMotion','Camera movement',0,1.5,.05,'Lens','Gain of authored camera motion.'),gain('glowStrength','Character glow',0,1.5,.05,'Compositing','Gain of the character glow.')],
 replay:[
 gain('editorialScale','Editorial type size',.8,1.15,.05,'Graphics','Size of the opening and editorial headlines; final logo geometry stays intact.'),
 {...gain('revealSpeed','Type reveal speed',.5,2,.05,'Motion','Speed of editorial text reveals, anchored to their original entrances.'),category:'motion'},
 gain('cardDepth','Card depth',.5,1.5,.05,'Graphics','Depth spread of the card collection around its authored layout.'),
 gain('orbitScale','Word orbit size',.7,1.3,.05,'Graphics','Radius of the replay words around the final record.'),
 {...gain('orbitSpeed','Word orbit speed',0,2,.05,'Motion','Rotation speed of the words around the final record.'),category:'motion'},
 gain('posterSpacing','Poster line spacing',.9,1.1,.01,'Graphics','Vertical spacing of GOOD OLD DAYS and their embedded objects.'),
 gain('cardSpread','Card spread',.75,1.25,.01,'Graphics','Spacing of card collection layouts.'),gain('cardTilt','Card tilt',0,1.5,.05,'Graphics','Gain of card rotation in collection layouts.'),gain('cardScale','Card size',.8,1.2,.01,'Graphics','Card size in collection layouts; the final lockup stays intact.'),gain('threadStrength','Connecting threads',0,1.5,.05,'Compositing','Gain of the connecting graphic threads.'),gain('finishPush','Final camera push',0,1.5,.05,'Lens','Gain of the final composition push.')]
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
