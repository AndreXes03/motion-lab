import {graphicControls} from './graphic-controls.js';
import {smoother,spliceMotion,arcEnvelope,replayEditTime} from './replay-motion-curves.js';
import {replayPaperFormat} from './replay-paper-format.js';
import {createReplayIllustrations} from './replay-illustrations.js';
import {replayCardPose,replayHeroCue,replayHeadlineWeight,replayPosterLine} from './replay-motion-direction.js';
import {createReplayCardWorld} from './replay-card-world.js';
import {replayCameraPose} from './replay-camera-rail.js';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
// Editable editorial nostalgia film. Absolute-time animation; no motion blur.
export const replayConfig={duration:15,fps:30,width:1920,height:1080,seed:16};
export const replayCuts=[0,2.4,5.4,7.7,9.4,11.4,13.2];
const C={cream:'#e9e6df',red:'#d63e39',ink:'#161616',pink:'#efb4c6',blue:'#777bdb',mint:'#acd4b9',yellow:'#f4df87'};
let artTime=0,illustrations,textReveal=1;
const TAU=Math.PI*2;
function rect(c,x,y,w,h,col,r=0){c.fillStyle=col;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
function disc(c,x,y,r,col){c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
function headline(c,s,x,y,size){c.save();c.translate(x,0);c.scale(.87,1);type(c,s,0,y,size,C.ink,'"Arial Black", Arial','900');c.restore();}
function line(c,points,col,width=3){c.strokeStyle=col;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...p));c.stroke()}
function type(c,s,x,y,size,col=C.ink,font='Arial',weight='900',align='left'){c.save();c.fillStyle=col;c.font=`${weight} ${size}px ${font}`;c.textAlign=align;if(textReveal<1){const width=c.measureText(s).width,left=align==='center'?x-width/2:align==='right'?x-width:x;c.beginPath();c.rect(left-5,y-size*1.1,width+10,size*1.36);c.clip();c.translate(0,size*1.32*(1-textReveal));}c.fillText(s,x,y);c.restore();}
function vinyl(c,x,y,r,angle=0){c.save();c.translate(x,y);c.rotate(angle);disc(c,0,0,r,'#171719');for(let k=0;k<29;k++){c.strokeStyle=k%3?'#303036':'#444448';c.lineWidth=1.3;c.beginPath();c.arc(0,0,r*(.35+.021*k),0,TAU);c.stroke()}const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#ffffff00');g.addColorStop(.35,'#ffffff18');g.addColorStop(.5,'#ffffff00');g.addColorStop(.72,'#ffffff11');g.addColorStop(1,'#ffffff00');disc(c,0,0,r,g);disc(c,0,0,r*.29,C.red);disc(c,0,0,r*.065,C.cream);c.restore()}
function art(c,id,transparent=false,format=[250,300]){ // 250 by 300 original miniature illustrations
 const rendered=transparent?illustrations?.getTransparent(id):illustrations?.get(id);if(rendered){c.drawImage(rendered,-125,-150,250,300);return;}
 const [fw,fh]=format;const palettes=[C.pink,C.blue,C.yellow,C.mint,'#a6bace','#b95a57','#cfbfe6','#e2b27d'];if(!transparent){rect(c,-fw/2,-fh/2,fw,fh,palettes[id%8]);const light=c.createLinearGradient(-125,-150,125,150);light.addColorStop(0,'#ffffff26');light.addColorStop(.5,'#ffffff00');light.addColorStop(1,'#1e163410');rect(c,-fw/2,-fh/2,fw,fh,light);}
 c.save();c.shadowColor='#22222225';c.shadowBlur=12;c.shadowOffsetY=6;
 switch(id%21){
 case 0: // camera
 rect(c,-98,-36,196,112,'#f5e9df',14);rect(c,-87,-61,65,30,'#b64267',6);rect(c,-95,-18,190,48,'#c45678');disc(c,10,18,53,'#772642');disc(c,10,18,40,'#be5875');disc(c,10,18,29,'#402836');disc(c,3,8,13,'#8497b7');disc(c,-66,-16,10,'#ece9da');break;
 case 1: // ferris wheel
 c.shadowBlur=0;line(c,[[-66,136],[0,-70],[65,136]],'#282862',7);for(let j=0;j<12;j++){const a=j*TAU/12+artTime*.13;line(c,[[0,-12],[88*Math.cos(a),-12+88*Math.sin(a)]],'#343e8e',2);rect(c,88*Math.cos(a)-10,-12+88*Math.sin(a)-2,20,18,'#36367b',3)}c.strokeStyle='#41408e';c.lineWidth=5;c.beginPath();c.arc(0,-12,88,0,TAU);c.stroke();rect(c,-125,137,250,13,'#323267');break;
 case 2: // icecream
 c.fillStyle='#cc9f43';c.beginPath();c.moveTo(-45,5);c.lineTo(45,5);c.lineTo(0,125);c.fill();for(let j=0;j<6;j++)line(c,[[-38+j*12,18],[5+j*4,100-j*12]],'#ac853a',2);disc(c,0,-30,56,'#faedb4');disc(c,0,-82,38,'#fff3bf');disc(c,-10,-91,15,'#fff9dd');break;
 case 3: // bike
 c.shadowBlur=0;for(const x of [-64,65]){disc(c,x,61,46,'#3a352c');disc(c,x,61,39,C.cream);disc(c,x,61,4,'#382c27');for(let k=0;k<12;k++){let a=k*TAU/12+artTime*.8;line(c,[[x,61],[x+Math.cos(a)*38,61+Math.sin(a)*38]],'#786d5930',1)}}line(c,[[-64,61],[-29,-5],[22,61],[-64,61],[51,-5],[65,61]],'#a45d38',7);line(c,[[-44,-8],[-13,-8]],'#40352d',7);line(c,[[51,-5],[45,-32],[72,-32]],'#40352d',5);break;
 case 4: // sunset water
 {const g=c.createLinearGradient(0,-150,0,150);g.addColorStop(0,'#cf443d');g.addColorStop(1,'#641e3b');rect(c,-fw/2,-fh/2,fw,fh,g);disc(c,0,-15,61,'#f2c8ab');rect(c,-fw/2,15,fw,fh/2-15,'#8d343d');for(let j=0;j<17;j++){const v=1-j/18;rect(c,-(55*v+10),18+j*7,110*v+20,2,'#e3a58c')}break;}
 case 5: // vinyl
 vinyl(c,0,0,105,-.2);break;
 case 6: // palms
 c.shadowBlur=0;line(c,[[-42,135],[-19,-48]],'#93495e',9);line(c,[[63,135],[49,-52]],'#93495e',7);for(const x of [-19,49])for(let j=0;j<7;j++){const a=3.4+j*.36;line(c,[[x,-48],[x+Math.cos(a)*68,-48+Math.sin(a)*26],[x+Math.cos(a)*95,-27]],'#7c465c',4)}break;
 case 7: // headphones
 c.strokeStyle='#99502f';c.lineWidth=14;c.beginPath();c.arc(0,-10,70,Math.PI,TAU);c.stroke();rect(c,-83,-15,33,85,'#7d3927',13);rect(c,50,-15,33,85,'#7d3927',13);rect(c,-75,-10,15,74,'#e7a36b',8);rect(c,60,-10,15,74,'#e7a36b',8);break;
 case 8: // flower
 for(let j=0;j<16;j++){c.save();c.rotate(j*TAU/16+artTime*.08);c.fillStyle='#f4f4e2';c.beginPath();c.ellipse(0,-65,16,42,0,0,TAU);c.fill();c.restore()}disc(c,0,0,37,'#dec55a');for(let j=0;j<38;j++)disc(c,Math.sin(j*7)*28,Math.cos(j*13)*28,2,'#b89630');break;
 case 9: // umbrella
 line(c,[[0,6],[0,137]],'#747396',4);for(let j=0;j<8;j++){c.fillStyle=j%2?'#f4ede3':'#6969a2';c.beginPath();c.moveTo(0,6);c.arc(0,6,104,Math.PI+j*Math.PI/8,Math.PI+(j+1)*Math.PI/8);c.fill()}break;
 case 10: // cassette
 rect(c,-108,-70,216,145,'#f4edcf',12);rect(c,-91,-54,182,64,'#393943',5);for(const x of [-49,49]){disc(c,x,-22,24,'#a3a2a1');disc(c,x,-22,15,'#37343f');for(let j=0;j<6;j++)disc(c,x+Math.cos(j)*10,-22+Math.sin(j)*10,3,'#e8e0c7')}rect(c,-70,34,140,30,'#be6757',5);break;
 case 11: // pizza
 c.fillStyle='#e8c371';c.beginPath();c.moveTo(0,-120);c.lineTo(-102,114);c.lineTo(102,114);c.closePath();c.fill();for(let j=0;j<7;j++)disc(c,Math.sin(j*4)*(22+j*7),-50+j*23,14,'#b84932');line(c,[[-102,114],[102,114]],'#b78443',21);break;

 case 12: // skyline at dusk
 {const g=c.createLinearGradient(0,-150,0,150);g.addColorStop(0,'#ce7a87');g.addColorStop(1,'#f0b087');rect(c,-fw/2,-fh/2,fw,fh,g);disc(c,70,-63,44,'#f3d9b4');for(let j=0;j<11;j++){const x=-126+j*25,hh=60+(j*73%115);rect(c,x,150-hh,22,hh,j%2?'#413848':'#2f3444');for(let k=0;k<hh/19;k++)rect(c,x+7,148-hh+k*19,5,7,'#dea985')}break;}
 case 13: // moon and stars
 rect(c,-fw/2,-fh/2,fw,fh,'#354583');disc(c,0,-16,76,'#ece6cb');for(let j=0;j<17;j++){const a=j*2.399,r=55*Math.sqrt(j/17);disc(c,Math.cos(a)*r,-16+Math.sin(a)*r,5+j%6,'#cdcab5')}for(let j=0;j<18;j++)disc(c,-110+j*47%220,-133+j*67%265,1.6,'#f6e9a9');break;
 case 14: // balloon
 {const g=c.createRadialGradient(-28,-58,8,0,-35,94);g.addColorStop(0,'#ffc3c3');g.addColorStop(.3,'#ef7474');g.addColorStop(1,'#ae364a');c.fillStyle=g;c.beginPath();c.ellipse(0,-45,71,93,-.1,0,TAU);c.fill();line(c,[[0,48],[-12,65],[-4,88],[4,118],[-2,150]],'#65536a',2);break;}
 case 15: // beach chair
 line(c,[[-80,135],[15,-75],[55,135]],'#f5eddb',8);line(c,[[15,-75],[88,-75],[5,135]],'#f5eddb',8);rect(c,-46,-67,94,144,'#e1b783');for(let j=0;j<7;j++)rect(c,-46+j*14,-67,7,144,'#eee9d9');break;
 case 16: // lemonade
 {const g=c.createLinearGradient(-60,0,60,0);g.addColorStop(0,'#ffffefcc');g.addColorStop(.3,'#f6e49f');g.addColorStop(.8,'#ddbd63');g.addColorStop(1,'#ffffea');rect(c,-59,-50,118,168,g,7);rect(c,-53,-91,106,53,'#eeecda99',7);c.strokeStyle='#fffdf199';c.lineWidth=3;c.strokeRect(-59,-90,118,207);line(c,[[30,-7],[39,-126],[72,-142]],'#bc695b',7);for(let j=0;j<12;j++)disc(c,-40+j*37%80,-50+j*17%145,3,'#fffbd7');disc(c,-49,-67,34,'#ead577');disc(c,-49,-67,28,'#f5e7a9');break;}
 case 17: // roller skate
 rect(c,-77,-85,90,140,'#6b93ba',17);rect(c,-77,16,182,71,'#759dc4',17);rect(c,-88,77,200,14,'#d6d4d0',4);for(const x of[-57,72]){disc(c,x,102,27,'#ec947e');disc(c,x,102,12,'#e2c59e')}for(let j=0;j<5;j++)line(c,[[-53,-56+j*17],[4,-56+j*17]],'#e5dfcb',5);break;
 case 18: // tennis ball
 {const g=c.createRadialGradient(-27,-42,5,0,0,96);g.addColorStop(0,'#e5ecaa');g.addColorStop(.4,'#bac86b');g.addColorStop(1,'#7e9949');disc(c,0,0,96,g);c.strokeStyle='#ececd4';c.lineWidth=8;c.beginPath();c.arc(-122,0,157,-.64,.64);c.stroke();c.beginPath();c.arc(122,0,157,Math.PI-.64,Math.PI+.64);c.stroke();break;}
 case 19: // strawberry
 {const g=c.createLinearGradient(-60,-80,60,100);g.addColorStop(0,'#f2b7a0');g.addColorStop(.3,'#d55852');g.addColorStop(1,'#943d47');c.fillStyle=g;c.beginPath();c.moveTo(0,115);c.bezierCurveTo(-115,0,-96,-76,0,-62);c.bezierCurveTo(96,-76,115,0,0,115);c.fill();for(let j=0;j<30;j++)disc(c,Math.sin(j*3.8)*(55-j*.9),-45+j*4.5,2.6,'#efd398');for(let j=0;j<5;j++){c.save();c.translate(0,-65);c.rotate(j*TAU/5);c.fillStyle='#698c6c';c.beginPath();c.ellipse(0,-23,12,32,0,0,TAU);c.fill();c.restore()}break;}
 case 20: // butterfly
 for(const side of[-1,1]){c.fillStyle='#9994cb';c.beginPath();c.ellipse(side*39,-29,47,63,side*.6,0,TAU);c.fill();c.fillStyle='#b9b4df';c.beginPath();c.ellipse(side*36,47,35,43,-side*.4,0,TAU);c.fill();for(let j=0;j<5;j++)disc(c,side*(22+j*7),-45+j*18,4,'#eadde0')}rect(c,-5,-71,10,142,'#5c5471',5);line(c,[[0,-65],[-15,-103]],'#5c5471',2);line(c,[[0,-65],[15,-103]],'#5c5471',2);break;
 }c.restore();
}
const smoothGlyph=smoother;
const cardImages=new Map();
function cardImage(id){if(!cardImages.has(id)){const image=document.createElement('canvas');const [w,h]=replayPaperFormat(id).map(x=>x*250);image.width=Math.round(w*3);image.height=Math.round(h*3);const ctx=image.getContext('2d');ctx.scale(3,3);ctx.translate(w/2,h/2);art(ctx,id,false,[w,h]);cardImages.set(id,image);}return cardImages.get(id);}
let cardWorld;
const replayControls=parameters=>graphicControls('replay',parameters);
export function controlledCardPose(id,t,controls){
 const pose=replayCardPose(id,t);
 if(controls.cardSpread!==1){pose.x=960+(pose.x-960)*controls.cardSpread;pose.y=540+(pose.y-540)*controls.cardSpread;}
 if(controls.cardTilt!==1){pose.rotation*=controls.cardTilt;pose.yaw*=controls.cardTilt;pose.pitch*=controls.cardTilt;}
 if(controls.cardScale!==1)pose.scale*=controls.cardScale;
 if(controls.cardDepth!==1)pose.z*=controls.cardDepth;
 return pose;
}
function finishingTravel(t,strength=1){const finish=Math.max(0,t-11.4),ramp=smoother(finish/.32);return finish*ramp*strength;}
function cameraPoseAt(time,parameters={}){
 const outputTime=replayEditTime(time),cameraTime=replayEditTime(sampleAnimationGroupTime(parameters,'camera',time));
 return {pose:replayCameraPose(cameraTime),outputTime,cameraTime,travel:outputTime>=11.4?finishingTravel(cameraTime,replayControls(parameters).finishPush):0};
}
const cameraChannels=[
 ...['x','y','z'].map(axis=>({id:`camera.position.${axis}`,label:`Camera position ${axis.toUpperCase()}`,unit:'scene units'})),
 ...['x','y','z'].map(axis=>({id:`camera.target.${axis}`,label:`Camera target ${axis.toUpperCase()}`,unit:'scene units'})),
 {id:'camera.roll',label:'Camera roll',unit:'rad'},
 {id:'composition.center.x',label:'Final composition center X',unit:'px'},
 {id:'composition.center.y',label:'Final composition center Y',unit:'px'},
 {id:'composition.zoom',label:'Final composition scale',unit:'scale'}
];
function drawCards(c,chapter,u,t,controls,cameraTime=t,outputTime=t){
 const poses=Array.from({length:21},(_,id)=>controlledCardPose(id,t,controls));
 cardWorld??=createReplayCardWorld(cardImage,id=>illustrations.getModel(id));
 cardWorld.render(c,poses,t,replayHeadlineWeight(1,outputTime)*controls.threadStrength,cameraTime);
}
function reveal(c,u,draw,weight=1){const previous=textReveal;textReveal=smoother(u/.45)*weight;draw();textReveal=previous;}
export function createReplayDemo(){illustrations??=createReplayIllustrations();return {config:replayConfig,animationChannels(groupId){return groupId==='camera'?cameraChannels.map(channel=>({...channel})):[];},animationState(groupId,time,parameters={}){if(groupId!=='camera')return{};const {pose,travel}=cameraPoseAt(time,parameters);return{'camera.position.x':pose.position[0],'camera.position.y':pose.position[1],'camera.position.z':pose.position[2],'camera.target.x':pose.target[0],'camera.target.y':pose.target[1],'camera.target.z':pose.target[2],'camera.roll':pose.roll,'composition.center.x':960-22*travel,'composition.center.y':540-7*travel,'composition.zoom':1+.10*travel};},nodesAt(t,p={}){
 const controls=replayControls(p),cardsTime=sampleAnimationGroupTime(p,'cards',t),cameraTime=sampleAnimationGroupTime(p,'camera',t),node={id:'record',type:'circle',x:960+Math.sin(cardsTime)*300,y:540,radius:120,fill:C.red,sound:true};
 // Retain the established sound proxy at defaults; expose layout edits using the
 // same centre and scale gains as the rendered collection.
 if(controls.cardSpread!==1)node.x=960+(node.x-960)*controls.cardSpread;
 if(controls.cardScale!==1)node.radius*=controls.cardScale;
 if(controls.finishPush!==1||cameraTime!==t){const original=finishingTravel(replayEditTime(t)),edited=finishingTravel(replayEditTime(cameraTime),controls.finishPush),relative=(1+.1*edited)/(1+.1*original);node.x=960-22*(edited-original)+(node.x-960)*relative;node.y=540-7*(edited-original);node.radius*=relative;}
 return [node];
},render(c,t,p={},w=1920,h=1080){
 const controls=replayControls(p);
 const cardsTime=replayEditTime(sampleAnimationGroupTime(p,'cards',t)),cameraTime=cameraPoseAt(t,p).cameraTime;
 t=replayEditTime(t);artTime=cardsTime;c.save();if(w!==1920||h!==1080)c.scale(w/1920,h/1080);
 // A continuous finishing push carries the complete composition, including
 // its type and record, so the final lockup keeps travelling as one unit.
 const finish=Math.max(0,t-11.4),travel=finishingTravel(cameraTime,controls.finishPush),push=1+.10*travel;
 if(finish>0){c.translate(960-22*travel,540-7*travel);c.scale(push,push);c.translate(-960,-540);}
 const chapter=Math.max(0,replayCuts.findLastIndex(x=>t>=x)),u=t-replayCuts[chapter];
 rect(c,0,0,1920,1080,C.cream);const hero=replayHeroCue(cardsTime);hero.orbitRadius*=controls.orbitScale;if(t>=11.4){const mask=replayHeroCue(t);disc(c,mask.iris.x,mask.iris.y,mask.iris.radius,C.red);if(t>=13.2)disc(c,mask.creamIris.x,mask.creamIris.y,mask.creamIris.radius,C.cream);}
 // All cards survive the edit: a shared scene graph reflows them between layouts.
 drawCards(c,chapter,u,cardsTime,controls,cameraTime,t);
 if(replayHeadlineWeight(0,t)>0)reveal(c,t*controls.revealSpeed,()=>{type(c,'2016',960,490,250*controls.editorialScale,C.red,'Arial','900','center');type(c,'to 2026',960,720,160*controls.editorialScale,C.ink,'Georgia','italic','center')},replayHeadlineWeight(0,t));
 if(replayHeadlineWeight(1,t)>0)reveal(c,(t-2.4)*controls.revealSpeed,()=>{headline(c,'Ten years,',115,905,142*controls.editorialScale);type(c,'one thread.',115,1035,142*controls.editorialScale,C.ink,'"Bodoni 72", Georgia','italic')},replayHeadlineWeight(1,t));
 if(replayHeadlineWeight(2,t)>0)reveal(c,(t-5.4)*controls.revealSpeed,()=>type(c,"Summer ’16",890,580,96*controls.editorialScale,'#76736d','"Bodoni 72", Georgia','italic','center'),replayHeadlineWeight(2,t));
 if(t>=7.7&&t<9.75){
 const wordTime=t-7.7;c.save();const holes=[];
 ['GOOD','OLD','DAYS'].forEach((word,j)=>{c.save();const baseline=645+(j-1)*315*controls.posterSpacing;const {lift,exit,arrival}=replayPosterLine(j,t);c.translate(960+exit,baseline+lift);c.scale(.82,1);c.beginPath();c.rect(-850,-410,1700,410*arrival+8*arrival);c.clip();c.font='900 370px "Arial Black"';c.textAlign='left';let cursor=-c.measureText(word).width/2;for(let z=0;z<word.length;z++){const width=c.measureText(word[z]).width;if(z!==[1,0,1][j]){c.fillStyle=C.red;c.fillText(word[z],cursor,0)}else holes.push({x:960+exit+.82*(cursor+width/2),y:baseline+lift-138,width:.82*width});cursor+=width;}c.restore();});
 const extracted=[];
 for(const [id,hole,targetScale,dy,j]of[[8,holes[0],1.24,0,0],[3,holes[1],1.17,0,1],[11,holes[2],.98,0,2]]){
  const now=replayPosterLine(j,t),baseX=hole.x-now.exit,baseY=hole.y-now.lift;
  const target=tt=>{const line=replayPosterLine(j,tt);return {id,x:baseX+line.exit,y:baseY+line.lift+dy,scale:targetScale,rotation:id===3?-.28:0,yaw:0,pitch:0,z:0,alpha:1};};
  const start=7.7+j*.045,duration=.82+j*.04;
  // Preserve the entire card-relative object transform at the exact instant
  // of extraction. Different owners follow independent, tangent-matched paths.
  const pose=spliceMotion(tt=>controlledCardPose(id,tt,controls),target,cardsTime,start,duration);
  const arc=arcEnvelope((cardsTime-start)/duration);
  if(id===8){pose.x-=35*arc;pose.y-=55*arc;}
  if(id===3){pose.x-=150*arc;pose.y+=85*arc;pose.z+=80*arc;}
  if(id===11){pose.x+=160*arc;pose.y-=30*arc;pose.z-=25*arc;}
  pose.screenX=hole.x;pose.screenY=hole.y+dy;pose.screenScale=targetScale;pose.screenLock=smoother((cardsTime-start)/duration);
  extracted.push(pose);
 }cardWorld.renderObjects(c,extracted,cardsTime);c.restore();
 }
 if(t>=9.4&&t<11.7){
  c.save();c.translate(-950*smoother((t-11.35)/.3),-14*smoother((t-11.35)/.3));
  const previous=textReveal;textReveal=smoother((t-9.75)/.35*controls.revealSpeed);
  headline(c,'Press play',120,235,142*controls.editorialScale);type(c,'on 2016.',120,375,142*controls.editorialScale,C.ink,'"Bodoni 72", Georgia','italic');
  textReveal=previous;c.restore();
 }
 if(t>=11.4){
  const rec=hero.record;
  // Grooves and orbit shrink physically into the label. No broad ghost dissolve.
  const projected=cardWorld.renderRecord(c,hero,cardsTime);
  if(projected){hero.record={...hero.record,x:projected.x,y:projected.y};hero.labelRadius*=projected.radius/Math.max(.001,hero.blackRadius);}

  if(t<13.95){c.save();c.translate(rec.x,rec.y);c.rotate((cardsTime-11.4)*.18*controls.orbitSpeed);for(let j=0;j<7;j++){c.save();c.rotate(j*TAU/7);type(c,'replay',0,-hero.orbitRadius,Math.max(.01,hero.orbitTypeSize*smoother((cardsTime-11.6)/.42)),C.ink,'Arial','900','center');c.restore()}c.restore();}
 }
 if(t>=13.2){
  c.font='900 240px Arial';const word='replay',whole=c.measureText(word).width;let cursor=960-whole/2;
  for(let j=0;j<word.length;j++){
   const advance=c.measureText(word[j]).width,progress=smoothGlyph((t-13.35-j*.05)/.48),travel=360*(1-progress);
   c.save();c.beginPath();c.rect(cursor-5,280,advance+10,300);c.clip();c.translate(cursor,525+travel);c.rotate((j%2?1:-1)*.055*(1-progress));
   // Clip the arrival lane. Glyphs emerge at their own baseline, not by fading.
   type(c,word[j],0,0,240,C.ink,'Arial','900');c.restore();cursor+=advance;
  }
  const tagline=smoothGlyph((t-13.92)/.48);c.save();c.beginPath();c.rect(420,580,1080,85);c.clip();type(c,'Your memories, in motion.',960,645+90*(1-tagline),68,C.ink,'"Bodoni 72", Georgia','italic','center');c.restore();
 }
 if(t>=11.4){const rec=hero.record;disc(c,rec.x,rec.y,hero.labelRadius,C.red);disc(c,rec.x,rec.y,hero.labelRadius*105*.065/(105*.29),C.cream);}


 c.restore();}}}
