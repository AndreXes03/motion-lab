import {validateAppDemo,appDemoExample,appDemoDuration} from '../engine/app-demo.js';
import {renderProcedural,progress} from '../engine/procedural.js';
import {sampleAnimationGroupTime} from '../engine/animation-groups.js';
const ink='#f3f4ed',muted='#a3aaa6',bg='#111716';
const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const text=(id,value,x,y,size,width,extra={})=>({id,type:'text',text:value,x,y,font:`600 ${size}px Arial`,fill:ink,wrapWidth:width,lineHeight:size*1.12,maxLines:3,...extra});
const rect=(id,x,y,width,height,fill,radius=0)=>({id,type:'rect',x,y,width,height,fill,cornerRadius:radius});
/** Same graph and absolute-time animation for Canvas and native Skia. */
export function appDemoNodes(time,parameters={}){
 const d=validateAppDemo(parameters.appDemo??appDemoExample),duration=appDemoDuration(d),t=Math.max(0,Math.min(duration-1/30,time));
 const accentInk=luminance(d.accent)>.18?'#142014':ink,accentText=luminance(d.accent)>.12?d.accent:ink;
 const gain=parameters.sceneControls?.movement??1,scale=parameters.sceneControls?.typeSize??1;
 const nodes=[rect('background',0,0,1920,1080,bg),rect('hairline',100,152,1720,1,'#ffffff20')];
 nodes.push(text('brand',d.name,100,106,27,1200,{fill:accentText}),text('section','PRODUCT WALKTHROUGH',1820,106,18,500,{align:'right',fill:muted}));
 if(d.logo)nodes.push({id:'logo',type:'image',asset:d.logo,x:100,y:50,width:44,height:44,fit:'contain'});
 if(d.logo)nodes.find(n=>n.id==='brand').x=164;
 let start=3,index=-1;for(let i=0;i<d.slides.length;i++){if(t>=start&&t<start+d.slides[i].duration){index=i;break;}start+=d.slides[i].duration;}
 const closing=t>=duration-3,local=closing?t-(duration-3):index>=0?t-start:t;
 const enter=progress(local,0,.65,'outCubic');
 if(index<0){
  const headline=closing?d.ending:d.benefit;
  nodes.push(rect('accent-line',100,274,72,5,d.accent));
  nodes.push(text('hero',headline,100,390+(1-enter)*32*gain,112*scale,1350,{opacity:.35+.65*enter,maxLines:3}));
  if(closing){const ctaWidth=Math.min(1480,Math.max(360,d.cta.length*19+90));nodes.push(rect('cta-bg',100,820,ctaWidth,94,d.accent,18),text('cta',d.cta,138,880,31,ctaWidth-76,{fill:accentInk,maxLines:1}));}
  else nodes.push(text('intro-note','A closer look at '+d.name,104,903,28,1500,{fill:muted}));
 }else{
  const s=d.slides[index],pose=sampleAnimationGroupTime({...parameters,scene:'appdemo'},'graphics',t)-start;
  const focus=progress(pose,.6,Math.min(2.2,s.duration*.55),'inOutCubic');
  const zoom=1+(s.focus.zoom-1)*focus*gain;
  nodes.push(text('step',`${String(index+1).padStart(2,'0')} / ${String(d.slides.length).padStart(2,'0')}`,100,247,22,300,{fill:accentText}));
  nodes.push(text('headline',s.title,100,340+(1-enter)*20*gain,64*scale,560,{opacity:.45+.55*enter,maxLines:3}));
  nodes.push(text('caption',s.caption,102,660,28,505,{fill:muted,lineHeight:39,maxLines:4,font:'400 28px Arial'}));
  nodes.push(rect('image-border',718,212,1102,738,'#35423b',25),rect('image-bg',720,214,1098,734,'#1c2521',24));
  nodes.push({id:'screen-window',type:'group',x:740,y:234,clip:{type:'rect',width:1058,height:694,cornerRadius:14},children:[{id:'screen',type:'image',asset:s.asset,width:1058,height:694,fit:'contain',zoom,focusX:s.focus.x,focusY:s.focus.y}]});
  nodes.push(rect('progress-track',100,901,510,3,'#334038'),rect('progress-fill',100,901,510*Math.min(1,local/s.duration),3,d.accent));
 }
 nodes.push(text('footer',closing?'YOUR NEXT STEP':index>=0?'REAL SCREENS. ONE CLEAR STORY.':'FROM AN IDEA TO A CLEAR RESULT.',100,1022,17,1500,{fill:muted}));
 return nodes;
}
export function createAppDemo(){let images=new Map(),pending=new Map();
 async function prepare(parameters={}){const d=validateAppDemo(parameters.appDemo??appDemoExample);await Promise.all([...new Set([...d.slides.map(s=>s.asset),d.logo].filter(Boolean))].map(asset=>{if(images.has(asset))return;if(!pending.has(asset))pending.set(asset,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images.set(asset,image);resolve();};image.onerror=()=>{pending.delete(asset);reject(Error('Image unavailable. Reimport the screenshot: '+asset));};image.src=asset;}));return pending.get(asset);}));}
 return {prepare,nodesAt:appDemoNodes,images,render(ctx,t,p,w,h){ctx.save();ctx.scale(w/1920,h/1080);try{renderProcedural(ctx,t,{width:1920,height:1080,nodes:appDemoNodes(t,p),images});}finally{ctx.restore();}},animationChannels:()=>[{id:'graphics.focus',label:'Screen zoom',unit:'ratio'}],animationState:(group,t,p)=>({'graphics.focus':appDemoNodes(t,p).find(n=>n.id==='screen-window')?.children[0]?.zoom??1})};
}
