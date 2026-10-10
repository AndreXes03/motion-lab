import {dotPixelCues} from './dot-pixels.js';
export function dotSoundTelemetry(rate=60){
const cues=[[.22,.65,.12],[.66,1.05,.12],[1.3,1.2,.1],[2.07,1,.23],[3.25,1.45,.16],[3.66,.85,.23],[4.47,1.05,.21],[5.25,1.25,.2],[6.33,.65,.24],[7.28,1.3,.19],[8.17,.7,.18],[9.65,1.25,.19],[10.34,.75,.1],[10.51,.9,.1],[10.68,1.1,.1],[10.85,1.3,.1],[12.03,.95,.25],[13.62,.72,.18],[14.54,1.2,.24],[15.3,1.5,.12]];
const events=cues.map(([time,pitch,gain],i)=>({module:'accents',kind:i%4===0?'soft':'pop',graphic:i%3===0?'settle':'pop',time,duration:.18,gain,pan:Math.sin(time)*.35,pitch}));
for(const [time,duration,gain,pan] of [[1.52,.61,.2,.4],[2.91,.71,.13,.4],[5.98,.36,.17,-.4],[8.9,.72,.13,.1],[10.95,.73,.16,.35],[13.4,.8,.17,-.3]])events.push({module:'camera',kind:'silk',time,duration,gain,pan,pitch:1,shape:[0,.1,.3,.7,1,.85,.5,.15,0],shapeRate:9/duration});

 for(let j=0;j<dotPixelCues.length;j++){
  const e=dotPixelCues[j],pan=Math.max(-.65,Math.min(.65,(e.x-960)/960)),notes=[523.25,659.25,783.99,1046.5];
  for(let n=0;n<3;n++)events.push({module:'accents',kind:'chime',digital:'pixel',frequency:notes[(j+n)%4],time:e.at+n*.035,duration:.19,gain:e.power*.031,pan,pitch:1});
  events.push({module:'accents',kind:'pop',digital:'pixel-thud',time:e.at,duration:.11,gain:e.power*.052,pan,pitch:1});
 }
 for(const [time,duration,pan] of [[1.56,.58,.5],[5.98,.52,-.3],[10.99,.95,.5],[13.55,.88,-.4]])events.push({module:'camera',kind:'grain',digital:'pixel-air',time,duration,gain:.062,pan,pitch:1});
 return {kind:'dot',duration:16,rate,authoredEvents:events.sort((a,b)=>a.time-b.time),musicBpm:120,curves:{camera:new Array(Math.ceil(16*rate)).fill(0)}};
}
