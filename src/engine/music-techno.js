/** Original deterministic 132-BPM-ready synth arrangement, rendered as PCM. */
export function technoMusic({voice,duration,bpm,phase,seed,random}){
 const beat=60/bpm,TAU=Math.PI*2,notes=[0,0,12,0,7,0,10,3,0,12,0,7,3,0,10,7];
 for(let k=0;k*beat+phase<duration;k++){
  const at=k*beat+phase,rand=random(seed+4321+k*113),section=Math.floor(at/(20/11)),energy=section===2?.78:section>=3?1:.85;
  // Pitch envelope settles to a low fundamental; no borrowed audio samples.
  voice('music',at,.36,.36,0,(t,u)=>Math.tanh(1.5*Math.sin(TAU*(48*t+2.1*(1-Math.exp(-t*48)))))*Math.exp(-t*11)*Math.min(1,t/.002)*(1-u));
  if(k%2===1)voice('music',at,.18,.07,0,t=>rand()*(Math.exp(-t*32)+.4*Math.exp(-Math.abs(t-.018)*150)+.2*Math.exp(-Math.abs(t-.034)*150))*Math.min(1,t/.001));
  for(let j=0;j<4;j++){
   const off=at+j*beat/4,open=j===2,len=open?.13:.035;let low=0;
   voice('music',off,len,(open?.065:.018)*energy,j%2?.3:-.3,(t,u)=>{const n=rand();low+=.22*(n-low);return(n-low)*Math.exp(-t*(open?24:100))*Math.min(1,t/.001)*(1-u)});
   if(j!==0){const f=49*Math.pow(2,notes[(k*4+j)%16]/12);voice('music',off,beat*.23,.14*energy,0,(t,u)=>Math.tanh(1.4*(Math.sin(TAU*f*t)+.25*Math.sin(TAU*f*2*t)))*Math.sin(Math.PI*u)*Math.exp(-u*2));}
   if(section>=1&&(k*4+j)%3!==0){const f=196*Math.pow(2,notes[(k*4+j+5)%16]/12),env=.4+.6*((k+j)%4)/3;voice('music',off,beat*.36,.032*energy,j%2?.45:-.45,(t,u)=>{const filter=Math.exp(-u*(5+env*6));return Math.min(1,t/.006)*(Math.sin(TAU*f*t)+.35*filter*Math.sin(TAU*f*3*t)+.15*filter*Math.sin(TAU*f*5*t))*Math.exp(-u*5)});}
  }
  if(k%4===3)for(let j=0;j<4;j++)voice('music',at+beat*.5+j*beat/8,.05,.024, j%2?.6:-.6,t=>Math.sin(TAU*(750*t+Math.sin(t*110)*.5))*Math.exp(-t*80)*Math.min(1,t/.002));
 }
}
