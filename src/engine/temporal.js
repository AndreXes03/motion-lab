/** Deterministic, centered exposure samples. Times are seconds; cut time starts the new shot. */
export function shutterSamples(time,{fps=30,duration=10,samples=24,shutterAngle=210,cuts=[],profile='cosine'}={}){
 if(!Number.isFinite(time)||!Number.isFinite(fps)||fps<=0||!Number.isFinite(duration)||duration<=0)throw new Error('Temporal time, fps and duration must be finite; fps and duration positive');
 if(time<0||time>duration)throw new Error('Temporal frame time is outside duration');
 if(!Number.isInteger(samples)||samples<1||samples>64)throw new Error('Temporal samples must be an integer from 1 to 64');
 if(!Number.isFinite(shutterAngle)||shutterAngle<0||shutterAngle>360)throw new Error('Shutter angle must be 0..360');
 if(!Array.isArray(cuts))throw new Error('Motion cuts must be an array of seconds or {time}/{t} objects');
 const times=cuts.map(c=>typeof c==='number'?c:c?.time??c?.t);
 if(times.some(t=>!Number.isFinite(t)||t<0||t>duration))throw new Error('Every motion cut must have a finite time within duration');
 if(!['cosine','box'].includes(profile))throw new Error('Unknown shutter profile');
 if(samples===1||shutterAngle===0)return [{time,weight:1}];
 const span=shutterAngle/360/fps,half=span/2;
 let shotStart=0,shotEnd=duration;
 for(const cut of times){if(cut<=time)shotStart=Math.max(shotStart,cut);else shotEnd=Math.min(shotEnd,cut);}
 const lo=Math.max(shotStart,time-half),hi=Math.min(shotEnd,time+half);
 if(hi<=lo)return [{time,weight:1}];
 // Midpoints avoid the cut itself and use one deterministic sample in each stratum.
 // Smooth cosine weighting approximates gradual shutter opening/closing, without random jitter.
 const schedule=Array.from({length:samples},(_,i)=>{const t=lo+(i+.5)*(hi-lo)/samples,u=(t-time)/half;return {time:t,weight:profile==='box'?1:Math.max(0,.75+.25*Math.cos(Math.PI*u))};});
 const total=schedule.reduce((sum,s)=>sum+s.weight,0);schedule.forEach(s=>s.weight/=total);return schedule;
}
