/** Object-local travel drives detents, hinge travel and bearings. No baked timestamps. */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const angle=(a,b)=>2*Math.acos(clamp(Math.abs(a.reduce((n,v,i)=>n+v*b[i],0))));
export function planFoley(telemetry,settings){
 const {frames,rate}=telemetry,dt=1/rate,events=[],sources=[];
 for(const [name,first]of Object.entries(frames[0].objects)){
  const profile=first.soundProfile;if(!['dial','hinge','rotor','bearing'].includes(profile)||!first.localQuaternion)continue;
  sources.push(name);const speed=frames.map((f,i)=>i&&!(telemetry.cuts||[]).some(t=>t>=(i-1)*dt&&t<=i*dt)?angle(f.objects[name].localQuaternion,frames[i-1].objects[name].localQuaternion)/dt:0);
  const add=(foley,index,duration,gain,extra={})=>{const o=frames[index].objects[name];if(o.visibility<.035)return;events.push({module:'objects',kind:settings.objectKit,foley,time:index*dt,duration,gain:gain*o.visibility,pan:o.pan,pitch:1,source:name,detail:profile==='dial'?'dial':profile==='hinge'?'hinge':'gyro',...extra});};
  if(profile==='dial'){
   let travel=0;const detent=.1;for(let i=1;i<frames.length;i++){travel+=speed[i]*dt;if(travel>=detent){travel%=detent;add('dial-click',i,.036,.16+clamp(speed[i]/8)*.1,{pitch:.86+clamp(speed[i]/5)*.7});}}
  }else if(profile==='hinge'){
   let start=null;
   for(let i=1;i<frames.length;i++){
    if(speed[i]>.035&&start===null)start=i;
    if(start!==null&&(speed[i]<=.035||i===frames.length-1)){
     const end=i,span=(end-start)*dt;if(span>.05){const opening=frames[end].objects[name].localRotation[1]<frames[start].objects[name].localRotation[1];
      const peak=Math.max(...speed.slice(start,end+1)),shape=speed.slice(start,end+1).map(v=>v/peak);
      add(opening?'latch-release':'hinge-start',start,.10,opening?.24:.10);
      add('hinge-glide',start,span,.18,{shape,shapeRate:rate,peakSpeed:peak});
      add(opening?'hinge-stop':'latch-close',end,opening?.09:.14,opening?.13:.3);
     }start=null;
    }
   }
  }else{
   // Long overlapping bearing grains avoid the old repeated buzzing texture.
   const step=Math.round(rate*.22);
   for(let i=step;i<frames.length;i+=step)if(speed[i]>.05)add(profile==='rotor'?'rotor-spin':'bearing',i,.38,Math.min(.16,speed[i]*.04),{pitch:.6+clamp(speed[i]/5)*1.9});
   if(profile==='bearing')for(let i=2;i<frames.length-1;i++)if(speed[i]<.018&&speed[i]<=speed[i-1]&&speed[i]<speed[i+1]&&speed.slice(Math.max(0,i-20),i).some(v=>v>.2))add('bearing-seat',i,.055,.075);
  }
 }
 return {events,sources};
}
export function foleySample(e,t,u,noise,low){
 const TAU=Math.PI*2,attack=Math.min(1,Math.max(0,t)/.0015),tail=Math.min(1,Math.max(0,1-u)*12),p=e.pitch||1;
 if(e.foley==='dial-click')return attack*tail*Math.exp(-t*145)*(Math.sin(TAU*1650*p*t)*.55+Math.sin(TAU*2700*p*t)*.15+(noise-low)*.25);
 if(e.foley==='latch-release')return attack*tail*Math.exp(-t*62)*(Math.sin(TAU*880*t)*.35+Math.sin(TAU*2180*t)*.12+noise*.23);
 if(e.foley==='latch-close')return attack*tail*(Math.exp(-t*62)*(Math.sin(TAU*260*t)*.55+Math.sin(TAU*1860*t)*.22+noise*.22)+Math.exp(-(((t-.028)/.009)**2))*Math.sin(TAU*740*t)*.13);
 if(e.foley==='hinge-start'||e.foley==='hinge-stop'||e.foley==='bearing-seat')return attack*tail*Math.exp(-t*90)*(Math.sin(TAU*460*t)*.42+low*.25);
 if(e.foley==='hinge-glide'){const at=clamp(t*e.shapeRate,0,e.shape.length-1),i=Math.floor(at),v=e.shape[i]+((e.shape[i+1]??e.shape[i])-e.shape[i])*(at-i);return Math.sin(Math.PI*clamp(u))**.5*v*(low*.28+Math.sin(TAU*(90*t+22*t*t))*.06);}
 if(e.foley==='rotor-spin')return Math.sin(Math.PI*clamp(u))**2*(Math.sin(TAU*210*p*t+Math.sin(TAU*31*t)*.15)*.09+low*.12);
 return Math.sin(Math.PI*clamp(u))**2*(low*.18+Math.sin(TAU*330*p*t)*.035);
}
