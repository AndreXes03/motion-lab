// Absolute-time, C2-continuous motion utilities. Preserve velocity and
// acceleration at both ends rather than easing a moving layout blend.
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const smoother=x=>{x=clamp01(x);return x*x*x*(10+x*(-15+6*x));};
export const arcEnvelope=x=>{x=clamp01(x);return 64*x*x*x*(1-x)**3;};
export function quinticHermite(p0,p1,v0,v1,a0,a1,u,duration){
 const u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
 return (1-10*u3+15*u4-6*u5)*p0+(u-6*u3+8*u4-3*u5)*duration*v0+(u2-3*u3+3*u4-u5)*duration*duration*a0/2+(10*u3-15*u4+6*u5)*p1+(-4*u3+7*u4-3*u5)*duration*v1+(u3-2*u4+u5)*duration*duration*a1/2;
}
const keys=['x','y','scale','rotation','yaw','pitch','z','alpha'];
export function spliceMotion(source,destination,t,start,duration){
 if(t<=start)return source(t);
 if(t>=start+duration)return destination(t);
 const dt=.002,finish=start+duration,a=source(start),b=destination(finish);
 const am=source(start-dt),ap=source(start+dt),bm=destination(finish-dt),bp=destination(finish+dt),u=(t-start)/duration,out={id:a.id};
 for(const k of keys){const p0=a[k]??0,p1=b[k]??0;out[k]=quinticHermite(p0,p1,((ap[k]??0)-(am[k]??0))/(2*dt),((bp[k]??0)-(bm[k]??0))/(2*dt),((ap[k]??0)-2*p0+(am[k]??0))/(dt*dt),((bp[k]??0)-2*p1+(bm[k]??0))/(dt*dt),u,duration);}
 return out;
}

// Local time acceleration peaks on the edit, while preserving the cut time.
// Positive derivative throughout: brisk travel survives either side of the whip.
export function replayEditTime(t){
 let warped=t;
 for(const cut of [2.4,5.4,7.7,9.4,11.4,13.2]){
  const d=t-cut,w=.19;
  warped+=(cut>=11.4?.72:1.18)*d*Math.exp(-.5*(d/w)**2);
 }
 return Math.max(0,Math.min(15,warped));
}
