import {renderProcedural,progress} from '../engine/procedural.js';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
import recipe from '../../project/graphics.json';
const W=1920,H=1080,TAU=Math.PI*2,INK='#090b10',WHITE='#eceee5';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const hash=i=>{let x=Math.imul(i+recipe.seed,1597334677);x^=x>>>16;return(x>>>0)/4294967296};
const node=(id,type,props)=>({id:'lab.'+id,type,...props});
const path=(id,points,stroke,width=1.5,extra={})=>node(id,'path',{commands:points.map((p,i)=>[i?'L':'M',...p]),stroke,lineWidth:width,sound:false,...extra});
const text=(id,value,x,y,size,color=WHITE,extra={})=>node(id,'text',{text:value,x,y,font:`700 ${size}px Arial, sans-serif`,fill:color,baseline:'middle',...extra});
export const proceduralCuts=[1,2,3,4,5].map(i=>i*20/11);
export function proceduralShutter(time,requested=210){return Math.min(5,Math.floor(Math.max(0,time)/(20/11)))===4?requested:0;}
export function proceduralTempo(parameters={}){return parameters.sound?.tempo==='manual'?clamp(Number(parameters.sound.bpm)||132,60,180):132;}
function buildNodes(t,parameters={}){
 const graphicsTime=sampleAnimationGroupTime(parameters,'graphics',t);
 const g={...recipe.defaults,...parameters.graphics},accent=/^#[0-9a-f]{6}$/i.test(g.accent)?g.accent:'#c2ff38',speed=clamp(Number(g.speed)||1,.25,2.5),density=clamp(Number(g.density)||10,4,18),bpm=proceduralTempo(parameters),beat=t*bpm/60,pulse=Math.exp(-(beat%1)*9),u=graphicsTime*speed;
 const chapter=Math.min(5,Math.floor(t/(20/11))),local=t-chapter*20/11,kick=1+.035*pulse,light=chapter===2,bg=light?WHITE:INK,fg=light?INK:WHITE;
 const nodes=[node('background','rect',{width:W,height:H,fill:bg,sound:false})],push=n=>nodes.push(n);
 const labels=['VECTOR FIELD','TOROIDAL ENGINE','ORDER / DISORDER','INTERFERENCE','KINETIC SYSTEM','MOTION LAB'];
 // Large forms are analytical functions of absolute time: repeat seeks are exact.
 if(chapter===0){
  const rows=Math.round(30+density*2.5);
  for(let j=0;j<rows;j++){const points=[];for(let i=0;i<100;i++){const x=140+i*16.8,a=x/420+u*1.7+j*.035;const envelope=Math.sin(i/99*Math.PI);points.push([x,540+(j-rows/2)*10+envelope*(160*Math.sin(a)+105*Math.sin(a*1.8+j*.1-u*2))]);}
   push(path('flow.'+j,points,j%8===0?accent:fg,j%8===0?3:1.1,{opacity:.3+.6*j/rows}));
  }
  for(let j=0;j<28;j++){const f=(hash(j)+u*(.12+hash(j+70)*.1))%1,x=140+f*1660,y=540+Math.sin(f*4+u*1.7)*170+(hash(j+22)-.5)*220;push(node('flow.head.'+j,'circle',{x,y,radius:j%4===0?5:2,fill:accent,sound:j%7===0}));}
  push(text('headline','FLOW',115,320,190,fg,{maxWidth:900,opacity:.95,x:115+18*Math.sin(u*2)}));
  push(text('flow.note','CONTINUOUS FIELD / '+String(rows).padStart(3,'0')+' STREAMS',120,845,22,fg));
 }
 if(chapter===1){
  const rings=Math.round(40+density*2),rot=u*.85,tilt=.55+Math.sin(u*.8)*.4;
  for(let j=0;j<rings;j++){const a=j/rings*TAU,pts=[];for(let i=0;i<=72;i++){const v=i/72*TAU,R=265+25*Math.sin(3*a+u*3),r=100+16*Math.sin(5*a-u*2);let x=(R+r*Math.cos(v))*Math.cos(a),y=(R+r*Math.cos(v))*Math.sin(a),z=r*Math.sin(v);let yy=y*Math.cos(tilt)-z*Math.sin(tilt),zz=y*Math.sin(tilt)+z*Math.cos(tilt),xx=x*Math.cos(rot)+zz*Math.sin(rot);zz=-x*Math.sin(rot)+zz*Math.cos(rot);const scale=950/(950-zz);pts.push([1000+xx*scale*1.4*kick,530+yy*scale*1.4*kick]);}push(path('torus.'+j,pts,j%9===0?accent:WHITE,j%9===0?3:1.1,{opacity:j%9===0?1:.45}));}
  push(text('torus.word','GENERATE.',105,870,100,WHITE,{x:105+12*Math.sin(u*3)}));
  for(let i=0;i<6;i++)push(node('torus.orbit.'+i,'circle',{x:1000+Math.cos(u*1.8+i*TAU/6)*510,y:530+Math.sin(u*1.8+i*TAU/6)*275,radius:5,fill:accent}));
 }
 if(chapter===2){
  const cols=Math.round(30+density),rows=18,morph=.5+.5*Math.sin((graphicsTime-chapter*20/11)*3.5-1.5),angle=u*.8;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const id=j*cols+i,a=id*.381966*TAU+angle,r=Math.sqrt(id/(rows*cols))*490;let x=mix(220+i*1480/(cols-1),960+Math.cos(a)*r*1.35,morph),y=mix(230+j*610/(rows-1),545+Math.sin(a)*r*.8,morph);const size=5+6*(.5+.5*Math.sin(i*.25+j*.3-u*5));push(node('swarm.'+id,'rect',{x,y,width:size*1.8,height:size*1.8,rotation:angle+id*.12*morph,fill:id%17===0?'#255cff':INK,opacity:.6+.4*hash(id),sound:id%90===0}));}
  push(text('swarm.title','ORDER → CHAOS',110,145,80,INK,{maxWidth:1400}));
  push(text('swarm.count',`${cols*rows} ELEMENTS / ONE RULE`,110,928,24,INK));
 }
 if(chapter===3){
  for(let family=0;family<2;family++)for(let j=0;j<40+density;j++){const pts=[];for(let i=0;i<=100;i++){let x=120+i*16.8,y=255+j*11+100*Math.sin(x*.006+u*2+family*2)+70*Math.sin(j*.12-u*3+family);pts.push([x,y]);}push(path('wave.'+family+'.'+j,pts,family?accent:'#6481ff',1.8,{blend:'screen',opacity:.7}));}
  for(let i=0;i<9;i++)push(node('interference.marker.'+i,'circle',{x:200+i*190,y:530+180*Math.sin(i*.7+u*3),radius:7+4*pulse,stroke:WHITE,lineWidth:2}));
  push(text('interference.word','SUPERPOSITION',110,890,110,WHITE,{maxWidth:1680}));
 }
 if(chapter===4){
  for(let i=0;i<26;i++){const phase=i/26,z=(phase+u*.4)%1,scale=.1+z*z*2.4,rot=.3*Math.sin(u*2)+i*.075,x=960+80*Math.sin(i*.3+u),y=535+60*Math.cos(i*.2+u);const pts=[[-460,-245],[460,-245],[460,245],[-460,245],[-460,-245]].map(([a,b])=>[x+(a*Math.cos(rot)-b*Math.sin(rot))*scale,y+(a*Math.sin(rot)+b*Math.cos(rot))*scale]);push(path('tunnel.'+i,pts,i%4===0?accent:WHITE,i%4===0?5:1.6,{opacity:Math.sin(z*Math.PI)}));}
  const word=String(g.title||'MOTION').slice(0,22).toUpperCase();for(let i=3;i>=0;i--)push(text('kinetic.word.'+i,word,960+(i-1.5)*12*Math.sin(beat*TAU/4),535+i*14,205,i===0?WHITE:accent,{align:'center',maxWidth:1600,opacity:i===0?1:.13,scaleX:1+.035*pulse,rotation:.02*Math.sin(u*4)}));
 }
 if(chapter===5){
  const p=progress(local,0,.22,'outCubic');push(text('final.title','MOTION LAB',960,480+35*(1-p),210,WHITE,{align:'center',maxWidth:1650,opacity:p}));push(text('final.subtitle','BUILT FROM RULES. MADE TO MOVE.',960,650,30,accent,{align:'center',opacity:p}));
  for(let i=0;i<60;i++)push(node('final.bar.'+i,'rect',{x:120+i*28,y:800,width:12,height:8+hash(i)*45*pulse,fill:accent,opacity:.8,sound:false}));
 }
 // Sub-beat instrumentation: quiet hierarchy around the main action, no full-screen flashes.
 push(text('brand','MOTION LAB',96,68,24,fg,{sound:false}));push(text('chapter',`${String(chapter+1).padStart(2,'0')} / ${labels[chapter]}`,1824,68,20,fg,{align:'right',sound:false}));
 push(path('top.rule',[[96,104],[1824,104]],fg,1,{opacity:.3}));
 push(text('footer','PROCEDURAL SYSTEMS / VOL. 01',96,1018,20,fg,{sound:false}));push(text('timecode',`${bpm} BPM  /  ${String(Math.floor(t*30)).padStart(4,'0')}`,1824,1018,20,fg,{align:'right',sound:false}));
 for(let i=0;i<44;i++){const active=i<=Math.floor(beat*2);push(node('meter.'+i,'rect',{x:680+i*13,y:1004,width:6,height:active?24:6,fill:accent,opacity:active?.9:.25,sound:false}));}
 for(let i=0;i<12;i++){const on=(Math.floor(beat*4)+i)%4===0;push(node('tick.'+i,'rect',{x:94,y:260+i*44,width:on?28:10,height:2,fill:fg,opacity:on?.9:.2,sound:false}));}
 // Traveling slit punctuates each chapter; its clip geometry drives adaptive wind SFX.
 const cut=local<.11&&chapter>0,slide=cut?1-progress(local,0,.11,'outCubic'):0;
 push(node('edit.slit','group',{clip:{type:'rect',width:W*slide,height:H},children:[node('edit.color','rect',{width:W,height:H,fill:accent})]}));
 return parameters.graphics?.cleanPreview?nodes.filter(n=>n.type!=='text'&&!/^lab\.(top\.rule|meter\.|tick\.)/.test(n.id)):nodes;
}
export function createProceduralDemo(config){const nodes=[];return{nodes,render(ctx,time,parameters={}){nodes.splice(0,nodes.length,...buildNodes(Number(time)||0,parameters));renderProcedural(ctx,Number(time)||0,{width:W,height:H,nodes,seed:recipe.seed});},nodesAt:buildNodes,config:{seed:recipe.seed,duration:config?.duration??10,width:W,height:H,graphics:recipe.defaults}};}
