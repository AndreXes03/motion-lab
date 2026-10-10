import {landingLift,explodedImpact} from '../engine/impact-motion.js';
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function pulseLanding(time){
 const dt=time-4.45;if(dt<=0)return landingLift(time);
 return landingLift(time)+.095*Math.exp(-6.4*dt)*Math.abs(Math.sin(23*dt))*(1-smooth((dt-.46)/.18));
}
export function pulseExplosion(time,index,kind){
 const base=explodedImpact(time,index,kind),dt=time-9.62;
 if(dt<=0||dt>=.70)return base;
 return Math.min(1,base+.14*Math.exp(-7*dt)*Math.abs(Math.sin(24*dt))*(1-smooth((dt-.46)/.24)));
}
export function lensCameraTime(time){
 // Fast at the edit, unhurried through the object read. Existing cut boundaries
 // and the original speaker-to-display match transition remain exact.
 for(const [a,b] of [[1.70,2.43],[2.45,3.45],[3.45,4.25],[5.25,5.9],[5.9,6.675]]){
  if(time>=a&&time<=b){const u=(time-a)/(b-a),k=3.7;return a+(b-a)*(.5+Math.sinh(k*(u-.5))/(2*Math.sinh(k*.5)));}
 }
 return time;
}
