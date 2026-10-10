import {smoother,arcEnvelope,spliceMotion} from './replay-motion-curves.js';
import {replayPaperFormat} from './replay-paper-format.js';
// Absolute-time choreography, independent of renderer.
// Card identity is immutable: draw art(card.id), never remap art on a cut.
const TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=smoother;
const mix=(a,b,k)=>a+(b-a)*k;
const rowIds=[6,3,0,1,2,4,9,5,7,8];
const zero={rotation:0,yaw:0,pitch:0,z:0,alpha:1,scale:.45};
const parked=id=>({...zero,x:id%2?-380:2300,y:70+(id*127)%950});

function layout(id,chapter,t){
  const p={...zero};
  if(chapter===0){
    if(id>=9)return parked(id);
    const a=id*TAU/9-.6+1.05*t;
    return {...p,x:960+Math.cos(a)*735,y:540+Math.sin(a)*430,
      scale:.64*(1+.12*Math.sin(a)),rotation:Math.sin(a)*.12,yaw:Math.sin(a)*.12};
  }
  if(chapter===1){
    // The grid becomes a flowing cloud; no card is born at the canvas centre.
    const q=(t-2.4)/3;
    const x=170+(id*647%1580)+Math.sin(id*2+q*1.8)*80;
    let y=90+(id*293%790)+Math.cos(id*1.5+q*1.4)*55;
    y-=310*smooth((1050-x)/130)*smooth((y-640)/120);
    return {...p,x,y,
      scale:.46+(id%4)*.055,rotation:Math.sin(id*2.1+q*.7)*.09,z:Math.sin(id*1.7)*70};
  }
  if(chapter===2){
    const a=id*TAU/21-.8+(t-5.4)*.7;
    // A vertical circle in a yawed 3D plane, not a flat ellipse with fake scaling.
    return {...p,x:960+Math.cos(a)*350,y:540+Math.sin(a)*350,z:-Math.cos(a)*500,
      scale:.84,rotation:Math.sin(a)*.07,yaw:.74+.42*Math.sin(a),pitch:.1*Math.cos(a)};
  }
  if(chapter===3){
    if(id===4)return {...p,x:220+14*(t-7.7),y:845-8*(t-7.7),scale:.66,rotation:-.07+.015*(t-7.7)};
    if(id===6)return {...p,x:1650-18*(t-7.7),y:210+10*(t-7.7),scale:.64,rotation:-.02-.012*(t-7.7)};
    // Peel the ring outward along its tangent, not shrink it into nothing.
    const a=id*TAU/21-.8+2.3*.7;
    return {...p,x:960+Math.cos(a)*1500,y:540+Math.sin(a)*1100,
      scale:.47,rotation:a*.08,yaw:.3*Math.sin(a)};
  }
  if(chapter===4){
    const j=rowIds.indexOf(id);
    if(j<0)return parked(id);
    const q=smoother((t-9.05)/2.65),focus=4+q*2;
    return {...p,x:105+j*225-145*q,y:850-125*replayPaperFormat(id)[1]*(.32+.96*Math.exp(-Math.pow((j-focus)/2.5,2))),
      scale:.32+.96*Math.exp(-Math.pow((j-focus)/2.5,2)),rotation:0};
  }
  if(chapter===5){
    if(id===5)return {...p,x:960,y:540,scale:355/104,rotation:t*.85};
    if(id===1)return {...p,x:1670,y:150,scale:.72};
    if(id===9)return {...p,x:170,y:870,scale:.8};
    return parked(id);
  }
  // The same red record-label contracts into the final logo's dot.
  if(id===5)return {...p,x:1025,y:450,scale:44/(104*.29),rotation:t*.85};
  return parked(id);
}

const starts=[0,2.4,5.4,7.7,9.4,11.4,13.2];
const migrationStarts=[0,1.65,4.55,7.35,8.9,11.4,13.2];
const windows=[.7,2.15,1.85,.8,1.45,.76,.7];

