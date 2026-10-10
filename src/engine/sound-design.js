import {technoMusic} from './music-techno.js';
import {planProceduralSound} from './sound-procedural.js';
import {windSample,windSampleRate} from '../assets/audio/wind-sample.js';
import {planFoley,foleySample} from './sound-foley.js';
/** Deterministic PCM sound engine. Shared by the viewer and offline exports. */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;
export const soundDefaults={enabled:true,camera:.22,objects:.38,accents:.25,dial:.85,hinge:.85,gyro:.5,music:.38,master:.8,density:.65,musicStyle:'scene',tempo:'auto',bpm:132,seed:42,cameraKit:'air',objectKit:'mechanical',accentKit:'soft'};
export const soundKits={camera:['air','silk','deep','grain','swirl','reverse','bright','riser'],objects:['mechanical','metal','plastic','glass','rubber','wood','electric','ceramic'],accents:['soft','click','knock','snap','ping','sub','chime','pop']};
export function normalizeSound(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid sound settings');
 for(const k of Object.keys(input))if(!(k in soundDefaults))throw Error('Unknown sound setting: '+k);
 const s={...soundDefaults,...input};if(!['scene','ambient','techno'].includes(s.musicStyle))throw Error('Invalid music style');
 if(typeof s.enabled!=='boolean'||!['auto','manual'].includes(s.tempo))throw Error('Invalid sound mode');
 for(const k of ['camera','objects','accents','music','master','density','dial','hinge','gyro'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1)throw Error('Sound '+k+' must be 0..1');
 if(!Number.isFinite(s.bpm)||s.bpm<60||s.bpm>180)throw Error('BPM must be 60..180');
 if(!Number.isInteger(s.seed)||s.seed<0||s.seed>999999)throw Error('Invalid sound seed');
 for(const [k,v] of Object.entries(soundKits))if(!v.includes(s[k==='objects'?'objectKit':k==='accents'?'accentKit':'cameraKit']))throw Error('Invalid sound kit');
 return s;
}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>2*Math.acos(clamp(Math.abs(a.reduce((n,v,i)=>n+v*b[i],0)),0,1));
function rng(seed){let x=seed|0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296*2-1;};}
function peaks(values,dt,threshold,gap){const out=[];for(let i=2;i<values.length-2;i++)if(values[i]>threshold&&values[i]>=values[i-1]&&values[i]>values[i+1]){const v={i,time:i*dt,strength:values[i]};if(out.length&&v.time-out.at(-1).time<gap){if(v.strength>out.at(-1).strength)out[out.length-1]=v;}else out.push(v);}return out;}
function chooseTempo(events,duration){let best={score:-Infinity,bpm:112,phase:0};if(!events.length)return best;
 for(let bpm=88;bpm<=138;bpm++)for(let p=0;p<16;p++){const beat=60/bpm,phase=p/16*beat;let score=0;for(const e of events){const delta=Math.abs((e.time-phase)/beat-Math.round((e.time-phase)/beat))*beat;score+=Math.exp(-delta*delta/.008)*e.gain;}score-=Math.abs(bpm-112)*.006;score-=Math.abs(duration/beat-Math.round(duration/beat))*.2;if(score>best.score)best={score,bpm,phase};}return best;
}
export function planSound(telemetry,input={}){
 const settings=normalizeSound(input),{frames,duration,rate=60}=telemetry,dt=1/rate;
 if(telemetry.authoredEvents){
  if(!Array.isArray(telemetry.authoredEvents)||duration<=0||duration>300)throw Error('Invalid authored sound timeline');
  const events=telemetry.authoredEvents.map(e=>({...e}));
  for(const e of events)if(!soundKits[e.module]||!Number.isFinite(e.time)||!Number.isFinite(e.duration)||e.time<0||e.duration<=0||!Number.isFinite(e.gain)||e.gain<0)throw Error('Invalid authored sound event');
  return {kind:telemetry.kind,duration,rate,settings,events,curves:telemetry.curves??{camera:new Array(Math.ceil(duration*rate)).fill(0)},bpm:settings.tempo==='manual'?settings.bpm:telemetry.musicBpm??120,phase:0};
 }
 if(!frames?.length||duration<=0||duration>300)throw Error('Invalid motion telemetry');
 if(telemetry.kind==='procedural'){const p=planProceduralSound(telemetry,settings),tempo=settings.tempo==='auto'?(telemetry.musicBpm?{bpm:telemetry.musicBpm,phase:0}:chooseTempo(p.events.filter(e=>e.module!=='objects'),duration)):{bpm:settings.bpm,phase:0};return {...p,kind:'procedural',duration,rate,settings,bpm:tempo.bpm,phase:tempo.phase};}
 const events=[],curves={};
 const crossesCut=i=>(telemetry.cuts||[]).some(t=>t>=(i-1)*dt&&t<=i*dt);
 const camera=frames.map((f,i)=>i&&!crossesCut(i)?distance(f.camera.position,frames[i-1].camera.position)/dt+angle(f.camera.quaternion,frames[i-1].camera.quaternion)/dt*.9:0);
 curves.camera=camera;
 // Bound each gesture by its velocity valleys, not an arbitrary sound length.
 for(const peak of peaks(camera,dt,2.5,.5-settings.density*.2)){
  let first=peak.i,last=peak.i;
  while(first>0&&peak.i-first<rate*.7&&camera[first-1]<=camera[first]&&camera[first-1]>peak.strength*.06&&!crossesCut(first))first--;
  while(last<camera.length-1&&last-peak.i<rate*.7&&camera[last+1]<=camera[last]&&camera[last+1]>peak.strength*.06&&!crossesCut(last+1))last++;
  first=Math.max(0,first-1);last=Math.min(camera.length-1,last+1);
  const span=(last-first)*dt;if(span<.05)continue;
  const extent=camera.slice(first,last+1).reduce((sum,v)=>sum+v*dt,0);
  if(extent<.22)continue;
  const speed=peak.strength,speedWeight=speed/(speed+8),extentWeight=Math.sqrt(extent/(extent+1.5));
  const gain=.5*speedWeight*extentWeight;
  const shape=camera.slice(first,last+1).map(v=>clamp(v/speed));
  events.push({module:'camera',kind:settings.cameraKit,time:first*dt,duration:span,gain,
   pan:clamp((frames[last].camera.position[0]-frames[first].camera.position[0])*.16,-.55,.55),
   pitch:1,source:'camera',peakSpeed:speed,extent,shape,shapeRate:rate});
 }
 for(const name of Object.keys(frames[0].objects)){
  const speed=frames.map((f,i)=>{if(!i||crossesCut(i))return 0;const a=f.objects[name],b=frames[i-1].objects[name];return distance(a.position,b.position)/dt+angle(a.quaternion,b.quaternion)/dt*.45;});
  curves[name]=speed;
  // Short overlapping grains follow actual world-space angular/linear velocity.
  const step=Math.round(rate*(.23-.10*settings.density));
  for(let i=step;i<frames.length;i+=step){const o=frames[i].objects[name],energy=speed[i];if(energy<.09||o.visibility<.04)continue;
   events.push({module:'objects',kind:settings.objectKit,time:i*dt,duration:.18+clamp(energy/6)*.15,gain:clamp(energy/7,0,.32)*o.visibility,pitch:.7+clamp(energy/9)*1.2,pan:o.pan,source:name});
  }
  const p=peaks(speed,dt,.25,.45);
  for(const peak of p){let i=peak.i;while(i<speed.length-1&&i<peak.i+rate*1.2&&speed[i]>peak.strength*.16)i++;const o=frames[i].objects[name];if(speed[i]>peak.strength*.25||o.visibility<.08)continue;
   if(events.some(e=>e.module==='accents'&&Math.abs(e.time-i*dt)<.09))continue;
   events.push({module:'accents',kind:settings.accentKit,time:i*dt,duration:.24,gain:clamp(peak.strength/4,.08,.6)*o.visibility,pan:o.pan,pitch:.8+(name.length%7)*.09,source:name});
  }
 }
 // Camera arrivals are accents, never physical collision claims.
 for(const peak of peaks(camera,dt,4,.7)){let i=peak.i;while(i<camera.length-1&&i<peak.i+rate&&camera[i]>peak.strength*.12)i++;if(camera[i]<peak.strength*.2&&!events.some(e=>e.module==='accents'&&Math.abs(e.time-i*dt)<.16))events.push({module:'accents',kind:settings.accentKit,time:i*dt,duration:.3,gain:clamp(peak.strength/50,.1,.45),pan:0,pitch:.75,source:'camera arrival'});}
 // Keep musical timing independent of revisions to the whoosh duration/color.
 const timingCamera=peaks(camera,dt,1.2,.65-settings.density*.32).map(p=>({module:'camera',time:Math.max(0,p.time-clamp(.25+p.strength*.018,.3,.85)*.52),gain:clamp(p.strength/20,.12,.8)}));
 const timingEvents=[...timingCamera,...events.filter(e=>e.module!=='camera')].sort((a,b)=>a.time-b.time);
 // Stable seeds keep other modules unchanged when camera gestures are removed.
 for(const e of events)if(e.module!=='camera')e.noiseIndex=timingEvents.indexOf(e);
 const tempo=settings.tempo==='auto'?chooseTempo(timingEvents.filter(e=>e.module!=='objects'),duration):{bpm:settings.bpm,phase:0};
 const detailed=planFoley(telemetry,settings);
 for(let i=events.length-1;i>=0;i--)if(detailed.sources.includes(events[i].source))events.splice(i,1);
 events.push(...detailed.events);
 return {duration,rate,events:events.filter(e=>e.time<duration).sort((a,b)=>a.time-b.time),curves,settings,bpm:tempo.bpm,phase:tempo.phase};
}
export function renderSound(plan,{sampleRate=48000,stems=false}={}){
 const {duration,settings:s,bpm,phase}=plan,n=Math.ceil(duration*sampleRate);
 const buses=Object.fromEntries(['camera','objects','accents','music'].map(k=>[k,[new Float32Array(n),new Float32Array(n)]]));
 function voice(module,start,len,gain,pan,fn){if(gain<=0||!s.enabled)return;const bus=buses[module],a=Math.max(0,Math.floor(start*sampleRate)),b=Math.min(n,Math.ceil((start+len)*sampleRate));const l=Math.cos((clamp(pan,-1,1)+1)*Math.PI/4),r=Math.sin((clamp(pan,-1,1)+1)*Math.PI/4);for(let i=a;i<b;i++){const t=i/sampleRate-start,x=fn(t,t/len)*gain;bus[0][i]+=x*l;bus[1][i]+=x*r;}}
 for(let ei=0;ei<plan.events.length;ei++){
  const e=plan.events[ei],random=rng(s.seed+(e.noiseIndex??ei)*7919+1);let low=0,airLow=0,airBody=0,airSmooth=0,readHead=((ei*.371)%1)*windSample.length;
  const variant=soundKits[e.module].indexOf(e.kind),color=.04+variant*.025;
  voice(e.module,e.time,e.duration,e.gain*(e.detail?s[e.detail]:1),e.pan,(t,u)=>{
   const noise=random();low+=color*(noise-low);const attack=Math.min(1,t/.006),tail=Math.min(1,(1-u)*35);
   if(e.digital==='pixel'){const phase=TAU*(e.frequency??660)*t,triangle=2/Math.PI*Math.asin(Math.sin(phase));return attack*tail*Math.exp(-t*27)*(triangle*.7+Math.sin(phase*2)*.19+Math.sin(phase*.5)*.11);}
   if(e.digital==='pixel-thud')return attack*tail*Math.exp(-t*52)*Math.sin(TAU*(175*t-320*t*t));
   if(e.digital==='pixel-air'){const hold=Math.floor(t*sampleRate/(4+Math.floor(u*18))),n=Math.sin(hold*78.233+e.time*4.7)*43758.5453;airLow+=.11*((n-Math.floor(n))*2-1-airLow);return Math.sin(Math.PI*u)**2*(airLow+Math.sin(TAU*(420*t+640*t*t))*.14);}
   if(e.graphic){const f=(e.graphic==='pop'?680:e.graphic==='settle'?290:410)*e.pitch;return attack*tail*(e.module==='accents'?Math.exp(-t*55):Math.sin(Math.PI*clamp(u))**2)*(.23*Math.sin(TAU*f*t)*Math.exp(-t*10)+low*.12);}
   if(e.foley)return foleySample(e,t,u,noise,low);
   if(e.module==='camera'){
    // Air turbulence only: cutoff and energy continuously follow the measured gesture.
    let motion=Math.sin(Math.PI*clamp(u));
    if(e.shape){const at=clamp(t*e.shapeRate,0,e.shape.length-1),i=Math.floor(at);motion=e.shape[i]+((e.shape[i+1]??e.shape[i])-e.shape[i])*(at-i);}
    const velocity=(e.peakSpeed??12)*motion,extent=e.extent??2;
    const colors=[1,.7,.48,1.45,.86,.76,1.7,1.15];
    const motionSpeed=clamp(velocity/24);
    const cutoff=(450+10500*motionSpeed**1.6)*colors[variant];
    readHead=(readHead+(0.45+3.1*motionSpeed**1.4)*windSampleRate/sampleRate)%windSample.length;
    const sampleIndex=Math.floor(readHead),fraction=readHead-sampleIndex;
    const air=windSample[sampleIndex]+(windSample[(sampleIndex+1)%windSample.length]-windSample[sampleIndex])*fraction;
    const highpass=120+variant*16;
    airLow+=(1-Math.exp(-TAU*cutoff/sampleRate))*(air-airLow);
    airBody+=(1-Math.exp(-TAU*highpass/sampleRate))*(airLow-airBody);
    const edge=Math.min(1,t/.025,(e.duration-t)/.035);
    airSmooth+=(1-Math.exp(-TAU*Math.min(16000,cutoff*1.7)/sampleRate))*((airLow-airBody)-airSmooth);
    return airSmooth*Math.pow(clamp(motion),1.05)*clamp(edge)*1.5;
   }
   if(e.module==='objects'){const f=(variant===0?170:240+variant*73)*e.pitch;return Math.sin(Math.PI*clamp(u))**2*(Math.sin(TAU*f*t+Math.sin(TAU*f*.51*t)*2)*.17+low*.23+noise*.035);}
   const f=(variant===5?55:180+variant*85)*e.pitch;return attack*tail*Math.exp(-t*(variant===4||variant===6?13:25))*(Math.sin(TAU*f*t+2*Math.exp(-t*40))*.75+Math.sin(TAU*f*2.71*t)*.13+noise*.14*Math.exp(-t*70));
  });
 }
 if(s.musicStyle==='techno'||(s.musicStyle==='scene'&&plan.kind==='procedural'))technoMusic({voice,duration,bpm,phase,seed:s.seed,random:rng});else{
 const beat=60/bpm,notes=[0,7,10,14,12,7,3,10],bass=[0,0,3,7];
 for(let k=-1;k*beat+phase<duration;k++){
  const at=k*beat+phase;if(at<0)continue;const rand=rng(s.seed+k*111+987),activity=clamp((plan.curves.camera[Math.min(plan.curves.camera.length-1,Math.round(at*plan.rate))]||0)/15);
  voice('music',at,.26,.2+activity*.035,0,(t,u)=>Math.sin(TAU*(48*t+1.2*(1-Math.exp(-t*32))))*Math.exp(-t*18)*Math.min(1,t/.003)*(1-u));
  if(k%2===1)voice('music',at,.14,.085,.12,(t)=>rand()*Math.exp(-t*35)*Math.min(1,t/.002));
  for(let j=0;j<2;j++)voice('music',at+j*beat/2,.055,.035+(j?0:.018),j?.35:-.35,(t)=>rand()*Math.exp(-t*75)*Math.min(1,t/.001));
  const bf=65.406*Math.pow(2,bass[Math.floor(k/4)%4]/12);voice('music',at,beat*.72,.19,0,(t,u)=>Math.sin(TAU*bf*t)*Math.min(1,t/.012)*Math.exp(-u*4)*(1-u));
  for(let j=0;j<2;j++){const f=261.626*Math.pow(2,notes[(k*2+j)%notes.length]/12);voice('music',at+j*beat/2,beat*.85,.055+activity*.025,j?.4:-.4,(t,u)=>Math.min(1,t/.009)*Math.exp(-u*5)*(Math.sin(TAU*f*t)+.22*Math.sin(TAU*f*2*t))*(1-u));}
 }
 // Soft harmonic bed, ducked automatically under movement accents.
 const chord=[130.813,155.563,195.998,233.082];for(let k=0;k<chord.length;k++)voice('music',0,duration,.021,k%2?.5:-.5,(t,u)=>Math.sin(TAU*chord[k]*t+Math.sin(t*.5)*.1)*Math.min(1,t/.5)*Math.min(1,(duration-t)/.65));
 }
 const mix=[new Float32Array(n),new Float32Array(n)];let peak=0,sum=0;
 for(let i=0;i<n;i++){
  const t=i/sampleRate,fade=Math.min(1,t/.012,(duration-t)/.13);let duck=1;
  for(const e of plan.events)if(e.module==='accents'&&t>=e.time&&t<e.time+.22)duck=Math.min(duck,1-.45*e.gain*Math.exp(-(t-e.time)*13));
  for(let c=0;c<2;c++){let x=0;for(const [key,bus] of Object.entries(buses)){bus[c][i]*=4*s[key]*s.master*fade*(key==='music'?duck:1);x+=bus[c][i];}mix[c][i]=x;peak=Math.max(peak,Math.abs(x));sum+=x*x;}
 }
 // One shared gain preserves stem summation and avoids clipping without flattening dynamics.
 const gain=peak>.89?.89/peak:1;if(gain<1)for(let c=0;c<2;c++)for(let i=0;i<n;i++){mix[c][i]*=gain;for(const bus of Object.values(buses))bus[c][i]*=gain;}
 return {channels:mix,sampleRate,stems:stems?buses:undefined,stats:{peak:peak*gain,rms:Math.sqrt(sum/(n*2))*gain,gain,bpm,eventCount:plan.events.length,duration}};
}
export function encodeWav(channels,sampleRate=48000){const n=channels[0].length,buffer=new ArrayBuffer(44+n*4),v=new DataView(buffer);const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+n*4,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*4,true);for(let i=0;i<n;i++)for(let c=0;c<2;c++)v.setInt16(44+i*4+c*2,Math.round(clamp(channels[c][i],-1,1)*32767),true);return new Uint8Array(buffer);}
