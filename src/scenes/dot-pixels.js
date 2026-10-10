/** Pixel choreography: one deterministic cue sheet drives picture and bespoke SFX. */
export const dotPixelCues=[
 {at:.24,x:960,y:540,r:570,color:'#b1ffd9',power:.5},
 {at:1.81,x:1270,y:550,r:160,color:'#7655ed',power:.75},
 {at:3.27,x:1425,y:615,r:340,color:'#ffeca3',power:1},
 {at:3.66,x:780,y:900,r:110,color:'#fff8d3',power:.65},
 {at:4.44,x:780,y:900,r:140,color:'#186756',power:.8},
 {at:5.22,x:790,y:900,r:150,color:'#c5ffc9',power:.95},
 {at:6.49,x:625,y:650,r:190,color:'#ffd395',power:1},
 {at:7.36,x:625,y:575,r:260,color:'#d340a1',power:.85},
 {at:8.26,x:625,y:580,r:230,color:'#acaaff',power:.7},
 ...[0,1,2,3].map((i)=>({at:10.34+i*.17,x:340+i*390,y:846,r:85,color:['#ffc064','#ff95d7','#bdb9ff','#b0ffdf'][i],power:.8})),
 {at:11.93,x:1310,y:550,r:395,color:'#c8e5ff',power:.9},
 {at:14.48,x:620,y:550,r:390,color:'#dcffce',power:1},
 {at:15.26,x:620,y:550,r:325,color:'#ffe49d',power:.45}
];
const clamp=x=>Math.max(0,Math.min(1,x)),hash=x=>{const a=Math.sin(x*127.1+43.7)*43758.5453;return a-Math.floor(a);};
const snap=(x,grid=6)=>Math.round(x/grid)*grid;
/** Quantized reveal boundary: tile rows lock into a continuous color field. */
export function dotPixelWipe(c,col,q){
 if(q<=0)return;c.save();c.fillStyle=col;
 for(let row=0;row<23;row++){
  const jitter=(hash(row*3+8)-.5)*220*Math.sin(Math.PI*q);
  const edge=q>=1?0:snap((1-q)*2200-200+jitter,48),y=row*48;
  c.globalAlpha=1;c.fillRect(edge,y,2160-edge,48);
  if(q>.07&&q<.93){c.globalAlpha=.55;c.fillRect(edge-96,y+12,24,24);if(row%3===0){c.globalAlpha=.28;c.fillRect(edge-192,y,48,48);}}
 }
 c.restore();
}
function square(c,x,y,s,col,alpha){c.globalAlpha=alpha;c.fillStyle=col;c.fillRect(snap(x),snap(y),s,s);}
function cross(c,x,y,s,col,alpha){square(c,x-s,y,s*3,col,alpha);square(c,x,y-s,s,col,alpha);square(c,x,y+s,s,col,alpha);}

