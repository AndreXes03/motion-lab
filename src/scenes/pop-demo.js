import {createGraphicLens} from '../engine/graphic-lens.js';
import {sampleGraphicCamera,applyGraphicCamera} from '../engine/graphic-camera.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createKineticType} from '../components/kinetic-type.js';
import {beatClock,ease,springIn} from '../engine/beat-clock.js';
import {rounded,title,burst,halftone,ticker} from '../components/comic.js';
const W=1920,H=1080,INK='#12132b',CREAM='#fff5dc';
const SHOTS=[
 {time:0,x:970,y:590,zoom:2.5,roll:-.18},
 {time:.46,x:960,y:505,zoom:1.1,roll:.04},
 {time:.98,x:910,y:510,zoom:1.22,roll:-.055},
 {time:1.48,x:1050,y:560,zoom:1.8,roll:.10},
 {time:1.98,x:810,y:450,zoom:1.38,roll:-.12},
 {time:2.34,x:1040,y:470,zoom:1.16,roll:.035},
 {time:2.5,x:1260,y:580,zoom:2.2,roll:.15},
 {time:2.97,x:950,y:470,zoom:1.13,roll:-.025},
 {time:3.47,x:790,y:480,zoom:1.43,roll:-.09},
 {time:3.97,x:1160,y:490,zoom:1.52,roll:.095},
 {time:4.47,x:990,y:600,zoom:1.16,roll:-.03},
 {time:4.85,x:1000,y:420,zoom:1.65,roll:.06},
 {time:5,x:690,y:450,zoom:2,roll:-.22},
 {time:5.48,x:960,y:500,zoom:1.10,roll:.035},
 {time:5.98,x:1110,y:540,zoom:1.4,roll:.12},
 {time:6.48,x:820,y:450,zoom:1.36,roll:-.12},
 {time:6.98,x:990,y:540,zoom:1.1,roll:.025},
 {time:7.5,x:990,y:610,zoom:2.1,roll:.16},
 {time:7.98,x:960,y:530,zoom:1.15,roll:-.07},
 {time:8.48,x:1020,y:580,zoom:1.42,roll:.06},
 {time:8.98,x:960,y:520,zoom:1.08,roll:-.02},
 {time:10,x:960,y:520,zoom:1.08,roll:-.02}
];
export function createPopDemo(){
 let renderer,scene,camera,player,types,env,playButton,playIcon,lens;const clay=new T.MeshStandardMaterial({color:'#a7a8b3',roughness:.6});
 function init(){if(renderer)return;renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.outputColorSpace=T.SRGBColorSpace;
 scene=new T.Scene();camera=new T.PerspectiveCamera(38,16/9,.1,100);camera.position.z=15;
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();env=pmrem.fromScene(room,.03);scene.environment=env.texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.45;
 scene.add(new T.HemisphereLight('#ffffff','#6a5adb',.8));const key=new T.DirectionalLight('#fff1d9',2);key.position.set(-4,7,8);scene.add(key);const rim=new T.DirectionalLight('#8adcff',1.5);rim.position.set(4,2,-1);scene.add(rim);
 types=['PLAY','BASS','MOVE'].map(word=>createKineticType(word));types.forEach(o=>scene.add(o.group));
 player=new T.Group();player.name='pop.player';scene.add(player);
 function box(w,h,d,color,x,y,z,r=.12){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,4,r),new T.MeshPhysicalMaterial({color,roughness:.25,metalness:.1,clearcoat:1}));mesh.position.set(x,y,z);player.add(mesh);return mesh;}
 box(6.5,3.85,.3,INK,0,0,-.12);box(6.3,3.65,.26,CREAM,0,0,.02);box(6.15,.42,.12,'#ff74ae',0,1.48,.19);box(5.65,.76,.15,INK,0,.68,.2);
 for(let i=0;i<3;i++){const dot=new T.Mesh(new T.SphereGeometry(.065,16,12),new T.MeshBasicMaterial({color:CREAM}));dot.position.set(-2.83+i*.21,1.48,.3);player.add(dot);}
 box(1.7,1.48,.6,INK,0,-.56,.44,.23);const play=box(1.4,1.2,.34,'#ff8657',0,-.56,.82,.2);play.name='pop.button';playButton=play;
 const tri=new T.Shape();tri.moveTo(-.16,-.26);tri.lineTo(.28,0);tri.lineTo(-.16,.26);tri.closePath();const icon=new T.Mesh(new T.ExtrudeGeometry(tri,{depth:.045,bevelEnabled:false}),new T.MeshStandardMaterial({color:CREAM}));icon.position.set(0,-.56,1.01);player.add(icon);playIcon=icon;
 for(const x of [-2,2]){box(.95,.78,.24,'#bcb0f1',x,-.56,.35);for(const dx of [-.09,.09]){const tiny=icon.clone();tiny.geometry=icon.geometry;tiny.scale.setScalar(.42);tiny.position.set(x+dx,-.56,.5);player.add(tiny);}}
 box(5.5,.085,.05,INK,0,-1.4,.2,.02);box(2.2,.085,.07,'#ff5a9d',-1.65,-1.4,.25,.02);
 // Screen content is a mapped canvas, so its text remains sharp and editable.
 const c=document.createElement('canvas');c.width=1024;c.height=140;const q=c.getContext('2d');q.fillStyle=INK;q.fillRect(0,0,1024,140);q.fillStyle='#ffe568';q.font='900 60px monospace';q.textAlign='center';q.fillText('PLAY.EXE   /   120 BPM',512,90);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const screen=new T.Mesh(new T.PlaneGeometry(5.4,.64),new T.MeshBasicMaterial({map:tex}));screen.position.set(0,.68,.29);player.add(screen);
 }
 function sample(time,parameters={}){const t=Math.max(0,Math.min(10,time));const energy=parameters.graphics?.speed??1;return {t,energy,chapter:Math.min(3,Math.floor(t/2.5)),local:t%2.5,...beatClock(t,120)};}
 function background(c,s,accent){const {t,chapter,pulse}=s;
 const gradient=c.createRadialGradient(980,490,50,960,540,1150);gradient.addColorStop(0,chapter===2?'#a344ca':'#4949dd');gradient.addColorStop(1,'#17134e');c.fillStyle=gradient;c.fillRect(0,0,W,H);halftone(c,t);
 c.save();c.translate(960,530);c.rotate(t*.025);c.strokeStyle='#b9a8ff';c.globalAlpha=.16;c.lineWidth=2;for(let i=0;i<30;i++){const a=i*Math.PI/15;c.beginPath();c.moveTo(Math.cos(a)*310,Math.sin(a)*310);c.lineTo(Math.cos(a)*1600,Math.sin(a)*1600);c.stroke();}c.restore();
 if(chapter===1){c.fillStyle='#ffe568';c.beginPath();c.arc(980,455,335+pulse*9,0,Math.PI*2);c.fill();
 for(let layer=0;layer<2;layer++)for(let i=0;i<24;i++){const localPulse=beatClock(t+(i%4)*.04).pulse;const x=i*92-110+Math.sin(t*.9)*70*(layer+1),h=120+((i*71+layer*37)%220)+localPulse*(35+(i%4)*28),y=940-h;rounded(c,x,y,74,h,8,layer?'#7063c3':'#333478',INK,4);c.fillStyle=layer?'#ffe49e':'#76bcdb';for(let row=0;row<h/26-1;row++)for(let col=0;col<3;col++)if((i+row*3+col)%4!==0)c.fillRect(x+12+col*19,y+15+row*26,7,11);}}
 if(chapter===2){for(let i=0;i<5;i++){c.save();c.translate(960,540);c.rotate(t*.1+i*.15);c.strokeStyle=[accent,'#ffe568','#6bdcf5'][i%3];c.lineWidth=15;c.beginPath();c.ellipse(0,0,340+i*95,170+i*48,0,0,Math.PI*2);c.stroke();c.restore();}}
 }
 function window(c,x,y,w,h,label,t,kind){c.save();c.translate(x,y);c.rotate(Math.sin(t*.7+x)*.06);rounded(c,8,12,w,h,16,INK,INK,0);rounded(c,0,0,w,h,16,CREAM);rounded(c,0,0,w,40,12,'#b9b0f6');c.fillStyle=INK;c.font='700 19px monospace';c.fillText(label,15,28);c.save();c.beginPath();c.rect(12,48,w-24,h-58);c.clip();if(kind==='bars'){for(let i=0;i<16;i++){const h2=25+(1+Math.sin(i*.6+t*7))*40;c.fillStyle=i%2?'#ff7ead':'#6454d7';c.fillRect(17+i*17,h-14-h2,11,h2);}}else{c.beginPath();for(let x=10;x<w-10;x++){const y=h*.64+Math.sin(x*.065-t*9)*25*Math.sin(x*.017+t);if(x===10)c.moveTo(x,y);else c.lineTo(x,y);}c.strokeStyle='#dc579c';c.lineWidth=6;c.stroke();}c.restore();c.restore();}
 function render(c,time,parameters={},width=W,height=H){init();const s=sample(time,parameters),{t,chapter,local,pulse,energy}=s;const accent=parameters.graphics?.accent??'#ff66a7';const review=parameters.review??'beauty',inspect=parameters.inspect?.object;
 c.save();c.scale(width/W,height/H);c.fillStyle='#211765';c.fillRect(0,0,W,H);c.save();if(!inspect){const pose=sampleGraphicCamera(t,SHOTS),strength=parameters.graphics?.cameraMotion??1;pose.x=960+(pose.x-960)*strength;pose.y=540+(pose.y-540)*strength;pose.zoom=1+(pose.zoom-1)*strength;pose.roll*=strength;pose.zoom*=1+.045*pulse*energy*strength;applyGraphicCamera(c,pose);}if(inspect){c.fillStyle='#dadde6';c.fillRect(0,0,W,H);}else background(c,s,accent);
 if(!inspect){window(c,160,460+Math.sin(t*2)*20,295,206,'SPECTRUM',t,'bars');window(c,1480,480+Math.cos(t*2)*30,280,190,'WAVE.FM',t,'wave');if(chapter!==1){burst(c,1600,245,115,accent,t*.08);title(c,'NEW!',1600,245,46,CREAM,.1);burst(c,320,810,100,'#ffe568',-t*.1);title(c,'120',320,807,46,CREAM,-.1);}}
 types.forEach(o=>o.group.visible=false);player.visible=chapter===0||chapter===3;player.position.set(0,-.15,0);player.rotation.set(.14+Math.sin(t*3)*.15,-.18+Math.sin(t*2.1)*.38,-.08+Math.sin(t*2)*.10);playButton.position.z=.82-pulse*.14;playIcon.position.z=1.01-pulse*.14;let p=springIn(t+.22,0);player.scale.setScalar(Math.max(.01,p)*1.18*(1+pulse*.015));
 let type=types[chapter===1?1:chapter===2?2:0];type.group.visible=true;type.animate(local+.2,{pulse,energy,start:0});type.group.position.set(0,chapter===0||chapter===3?2.7:.55,1);type.group.rotation.set(.12+Math.sin(t*3)*.13,Math.sin(t*2.5)*.48,-.06+Math.sin(t*3)*.11);type.group.scale.setScalar(chapter===0||chapter===3?.7:1.48);
 if(chapter===3){player.scale.setScalar(1.13*(1+.045*pulse));type.animate(t-7.5+.2,{pulse,energy:t>9?.3:1});}
 if(inspect){types.forEach(o=>o.group.visible=inspect===o.group.name);player.visible=inspect==='pop.player';const target=player.visible?player:types.find(o=>o.group.visible)?.group;if(target){target.position.set(0,0,0);target.rotation.set(.12,(parameters.inspect.yaw??20)*Math.PI/180,0);target.scale.setScalar(1.25);if(!player.visible)type=types.find(o=>o.group.visible);if(type?.group.visible)type.animate(2,{energy:0});}}
 const rect=renderer.getSize(new T.Vector2());if(rect.x!==width||rect.y!==height)renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();scene.overrideMaterial=review==='clay'?clay:null;renderer.render(scene,camera);c.drawImage(renderer.domElement,0,0,W,H);
 if(!inspect&&review!=='clay'){c.restore();const captions=['PRESS PLAY. FEEL EVERYTHING.','BASS YOU CAN SEE.','MAKE SOME NOISE.','YOUR NEXT MOVE.'];title(c,captions[chapter],960,900,chapter===0?57:68,CREAM,-.018);c.fillStyle=CREAM;c.font='700 22px monospace';c.textAlign='left';c.fillText('MOTION LAB  /  POP STUDY 01',65,69);c.textAlign='right';c.fillText(`${String(Math.floor(t*30)).padStart(3,'0')}   ●   120 BPM`,1855,69);ticker(c,t,'PLAY.EXE   /   TURN IDEAS UP   /   MOTION LAB');
 // A continuous circular iris covers the chapter cut, including temporal samples.
 for(const cut of [2.5,5,7.5]){const d=Math.abs(t-cut);if(d<.16){const radius=1300*ease(1-d/.16);c.fillStyle='#ffe568';c.beginPath();c.arc(960,540,radius,0,Math.PI*2);c.fill();}}}
 if(inspect||review==='clay')c.restore();c.restore();if(!inspect&&review==='beauty'){lens??=createGraphicLens(c.canvas);lens.apply(c,parameters.graphics?.fisheye??.3);}return s;
 }
 // Semantic 2D proxies capture the main animated objects for the shared SFX planner.
 function nodesAt(t,p={}){const s=sample(t,p),isPlayer=s.chapter===0||s.chapter===3;return [{id:'pop.hero',type:'rect',x:960+Math.sin(t*1.3)*50,y:500+Math.sin(t*1.8)*20,width:850,height:500,scaleX:Math.max(.01,springIn(s.local,0)),scaleY:1,rotation:Math.sin(t)*.06,fill:'#fff'},{id:'pop.word',type:'text',text:isPlayer?'PLAY':s.chapter===1?'BASS':'MOVE',font:'900 220px Arial',x:960,y:isPlayer?230:480,align:'center',scaleX:Math.max(.01,springIn(s.local,0)),rotation:Math.sin(t*.8)*.03}];}
 return {render,nodesAt};
}
