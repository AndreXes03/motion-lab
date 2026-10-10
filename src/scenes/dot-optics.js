/** Spatial lens breathing: emissive macros bulge; final editorial text stays outside the lens region. */
export function applyDotOptics(ctx,t,w,h){
 const bell=(x,a,b)=>x<=a||x>=b?0:Math.sin((x-a)/(b-a)*Math.PI)**2;
 const macro=t<1.65?.7:bell(t,5.94,6.73),clock=bell(t,11.05,13.5),product=t>13.6?Math.min(1,(t-13.6)/.7):0;
 if(macro<.001&&clock<.001&&product<.001)return;
 const frame=ctx.getImageData(0,0,w,h),src=new Uint8ClampedArray(frame.data),d=frame.data;
 const local=clock>macro&&clock>product,midX=local?w*.682:product?w*.325:w*.5,midY=h*.5;
 const rx=local?w*.29:product?w*.31:w*.62,ry=h*.66,k=.15*macro+.105*clock+.09*product;
 const sample=(x,y,ch)=>{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;return (src[(y0*w+x0)*4+ch]*(1-fx)+src[(y0*w+x1)*4+ch]*fx)*(1-fy)+(src[(y1*w+x0)*4+ch]*(1-fx)+src[(y1*w+x1)*4+ch]*fx)*fy;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=(x-midX)/rx,dy=(y-midY)/ry,r2=dx*dx+dy*dy;if(r2>=1)continue;
  const fall=(1-r2)**2,fac=1-k*fall,xx=midX+(x-midX)*fac,yy=midY+(y-midY)*fac,i=(y*w+x)*4,shift=w/1920*.42*dx*r2*Math.max(macro,product)*fall;
  d[i]=sample(xx+shift,yy,0);d[i+1]=sample(xx,yy,1);d[i+2]=sample(xx-shift,yy,2);
 }
 ctx.putImageData(frame,0,0);
}