export function drawDotPixels(c,t,layer='front',{protectDisplay=null}={}){
 c.save();
 // Final foreground pixels orbit the physical enclosure; they cannot float over its LED glass.
 if(layer==='front'&&protectDisplay?.length){c.beginPath();c.rect(-4096,-4096,10112,9272);c.moveTo(...protectDisplay[0]);for(const point of protectDisplay.slice(1))c.lineTo(...point);c.closePath();c.clip('evenodd');}
 // A very low-contrast matrix gives the empty dark field depth; no raster over the type.
 if(layer==='back'&&t>6.32){
  const alpha=t>13.8?.11:.07;c.fillStyle=t>13.8?'#d1bfff':'#b9a3ef';
  for(let y=66;y<1080;y+=36)for(let x=34;x<1920;x+=36){
   const radius=Math.hypot(x-760,y-520),wave=Math.max(0,Math.sin(radius*.011-t*2.4));
   c.globalAlpha=alpha*wave**6*(.2+.8*hash(x+y*2));c.fillRect(x,y,2.5,2.5);
  }
 }
 for(let k=0;k<dotPixelCues.length;k++){
  const e=dotPixelCues[k],age=t-e.at,duration=.56+e.power*.16;if(age<0||age>duration)continue;
  const u=age/duration,fade=Math.min(1,u*12)*(1-u)**1.6;
  const count=layer==='back'?48:24;
  for(let j=0;j<count;j++){
   const seed=k*91+j,angle=hash(seed+5)*Math.PI*2;
   const speed=95+hash(seed+71)*180,rad=e.r+(1-Math.exp(-u*4))*speed;
   // The forward pass hugs the silhouette. Faces and editorial text remain clear.
   let x=e.x+Math.cos(angle)*rad,y=e.y+Math.sin(angle)*rad*.82;
   if(e.y>800){x=e.x+Math.cos(angle)*rad*1.1;y=e.y-Math.abs(Math.sin(angle))*rad*(.3+u*.6)+u*u*65;}
   if(layer==='front'&&((t>6.5&&t<9&&x>955)||(t>11.6&&t<13.65&&x<930)||(t>14.1&&x>1090)))continue;
   const sz=(layer==='front'?6:9)*(1+Math.floor(hash(seed+13)*2)),a=fade*e.power*(layer==='back'?.28:.82);
   const landingGlow=k>=9&&k<=12,ledGlow=k===0||k===7||k===8;const pixelGlow=(ledGlow||landingGlow)&&j%3===0?Math.sin(Math.PI*u)**2:0;c.shadowColor=e.color;c.shadowBlur=(landingGlow?(layer==='front'?3.6:2.3):(layer==='front'?8:4.6))*pixelGlow;
   if(j%7===0)cross(c,x,y,sz,e.color,a);else square(c,x,y,sz,e.color,a);c.shadowBlur=0;
   if(layer==='back'&&j%3===0){for(let q=1;q<4;q++)square(c,x-Math.cos(angle)*q*15,y-Math.sin(angle)*q*15,sz,e.color,a*(1-q/4));}
  }
 }
 // Pixel streaks inherit the direction of the character pullbacks and the cast gathering.
 const sweeps=[{a:1.56,b:2.15,x:1120,y:550,dir:-1,col:'#a993ff'},
  {a:5.98,b:6.52,x:960,y:550,dir:1,col:'#f8d497'},
  {a:10.99,b:11.94,x:1270,y:500,dir:1,col:'#c5b8ff'},
  {a:13.55,b:14.43,x:660,y:550,dir:-1,col:'#ffdbad'}];
 if(layer==='back')for(const e of sweeps){const u=(t-e.a)/(e.b-e.a);if(u<=0||u>=1)continue;
  const energy=Math.sin(Math.PI*u)**1.5;
  for(let j=0;j<70;j++){const seed=j+e.a*100,row=hash(seed)*Math.PI*2;
   const r=140+hash(seed+1)*820,run=u*420,xx=e.x+Math.cos(row)*(r+run*e.dir),yy=e.y+Math.sin(row)*r*.58;
   c.globalAlpha=energy*(.08+.15*hash(seed+8));c.fillStyle=e.col;
   c.fillRect(snap(xx,12),snap(yy,12),12+Math.floor(hash(seed+3)*5)*12,6);
  }
 }
 // Fine pixel arcs resolve around the enclosure rather than a generic full-screen glitch.
 if(layer==='front'&&t>13.85&&t<15.6){const u=(t-13.85)/1.75,env=Math.sin(Math.PI*u)**2;
  for(let i=0;i<90;i++){const a=i/90*Math.PI*2+t*.7;if(Math.sin(a)>.8)continue;
   const r=414+12*Math.sin(i*.5+t*7),x=620+Math.cos(a)*r,y=550+Math.sin(a)*r;
   square(c,x,y,i%6===0?8:4,'#e6ffe0',env*(i%6===0?.52:.2));
  }
 }
 c.restore();
}
