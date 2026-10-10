import * as T from 'three';
const fract=x=>x-Math.floor(x),hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7+17.31)*43758.5453123);
const smooth=x=>x*x*(3-2*x),mix=(a,b,t)=>a+(b-a)*t;
function noise(x,y,period=256){const X=Math.floor(x),Y=Math.floor(y),u=smooth(fract(x)),v=smooth(fract(y));const h=(i,j)=>hash((i%period+period)%period,(j%period+period)%period);return mix(mix(h(X,Y),h(X+1,Y),u),mix(h(X,Y+1),h(X+1,Y+1),u),v);}
// Seamless cell edges and coherent fibres, never a periodic sine-grid.
export function organicSurface(kind){
 const n=1024,heights=new Float32Array(n*n),color=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4),normal=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n;let h;
  if(kind==='leather'){
   const px=u*72,py=v*72,ix=Math.floor(px),iy=Math.floor(py);let a=10,b=10;
   for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=ix+i,cy=iy+j,sx=cx+.15+.7*hash((cx+72)%72,(cy+72)%72),sy=cy+.15+.7*hash((cy+72)%72+100,(cx+72)%72);const dist=Math.hypot(px-sx,py-sy);if(dist<a){b=a;a=dist;}else b=Math.min(b,dist);}
   const edge=Math.min(1,(b-a)*9);h=.18+.52*smooth(edge)+.17*noise(u*128,v*128,128)+.1*noise(u*32,v*32,32);
  }else if(kind==='paper')h=.28*noise(u*64,v*64,64)+.32*noise(u*256,v*32,256)+.24*noise(u*128,v*256,256)+.16*noise(u*512,v*512,512);
  else h=.6*noise(u*8,v*512,512)+.25*noise(u*4,v*128,128)+.15*noise(u*64,v*512,512);
  heights[y*n+x]=h;
  const albedo=Math.round(kind==='paper'?185+45*h:225+24*h),r=Math.round(kind==='paper'?215+30*h:kind==='leather'?182+45*h:155+65*h);
  color.set([albedo,albedo,albedo,255],(y*n+x)*4);rough.set([r,r,r,255],(y*n+x)*4);
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const h=(a,b)=>heights[((b+n)%n)*n+(a+n)%n];const strength=kind==='leather'?1.1:kind==='paper'?.9:.45,dx=(h(x+1,y)-h(x-1,y))*strength,dy=(h(x,y+1)-h(x,y-1))*strength,len=Math.hypot(dx,dy,1);normal.set([Math.round(127.5-127.5*dx/len),Math.round(127.5-127.5*dy/len),Math.round(127.5+127.5/len),255],(y*n+x)*4);}
 const tex=(data,srgb=false)=>{const t=new T.DataTexture(data,n,n,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,2);t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=8;t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.needsUpdate=true;return t;};
 return {map:tex(color,true),roughnessMap:tex(rough),normalMap:tex(normal)};
}
