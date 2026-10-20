import * as T from 'three';
import {createProductStage, createRotaryControl} from '../product-kit/index.js';
import {addLoopProductDetail} from './loop-product-detail.js';
import {applyCameraLens} from '../engine/camera-lens.js';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';

// Fictional brand; the brief and process cards are authored motion graphics.
// They are not a recording, a generation-speed claim or a model comparison.
const authoredCuts=[0,4,4.8,5.6,6.4,7.2,8.2,9.2,10,12,13,14,15.4,16,17.2,18.4,19.2,20.6,22];
// Strong transients measured in the approved soundtrack, quantized to 30 fps.
export const loopCuts=[0,90,119,144,159,231,259,288,316,372,399,428,456,470,513,540,568,618,660].map(f=>f/30);
function mapClock(t,from,to){const i=Math.min(from.length-2,Math.max(0,from.findLastIndex(v=>v<=t)));return to[i]+(t-from[i])/(from[i+1]-from[i])*(to[i+1]-to[i]);}
const filmTime=t=>mapClock(t,authoredCuts,loopCuts);
const storyTime=t=>mapClock(t,loopCuts,authoredCuts);
const C={ink:'#21172f',paper:'#f4f0e8',lime:'#d9ff64',purple:'#7547e8',orange:'#ff6b36',pink:'#f2a6d9'};
const sat=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=sat(n);return n*n*(3-2*n);};
const out=n=>1-(1-sat(n))**4;
const mix=(a,b,n)=>a+(b-a)*n;
const TAU=Math.PI*2;
function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,TAU);ctx.fill();}
function line(ctx,x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function box(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function type(ctx,text,x,y,size,color=C.ink,weight=700,align='left'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial, sans-serif`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(text,x,y);ctx.textAlign='left';}
function mark(ctx,x,y,size,color=C.ink,turn=0){ctx.save();ctx.translate(x,y);ctx.rotate(turn);ctx.strokeStyle=color;ctx.lineWidth=size*.17;for(const dx of [-.21,.21]){ctx.beginPath();ctx.ellipse(dx*size,0,size*.29,size*.35,0,0,TAU);ctx.stroke();}ctx.restore();}
function wordmark(ctx,x,y,size,color=C.ink){mark(ctx,x+size*.5,y-size*.36,size*.9,color);type(ctx,'loop',x+size*1.14,y,size,color,800);}
function label(ctx,text,x=80,y=78,color=C.ink){type(ctx,text,x,y,20,color,600);}
function footer(ctx,left,right,color=C.ink){line(ctx,80,1006,1840,1006,color,1);type(ctx,left,80,1044,17,color,500);type(ctx,right,1840,1044,17,color,500,'right');}
function speakerIcon(ctx,x,y,r,color=C.orange,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);circle(ctx,0,9,r,color);circle(ctx,0,0,r*.87,C.ink);ctx.strokeStyle='#75667d';ctx.lineWidth=2;for(let i=-9;i<=9;i++){const yy=i*r*.075,xx=Math.sqrt(Math.max(0,(r*.79)**2-yy**2));line(ctx,-xx,yy,xx,yy,'#5b4b65',2);}ctx.strokeStyle=C.lime;ctx.lineWidth=r*.026;ctx.beginPath();ctx.arc(0,0,r*.925,-2.9,-.25);ctx.stroke();box(ctx,-r*.15,-r*1.06,r*.3,r*.15,5,color);mark(ctx,0,r*.45,r*.13,C.paper);ctx.restore();}
function drawing(ctx,w,h,fn){ctx.save();ctx.scale(w/1920,h/1080);fn();ctx.restore();}
function curve(ctx,x,y,w,h,p,color){ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();for(let i=0;i<=90;i++){const q=i/90,xx=x+w*q,yy=y+h-h*ease(q);if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.stroke();circle(ctx,x+w*p,y+h-h*ease(p),12,color);}

function cursor(ctx,x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(2,35);ctx.lineTo(11,26);ctx.lineTo(20,43);ctx.lineTo(27,39);ctx.lineTo(17,22);ctx.lineTo(31,20);ctx.closePath();ctx.fillStyle='#fafafa';ctx.fill();ctx.strokeStyle='#171719';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
function gaussianEase(x,sigma=.16){
  const erf=z=>{const sign=z<0?-1:1;z=Math.abs(z);const k=1/(1+.3275911*z);return sign*(1-(((((1.061405429*k-1.453152027)*k)+1.421413741)*k-.284496736)*k+.254829592)*k*Math.exp(-z*z));};
  const cdf=v=>(1+erf((v-.5)/(Math.max(.04,sigma)*Math.SQRT2)))/2;
  return sat((cdf(sat(x))-cdf(0))/(cdf(1)-cdf(0)));
}
function introTransform(t,p){const c=p.sceneControls??{},real=t*.75,reveal=gaussianEase((real-(c.introPullbackStart??.75))/(c.introPullbackDuration??1.8),c.introSigma??.16);return {reveal,zoom:mix(c.introZoom??3,1,reveal),x:mix(630+Math.min(t,2.15)*(c.introPan??160),960,reveal),y:mix(448,540,reveal)};}
function sendAction(ctx,t){
  // Story time maps to the three-second intro; all states are seekable.
  const approach=out((t-3.03)/.34),hover=ease((t-3.26)/.15);
  const down=ease((t-3.55)/.10),release=out((t-3.67)/.16),press=down*(1-release);
  const launch=ease((t-3.70)/.20),settle=out((t-3.80)/.16);
  const scale=1+.08*hover-.18*press-.06*settle,lift=-3*hover+5*press;
  ctx.save();ctx.translate(1518,617+lift);ctx.scale(scale,scale);
  circle(ctx,0,0,38,'#f2eff8');
  ctx.save();ctx.globalAlpha=hover;circle(ctx,0,0,38,'#d7f56b');ctx.restore();
  ctx.strokeStyle=`rgba(215,245,107,${.45*hover*(1-down)})`;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,43,0,TAU);ctx.stroke();
  ctx.save();ctx.beginPath();ctx.arc(0,0,34,0,TAU);ctx.clip();
  ctx.translate(0,-3*hover-66*launch);ctx.globalAlpha=1-launch;
  line(ctx,0,17,0,-15,'#17151d',4);line(ctx,-13,-3,0,-16,'#17151d',4);line(ctx,0,-16,13,-3,'#17151d',4);ctx.restore();
  const confirm=out((t-3.84)/.11);
  if(confirm>0){ctx.save();ctx.globalAlpha=confirm;ctx.lineCap='round';line(ctx,-12,0,-3,9,'#17151d',4);line(ctx,-3,9,14,-10,'#17151d',4);ctx.restore();}
  ctx.restore();
  if(t>3.03)cursor(ctx,mix(1740,1525,approach)+6*settle,mix(830,626,approach)+lift+4*settle,1.1*(1-.09*press));
}
function brief(ctx,t,p){
  ctx.fillStyle='#050507';ctx.fillRect(0,0,1920,1080);
  const glowTime=t*(p.sceneControls?.introGlowSpeed??1),glowX=760+Math.sin(glowTime*1.8)*400,glowY=480+Math.cos(glowTime*1.5)*170;
  const glow=ctx.createRadialGradient(glowX,glowY,20,glowX,glowY,840);glow.addColorStop(0,'#696d19');glow.addColorStop(.48,'#282b0c');glow.addColorStop(1,'#05050700');ctx.fillStyle=glow;ctx.fillRect(0,0,1920,1080);
  const blue=ctx.createRadialGradient(1300-Math.sin(glowTime*1.3)*350,680+Math.sin(glowTime*2)*160,0,1180,700,650);blue.addColorStop(0,'#d7f56b45');blue.addColorStop(1,'#00000000');ctx.fillStyle=blue;ctx.fillRect(0,0,1920,1080);

  ctx.save();const view=introTransform(t,p);ctx.translate(960,540);ctx.scale(view.zoom,view.zoom);ctx.translate(-view.x,-view.y);
  ctx.shadowColor='#d7f56b';ctx.shadowBlur=30+Math.sin(t*2)*8;box(ctx,320,380,1280,318,28,'#202027');ctx.shadowBlur=0;box(ctx,322,382,1276,314,26,'#101014');
  const copy='Create a bold launch commercial for LOOP.';type(ctx,copy.slice(0,Math.floor(t*24)),370,457,42,'#f5f4f7',500);if(t<2)line(ctx,370+ctx.measureText(copy.slice(0,Math.floor(t*24))).width,422,370+ctx.measureText(copy.slice(0,Math.floor(t*24))).width,464,'#d7f56b',2);
  const names=['Brand assets','loop.svg','Product'];names.forEach((name,i)=>{const q=out((t-2.55-i*.18)/.32);if(!q)return;const x=mix(180+i*650,370+i*270,q),y=mix(200+i*40,516,q)+Math.sin(t*2+i)*3;ctx.globalAlpha=q;box(ctx,x,y,244,112,14,'#23232a');if(i===1)mark(ctx,x+36,y+38,36,'#dcff78',t*.15);else if(i===2)speakerIcon(ctx,x+38,y+38,24,C.orange,t*.1);else{box(ctx,x+17,y+19,40,32,4,'#d7f56b');box(ctx,x+17,y+12,19,12,3,'#d7f56b');}type(ctx,name,x+16,y+91,23,'#dfdce6',500);if(q<.99)cursor(ctx,x+170,y+75,.85);});ctx.globalAlpha=1;
  sendAction(ctx,t);
  ctx.restore();
}
// A separate virtual light field follows each shot's screen travel.
// It never receives 3D perspective or scene lighting.
function digitalBackground(ctx,t,w=1920,h=1080){
  if(t>=20.6){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);return;}
  const shot=Math.min(authoredCuts.length-2,Math.max(1,authoredCuts.findLastIndex(c=>c<=t))),start=authoredCuts[shot],end=authoredCuts[shot+1];
  const q=sat((t-start)/(end-start)),travel=.16*out(q/.24)+.60*q+.24*q**5;
  const looks={
    1:[.20,.80,.64,.32,-.46,'#000102','#010812','#082348',.09],
    2:[.76,.24,.29,.73,.26,'#010307','#071329','#123e72',.15],
    3:[.88,.22,.25,.70,-.65,'#010205','#031023','#0c3159',.12],
    4:[.35,.75,.76,.30,.15,'#010408','#041c3b','#105297',.17],
    5:[.85,.18,.58,.80,-.35,'#010206','#06172e','#0b4279',.16],
    6:[.16,.76,.72,.29,.62,'#000102','#02070e','#071e39',.07],
    7:[.72,.22,.30,.82,.34,'#010308','#061830','#174d85',.17],
    8:[.20,.81,.75,.29,-.28,'#010307','#07192f','#124e8a',.14],
    9:[.85,.24,.35,.75,.60,'#000103','#030b17','#0b2c53',.13],
    10:[.23,.75,.25,.76,-.48,'#020409','#0b1b30','#294f7e',.15],
    11:[.76,.30,.73,.27,.40,'#010308','#071a38','#0c417d',.16],
    12:[.20,.80,.80,.24,-.28,'#010307','#031124','#0d3667',.08],
    13:[.75,.25,.20,.78,.35,'#010307','#0b1d33','#284b70',.13],
    14:[.20,.82,.73,.27,-.42,'#000307','#06162b','#154778',.17],
    15:[.72,.22,.32,.76,.55,'#000102','#020812','#0a294b',.09]
  };
  // The product/logo match shares one continuous field across the hard cut.
  const match=t>=19.2,clock=match?sat((t-19.2)/2.8):travel;
  const d=looks[shot]??[.25,.67,.72,.40,-.32,'#010307','#06172e','#0d3b70',.13];
  const x=mix(d[0],d[1],clock),y=mix(d[2],d[3],clock),angle=d[4]+(clock-.5)*.25;
  const cx=w*(.5+(x-.5)*.18),cy=h*(.45+(y-.5)*.16),dx=Math.sin(angle)*w*.8,dy=Math.cos(angle)*h*.8;
  const gradient=ctx.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);gradient.addColorStop(0,d[5]);gradient.addColorStop(.40+clock*.08,d[6]);gradient.addColorStop(1,d[7]);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.globalAlpha=d[8];const light=ctx.createRadialGradient(w*x,h*y,0,w*x,h*y,w*.55);light.addColorStop(0,'#74a9e6');light.addColorStop(.35,'#245b9b88');light.addColorStop(1,'#00000000');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);ctx.restore();
  if(t>=19.2){ctx.save();ctx.globalAlpha=gaussianEase((t-19.2)/1.10,.23);ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.restore();}
}
export function renderLoopBackground(ctx,time,p={},w=1920,h=1080){const t=storyTime(time);digitalBackground(ctx,t,w,h);if(t>=6.4&&t<7.2)drawing(ctx,w,h,()=>kinetic(ctx,t,p));}
// Fast at the frame edge, with a long controlled deceleration near the center.
function titleEase(x,c={}){
  x=sat(x);let lo=0,hi=1,u=x;
  const cubic=(q,a,b)=>3*(1-q)**2*q*a+3*(1-q)*q*q*b+q*q*q;
  for(let i=0;i<16;i++){u=(lo+hi)/2;if(cubic(u,c.titleEaseX1??.16,c.titleEaseX2??.38)<x)lo=u;else hi=u;}
  return cubic(u,c.titleEaseY1??.86,c.titleEaseY2??1);
}
function superTitle(ctx,text,t,start,end,size=132,stretch=1,p={}){
  if(t<start||t>=end)return;
  const c=p.sceneControls??{},duration=end-start,age=t-start,entry=Math.min(c.titleEntry??.38,duration*.43),exit=Math.min(c.titleExit??.30,duration*.30);
  const arrive=titleEase(age/entry,c),leave=1-titleEase((duration-age)/exit,c);
  ctx.save();ctx.translate(960+1500*(1-arrive)-1500*leave+(c.titleDrift??20)*(.5-age/duration),552);ctx.scale(stretch,1);
  ctx.font=`600 ${size}px Arial, sans-serif`;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#fff';
  const width=ctx.measureText(text).width;
  for(let i=0;i<text.length;i++){
    const q=titleEase((age-(c.letterStagger??.07)*i/Math.max(1,text.length-1))/.16,c);
    if(q<=0||text[i]===' ')continue;
    const x=ctx.measureText(text.slice(0,i)).width-width/2;
    ctx.save();ctx.beginPath();ctx.rect(x-1,-size,ctx.measureText(text[i]).width+2,size*1.25);ctx.clip();
    ctx.globalAlpha=q;ctx.fillText(text[i],x+18*(1-q),size*(c.letterRise??.24)*(1-q));ctx.restore();
  }
  ctx.restore();
}
function logoMetrics(ctx){ctx.save();ctx.font='500 88px Arial, sans-serif';const prefix=ctx.measureText('Framev').width,letter=ctx.measureText('o').width;ctx.restore();return {prefix,letter,x:786+prefix+letter/2,y:545};}
function framevolveLogo(ctx,t,productO=false,opacity=1){
  const age=Math.max(0,t-20.6),carry=1-(1-sat(age/.34))**5,q=opacity,scale=1+.035*(1-carry)+Math.max(0,age-.34)*.002;
  ctx.save();ctx.translate(960-48*(1-carry),540);ctx.scale(scale,scale);ctx.globalAlpha=q;
  ctx.save();ctx.translate(-365,-75);ctx.scale(150/128,150/128);ctx.translate(64,64);ctx.rotate((t-20.6)*.018);ctx.translate(-64,-64);
  ctx.fillStyle='#d7f56b';const orbit=new Path2D('M52 8C77 8 96 24 96 48V67L39 34V22C39 14 44 8 52 8Z');
  for(let i=0;i<3;i++){ctx.save();ctx.translate(64,64);ctx.rotate(i*TAU/3);ctx.translate(-64,-64);ctx.fill(orbit);ctx.restore();}ctx.restore();
  const m=logoMetrics(ctx);type(ctx,'Framev',-174,29,88,'#f1f4f8',500);if(!productO)type(ctx,'o',-174+m.prefix,29,88,'#f1f4f8',500);type(ctx,'lve',-174+m.prefix+m.letter,29,88,'#f1f4f8',500);ctx.restore();
}
// Product and trail use the same transform, including historical rotation.
function wavePose(elapsed,c={}){
  const u=Math.max(0,elapsed)*(c.waveSpeed??1),launch=1-Math.exp(-u*5.7),travel=c.waveTravel??1;
  return {scale:mix(2.3,.43,launch),x:travel*(Math.sin(u*2.0)*2.05+launch*.18),y:travel*Math.sin(u*2.7)*1.14,
    rotation:new T.Euler(.18+Math.sin(u*2.5)*.46,-.4+u*2.0,-.25+u*.84)};
}
function kinetic(ctx,t,p){
  const c=p.sceneControls??{},elapsed=filmTime(t)-loopCuts[4],count=Math.round(c.waveCount??58),weight=c.waveWeight??1;
  ctx.save();ctx.lineJoin='round';const projection=540/Math.tan(42*Math.PI/360),emitted=Math.min(count,Math.floor(elapsed/.026));
  for(let i=emitted;i>=1;i--){
    const delay=i/emitted*Math.min(elapsed,2.35),age=elapsed-delay;if(age<0)continue;
    const pose=wavePose(age,c),quat=new T.Quaternion().setFromEuler(pose.rotation),major=i%4===0;
    const contour=(radius,reverse=false)=>{for(let j=0;j<=128;j++){
      const a=(reverse?128-j:j)/128*TAU,r=radius*(1+.008*(c.waveWarp??1)*Math.sin(a*6+age*4));
      const v=new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,.33).multiplyScalar(pose.scale).applyQuaternion(quat);v.x+=pose.x;v.y+=pose.y;
      const x=960+projection*v.x/(6-v.z),y=540-projection*v.y/(6-v.z);if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    }ctx.closePath();};
    ctx.beginPath();contour(1.32);ctx.globalAlpha=major?.92:.58;
    if(major){contour(Math.max(.84,1.32-.16*weight),true);ctx.fillStyle=i%8===0?'#d7f56b':'#398dff';ctx.fill('evenodd');}
    else{ctx.strokeStyle=i%2===0?'#b7d9ff':'#2478d7';ctx.lineWidth=(i%2===0?4.8:2.3)*weight;ctx.stroke();}
  }
  ctx.restore();
}
function graphicFinal(ctx,t,p){
  digitalBackground(ctx,t);
  if(t>=20.6){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<6;i++)framevolveLogo(ctx,t+(i/5-.5)*.028,false,1/6);ctx.restore();return;}
  const u=t-15.4;ctx.save();ctx.translate(960,540);ctx.rotate(u*.45);ctx.strokeStyle='#154c8a';ctx.lineWidth=2;
  for(let i=0;i<28;i++){const x=(i*110+u*u*2000)%3100-1550;ctx.beginPath();ctx.moveTo(x,-900);ctx.lineTo(x+400,900);ctx.stroke();}ctx.restore();
  superTitle(ctx,'AGAIN.',t,15.4,16,150*(p.sceneControls?.typeScale??1),1,p);
}

function glassPanelAt(t){
  if(t<10||t>=15.4)return null;
  const start=t<12?10:t<13?12:t<14?13:14,entry=gaussianEase((t-start)/.24,.23),alpha=entry*ease((15.4-t)/.18),x=t<12?590:t<13?570:t<14?360:610;
  return {x:x+38*(1-entry)+Math.sin(t*2.1)*7,y:(t<12?418:456)+18*(1-entry)+Math.cos(t*2.6)*6,width:370,height:280,radius:28,blur:14,alpha,refraction:1.012};
}
export const loopGlassPanelAt=time=>glassPanelAt(storyTime(time));
function rollingNumber(ctx,value,x,y,size){
  const low=Math.floor(value),fraction=value-low,step=size*1.15,c=document.createElement('canvas');c.width=Math.ceil(size*1.8);c.height=Math.ceil(size*1.12);const d=c.getContext('2d');
  type(d,String(low),0,size+fraction*step,size,'#fff',500);type(d,String(low+1),0,size-(1-fraction)*step,size,'#fff',500);
  d.globalCompositeOperation='destination-in';const fade=d.createLinearGradient(0,0,0,c.height);fade.addColorStop(0,'#ffffff00');fade.addColorStop(.15,'#fff');fade.addColorStop(.86,'#fff');fade.addColorStop(1,'#ffffff00');d.fillStyle=fade;d.fillRect(0,0,c.width,c.height);ctx.drawImage(c,x,y-size);
}
function panelUI(ctx,t,p){
  const rect=glassPanelAt(t);if(!rect)return;
  const {x,y,width,height,radius,alpha}=rect;
  ctx.save();ctx.globalAlpha=alpha;
  if(!p.cyclesBake){ctx.save();ctx.beginPath();ctx.roundRect(x,y,width,height,radius);ctx.clip();ctx.filter='blur(14px)';ctx.drawImage(ctx.canvas,0,0,ctx.canvas.width,ctx.canvas.height,-11.52,-6.48,1943.04,1092.96);ctx.restore();}
  const glass=ctx.createLinearGradient(x,y,x+width,y+height);glass.addColorStop(0,'#dceaff29');glass.addColorStop(.38,'#ffffff12');glass.addColorStop(.7,'#0812244a');glass.addColorStop(1,'#7ba4cc20');box(ctx,x,y,width,height,radius,glass);
  const edge=ctx.createLinearGradient(x,y,x+width,y+height);edge.addColorStop(0,'#f3fbff9c');edge.addColorStop(.35,'#b8d9f52c');edge.addColorStop(.7,'#e9f5ff10');edge.addColorStop(1,'#c5e5ff60');ctx.strokeStyle=edge;ctx.lineWidth=1.6;ctx.beginPath();ctx.roundRect(x+.8,y+.8,width-1.6,height-1.6,radius);ctx.stroke();
  ctx.strokeStyle='#02050c48';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x+3,y+3,width-6,height-6,radius-2);ctx.stroke();
  type(ctx,t<12?'Lens':t<13?'Light':t<14?'Finish':'Motion',x+27,y+46,28,'#f6faff',500);
  if(t<12){const q=gaussianEase((t-10)/2,.24),mm=12/Math.tan(mix(50,104,q)*Math.PI/360);rollingNumber(ctx,mm,x+27,y+132,66);type(ctx,'mm',x+125,y+130,23,'#d7e9fb',500);line(ctx,x+30,y+197,x+width-30,y+197,'#ecf6ff50',3);line(ctx,x+30,y+197,x+30+q*(width-60),y+197,'#d7f56b',3);circle(ctx,x+30+q*(width-60),y+197,10,'#fff');cursor(ctx,x+36+q*(width-60),y+208,.68);type(ctx,'26',x+27,y+251,17,'#d1e2f5',500);type(ctx,'WIDE',x+width-27,y+251,17,'#d1e2f5',500,'right');}
  else if(t<13){const q=ease(t-12);box(ctx,x+25+q*216,y+90,102,70,17,'#e2efff38');['Rim','Soft','Hard'].forEach((name,i)=>{const bx=x+25+i*108,selected=Math.min(2,Math.floor(q*3))===i;box(ctx,bx,y+90,102,70,17,'#0a142222');type(ctx,name,bx+51,y+132,22,'#fff',500,'center');});cursor(ctx,x+60+q*240,y+151,.68);type(ctx,'Shape the reflection.',x+27,y+239,18,'#d2e4f7',500);}
  else if(t<14){const q=ease((t-13-.12)/.78);ctx.strokeStyle='#f3faff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+72+q*113,y+139,36,0,TAU);ctx.stroke();['#f55b18','#99b7e2','#0c1018'].forEach((color,i)=>{const bx=x+72+i*113;circle(ctx,bx,y+139,29,color);ctx.strokeStyle='#dbeaff45';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(bx,y+139,35,0,TAU);ctx.stroke();});cursor(ctx,x+88+ease(q)*113,y+164,.68);type(ctx,'Organic coating',x+27,y+239,18,'#d2e4f7',500);}
  else{const q=sat((t-14)/1.4),edit=gaussianEase(q,.23),x0=x+30,y0=y+235,x3=x+width-30,y3=y+98,cx=x+100,cy=mix(y+225,y+107,edit);line(ctx,x0,y0,x3,y0,'#e2efff30',1);ctx.setLineDash([4,5]);line(ctx,x0,y0,cx,cy,'#d3e7ff65',1);ctx.setLineDash([]);ctx.strokeStyle='#d7f56b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x0,y0);ctx.bezierCurveTo(cx,cy,x+245,y+103,x3,y3);ctx.stroke();circle(ctx,x0,y0,5,'#e7f4ff');circle(ctx,x3,y3,5,'#e7f4ff');circle(ctx,cx,cy,7,'#d7f56b');ctx.strokeStyle='#eaf5ff45';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,13,0,TAU);ctx.stroke();cursor(ctx,cx+3,cy+5,.68);}
  ctx.restore();
}
function sceneOverlay(ctx,t,p){
  const scale=p.sceneControls?.typeScale??1;
  if(t>=4&&t<4.8)superTitle(ctx,'FROM A BRIEF.',t,4,4.8,110*scale,1,p);
  else if(t>=5.6&&t<6.4)superTitle(ctx,'TO THIS.',t,5.6,6.4,130*scale,1,p);
  if(t>=10&&t<15.4)panelUI(ctx,t,p);
}

// The same Canvas pass is used by Studio and for recompositing cached Cycles beauty.
export function renderLoopGraphics(ctx,time,p={},w=1920,h=1080){
  const t=storyTime(sampleAnimationGroupTime(p,'graphics',time));
  drawing(ctx,w,h,()=>{
    if(t<4)brief(ctx,t,p);
    else if(t>=6.4&&t<7.2){}
    else if((t>=15.4&&t<16)||t>=20.6)graphicFinal(ctx,t,p);
    else sceneOverlay(ctx,t,p);
  });
}

export function createLoopLaunch(){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);
  const stage=createProductStage(renderer,{background:C.purple,colors:{satinPlastic:C.orange},lighting:{keyStrength:1.5,fillIntensity:.09,environmentIntensity:.16,rimStrength:.8},look:{dofEnabled:false,aoIntensity:.18,bloomStrength:.045,bloomThreshold:2,aberrationPx:0,vignette:.04,lensDistortion:0}});
  const {scene,camera}=stage,geometries=[],materials=[],parts=[];scene.background=null;renderer.setClearColor(0x000000,0);const backdrop=document.createElement('canvas');backdrop.width=960;backdrop.height=540;const bgctx=backdrop.getContext('2d');
  const mat=(name,options)=>{const m=stage.kit.variant(name,options);materials.push(m);return m;};
  const shell=mat('satinPlastic',{color:'#f45a19',roughness:.26,metalness:0,clearcoat:.24,clearcoatRoughness:.20,normalScale:new T.Vector2(.025,.025)});
  const black=mat('rubber',{color:'#15121c',roughness:.7,normalScale:new T.Vector2(.08,.08)});
  const grille=mat('anodizedMetal',{color:'#292330',roughness:.30,metalness:.72,normalScale:new T.Vector2(.035,.035)});
  const trim=mat('brushedMetal',{color:'#b7b2c8',roughness:.19,metalness:1,normalScale:new T.Vector2(.025,.025)});
  const led=new T.MeshStandardMaterial({color:C.lime,emissive:C.lime,emissiveIntensity:1.4,roughness:.35});materials.push(led);
  function mesh(geo,material,parent){geometries.push(geo);const m=new T.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function cylinder(radius,depth,z,material,parent){const m=mesh(new T.CylinderGeometry(radius,radius,depth,96),material,parent);m.rotation.x=Math.PI/2;m.position.z=z;return m;}
  function ring(radius,tube,z,material,parent){const m=mesh(new T.TorusGeometry(radius,tube,16,128),material,parent);m.position.z=z;return m;}
  const product=new T.Group();product.name='loop.product';scene.add(product);
  const body=new T.Group();body.name='loop.shell';product.add(body);
  const profile=[[0,-.3],[1.11,-.3],[1.24,-.28],[1.31,-.22],[1.34,-.12],[1.34,.2],[1.31,.29],[1.23,.33],[1.17,.30],[1.17,.23]];
  const housing=mesh(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),128),shell,body);housing.rotation.x=Math.PI/2;
  cylinder(1.18,.06,-.25,black,body);ring(1.25,.035,.30,trim,body);ring(1.275,.018,.335,led,body);
  const cone=new T.Group();product.add(cone);cylinder(1.15,.055,.20,black,cone);
  const dome=mesh(new T.SphereGeometry(.39,64,24,0,TAU,0,Math.PI/2),black,cone);dome.rotation.x=Math.PI/2;dome.scale.set(1,.32,1);dome.position.z=.14;
  const face=new T.Group();face.name='loop.grille';product.add(face);ring(1.145,.017,.38,grille,face);
  // The scene-owned detail module adds the fine woven acoustic membrane.
  const badge=mesh(new T.CircleGeometry(.115,40),shell,face);badge.position.set(0,-.69,.395);
  const iconCanvas=document.createElement('canvas');iconCanvas.width=256;iconCanvas.height=256;const ic=iconCanvas.getContext('2d');mark(ic,128,128,170,C.ink);const iconTexture=new T.CanvasTexture(iconCanvas);iconTexture.colorSpace=T.SRGBColorSpace;
  const iconMat=new T.MeshStandardMaterial({map:iconTexture,transparent:true,depthWrite:false,roughness:.6});materials.push(iconMat);const icon=mesh(new T.PlaneGeometry(.17,.17),iconMat,face);icon.position.set(0,-.69,.398);
  stage.kit.materials.brushedMetal.roughness=.23;stage.kit.materials.brushedMetal.normalScale.set(.035,.035);
  stage.kit.materials.satinPlastic.roughness=.28;stage.kit.materials.satinPlastic.clearcoat=.24;stage.kit.materials.satinPlastic.clearcoatRoughness=.2;
  stage.kit.materials.rubber.normalScale.set(.07,.07);
  const knob=createRotaryControl(stage.kit.materials,{radius:.26,depth:.19,ridges:96});knob.root.position.set(0,1.315,-.04);knob.root.rotation.x=-Math.PI/2;body.add(knob.root);parts.push(knob);
  const foot=mesh(new T.CapsuleGeometry(.12,.9,8,28),black,body);foot.rotation.z=Math.PI/2;foot.position.set(0,-1.27,-.02);
  const detailing=addLoopProductDetail({product,body,face,cone,knob,shell,black,trim,grille,mat,mesh,cylinder,ring});
  // Complete speaker instances: all parts and the same real grille remain attached.
  // There is no floor or background geometry to clip through the lower array rows.
  const iceShell=shell.clone();iceShell.color.set('#9ebbd2');materials.push(iceShell);const chalkShell=shell.clone();chalkShell.color.set('#d5d9de');materials.push(chalkShell);
  const arrayGroup=new T.Group();arrayGroup.visible=false;scene.add(arrayGroup);const arrayItems=[];
  for(let i=0;i<12;i++){const root=product.clone(true);root.name='loop.array.'+i;root.traverse(o=>{if(o.userData.loopInternal||o.userData.loopCoating)o.visible=false;});if(i%3)root.traverse(o=>{if(o.isMesh&&o.material===shell)o.material=i%3===1?iceShell:chalkShell;});arrayGroup.add(root);arrayItems.push(root);}
  const edgeA=new T.RectAreaLight('#b9d9ff',18,.10,5);edgeA.position.set(-2.4,.4,-.6);edgeA.lookAt(0,0,0);scene.add(edgeA);
  const edgeB=new T.RectAreaLight('#fff4df',12,.08,4);edgeB.position.set(2.2,1,-.7);edgeB.lookAt(0,0,0);scene.add(edgeB);
  stage.prepare();
  const cameraChannels=['x','y','z'].map(axis=>({id:`camera.position.${axis}`,label:`Camera ${axis}`,unit:'scene units'})).concat({id:'camera.fov',label:'Lens',unit:'deg'});
  const productChannels=[{id:'product.rotation.y',label:'Product turn',unit:'rad'},{id:'product.rotation.z',label:'Product bank',unit:'rad'},{id:'product.face.position.z',label:'Grille separation',unit:'scene units'}];
  let graphicsTime=0,graphicsParameters={};
  function sceneFrame(ctx,t,p,w,h){
    const s=p.sceneControls??{},motion=s.motionAmount??1,pt=storyTime(sampleAnimationGroupTime(p,'product',filmTime(t))),ct=storyTime(sampleAnimationGroupTime(p,'camera',filmTime(t)));
    const threeReview=['clean','clay','wireframe','normals'].includes(p.review);
    product.visible=true;product.position.set(0,0,0);product.rotation.set(0,0,0);product.scale.setScalar(1);arrayGroup.visible=false;arrayGroup.rotation.set(0,0,0);face.position.z=0;cone.position.z=0;detailing.update(0);knob.root.position.set(0,1.315,-.04);knob.root.rotation.set(-Math.PI/2,0,0);
    let target=new T.Vector3(),pos=new T.Vector3(),fov=42,accent='#f55b18',blackout=false,focusStop=4,macro=false;
    const shot=authoredCuts.findLastIndex(c=>c<=t),start=authoredCuts[shot],end=authoredCuts[shot+1]??22,duration=end-start,u=ct-start,v=(pt-start)*motion,q=sat(u/duration);
    const ramp=.35*q+.65*q**6;const fly=1-(1-q)**5;const travel=.16*out(q/.24)+.60*q+.24*q**5;
    // Relative camera offsets stay outside the shell. The focal point follows a real detail.
    const detail=(point,offset)=>{product.updateMatrixWorld(true);target.copy(product.localToWorld(point));pos.copy(offset.applyQuaternion(product.quaternion)).add(target);macro=true;};
    if(t<4.8){blackout=true;accent='#05070b';product.rotation.set(.12+v*.17,-.34+v*.35,-.3+v*.2);const a=.25+q*.75;detail(new T.Vector3(Math.cos(a)*1.24,Math.sin(a)*1.24,.34),new T.Vector3(.28-.2*q,.16,1.75-ramp*.35));fov=38;focusStop=3.5;}
    else if(t<5.6){
      product.rotation.set(.06,-.12+v*.08,-.14);knob.root.rotation.z=-v*4;
      const a=-1.05+travel*2.25;
      detail(new T.Vector3(0,1.405,-.04),new T.Vector3(Math.sin(a)*.78,.34+q*.10,Math.cos(a)*.78));fov=40;focusStop=5.6;
    }
    else if(t<6.4){
      product.rotation.set(.03,.08,-.12+v*.1);
      detail(new T.Vector3(-.68+travel*1.36,.06,.405),new T.Vector3(-.72,.18,.34));fov=46;focusStop=3.6;
    }
    else if(t<7.2){const pose=wavePose(filmTime(pt)-loopCuts[4],s);product.position.set(pose.x,pose.y,0);product.rotation.copy(pose.rotation);product.scale.setScalar(pose.scale);pos.set(0,0,6);target.set(0,0,0);fov=42;focusStop=8;}
    else if(t>=7.2&&t<8.2){
      product.visible=false;arrayGroup.visible=true;fov=54;focusStop=7.1;
      const advance=travel*5.2;pos.set(1.90,.18+Math.sin(q*Math.PI)*.18,4.35-advance);target.set(-.25,.06,2.90-advance);
      arrayItems.forEach((x,i)=>{x.visible=i<7;x.position.set(Math.sin(v*2+i*.5)*.09,Math.sin(v*1.5+i*.5)*.12,3.5-i*1.5);x.rotation.set(.02,-.23+Math.sin(v*1.4+i*.3)*.07,.04*Math.sin(v+i));});
    }
    else if(t>=17.2&&t<18.4){
      product.visible=false;arrayGroup.visible=true;arrayGroup.rotation.z=-.22+travel*.44;
      fov=46;focusStop=3.8;pos.set(3.6-travel*5.8,5.5-travel*1.8,9.4-ramp*2.2);target.set(0,0,-.6);
      arrayItems.forEach((x,i)=>{x.visible=i<6;const a=i*TAU/6+.2+v*.18;x.position.set(Math.cos(a)*2.4,Math.sin(a)*2.3,(i%3-1)*1.8);x.rotation.set(-.35+i*.07,.12*Math.sin(i+v),a*.35+travel*.3);});
    }
    else if(t<9.2){blackout=true;accent='#05070b';product.rotation.set(.08+q*.14,1.28+travel*.48,-.68+travel*.66);target.set(.1,.08,0);pos.set(-.8+travel*1.8,.65-travel*.8,4.7-ramp*.6);fov=36;focusStop=4;}
    else if(t<10){product.rotation.set(-.15+travel*.18,-1.03+travel*.22,-.26+travel*.20);const sep=(2.25+.90*Math.sin(q*Math.PI))*(s.explodeAmount??1);face.position.z=sep;cone.position.z=sep*.78;detailing.update(sep);knob.root.rotation.z=v*2;product.updateMatrixWorld(true);target.copy(product.localToWorld(new T.Vector3(0,0,1.55)));pos.copy(target).add(new T.Vector3(.65-travel*1.2,.55-travel*.40,3.15-ramp*.25));fov=45;focusStop=8;}
    else if(t<12){const lens=gaussianEase((ct-10)/2,.24);product.rotation.set(-.17+.28*lens,-.24+.55*lens,-.25+.35*travel);detail(new T.Vector3(.20,.22,.10),new T.Vector3(mix(1.15,.78,lens),mix(.55,.34,lens),mix(2.65,.64,lens)));fov=mix(50,104,lens);focusStop=7.1;}
    else if(t<13){blackout=true;accent='#07090d';product.rotation.set(.12+travel*.2,-.35+travel*.45,-.68+travel*.6);detail(new T.Vector3(-1.07+travel*.35,.45+travel*.4,.24),new T.Vector3(-.5+travel*.5,.18,1.9-ramp*.3));fov=39;focusStop=4.5;}
    else if(t<14){accent=new T.Color('#f55b18').lerp(new T.Color('#99b7e2'),ease((q-.25)/.5));product.rotation.set(-.24,.48+travel*.22,.82-travel*.4);knob.root.rotation.z=v*3;detail(new T.Vector3(.1,1.14,.03),new T.Vector3(1.25-travel*.7,.55,1.3-travel*.25));fov=43;focusStop=4.5;}
    else if(t<15.4){product.rotation.set(.38-travel*.3,.95-travel*.7,-.65+travel*.5);const sep=(.35+Math.sin(sat(v/1.4)*Math.PI)*1.75)*(s.explodeAmount??1);face.position.z=sep;cone.position.z=sep*.78;detailing.update(sep);knob.root.position.y+=sep*.25;knob.root.rotation.z=v*2;target.set(0,.1,.6);pos.set(-1.8+travel*3,-.75+travel*1.7,4.9-ramp*.55);focusStop=5.6;}
    else if(t<17.2){
      product.rotation.set(.04,.12,-.10+v*.08);knob.root.rotation.z=v*5;
      const a=travel*2.8;detail(new T.Vector3(0,1.42,-.04),new T.Vector3(Math.sin(a)*.48,.88,Math.cos(a)*.48));fov=34;focusStop=4;
    }
    else if(t<19.2){blackout=true;accent='#05070b';product.rotation.set(.15,-.45+v*.5,-.3+v*.25);detail(new T.Vector3(.95,.75-q*.4,.34),new T.Vector3(.2,.15,1.6-ramp*.2));fov=38;focusStop=3.6;}
    else{
      // Accelerate into the cut; the incoming logo inherits screen velocity.
      const progress=sat((ct-19.2)/1.4),resolve=progress**3.5,size=mix(1.70,.067,resolve),distance=6.2/size,m=logoMetrics(bgctx);
      const screenX=mix(960,960+(m.x-960)*1.035-48,resolve),screenY=mix(540,540+(m.y-540)*1.035,resolve);
      fov=43;focusStop=5.6;pos.set(0,0,distance);target.set(0,0,0);
      product.position.set((screenX-960)/540*distance*Math.tan(fov*Math.PI/360),-(screenY-540)/540*distance*Math.tan(fov*Math.PI/360),0);
      product.rotation.set(mix(.08,0,progress),mix(-.20,-Math.atan2(product.position.x,distance),progress),mix(-.10,0,progress));
    }
    // Keep space on the left for the larger frosted controls.
    if(t>=10&&t<15.4)target.x-=macro?.18:t<12?.65:.65;
    // Independent world-space light travel changes real reflections as object and camera move.
    shell.color.set(accent).offsetHSL((s.paletteHue??0)/360,0,0);shell.roughness=blackout?.30:(s.shellRoughness??.34)*1.12;iceShell.roughness=shell.roughness;chalkShell.roughness=shell.roughness;iceShell.color.set('#9ebbd2').offsetHSL((s.paletteHue??0)/360,0,0);chalkShell.color.set('#d5d9de').offsetHSL((s.paletteHue??0)/360,0,0);grille.color.set(blackout?'#0b1017':'#343d47');black.color.set('#07090c');trim.color.set(blackout?'#7c8a96':'#b4b9be');
    const coating=t>=13&&t<14?ease((ct-13-.12)/.78):-1;detailing.coat(coating,s.paletteHue??0,s.coatingScale??1,s.coatingEdge??1);if(coating>=0)shell.color.set('#ffffff');
    scene.environmentIntensity=blackout?.008:.10;stage.lights.key.intensity=(blackout?.3:7)*(s.keyLight??1);stage.lights.key.width=blackout?.25:2.2;stage.lights.key.height=3;stage.lights.key.position.set(-2.8+Math.sin(t*1.7)*1.8,2.4+Math.cos(t)*.7,2.8+Math.sin(t*.8));stage.lights.key.lookAt(target);
    stage.lights.fill.intensity=(blackout?.001:.025)*(s.fillLight??1);stage.lights.rims.forEach(l=>l.intensity=0);
    edgeA.intensity=(blackout?38:20)*(s.fillLight??1);edgeB.intensity=(blackout?24:12)*(s.fillLight??1);edgeA.position.set(-2.1+Math.sin(t*2)*.8,1+Math.cos(t*1.4)*1.2,-.8+Math.sin(t)*.45);edgeA.lookAt(target);edgeB.position.set(2.2+Math.cos(t*1.7)*.6,.7+Math.sin(t*1.8)*1.5,.2);edgeB.lookAt(target);
    const key=stage.lights.key;key.color.set('#fff2e2');edgeA.color.set('#b9d9ff');edgeB.color.set('#fff4df');edgeA.width=.1;edgeA.height=5;edgeB.width=.08;edgeB.height=4;
    const shapeLight=(light,color,power,w,h,xyz)=>{light.color.set(color);light.intensity=power;light.width=w;light.height=h;light.position.fromArray(xyz);light.lookAt(target);};
    const kg=s.keyLight??1,fg=s.fillLight??1;
    if(t>=4.8&&t<5.6){shapeLight(key,'#fff0df',9*kg,1.7,3,[-1.8+q*.7,4,2]);shapeLight(edgeA,'#8fc7ff',28*fg,.14,2,[1.3,1.7,-.8+q*.5]);shapeLight(edgeB,'#fff9ee',18*fg,.12,2,[-1.5,1.9,.5]);}
    else if(t>=5.6&&t<6.4){shapeLight(key,'#e4edff',28*kg,.12,3,[-2.1+q*.6,1.2,1]);shapeLight(edgeA,'#89baff',36*fg,.08,3,[2,.3,.8]);shapeLight(edgeB,'#ffb77e',16*fg,.1,3,[-1.5,-.4,.9]);}
    else if(t>=7.2&&t<8.2){shapeLight(key,'#fff0db',10*kg,7,4,[-3+q,6,4]);shapeLight(edgeA,'#80bfff',28*fg,.4,7,[1.8,1,-4+q*3]);shapeLight(edgeB,'#fff4e7',18*fg,.3,6,[-3,1,1]);}
    else if(t>=8.2&&t<9.2){shapeLight(key,'#e2efff',.08*kg,.2,4,[-2,3,1]);shapeLight(edgeA,'#9bcaff',48*fg,.08,4,[-1.7,.6,-1]);shapeLight(edgeB,'#fff0dd',34*fg,.06,4,[1.7,-.4,-.5]);}
    else if(t>=9.2&&t<10){shapeLight(key,'#e5edff',8*kg,2.5,4,[-2+q,4,3]);shapeLight(edgeA,'#ffb87a',25*fg,.2,4,[2.4,1,-1]);shapeLight(edgeB,'#83bcff',30*fg,.12,3,[-1.8,-.4,1]);}
    else if(t>=10&&t<12){shapeLight(key,'#edf5ff',8*kg,3,5,[-3,3.5,4]);shapeLight(edgeA,'#83b6ff',22*fg,.18,5,[2.6+q*.5,1,-.5]);shapeLight(edgeB,'#ffe3c3',15*fg,.2,4,[-2,-.5,1]);}
    else if(t>=12&&t<13){const spread=.18+2.8*Math.sin(q*Math.PI)**2;shapeLight(key,'#dceeff',(18-spread*4)*kg,spread,4,[-2.5+q*5,3,2]);shapeLight(edgeA,'#8bbfff',28*fg,.1,4,[2,1,-.5]);}
    else if(t>=13&&t<14){shapeLight(key,'#fff7ed',7*kg,3,4,[-2.7,4,3]);shapeLight(edgeA,'#90c3ff',24*fg,.2,4,[2,1,-.6]);}
    else if(t>=14&&t<15.4){shapeLight(key,'#fff3e5',9*kg,2.5,4,[-3,3,3]);shapeLight(edgeA,'#88bfff',28*fg,.18,4,[2,1,-1]);shapeLight(edgeB,'#d7e8ff',16*fg,.15,4,[-1,-2,2]);}
    else if(t>=16&&t<17.2){shapeLight(key,'#edf4ff',7*kg,3,3,[-1.5,4,1]);shapeLight(edgeA,'#ffd3a9',24*fg,.08,3,[1.5,1.8,-1]);shapeLight(edgeB,'#a4d3ff',22*fg,.1,3,[-1.4,1.4,.7]);}
    else if(t>=17.2&&t<18.4){shapeLight(key,'#fff4e6',9*kg,7,5,[-4,6,2]);shapeLight(edgeA,'#88c0ff',24*fg,.3,6,[3,2,-3]);shapeLight(edgeB,'#dae8ff',12*fg,.2,5,[-3,2,1]);}
    else if(t>=19.2){shapeLight(key,'#fff4e7',9*kg,4,5,[-3,4,3]);shapeLight(edgeA,'#8fc4ff',28*fg,.18,5,[3,1,-1]);shapeLight(edgeB,'#ffc68f',18*fg,.18,4,[-2,-1,1]);for(const light of [key,edgeA,edgeB]){light.position.add(product.position);light.lookAt(product.position);}}
    led.color.set(blackout?'#121b25':'#9bbddc');led.emissive.set(blackout?'#121b25':'#9bbddc');led.emissiveIntensity=(blackout?.005:.12)*(s.ledBrightness??1);
    renderer.toneMappingExposure=s.exposure??1.15;camera.position.copy(pos);camera.fov=fov;camera.lookAt(target);camera.updateProjectionMatrix();applyCameraLens(camera,p,{target,referenceFov:fov});camera.userData.dof={enabled:true,focusDistance:camera.position.distanceTo(target),fstop:focusStop};digitalBackground(bgctx,t,backdrop.width,backdrop.height);if(t>=6.4&&t<7.2)drawing(bgctx,backdrop.width,backdrop.height,()=>kinetic(bgctx,t,p));
    if(!p.cyclesBake){ctx.drawImage(backdrop,0,0,w,h);const frame=stage.render(t,{width:w,height:h,review:p.review,look:{bloomStrength:0,bloomEnabled:false,bloomThreshold:1.2,bloomRadius:0,compactGlowStrength:.035*(s.bloomStrength??1),compactGlowRadiusPx:2,compactGlowThreshold:.78,dofEnabled:false,aoIntensity:0,vignette:0,aberrationPx:1*(s.renderAberration??1),lensDistortion:0}});ctx.drawImage(frame,0,0,w,h);}
    if(threeReview)return;
    drawing(ctx,w,h,()=>sceneOverlay(ctx,storyTime(graphicsTime),p));
  }

  return {scene,camera,renderer,getBackdrop:()=>backdrop,getGlassPanel:time=>glassPanelAt(storyTime(time)),isGraphicOnly:time=>{const t=storyTime(time);return t<4||(t>=15.4&&t<16)||t>=20.6;},
    render(ctx,time,p={},w=1920,h=1080){const t=storyTime(Math.max(0,Math.min(22,time)));graphicsTime=sampleAnimationGroupTime(p,'graphics',time);graphicsParameters=p;if(t<4)drawing(ctx,w,h,()=>brief(ctx,storyTime(graphicsTime),p));else if((t>=15.4&&t<16)||t>=20.6)drawing(ctx,w,h,()=>graphicFinal(ctx,storyTime(graphicsTime),p));else sceneFrame(ctx,t,p,w,h);},
    animationChannels(id){return id==='camera'?cameraChannels:id==='product'?productChannels:[{id:'graphics.phase',label:'Graphic phase',unit:'s'},{id:'graphics.zoom',label:'Intro zoom',unit:'×'},{id:'graphics.pullback',label:'Gaussian pullback',unit:'progress'}];},
    captureAuthoredAnimation(id){const values=id==='camera'?{'camera.position.x':camera.position.x,'camera.position.y':camera.position.y,'camera.position.z':camera.position.z,'camera.fov':camera.fov}:id==='product'?{'product.rotation.y':product.rotation.y,'product.rotation.z':product.rotation.z,'product.face.position.z':face.position.z}:{'graphics.phase':graphicsTime,'graphics.zoom':introTransform(storyTime(graphicsTime),graphicsParameters).zoom,'graphics.pullback':introTransform(storyTime(graphicsTime),graphicsParameters).reveal};return{channels:this.animationChannels(id),values};},
    dispose(){detailing.dispose();parts.forEach(p=>p.dispose());geometries.forEach(g=>g.dispose());led.dispose();iconMat.dispose();iconTexture.dispose();iceShell.dispose();chalkShell.dispose();stage.dispose();renderer.dispose();}
  };
}
