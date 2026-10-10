import {seededNoise} from './procedural.js';
/** Samples the actual Canvas2D graph without drawing or creating WebGL. */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const val=(v,t,c,f=0)=>typeof v==='function'?v(t,c):v??f;
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const bounds=(m,x,y,w,h)=>{const p=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(v=>point(m,...v));return {x:Math.min(...p.map(v=>v[0])),y:Math.min(...p.map(v=>v[1])),r:Math.max(...p.map(v=>v[0])),b:Math.max(...p.map(v=>v[1]))};};
const area=b=>Math.max(0,b.r-b.x)*Math.max(0,b.b-b.y);
const intersection=(a,b)=>({x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),r:Math.min(a.r,b.r),b:Math.min(a.b,b.b)});
export function sampleGraph(nodes,time,{width=1920,height=1080,seed=1}={}){
 const context={width,height,seed,noise:seededNoise(seed)},items=[],viewport={x:0,y:0,r:width,b:height};
 function visit(node,parent,alpha,clip,silent=false){
  silent ||= node.sound===false;
  const n=k=>val(node[k],time,context),sx=val(node.scaleX,time,context,1),sy=val(node.scaleY,time,context,1),rotation=n('rotation'),cos=Math.cos(rotation),sin=Math.sin(rotation);
  const m=mul(parent,[cos*sx,sin*sx,-sin*sy,cos*sy,n('x'),n('y')]);alpha*=clamp(val(node.opacity,time,context,1));
  const shape=val(node.clip,time,context,null);
  if(shape){let box;if(shape.type==='rect')box=bounds(m,0,0,val(shape.width,time,context),val(shape.height,time,context));else if(shape.type==='circle'){const r=val(shape.radius,time,context);box=bounds(m,-r,-r,r*2,r*2);}else box=viewport;
   clip=intersection(clip,box);
   if(shape.type==='rect')items.push({id:node.id+'.clip',box:viewport,alpha,clip:viewport,transition:true,size:[Math.max(0,box.r-box.x)/width,Math.max(0,box.b-box.y)/height],m,type:'transition',silent});
  }
  if(node.type==='group'){for(const child of node.children||[])visit(child,m,alpha,clip,silent);return;}
  let x=0,y=0,w=0,h=0;
  if(node.type==='circle'){const r=n('radius');x=y=-r;w=h=r*2;}
  else if(node.type==='text'){const font=val(node.font,time,context,'16px sans-serif'),fs=Number(/([\d.]+)px/.exec(font)?.[1]||16);w=Math.min(val(node.maxWidth,time,context,Infinity),String(val(node.text,time,context,'')).length*fs*.62);h=fs*1.2;x=val(node.align,time,context,'left')==='center'?-w/2:val(node.align,time,context,'left')==='right'?-w:0;y=-h/2;}
  else if(node.type==='rect'){w=n('width');h=n('height');}
  else{const values=val(node.commands,time,context,[]).filter(c=>['M','L','Q','C'].includes(c[0])).flatMap(c=>c.slice(1).map(v=>val(v,time,context)));const xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2===1);if(xs.length){x=Math.min(...xs);y=Math.min(...ys);w=Math.max(...xs)-x;h=Math.max(...ys)-y;}}
  const box=bounds(m,x,y,Math.max(w,1),Math.max(h,1));items.push({id:node.id,box,clip,alpha,m,type:node.type,size:[Math.abs(w*sx)/width,Math.abs(h*sy)/height],cover:node.type==='rect'&&!!node.fill&&alpha>.98,silent});
 }
 for(const node of nodes)visit(node,[1,0,0,1,0,0],1,viewport);
 const covers=items.filter(b=>b.cover);const objects={};for(let i=0;i<items.length;i++){
  if(items[i].silent)continue;
  const a=items[i],visible=intersection(intersection(a.box,a.clip),viewport),total=area(a.box);let visibility=a.alpha*(total?area(visible)/total:0);
  // Later opaque rectangles suppress hidden layers (including chapter backgrounds).
  if(!a.transition&&visibility>0)for(const b of covers){if(items.indexOf(b)>i){const coverage=area(intersection(visible,intersection(b.box,b.clip)))/Math.max(1,area(visible));visibility*=1-clamp(coverage);}}
  const cx=(a.box.x+a.box.r)/2,cy=(a.box.y+a.box.b)/2,rotation=Math.atan2(a.m[1],a.m[0]);
  objects[a.id]={position:[cx/width*8,cy/height*4,0],quaternion:[0,0,Math.sin(rotation/2),Math.cos(rotation/2)],visibility:a.silent?0:visibility,opacity:a.alpha,pan:clamp(cx/width*2-1,-.85,.85),size:a.size,renderKind:a.type,transition:!!a.transition,importance:clamp(Math.sqrt(total/(width*height))*3,.05,1)};
 }
 return objects;
}
export function sampleProceduralMotion(nodesAt,{duration=10,rate=60,width=1920,height=1080,seed=1}={}){
 const frames=[],registry=new Map();for(let i=0;i<=Math.ceil(duration*rate);i++){const time=Math.min(duration,i/rate),objects=sampleGraph(nodesAt(time),time,{width,height,seed});for(const [id,o]of Object.entries(objects))if(!registry.has(id))registry.set(id,o);frames.push({time,camera:{position:[0,0,10],quaternion:[0,0,0,1]},objects});}
 for(const f of frames)for(const[id,o]of registry)if(!f.objects[id])f.objects[id]={...o,visibility:0,opacity:0};
 return {kind:'procedural',duration,rate,frames,cuts:[]};
}
export function planProceduralSound(telemetry,settings){
 const {frames,rate,duration}=telemetry,dt=1/rate,events=[],curves={camera:Array(frames.length).fill(0)},candidates=[];
 const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(const name of Object.keys(frames[0].objects)){
  const samples=frames.map(f=>f.objects[name]),transition=samples[0].transition;
  const speed=samples.map((o,i)=>{if(!i)return 0;const p=samples[i-1];if(o.visibility<.025&&p.visibility<.025)return 0;const dot=Math.min(1,Math.abs(o.quaternion.reduce((s,v,k)=>s+v*p.quaternion[k],0)));return (dist(o.position,p.position)+2*Math.acos(dot)*.35+dist(o.size,p.size)*8)/dt;});curves[name]=speed;
  if(transition){
   let first=null;for(let i=1;i<speed.length;i++){curves.camera[i]+=speed[i];if(speed[i]>.06&&first===null)first=i-1;if(first!==null&&(speed[i]<=.06||i===speed.length-1)){const last=i,span=(last-first)*dt,peak=Math.max(...speed.slice(first,last+1)),extent=speed.slice(first,last+1).reduce((s,x)=>s+x*dt,0);if(span>.04)events.push({module:'camera',kind:settings.cameraKit,time:first*dt,duration:span,gain:.38*peak/(peak+8),pan:0,pitch:1,source:name,peakSpeed:peak,extent,shape:speed.slice(first,last+1).map(v=>v/peak),shapeRate:rate});first=null;}}
   continue;
  }
  for(let i=1;i<samples.length;i++){
   const o=samples[i],p=samples[i-1];if(o.visibility<.06)continue;
   if(p.visibility<.14&&o.visibility>=.14&&o.renderKind!=='path')candidates.push({module:'accents',graphic:'pop',kind:settings.accentKit,time:i*dt,duration:.12,gain:.16*o.importance,pan:o.pan,pitch:o.renderKind==='text'?.75:1.3,source:name,score:o.importance});
   if(i>5&&speed[i]<.04&&speed[i-1]>=.04&&Math.max(...speed.slice(i-5,i))>.4)candidates.push({module:'accents',graphic:'settle',kind:settings.accentKit,time:i*dt,duration:.1,gain:.13*o.importance,pan:o.pan,pitch:.9,source:name,score:o.importance*.8});
   if(i%Math.round(rate*(.35-.15*settings.density))===0&&speed[i]>.12)candidates.push({module:'objects',graphic:o.renderKind==='text'?'type-glide':'shape-glide',kind:settings.objectKit,time:i*dt,duration:.25,gain:Math.min(.16,speed[i]*.035)*o.visibility*o.importance,pan:o.pan,pitch:.65+Math.min(1.8,speed[i]*.3),source:name,score:o.importance*Math.min(2,speed[i])});
  }
 }
 // Select the main gestures instead of sounding every dot in a repeated grid.
 const gap=.28-.16*settings.density,bins=new Map();for(const e of candidates){const key=e.module+':'+Math.floor(e.time/gap);if(!bins.has(key)||e.score>bins.get(key).score)bins.set(key,e);}events.push(...bins.values());
 return {events:events.filter(e=>e.time<duration).sort((a,b)=>a.time-b.time),curves};
}
