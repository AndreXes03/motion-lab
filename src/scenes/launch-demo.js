import {createCommercialBrief} from '../engine/commercial-brief.js';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';

/** An authored, deterministic SaaS film. Canvas layers, not simulated 3D. */
export const launchConfig={duration:24,fps:30,width:1920,height:1080,seed:71};
export const launchCuts=[0,4,9,14,19,24];
export const launchControlDefaults=Object.freeze({typeScale:1,screenshotScale:1,screenshotPanX:0,screenshotPanY:0,revealSpeed:1,motionStrength:1,framingZoom:1,framingX:0,framingY:0,cameraMotion:1,backgroundGlow:1,cardShadow:1,detailOpacity:1});
const bounds={typeScale:[.75,1.2],screenshotScale:[.65,1.3],screenshotPanX:[-1,1],screenshotPanY:[-1,1],revealSpeed:[.5,2],motionStrength:[0,1.5],framingZoom:[.8,1.2],framingX:[-1,1],framingY:[-1,1],cameraMotion:[0,1.5],backgroundGlow:[0,2],cardShadow:[0,2],detailOpacity:[0,1]};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10);};
const settle=v=>1-Math.exp(-7*Math.max(0,v))*Math.cos(6*Math.max(0,v));
const mix=(a,b,t)=>a+(b-a)*t;
const rgba=(hex,a)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${clamp(a)})`;
function colorMix(a,b,t){return '#'+[1,3,5].map(i=>Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)).toString(16).padStart(2,'0')).join('');}
export function launchControls(parameters={}){const input=parameters.sceneControls??{};return Object.fromEntries(Object.entries(launchControlDefaults).map(([key,value])=>[key,Number.isFinite(input[key])?clamp(input[key],...bounds[key]):value]));}
function box(c,x,y,w,h,fill,r=0){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function strokeBox(c,x,y,w,h,stroke,r=0,width=1){c.strokeStyle=stroke;c.lineWidth=width;c.beginPath();c.roundRect(x,y,w,h,r);c.stroke();}
function line(c,x1,y1,x2,y2,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function text(c,value,x,y,size,color,{weight=500,align='left',maxWidth}={}){c.font=`${weight} ${size}px Arial, sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=color;if(maxWidth&&c.measureText(value).width>maxWidth){c.font=`${weight} ${Math.max(1,size*maxWidth/c.measureText(value).width)}px Arial, sans-serif`;}c.fillText(value,x,y);}
function linesFor(c,value,maxWidth){const words=String(value).split(/\s+/).filter(Boolean),lines=[];let current='';for(const word of words){const next=current?current+' '+word:word;if(current&&c.measureText(next).width>maxWidth){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);return lines;}
/** Fit by wrapping and decreasing font size, including long unbroken inputs. */
function headline(c,value,x,y,width,height,size,color,{align='left',reveal=1,scale=1}={}){
 let actual=size*scale,lines=[];for(let i=0;i<36;i++){c.font=`600 ${actual}px Arial, sans-serif`;lines=linesFor(c,value,width);if(lines.length*actual*1.08<=height&&lines.every(s=>c.measureText(s).width<=width))break;actual*=.92;}
 const step=actual*1.08;c.save();c.beginPath();c.rect(align==='center'?x-width/2:x,y-actual,width,height+actual);c.clip();
 lines.forEach((value,index)=>{const r=ease((reveal-index*.07)/.82);c.save();c.globalAlpha*=r;text(c,value,x,y+index*step+actual*.52*(1-r),actual,color,{weight:600,align,maxWidth:width});c.restore();});c.restore();return lines.length*step;
}
const shotIndex=t=>Math.min(4,Math.max(0,launchCuts.findLastIndex(cut=>t>=cut)));
const shotProgress=(t,index)=>clamp((t-launchCuts[index])/(launchCuts[index+1]-launchCuts[index]));
function chapterVisibility(t,index){const start=launchCuts[index],end=launchCuts[index+1];if(t<start||t>end)return 0;return (index===0?1:ease((t-start)/.38))*(index===4?1:1-ease((t-end+.33)/.33));}
function groupPose(time,parameters,group,index){const controls=launchControls(parameters),clock=sampleAnimationGroupTime(parameters,group,time),local=clock-launchCuts[index],p=shotProgress(clock,index);return {clock,local,p,arrival:settle(Math.max(0,local)*controls.revealSpeed*1.18),reveal:clamp(local*controls.revealSpeed/1.05),controls};}
export function launchPose(time,parameters={}){
 const index=shotIndex(time),cam=groupPose(time,parameters,'camera',index),screen=groupPose(time,parameters,'screens',index),type=groupPose(time,parameters,'typography',index),v=cam.controls;
 return {index,camera:{x:960+v.framingX*160+Math.sin(cam.p*Math.PI)*12*v.cameraMotion,y:540+v.framingY*100,zoom:v.framingZoom*(1+.026*cam.p*v.cameraMotion)},screen:{x:(index===2?1360:index===3?1020:960)+(1-screen.arrival)*160*v.motionStrength,y:(index===1?636:index===2?590:index===3?635:610)+(1-screen.arrival)*100*v.motionStrength,scale:1+(screen.arrival-1)*.1*v.motionStrength,tilt:(index===2?-.013:index===3?.012:0)*v.motionStrength+Math.sin(screen.p*Math.PI)*.004*v.motionStrength,reveal:screen.reveal,progress:screen.p},typography:{reveal:type.reveal,y:64*(1-type.arrival)*v.motionStrength},controls:v};
}
const channelDefinitions={camera:[['composition.x','Composition centre X','px'],['composition.y','Composition centre Y','px'],['composition.zoom','Composition zoom','scale']],screens:[['screen.x','Screen centre X','px'],['screen.y','Screen centre Y','px'],['screen.scale','Screen arrival scale','scale'],['screen.rotation','Screen rotation','rad']],typography:[['type.reveal','Headline reveal','progress'],['type.y','Headline arrival offset','px']]};

export function createLaunchDemo(){
 const defaultBrief=createCommercialBrief(),briefCache=[],images=new Map(),pending=new Map();let disposed=false,prepareGeneration=0;
 // Parameter animation clones recipes on every sample. Compare primitive leaves
 // without serializing or scanning megabytes of embedded base64 on every frame.
 function briefSignature(value,out=[],depth=0){
  if(depth>8||out.length>180)throw new Error('Invalid commercial brief structure');
  if(value&&typeof value==='object'){const keys=Object.keys(value);out.push(Array.isArray(value)?'array':'object',keys.length);for(const key of keys){out.push(key);briefSignature(value[key],out,depth+1);}}
  else out.push(typeof value,value);
  return out;
 }
 function briefFor(parameters={}){
  const input=parameters.commercial;if(!input)return defaultBrief;const signature=briefSignature(input),cached=briefCache.find(item=>item.signature.length===signature.length&&item.signature.every((value,index)=>value===signature[index]));if(cached)return cached.brief;
  const brief=createCommercialBrief(input);briefCache.unshift({signature,brief});if(briefCache.length>4)briefCache.pop();return brief;
 }
 function assetList(brief){return [brief.assets.logo,...brief.assets.screenshots].filter(Boolean);}
 async function load(asset){if(images.has(asset.src))return images.get(asset.src);if(pending.has(asset.src))return pending.get(asset.src);
  const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{if(disposed){reject(new Error('Commercial scene was disposed during image preparation'));return;}if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>32_000_000){reject(new Error(`Image dimensions are invalid or exceed 32 megapixels: ${asset.name}`));return;}images.set(asset.src,img);resolve(img);};img.onerror=()=>reject(new Error(`Could not decode commercial image: ${asset.name}`));img.src=asset.src;});pending.set(asset.src,promise);try{return await promise;}finally{pending.delete(asset.src);}
 }
 function readyImage(asset){if(!asset)return null;const img=images.get(asset.src);if(!img)throw new Error(`Commercial image is not prepared: ${asset.name}. Await runtime.prepare(parameters) before rendering.`);return img;}
 function brand(c,brief,x,y,{size=36,logoSize=42}={}){const image=readyImage(brief.assets.logo);if(image){const scale=Math.min(logoSize/image.naturalWidth,logoSize/image.naturalHeight);c.drawImage(image,x,y-logoSize*.8,image.naturalWidth*scale,image.naturalHeight*scale);x+=logoSize+16;}text(c,brief.brand.name,x,y,size,brief.brand.colors.foreground,{weight:600,maxWidth:680});}
 function backdrop(c,brief,controls,t){const {background:bg,foreground:fg,accent}=brief.brand.colors;box(c,0,0,1920,1080,bg);if(controls.backgroundGlow){const gradient=c.createRadialGradient(1460,320,0,1460,320,1050);gradient.addColorStop(0,rgba(accent,.12*controls.backgroundGlow));gradient.addColorStop(1,rgba(accent,0));box(c,0,0,1920,1080,gradient);}
  c.save();c.globalAlpha=controls.detailOpacity;for(let x=100;x<1920;x+=215)line(c,x,0,x,1080,rgba(fg,.025));for(let y=108;y<1080;y+=216)line(c,0,y,1920,y,rgba(fg,.025));line(c,104,994,1816,994,rgba(fg,.15));line(c,104,994,104+1712*clamp(t/24),994,accent,2);text(c,'PRODUCT IN FOCUS',104,1030,14,rgba(fg,.5),{weight:500});text(c,String(shotIndex(t)+1).padStart(2,'0')+' / 05',1816,1030,14,rgba(fg,.5),{align:'right'});c.restore();
 }
 function demoInterface(c,w,h,brief,variant=0){
  const {background:bg,foreground:fg,accent}=brief.brand.colors,panel=colorMix(bg,fg,.055);box(c,0,0,w,h,panel);const side=w*.2;
  box(c,0,0,side,h,colorMix(bg,fg,.025));text(c,brief.brand.name,side*.14,h*.1,Math.min(28,w*.024),fg,{weight:600,maxWidth:side*.75});
  ['Workspace','Projects','My tasks'].forEach((name,i)=>{if(i===variant%3)box(c,side*.08,h*.17+i*h*.095,side*.84,h*.073,rgba(accent,.1),9);box(c,side*.15,h*.195+i*h*.095,10,10,i===variant%3?accent:rgba(fg,.35),3);text(c,name,side*.28,h*.215+i*h*.095,Math.min(18,w*.016),i===variant%3?accent:rgba(fg,.55),{maxWidth:side*.6});});
  const x=side+w*.04,main=w-side-w*.08;text(c,['Project overview','Your next step','Made for focus'][variant%3],x,h*.13,Math.min(36,w*.032),fg,{weight:600,maxWidth:main});text(c,'One shared space. A clear way forward.',x,h*.205,Math.min(17,w*.015),rgba(fg,.5),{maxWidth:main});
  const headings=['Ideas','In progress','Ready'],cw=(main-28)/3;
  headings.forEach((heading,j)=>{const xx=x+j*(cw+14);text(c,heading,xx,h*.32,Math.min(16,w*.014),rgba(fg,.65),{weight:600,maxWidth:cw});for(let k=0;k<(j===1?3:2);k++){const yy=h*.36+k*h*.17;box(c,xx,yy,cw,h*.14,colorMix(bg,fg,.09),10);box(c,xx+14,yy+14,cw*.2,4,j===variant%3?accent:rgba(fg,.2),2);box(c,xx+14,yy+h*.057,cw*.67,7,rgba(fg,.5),3);box(c,xx+14,yy+h*.084,cw*.45,5,rgba(fg,.14),2);}});
  text(c,'Illustrative demo interface',x,h*.94,Math.min(13,w*.012),rgba(fg,.36));
 }
 function screen(c,brief,index,x,y,w,h,controls,{rotation=0,progress=0}={}){
  const {background:bg,foreground:fg,accent}=brief.brand.colors;const asset=brief.assets.screenshots[index]??brief.assets.screenshots[0],image=readyImage(asset);c.save();c.translate(x,y);c.rotate(rotation);const left=-w/2,top=-h/2,bar=46;
  if(controls.cardShadow){c.shadowColor=rgba('#000000',.45*controls.cardShadow);c.shadowBlur=56*controls.cardShadow;c.shadowOffsetY=30*controls.cardShadow;}box(c,left,top,w,h,colorMix(bg,fg,.075),18);c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0;
  c.save();c.beginPath();c.roundRect(left,top,w,h,18);c.clip();box(c,left,top,w,bar,colorMix(bg,fg,.09));for(let j=0;j<3;j++){c.fillStyle=rgba(fg,j===0?.5:.16);c.beginPath();c.arc(left+23+j*17,top+23,4,0,Math.PI*2);c.fill();}text(c,brief.copy.url||brief.brand.name,0,top+29,13,rgba(fg,.5),{align:'center',maxWidth:w*.65});
  const innerH=h-bar;c.translate(left,top+bar);box(c,0,0,w,innerH,bg);c.beginPath();c.rect(0,0,w,innerH);c.clip();
  const contentScale=controls.screenshotScale,panX=controls.screenshotPanX*w*.22,panY=controls.screenshotPanY*innerH*.22;c.translate(w/2+panX,innerH/2+panY);c.scale(contentScale,contentScale);
  if(image){const fit=Math.min(w/image.naturalWidth,innerH/image.naturalHeight);c.drawImage(image,-image.naturalWidth*fit/2,-image.naturalHeight*fit/2,image.naturalWidth*fit,image.naturalHeight*fit);}else {c.translate(-w/2,-innerH/2);demoInterface(c,w,innerH,brief,index);}c.restore();strokeBox(c,left,top,w,h,rgba(fg,.18),18,1);
  if(index===1&&!image){const badgeW=Math.min(250,w*.3);c.save();c.translate(w*.24,-h*.12+Math.sin(progress*Math.PI)*-10*controls.motionStrength);box(c,0,0,badgeW,68,accent,14);text(c,'In focus',24,43,24,bg,{weight:600,maxWidth:badgeW-48});c.restore();}c.restore();
 }
 function heading(c,brief,value,x,y,width,height,size,pose,{center=false}={}){return headline(c,value,x,y+pose.typography.y,width,height,size,brief.brand.colors.foreground,{align:center?'center':'left',reveal:pose.typography.reveal,scale:pose.controls.typeScale});}
 function chapter(c,t,index,brief,pose){const {foreground:fg,background:bg,accent}=brief.brand.colors,v=pose.controls,s=pose.screen;brand(c,brief,104,99);text(c,['INTRODUCING','THE PRODUCT','IN DETAIL','IN ACTION','YOUR NEXT MOVE'][index],1816,92,15,rgba(fg,.56),{align:'right'});
  if(index===0){
   const arrival=ease((t-.15)/1.2);c.save();c.globalAlpha=arrival;c.translate(1460,540);c.rotate(-.15+.07*s.progress*v.motionStrength);for(let i=4;i>=0;i--){const offset=i*40;strokeBox(c,-270-offset*.2,-210+offset,470,320,rgba(accent,.15+i*.03),40,2);};box(c,-240,-240,470,320,accent,40);text(c,brief.brand.name,-195,-112,56,bg,{weight:600,maxWidth:380});headline(c,brief.brand.tagline,-195,-48,380,70,26,bg);line(c,-195,20,175,20,rgba(bg,.2),2);for(let i=0;i<3;i++)box(c,-195+i*125,51,105,8,rgba(bg,.17+i*.06),4);c.restore();
   heading(c,brief,brief.copy.headline,104,352,1050,450,134,pose);c.save();c.globalAlpha=ease((t-1.15)/.7);text(c,brief.brand.tagline,110,855,30,rgba(fg,.56),{maxWidth:1050});c.restore();
  }else if(index===1){
   heading(c,brief,brief.copy.features[0],960,255,1580,155,77,pose,{center:true});c.save();c.translate(s.x,s.y);c.scale(s.scale,s.scale);screen(c,brief,0,0,0,1260,603,v,{rotation:s.tilt,progress:s.progress});c.restore();
  }else if(index===2){
   c.save();c.globalAlpha=ease((t-9)/.6);box(c,104,216,78,36,rgba(accent,.12),18);text(c,'01',143,241,16,accent,{weight:600,align:'center'});c.restore();heading(c,brief,brief.copy.features[1],104,354,660,365,92,pose);text(c,brief.brand.tagline,108,795,23,rgba(fg,.5),{maxWidth:640});c.save();c.translate(s.x,s.y);c.scale(s.scale,s.scale);screen(c,brief,1,0,0,1050,615,v,{rotation:s.tilt,progress:s.progress});c.restore();
  }else if(index===3){
   heading(c,brief,brief.copy.features[2],960,255,1560,160,77,pose,{center:true});c.save();c.translate(s.x,s.y);c.scale(s.scale,s.scale);screen(c,brief,2,0,0,1230,595,v,{rotation:s.tilt,progress:s.progress});c.restore();
  }else{
   c.save();c.globalAlpha=ease((t-19)/.6);const g=c.createRadialGradient(960,540,0,960,540,620);g.addColorStop(0,rgba(accent,.12*v.backgroundGlow));g.addColorStop(1,rgba(accent,0));box(c,200,140,1520,760,g);c.restore();
   const image=readyImage(brief.assets.logo);if(image){const scale=Math.min(92/image.naturalWidth,92/image.naturalHeight);c.drawImage(image,960-image.naturalWidth*scale/2,213,image.naturalWidth*scale,image.naturalHeight*scale);}
   heading(c,brief,brief.copy.cta,960,image?427:394,1510,250,132,pose,{center:true});c.save();c.globalAlpha=ease((t-19.8)/.8);text(c,brief.brand.tagline,960,650,32,rgba(fg,.58),{align:'center',maxWidth:1450});const url=brief.copy.url||brief.brand.name;c.font='600 25px Arial';const buttonWidth=clamp(c.measureText(url).width+100,300,1100);box(c,960-buttonWidth/2,723,buttonWidth,82,accent,41);text(c,url,960,776,25,bg,{weight:600,align:'center',maxWidth:buttonWidth-70});c.restore();
  }
 }
 return {config:launchConfig,
  async prepare(parameters={}){if(disposed)throw new Error('Commercial scene is disposed');const generation=++prepareGeneration,assets=assetList(briefFor(parameters));await Promise.all(assets.map(load));if(generation===prepareGeneration){const wanted=new Set(assets.map(asset=>asset.src));for(const source of images.keys())if(!wanted.has(source))images.delete(source);}return true;},
  animationChannels(group){return (channelDefinitions[group]??[]).map(([id,label,unit])=>({id,label,unit}));},
  animationState(group,time,parameters={}){const p=launchPose(time,parameters);if(group==='camera')return {'composition.x':p.camera.x,'composition.y':p.camera.y,'composition.zoom':p.camera.zoom};if(group==='screens')return {'screen.x':p.screen.x,'screen.y':p.screen.y,'screen.scale':p.screen.scale,'screen.rotation':p.screen.tilt};if(group==='typography')return {'type.reveal':p.typography.reveal,'type.y':p.typography.y};return {};},
  nodesAt(time,parameters={}){const p=launchPose(time,parameters);return [{id:'launch.screen',type:'rect',x:p.screen.x,y:p.screen.y,width:1260*p.screen.scale,height:603*p.screen.scale,opacity:p.index>0&&p.index<4?chapterVisibility(time,p.index):0,sound:false}];},
  render(c,time,parameters={},w=1920,h=1080){if(disposed)throw new Error('Commercial scene is disposed');const brief=briefFor(parameters),t=clamp(time,0,24),pose=launchPose(t,parameters);for(const asset of assetList(brief))readyImage(asset);c.save();try{box(c,0,0,w,h,brief.brand.colors.background);const scale=Math.min(w/1920,h/1080);c.translate((w-1920*scale)/2,(h-1080*scale)/2);c.scale(scale,scale);c.beginPath();c.rect(0,0,1920,1080);c.clip();backdrop(c,brief,pose.controls,t);c.translate(960,540);c.scale(pose.camera.zoom,pose.camera.zoom);c.translate(-pose.camera.x,-pose.camera.y);c.globalAlpha=chapterVisibility(t,pose.index);chapter(c,t,pose.index,brief,pose);}finally{c.restore();}},
  dispose(){disposed=true;prepareGeneration++;images.clear();pending.clear();briefCache.length=0;}
 };
}