export function replayCardPose(id,t){
 const chapter=Math.max(0,migrationStarts.findLastIndex(x=>t>=x));
 if(chapter===0)return {id,...layout(id,0,t)};
 let start=migrationStarts[chapter],duration=windows[chapter];
 if(chapter===1){const delay=id*.018;start+=delay;duration-=delay;}
 if(chapter===2)start+=(id%12)*.012;
 if(chapter===3&&[3,8,11].includes(id)){start=7.7;duration=.9;}
 if(chapter===4)start+=Math.abs(rowIds.indexOf(id)-4.5)*.015;
 const from=t=>({id,...layout(id,chapter-1,t)}),to=t=>({id,...layout(id,chapter,t)});
 const out=spliceMotion(from,to,t,start,duration),q=clamp((t-start)/duration),arc=arcEnvelope(q);
 // A migration's depth and routing have zero velocity/acceleration at both
 // endpoints, leaving the inherited object momentum intact.
 if(chapter===1){out.z+=arc*90*Math.sin(id*.33);out.yaw+=arc*.20*Math.sin(id*.48);}
 if(chapter===2){const theta=id*TAU/21-.8+(t-5.4)*.7;out.x+=Math.sin(theta)*55*arc;out.y-=Math.cos(theta)*45*arc;out.z+=Math.sin(theta)*100*arc;out.yaw+=.12*Math.cos(theta)*arc;}
 if(chapter===3&&id===6){out.x+=280*arc;out.y+=140*arc;}
 if(chapter===4){out.y+=360*arc;out.rotation+=(id%2?1:-1)*.045*arc;}
 return out;
}

export function replayStockPose(id,t){
 const start=11.4,initial=replayCardPose(id,start),end={...initial,x:initial.x+120,y:initial.y+1050,z:initial.z-140,yaw:initial.yaw+1.2,rotation:initial.rotation+.24};
 return spliceMotion(tt=>replayCardPose(id,tt),tt=>({...end,y:end.y+1100*(tt-start-.85)}),t,start,.85);
}

export function replayPosterLine(j,t){
 const u=clamp((t-7.7-j*.07)/.95);
 return {lift:75*(1-smoother(u))-24*arcEnvelope(u),exit:-2100*smoother((t-9.02-j*.04)/.48),arrival:smoother((t-7.7-j*.065)/.38)};
}

export function replayRecordSpin(t){
  const x=Math.max(0,t-10.4);
  return x<.5?.85*x*x:.85*(x-.25);
}

export function replayHeroCue(t){
  const record={...replayCardPose(5,t),rotation:replayRecordSpin(t)};
  const peel=smooth((t-11.4)/.45),resolve=smooth((t-13.2)/.7);
  return {
    record,
    depth:(record.z/250+.12*record.scale)*(1-smoother((t-11.4)/.76)),
    // The rectangular stock peels away; its record remains the hero object.
    stockOpacity:1-peel,
    recordOpacity:1-resolve,
    labelOpacity:1,
    blackRadius:t<13.2?104*record.scale:mix(355,18,resolve),
    labelRadius:104*record.scale*.29,
    orbitRadius:t<13.2?104*record.scale+80:mix(435,10,resolve),
    orbitTypeSize:t<13.2?64:mix(64,1,resolve),
    iris:{x:record.x,y:record.y,radius:2200*smooth((t-11.4)/.8),color:'#d63e39'},
    creamIris:{x:record.x,y:record.y,radius:2200*resolve,color:'#eeeadd'},
    logoOpacity:smooth((t-13.35)/.45)
  };
}

// Headlines use fixed editorial masks while the collection continues moving.
export function replayHeadlineWeight(chapter,t){
  const offset=chapter===2?1.0:chapter===4?.35:0;
  const enter=chapter===0?smooth(t/.5):smooth((t-starts[chapter]-offset)/.35);
  const next=starts[chapter+1];
  const leave=next===undefined?1:1-smooth((t-next+(chapter===2?.25:0))/.3);
  return enter*leave;
}

export const replayDirectionNotes={
  rowIds,
  vinylId:5,
  identity:'Render illustration id unchanged. Row order changes positions only.',
  background:'Always cream base. Draw red iris 11.4–12.2; cream iris 13.2–13.9.',
  hero:'Draw persistent record at cue.record; draw stock separately. Red label becomes logo dot.',
  type:'Keep previous headline for 0.3s after a boundary; incoming starts during migration.'
};
