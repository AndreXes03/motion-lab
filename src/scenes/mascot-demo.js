import {drawDotPixels,dotPixelWipe} from './dot-pixels.js';
import {applyDotOptics} from './dot-optics.js';
import {heroPose,personalityPose,characterActing,compositionPose} from './dot-motion.js';
import {createDotDevice} from './dot-device.js';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
/** DOT: 2.5D character motion with soft silhouettes and procedural LED facial acting. */
export const mascotConfig={id:'dot-personality',title:'DOT / A little character',duration:16,fps:30,width:1920,height:1080,scene:'mascot'};
// Preserve crisp2D silhouettes; temporal exposure belongs only to the physical device move.
export const mascotShutterAt=t=>(t>13.6&&t<14.3)?72:0;
export const mascotCuts=[0,6.32,16];
const TAU=Math.PI*2,C={cream:'#f3f1e8',violet:'#6c43e9',dark:'#100e24',pink:'#db68b8',mint:'#6fd7b3',orange:'#f0a341'};
const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,x)=>a+(b-a)*x,ease=x=>1-(1-clamp(x))**3;
const spring=x=>x<=0?0:1-Math.exp(-7*x)*Math.cos(11*x);
const bump=(t,at,width)=>Math.max(0,1-Math.abs(t-at)/width);
function circle(c,x,y,r,col){c.fillStyle=col;c.beginPath();c.arc(x,y,Math.max(.01,r),0,TAU);c.fill();}
function txt(c,s,x,y,size,col=C.cream,align='left',weight=900){c.fillStyle=col;c.font=`${weight} ${size}px ${weight>=900?'"Arial Black", ':''}Arial`;c.textAlign=align;c.textBaseline='alphabetic';c.letterSpacing=size>100?'-4px':'0px';c.fillText(s,x,y);c.letterSpacing='0px';}
function mono(c,s,x,y,size=22,col=C.cream,align='left'){c.fillStyle=col;c.font=`500 ${size}px monospace`;c.textAlign=align;c.fillText(s,x,y);}
function title(c,s,x,y,size,col,t,delay=0){const q=ease((t-delay)/.35);c.save();c.beginPath();c.rect(x-4,y-size*1.12,size*12,size*1.22);c.clip();txt(c,s,x,y+(1-q)*size*1.35,size,col);c.restore();}
function glow(c,x,y,r,col,alpha=.5){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(.32,col);g.addColorStop(1,col+'00');c.save();c.globalAlpha=alpha;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
function outline(c,kind,t,act={}){
 c.beginPath();
 if(kind==='bunny'){
  const l=act.earL||0,r=act.earR||0,cheek=act.cheek||0,fl=act.footL||0,fr=act.footR||0;
  c.moveTo(-.67,-.66);
  c.bezierCurveTo(-.98-cheek,-.46,-1.06,.08,-.87,.61);
  c.bezierCurveTo(-.81,.9,-.67,1.08+fl,-.43,1.04+fl);
  c.bezierCurveTo(-.2,.97,-.15,.89,.01,.92);
  c.bezierCurveTo(.16,.92,.28,1.07+fr,.5,1.02+fr);
  c.bezierCurveTo(.9,.97,1.01,.53,.94,.11);
  c.bezierCurveTo(.96,-.3,.8+cheek,-.52,.64,-.64);
  c.bezierCurveTo(.7+r,-.97,.91+r,-1.47,.8+r,-1.74);
  c.bezierCurveTo(.72+r,-1.95,.44+r*.6,-1.64,.27,-.73);
  c.bezierCurveTo(.1,-.78,-.12,-.76,-.3,-.72);
  c.bezierCurveTo(-.32+l*.5,-1.14,-.54+l,-1.83,-.69+l,-1.88);
  c.bezierCurveTo(-.87+l,-1.92,-.9+l,-1.31,-.67,-.66);c.closePath();return;
 }
 if(kind==='spark'){
  const f=act.cheek||0,fl=act.footL||0,fr=act.footR||0;
  c.moveTo(-.89,.1);c.bezierCurveTo(-1.23,.19,-1.13,.46,-.79,.45);
  c.bezierCurveTo(-.77,.63,-.55,.7,-.3,.56+f+fl);c.bezierCurveTo(-.1,.72,.08,.7,.26,.57);
  c.bezierCurveTo(.5,.7+fr,.76,.61+fr,.77,.43);c.bezierCurveTo(1.15,.46,1.18,.18,.82,.09);
  c.bezierCurveTo(.73,-.03,.65,-.67,.52,-.86);
  c.quadraticCurveTo(.47,-.9,.19,-.38);c.quadraticCurveTo(.11,-.51,-.01,-1.11);
  c.quadraticCurveTo(-.07,-1.17,-.32,-.42);c.quadraticCurveTo(-.42,-.63,-.55,-.92);
  c.quadraticCurveTo(-.63,-1.01,-.7,-.18);c.quadraticCurveTo(-.73,.01,-.89,.1);c.closePath();return;
 }
 const n=180;
 for(let i=0;i<=n;i++){const a=i/n*TAU,ca=Math.cos(a),sa=Math.sin(a);let x=Math.sign(ca)*Math.pow(Math.abs(ca),.72),y=Math.sign(sa)*Math.pow(Math.abs(sa),.72);
  if(kind==='cloud'){const rr=1+.075*Math.cos(5*a+.25)+.055*Math.sin(3*a-.4);x=ca*rr;y=sa*rr*.86;}
  const wobble=.009*Math.sin(a*3+t*2)+.004*Math.sin(a*5-t*1.4);x*=1+wobble;y*=1+wobble;
  if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
 }c.closePath();
}
/** A sampled emissive matrix, clipped to the animated expression: no toy eyeball meshes. */
function ledFaceCore(c,r,t,{mood='happy',look=0,blink=0,inverse=false,eyesOnly=false,opacity=1,joy=0,pixelMatte=false}={}){
 const pixelScale=Math.hypot(c.getTransform().a,c.getTransform().b)/r,eyeY=-.09,eyeX=.36,eyeR=.285;
 for(const side of [-1,1]){c.save();c.translate(side*eyeX,eyeY);c.scale(1,Math.max(.035,1-blink));const pupilX=.095*look,pupilY=mood==='curious'?-.055:0;
 c.fillStyle=inverse?'#273238':'#ecfff5';c.globalAlpha=(inverse?.04:.08)*opacity;c.shadowColor=inverse?'#232e34':'#defff0';c.shadowBlur=(inverse?1:10)*pixelScale;c.beginPath();c.ellipse(0,0,eyeR,eyeR*1.12,0,0,TAU);if(!pixelMatte&&mood!=='sleepy'&&(mood!=='wild'||joy>.3)&&mood!=='love')c.fill();c.shadowBlur=0;c.globalAlpha=opacity;
 const step=.017;for(let yy=-eyeR*1.15;yy<eyeR*1.15;yy+=step)for(let xx=-eyeR;xx<eyeR;xx+=step){const rr=(xx/eyeR)**2+(yy/(eyeR*1.12))**2,pupil=((xx-pupilX)/.086)**2+((yy-pupilY)/.102)**2;if(rr>1||(mood==='wild'&&yy<(-side*xx*.45-.03)-joy*.7))continue;const heartX=xx/(eyeR*.94),heartY=-yy/(eyeR*1.05),heartMask=(heartX*heartX+heartY*heartY-0.58)**3-heartX*heartX*heartY**3<0;if(mood==='love'&&!heartMask)continue;const sleepyMask=mood==='sleepy'&&Math.abs(yy-(.07-Math.abs(xx)*.55))>.025,wildMask=mood==='wild'&&yy>(.19-.06*(xx/eyeR)**2)+joy*.7;const lit=inverse?(rr>.52||pupil<1):mood==='sleepy'?!sleepyMask:mood==='wild'?(!wildMask&&(joy<.03||pupil>joy*joy)):mood==='love'?true:(pupil>1);if(lit){c.fillStyle=inverse?'#233039':'#eff6eb';c.beginPath();c.arc(xx,yy,inverse?.0064:.0074,0,TAU);c.fill();}}
 c.restore();}
 if(eyesOnly)return;
 c.strokeStyle=inverse?'#283137':'#effff4';c.lineWidth=.024;c.lineCap='round';c.shadowColor='#d5ffe9';c.shadowBlur=(inverse?1:6)*pixelScale;c.beginPath();if(inverse){c.moveTo(-.033,-.055);c.lineTo(.033,-.055);}else if(mood==='sleepy'){c.ellipse(0,-.015,.038,.055,0,0,TAU);}else if(mood==='curious'){c.ellipse(0,.28,.055,.077,0,0,TAU);}else if(mood==='wild'){c.moveTo(-.1-.03*joy,.26);c.quadraticCurveTo(0,.26+.18*joy,.1+.03*joy,.26);}else{c.moveTo(-.13,.23);c.quadraticCurveTo(0,.37,.13,.23);}c.stroke();c.shadowBlur=0;
}
/** Pixel-only emissive matte: colored short halo sits beneath the unchanged LED core. */
function ledFace(c,r,t,options={}){
 const pulse=(at,width)=>Math.exp(-(((t-at)/width)**4));
 const energy=Math.min(1,pulse(.57,.6)*.78+pulse(7.43,.23)*.9+pulse(8.32,.18)*.78);
 if(energy>.025){
  ledFace.matte??=document.createElement('canvas');const matte=ledFace.matte;matte.width=512;matte.height=384;const m=matte.getContext('2d');m.setTransform(320,0,0,320,256,192);
  ledFaceCore(m,r,t,{...options,pixelMatte:true});m.globalCompositeOperation='source-in';m.fillStyle=t<2?'#b4e3ff':t<8?'#ffa1d6':'#c7c4ff';m.fillRect(-1,-1,2,2);
  const screenScale=Math.hypot(c.getTransform().a,c.getTransform().b)/Math.max(1,r);
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=.17*energy;c.filter=`blur(${8.8*screenScale}px)`;c.drawImage(matte,-.8,-.6,1.6,1.2);
  c.globalAlpha=.28*energy;c.filter=`blur(${3.8*screenScale}px)`;c.drawImage(matte,-.8,-.6,1.6,1.2);c.restore();
 }
 ledFaceCore(c,r,t,options);
}
function mascot(c,{x,y,r=200,color='#12151e',kind='dot',mood='happy',look=0,t=0,sx=1,sy=1,rot=0,blink=0,shell=false,inverse=false,glowStrength=.45,eyesOnly=false,eyeOpacity=1,groundY=null,act={},fusion=null}={}){
 // Airy contact and rim aura are spatial compositing, never temporal blur.
 glow(c,x,y,r*1.35,color,glowStrength*.65);const foot=groundY??(y+r*1.08),rise=Math.max(0,foot-y-r),shadowScale=1/(1+rise/Math.max(1,r)*.7);c.save();c.globalAlpha=.19*shadowScale;c.fillStyle='#1c1136';c.filter='blur(9px)';c.beginPath();c.ellipse(x,foot,r*.75*shadowScale,r*.1*shadowScale,0,0,TAU);c.fill();c.restore();
 c.save();c.translate(x,y);c.rotate(rot);c.scale(r*sx,r*sy);const pixelScale=1;
 if(shell){const g=c.createLinearGradient(-1,-1,1,1);g.addColorStop(0,'#fffdf2');g.addColorStop(.46,'#ceced9');g.addColorStop(1,'#7c798c');c.fillStyle=g;c.shadowColor='#eee7ff';c.shadowBlur=22*pixelScale;c.beginPath();c.roundRect(-1.13,-1.13,2.26,2.26,.69);c.fill();c.shadowBlur=0;}
 const darkFusion=fusion??(t>=6.32&&t<10.93&&!(t>7.1&&t<8.2)?1:0);
 const outer=c;
 if(kind!=='dot'&&darkFusion>0){
  mascot.skin??=document.createElement('canvas');const skin=mascot.skin;skin.width=922;skin.height=1101;
  c=skin.getContext('2d');c.setTransform(256,0,0,256,461,640);
 }
 const colorful=kind!=='dot',core={bunny:'#6d244e',cloud:'#302647',spark:'#9c4719',mint:'#123e35'}[kind]||color;
 // Edge emission is generated by the actual silhouette; ears never sample an out-of-bounds white radial stop.
 if(colorful){
  outline(c,kind,t,act);c.fillStyle=color;c.shadowColor=color;c.shadowBlur=(darkFusion>0?108:72)*pixelScale;c.globalAlpha=darkFusion>0?.38:.48;c.fill();
  c.shadowBlur=25*pixelScale;c.globalAlpha=.85;c.fill();c.globalAlpha=1;c.shadowBlur=0;
 }
 outline(c,kind,t,act);c.fillStyle=inverse?color:colorful?color:core;c.fill();
 c.save();outline(c,kind,t,act);c.clip();
 // Broad body volume and ear pigment are separate from the luminous skin.
 // Subtle pigment drift within the same clipped silhouette; no pose or palette changes.
 const pigmentX=.048*Math.sin(t*.83+(kind==='bunny'?1.4:kind==='mint'?2.7:.3)),pigmentY=.035*Math.sin(t*.67+.8);
 const fill=c.createRadialGradient(.12+pigmentX,.03+pigmentY,.03,.1+pigmentX*.65,.02+pigmentY*.65,1.12);
 fill.addColorStop(0,inverse?'#f2f4ec':core);fill.addColorStop(.55,inverse?'#eff2e8':core);fill.addColorStop(.83,inverse?'#d5ded0':colorful?color:core);fill.addColorStop(1,inverse?'#bbc8bc':colorful?color:core);
 c.fillStyle=fill;c.fillRect(-1.4,-1.95,2.8,3.3);
 if(kind==='bunny'){
  const ear=c.createLinearGradient(0,-1.95,0,-.48);ear.addColorStop(0,'#ef93cf');ear.addColorStop(.32,'#df71b7');ear.addColorStop(.76,'#bc4b93');ear.addColorStop(1,'#bc4b9300');c.fillStyle=ear;c.fillRect(-1.2,-1.98,2.4,1.6);
 }
 if(colorful){
  const gloss=c.createRadialGradient(-.5+pigmentX*1.5,-.68+pigmentY,.01,-.5+pigmentX*1.5,-.68+pigmentY,.9);gloss.addColorStop(0,'#ffffff35');gloss.addColorStop(.38,'#ffffff12');gloss.addColorStop(1,'#ffffff00');c.fillStyle=gloss;c.fillRect(-1.3,-1.98,2.6,3.3);
  // A blurred rim travels asymmetrically instead of a uniform white vector stroke.
  c.shadowColor=color;c.shadowBlur=18*pixelScale;c.strokeStyle=color;c.lineWidth=darkFusion>0?.065:.045;outline(c,kind,t,act);c.stroke();c.shadowBlur=0;
 }
 const cell=.018,dotR=.0035;c.fillStyle=inverse?'#25343b48':'#d6fff114';for(let yy=-1.8;yy<1.5;yy+=cell)for(let xx=-1.5;xx<1.5;xx+=cell){c.beginPath();c.arc(xx,yy,dotR,0,TAU);c.fill();}c.restore();
 if(kind!=='dot'&&darkFusion>0){
  c.save();c.globalCompositeOperation='destination-in';
  const fusionMask=c.createLinearGradient(-1.45,-.65,.4,.5);
  const alpha={spark:.42,cloud:.24,bunny:.66,mint:.35}[kind]??.5;
  fusionMask.addColorStop(0,`rgba(255,255,255,${alpha})`);fusionMask.addColorStop(.26,`rgba(255,255,255,${alpha+.16})`);fusionMask.addColorStop(.65,'rgba(255,255,255,.95)');fusionMask.addColorStop(1,'white');
  c.fillStyle=fusionMask;c.fillRect(-1.81,-2.5,3.62,4.31);c.restore();
  c=outer;c.drawImage(mascot.skin,-461/256,-640/256,922/256,1101/256);
 }
 // The emissive face is soft at the edge but crisp enough to resolve its grid in close-ups.
 c.save();c.translate(act.faceX||0,act.faceY||0);ledFace(c,r,t,{mood,look,blink,inverse,eyesOnly,opacity:eyeOpacity});c.restore();
 if(kind==='mint'){c.strokeStyle=color;c.lineWidth=.045;c.beginPath();c.moveTo(0,-.96);c.quadraticCurveTo(.16+(act.antenna||0),-1.22,.08+(act.antenna||0),-1.39);c.shadowColor='#e3ffc5';c.shadowBlur=13*pixelScale;c.stroke();circle(c,.08+(act.antenna||0),-1.39,.075,'#e1ffca');c.strokeStyle='#d6ffc9';for(const side of [-1,1]){c.beginPath();c.moveTo(side*.93,-.1);c.quadraticCurveTo(side*1.17,-.23,side*1.29,-.05);c.quadraticCurveTo(side*1.17,.1,side*.95,.07);c.stroke();}}
 c.restore();
}
function dust(c,t,col='#fffaf0',centre=960,width=1600){c.save();c.fillStyle=col;for(let i=0;i<45;i++){const x=centre+Math.sin(i*18.319)*width*.5,y=70+(i*173.27+t*(13+i%5*3))%960;c.globalAlpha=.08+.18*((i*13)%7)/7;circle(c,x,y,1.3+(i%3)*.6,col);}c.restore();}
function scene(c,col,t=0){c.fillStyle=col;c.fillRect(0,0,1920,1080);if(col===C.dark||col===C.violet){const driftX=22*Math.sin(t*.31),driftY=14*Math.sin(t*.27+.5);const light=c.createRadialGradient(760+driftX,420+driftY,20,920+driftX*.6,470+driftY*.6,1300);light.addColorStop(0,col===C.dark?'#2a264d55':'#a99aff16');light.addColorStop(.7,'#00000000');light.addColorStop(1,'#00000018');c.fillStyle=light;c.fillRect(0,0,1920,1080);}}

const smoother=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const prog=(t,a,b)=>smoother((t-a)/(b-a));
const softBlink=(t,at,width)=>t<=at?smoother((t-at+width*.8)/(width*.8)):1-smoother((t-at)/(width*1.35));
const bell=(t,a,b)=>Math.sin(Math.PI*clamp((t-a)/(b-a)));
function colour(a,b,q){return '#'+[1,3,5].map(i=>Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),q)).toString(16).padStart(2,'0')).join('');}
function wipe(c,col,q,x=1450,y=550){if(q<=0)return;circle(c,x,y,2450*smoother(q),col);}
function word(c,s,x,y,size,col,t,at){c.save();c.translate(x,y);for(let i=0;i<s.length;i++){const q=clamp((t-at-i*.035)/.36),off=Math.sin(q*Math.PI)*(-.05);c.save();c.translate(i*size*.72,(1-spring(q))*size*.55);c.rotate(off);txt(c,s[i],0,0,size,col);c.restore();}c.restore();}
function graphicDial(c,x,y,r,t,collapse=0){
 c.save();c.translate(x,y);c.scale(r/375,r/375);
 c.save();c.shadowColor='#070517aa';c.shadowBlur=30;c.shadowOffsetY=17;
 const g=c.createLinearGradient(-310,-350,320,390);g.addColorStop(0,'#fffdf8');g.addColorStop(.4,'#f3eee6');g.addColorStop(.78,'#dad4d2');g.addColorStop(1,'#aaa4b3');c.fillStyle=g;c.beginPath();c.arc(0,0,375,0,TAU);c.fill();c.restore();
 c.strokeStyle='#fffdf0';c.lineWidth=5;c.beginPath();c.arc(0,0,364,-3.1,-.2);c.stroke();const g2=c.createRadialGradient(-65,-65,160,0,0,345);g2.addColorStop(0,'#f6f2eb');g2.addColorStop(.8,'#eee9e3');g2.addColorStop(1,'#bab3bd');circle(c,0,0,344,g2);
 for(let i=0;i<60;i++){const a=i/60*TAU-TAU/4,d=(i%5===0?315:330)*(1-.7*smoother(collapse));c.strokeStyle=i%5===0?'#46404f':'#918691';c.lineWidth=i%5===0?3:1.2;c.beginPath();c.moveTo(Math.cos(a)*d,Math.sin(a)*d);c.lineTo(Math.cos(a)*341*(1-.7*smoother(collapse)),Math.sin(a)*341*(1-.7*smoother(collapse)));c.stroke();}
 const a=-1.57+(t-11)*1.5;c.strokeStyle='#b77b2e';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(-Math.cos(a)*35,-Math.sin(a)*35);c.lineTo(Math.cos(a)*298*(1-prog(collapse,0,.55)),Math.sin(a)*298*(1-prog(collapse,0,.55)));c.stroke();circle(c,0,0,10,C.orange);c.restore();
}
const dotControlDefaults={characterScale:1,actingStrength:1,lensMotion:1,glowStrength:1};
function dotControls(parameters){
 const source=parameters.sceneControls??{},bounds={characterScale:[.8,1.15],actingStrength:[0,1.5],lensMotion:[0,1.5],glowStrength:[0,1.5]};
 return Object.fromEntries(Object.entries(dotControlDefaults).map(([key,fallback])=>[key,Number.isFinite(source[key])?Math.max(bounds[key][0],Math.min(bounds[key][1],source[key])):fallback]));
}
function cameraPoseAt(time,parameters={}){
 const graphicTime=clamp(Number.isFinite(parameters.renderSample?.frameTime)?parameters.renderSample.frameTime:time,0,16);
 const cameraTime=sampleAnimationGroupTime(parameters,'camera',graphicTime),pose=compositionPose(cameraTime),strength=dotControls(parameters).lensMotion;
 if(strength!==1){pose.x*=strength;pose.y*=strength;pose.roll*=strength;pose.scale=1+(pose.scale-1)*strength;}
 return pose;
}
const cameraChannels=[
 {id:'camera.position.x',label:'Camera center X',unit:'px'},
 {id:'camera.position.y',label:'Camera center Y',unit:'px'},
 {id:'camera.zoom',label:'Camera zoom',unit:'scale'},
 {id:'camera.roll',label:'Camera roll',unit:'rad'}
];
export function createMascotDemo(){
 let device,controls=dotControlDefaults;
 // Scale character expression and pose offsets, never the authored cut times.
 function drawMascot(c,pose){
  const strength=controls.actingStrength;
  const adapted={...pose,r:(pose.r??200)*controls.characterScale,glowStrength:(pose.glowStrength??.45)*controls.glowStrength};
  if(strength!==1){adapted.sx=1+((pose.sx??1)-1)*strength;adapted.sy=1+((pose.sy??1)-1)*strength;adapted.rot=(pose.rot??0)*strength;adapted.look=(pose.look??0)*strength;if(pose.act)adapted.act=Object.fromEntries(Object.entries(pose.act).map(([key,value])=>[key,typeof value==='number'?value*strength:value]));}
  mascot(c,adapted);
 }
 function render(c,time,p={},w=1920,h=1080){controls=dotControls(p);const t=Math.max(0,Math.min(16,time));const graphicTime=Math.max(0,Math.min(16,p.renderSample?.frameTime??t)),characterTime=sampleAnimationGroupTime(p,'character',t),characterGraphicTime=sampleAnimationGroupTime(p,'character',graphicTime);let displayContour=null;c.save();c.scale(w/1920,h/1080);const lens=cameraPoseAt(t,p);c.translate(960+lens.x,540+lens.y);c.rotate(lens.roll);c.scale(lens.scale,lens.scale);c.translate(-960,-540);
 // A single optical journey. The hero is the punctuation, grows, then opens the cast.
 if(t<6.32){
  scene(c,C.cream,graphicTime);
  const growth=prog(t,2.96,3.69),n=clamp((t-3.66)/.78),stage=Math.min(2,Math.floor(Math.max(0,t-3.64)/.78));
  wipe(c,C.orange,clamp((t-3.08)/.43),1380,550);
  if(t>4.36){const q=prog(t,4.36,4.58);dotPixelWipe(c,C.mint,q);}
  if(t>5.14){const q=prog(t,5.14,5.36);dotPixelWipe(c,C.violet,q);}
  if(!p.review||p.review==='beauty')drawDotPixels(c,graphicTime,'back');
  const logoOut=prog(t,2.92,3.44);c.save();c.translate(-logoOut*1750,0);word(c,'DOT',550,640,300,'#161320',t,1.81);c.globalAlpha=prog(t,2.13,2.46);mono(c,'A TINY CHARACTER. A BIG PERSONALITY.',960,765,25,C.violet,'center');c.restore();
  if(t>3.2){const u=t-3.64,slot=(u/.78),k=Math.min(2,Math.floor(Math.max(0,slot))),phase=clamp((u-k*.78)/.23),ink=k<2?'#191725':C.cream;
   c.save();c.beginPath();c.rect(100,156,670,610);c.clip();const enter=prog(t,3.27,3.63);c.translate(0,670*(1-enter));if(k>0&&phase<1)txt(c,String(k),115,740-650*ease(phase),650,ink);txt(c,String(k+1),115,740+650*(1-ease(phase)),650,ink);c.restore();
   title(c,['BABY','TEEN','BESTIE'][k],126,893,92,ink,t,3.54+k*.78);c.save();c.globalAlpha=prog(t,3.57+k*.78,3.75+k*.78);mono(c,['JUST GETTING STARTED.','HAS OPINIONS.','KNOWS YOU.'][k],134,951,23,ink);c.restore();
  }
  const retract=prog(t,1.46,2.23),jump=bell(t,2.87,3.7),exit=prog(t,5.9,6.32);
  const [x,y,r]=heroPose(characterTime),inv=t>3.28&&t<5.2,baseInk=inv?'#eef0e7':'#171425',ink=colour(baseInk,'#873c13',prog(t,6.13,6.32));
  drawMascot(c,{x,y,r,t:characterTime,color:ink,inverse:inv,kind:'dot',look:mix(-.8,.4,prog(characterTime,.35,.85))-.9*prog(characterTime,2.96,3.69),blink:bump(characterTime,1.29,.08)+bump(characterTime,3.28,.12)+prog(characterTime,6.05,6.14)*(1-prog(characterTime,6.35,6.45)),mood:stage===0&&t>3.4?'curious':'happy',sx:1+.15*bell(characterTime,2.88,3.4),sy:1-.17*bell(characterTime,2.88,3.4),rot:-.09*bell(characterTime,2.87,3.7),glowStrength:t<1.7?0:.1,eyesOnly:t<1.7||t>6.06,eyeOpacity:prog(characterTime,.06,.38)});
  if(t<1.5){c.save();c.globalAlpha=prog(t,.1,.4)*(1-prog(t,1.08,1.45));mono(c,'EYE KNOW.',960,974,25,'#c7c7d2','center');c.restore();}
  // The outgoing body becomes the dark field; no whole-frame cross dissolve.

 }
 if(t>=6.32&&t<10.93){
  const castAt=8.87,wide=prog(t,castAt,9.65),castWide=prog(characterTime,castAt,9.65),colors=[C.orange,C.pink,'#7b80dd',C.mint],kinds=['spark','bunny','cloud','mint'],moods=['wild','love','sleepy','curious'];
  scene(c,C.dark,graphicTime);const pinkIn=prog(t,7.1,7.36),pinkOut=prog(t,7.99,8.2);wipe(c,C.cream,pinkIn,625,550);wipe(c,C.dark,pinkOut,625,550);
  if(!p.review||p.review==='beauty')drawDotPixels(c,graphicTime,'back');
  let which=t<7.22?0:t<8.13?1:2;
  for(let i=0;i<4;i++){
   const local=characterTime-[6.32,7.22,8.13,9.05][i],entry=prog(local,-.11,.21),exit=prog(local,.70,1.0),isActive=i===which;
   const takeoff=9.85+i*.17,flight=clamp((characterTime-takeoff)/.49),wave=Math.sin(Math.PI*flight)**1.1,anticipation=bell(characterTime,takeoff-.13,takeoff),landTime=Math.max(0,characterTime-takeoff-.49),landingRebound=characterTime>takeoff+.49?Math.sin(landTime*23)*Math.exp(-landTime*15):0;const castSquash=.14*anticipation+.065*landingRebound-.095*Math.sin(Math.PI*flight);const endX=340+i*390+18*Math.sin(Math.PI*flight)*(i%2?1:-1),endY=664-(i===1?134:i===2?112:140)*wave+12*Math.sin((characterTime-9.3)*2+i);
   let x=625,y=583-95*bell(local,-.12,.42),r=238;if(i===0&&t<7.03){[x,y,r]=personalityPose(characterTime);}
   if(i<=which){y-=exit*1250;x+=110*exit;}else y+=1250*(1-entry);
   if(i===3){x=2100;y=680;}
   x=mix(x,endX,castWide);y=mix(y,endY,castWide);r=mix(r,170,castWide);
   if(t<castAt&&(i>which||i<which-1))continue;
   const landing=Math.exp(-Math.max(0,local)*5)*Math.sin(Math.max(0,local)*12),breath=Math.sin(characterTime*2.1+i)*.018;
   drawMascot(c,{x,y,r,t:characterTime,color:colors[i],kind:kinds[i],mood:moods[i],look:i===which?-.3+Math.sin(local*2.5)*.55:Math.sin(characterTime+i)*.55,blink:i===0&&t<6.46?prog(characterTime,6.05,6.14)*(1-prog(characterTime,6.35,6.45)):i===2?.25:softBlink((characterTime+i*.19)%2,1.7,.07),sx:1-.14*landing+breath+castSquash*castWide,sy:1+.24*landing-breath-castSquash*castWide,eyesOnly:i===0&&t<6.4,groundY:mix(865,854,castWide),rot:(.06*Math.sin(local*4)*Math.exp(-Math.max(0,local)*2))*(1-castWide)+(.022*Math.sin(characterTime*2+i)+.085*Math.sin(Math.PI*flight)*(i%2?1:-1))*castWide,glowStrength:.15,act:characterActing(characterTime,local,flight,i)});
   if(i===1&&isActive&&wide<.4){for(let j=0;j<3;j++){const u=clamp((local-.22-j*.12)/.7);c.save();c.globalAlpha=Math.sin(u*Math.PI)*.7;txt(c,'♥',650+80*Math.sin(j*2+u),250-u*170,19+18*u,C.pink,'center');c.restore();}}
   if(i===2&&isActive&&wide<.4){for(let j=0;j<3;j++){const u=(Math.max(0,local)*.7+j*.28)%1;c.save();c.globalAlpha=Math.sin(Math.PI*u);txt(c,'z',810+u*110,360-u*180,35+25*u,'#a1bff2','center',600);c.restore();}}
  }
  c.save();c.translate(0,-900*prog(t,8.86,9.24));const local=t-[6.32,7.22,8.13][which],delay=which===0?.31:.1;title(c,['GRUMP.','LOOP.','DOZE.'][which],1020,602,159,which===1?'#181523':C.cream,local,delay);c.globalAlpha*=(prog(local,delay+.05,delay+.28));mono(c,['HAS A LITTLE ATTITUDE.','A LITTLE EXTRA LOVE.','DO NOT DISTURB.'][which],1035,677,22,which===1?'#353142':'#b6b2c9');c.restore();
  c.save();c.globalAlpha=wide;title(c,'Every mood.',510,165,117,C.cream,t,9.6);mono(c,'FOUR PERSONALITIES. ONE DOT.',960,955,24,C.cream,'center');c.restore();
 }
 if(t>=10.93){
  scene(c,C.dark,graphicTime);const g=prog(t,10.93,12.04),product=prog(characterTime,13.3,14.55),clockExit=prog(t,13.27,13.86),cx=mix(1310,620,product),cy=550+Math.sin(product*Math.PI)*75;
  // Hold the2D wipe at exposure center; only the physical device is temporally sampled.
  const graphicProduct=prog(graphicTime,13.3,14.55),graphicX=mix(1310,620,graphicProduct),graphicY=550+Math.sin(graphicProduct*Math.PI)*75;
  wipe(c,C.violet,clamp((graphicTime-13.56)/.6),graphicX,graphicY);
  if(!p.review||p.review==='beauty')drawDotPixels(c,graphicTime,'back');
  const dialTrace=prog(t,11.12,11.96);if(t<12.1&&dialTrace>0){c.save();c.strokeStyle='#b6b0c76a';c.lineWidth=3;c.beginPath();c.arc(1310,550,375,-Math.PI/2,-Math.PI/2+TAU*dialTrace);c.stroke();c.restore();}const cScale=prog(t,11.48,12.04)*(t<12.19?1:0);if(cScale>0.001)graphicDial(c,1310,550,375*cScale,t);
  c.save();c.globalAlpha=1-prog(t,10.93,11.32);txt(c,'Every mood.',510,165,117,C.cream);mono(c,'FOUR PERSONALITIES. ONE DOT.',960,955,24,C.cream,'center');c.restore();
  c.save();c.globalAlpha=prog(t,11.66,12.02)*(1-prog(t,13.2,13.58));title(c,'Lives',220,375,118,C.cream,t,11.62);title(c,'your day.',220,507,118,C.cream,t,11.7);const digits=String(Math.floor(3+Math.max(0,t-11.55)*14)).padStart(2,'0');txt(c,'17:'+digits,222,725,146,C.orange);mono(c,'PLAY TIME — IT IS.',228,797,23,C.cream);c.restore();
  const colors=[C.orange,C.pink,'#7b80dd',C.mint],kinds=['spark','bunny','cloud','mint'],moods=['wild','love','sleepy','curious'];
  for(let i=3;i>=0;i--){
   const angle=-TAU/4+(i-1)*TAU/3+Math.max(0,characterTime-12.04)*.5,a=i===0?0:angle;
   const gi=prog(characterTime,10.93+i*.055,11.87+i*.055),arc=Math.sin(Math.PI*gi);const x=mix(340+i*390,i===0?1310:1310+Math.cos(a)*203,gi)+arc*(i-1.5)*28,y=mix(664+12*Math.sin((characterTime-9.3)*2+i),i===0?550:550+Math.sin(a)*203,gi)-arc*(160+i*34),r=mix(170,i===0?60:43,smoother(gi));
   if(i>0&&product>.01){const fly=prog(characterTime,13.35+i*.055,14.02+i*.045);drawMascot(c,{x:mix(x,cx,fly),y:mix(y,cy,fly),r:mix(r,20,fly),t:characterTime,color:colors[i],kind:kinds[i],mood:moods[i],sx:1,sy:1,rot:(i-2)*.12*fly,glowStrength:.14});}
   else if(i>0&&t<13.32)drawMascot(c,{x,y,r,t:characterTime,color:colors[i],kind:kinds[i],mood:moods[i],look:-Math.cos(a)*.7,glowStrength:.1});
   if(i===0){
    const rr=mix(358,315,product);
    if(t>12.02){if(product>.24){const reveal=prog(characterGraphicTime,13.85,14.55);drawMascot(c,{x:graphicX-85*reveal,y:graphicY-80*reveal,r:335*reveal,t:characterGraphicTime,color:C.orange,kind:'spark',mood:'wild',rot:-.08*reveal,glowStrength:.12});}device??=createDotDevice(ledFace,(ctx,tt,q)=>{graphicDial(ctx,384,384,384,tt,q);drawMascot(ctx,{x:384,y:384,r:64,t:tt,color:C.orange,kind:'spark',mood:'wild',glowStrength:0});for(let j=1;j<4;j++){const aa=-TAU/4+(j-1)*TAU/3+Math.max(0,tt-12.04)*.5;drawMascot(ctx,{x:384+Math.cos(aa)*208,y:384+Math.sin(aa)*208,r:44,t:tt,color:colors[j],kind:kinds[j],mood:moods[j],glowStrength:0});}});displayContour=device.render(c,cx,cy,rr,characterTime,prog(t,12.02,12.19),1-product)?.displayContour;}
    else drawMascot(c,{x,y,r,t:characterTime,color:colors[0],kind:'spark',mood:'wild',look:-.4,glowStrength:.1});
   }
  }
  if(graphicTime>14.13){title(c,'DOT.',1170,595,222,C.cream,graphicTime,14.13);c.save();c.globalAlpha=prog(graphicTime,14.39,14.7);txt(c,'made with motion lab',1180,664,38,C.cream,'left',700);c.restore();c.save();const badge=prog(graphicTime,14.59,14.91);c.globalAlpha=badge;c.translate(0,22*(1-badge));c.fillStyle=C.cream;c.beginPath();c.roundRect(1180,713,405,72,36);c.fill();txt(c,'free + open source',1382,760,29,C.violet,'center',700);c.restore();}
 }
 if(!p.review||p.review==='beauty')drawDotPixels(c,graphicTime,'front',{protectDisplay:displayContour});
 c.restore();if(!p.review||p.review==='beauty')applyDotOptics(c,graphicTime,w,h);return {chapter:mascotCuts.filter(x=>x<=t).length-1,local:t};
 }
 return {render,animationChannels(groupId){return groupId==='camera'?cameraChannels.map(channel=>({...channel})):[];},animationState(groupId,time,parameters={}){if(groupId!=='camera')return{};const pose=cameraPoseAt(time,parameters);return{'camera.position.x':960+pose.x,'camera.position.y':540+pose.y,'camera.zoom':pose.scale,'camera.roll':pose.roll};}};
}
