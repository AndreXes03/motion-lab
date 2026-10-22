import sharp from 'sharp';

/** Bounded, display-space optical finish on the isolated beauty only. */
export async function finishLoopBeauty(input,{width,height,aberrationPx=.35,glowStrength=.035,glowRadiusPx=2,glowThreshold=.78}={}){
  const {data,info}=await sharp(input).resize(width,height).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,out=Buffer.from(data),glow=new Float32Array(w*h*3);
  const radius=Math.max(1,Math.round(Math.min(3,glowRadiusPx)*h/1080));
  if(glowStrength>0)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=(y*w+x)*4,peak=Math.max(data[p],data[p+1],data[p+2])/255;
    if(peak<=glowThreshold||!data[p+3])continue;
    let a=Math.min(1,(peak-glowThreshold)/(1-glowThreshold));a=a*a*(3-2*a)*data[p+3]/255*glowStrength;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
      const xx=x+i*radius,yy=y+j*radius;if(xx<0||xx>=w||yy<0||yy>=h)continue;
      const weight=(i===0?2:1)*(j===0?2:1)/16,k=(yy*w+xx)*3;
      for(let c=0;c<3;c++)glow[k+c]+=data[p+c]*a*weight;
    }
  }
  const sample=(x,y,c)=>{
    x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
    const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
    return (data[(y0*w+x0)*4+c]*(1-fx)+data[(y0*w+x1)*4+c]*fx)*(1-fy)+(data[(y1*w+x0)*4+c]*(1-fx)+data[(y1*w+x1)*4+c]*fx)*fy;
  };
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=(y*w+x)*4,k=(y*w+x)*3,dx=(x+.5)/w-.5,dy=(y+.5)/h-.5,r=Math.hypot(dx,dy),edge=Math.min(1,r*Math.SQRT2);
    const amount=r?edge*edge*aberrationPx*h/1080/r:0,ox=dx*amount,oy=dy*amount;
    out[p]=Math.min(255,sample(x+ox,y+oy,0)+glow[k]);
    out[p+1]=Math.min(255,data[p+1]+glow[k+1]);
    out[p+2]=Math.min(255,sample(x-ox,y-oy,2)+glow[k+2]);
  }
  return sharp(out,{raw:info}).png().toBuffer();
}
