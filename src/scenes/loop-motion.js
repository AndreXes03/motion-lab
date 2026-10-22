import * as T from 'three';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

export function titleEase(x,c={}){
  x=clamp(x);if(x===0||x===1)return x;
  let lo=0,hi=1,u=x;
  const cubic=(q,a,b)=>3*(1-q)**2*q*a+3*(1-q)*q*q*b+q*q*q;
  for(let i=0;i<20;i++){u=(lo+hi)/2;if(cubic(u,c.titleEaseX1??.16,c.titleEaseX2??.24)<x)lo=u;else hi=u;}
  const bezier=cubic(u,c.titleEaseY1??.68,c.titleEaseY2??1);
  // Integrate a velocity bell concentrated at the entrance. Subtract its tiny
  // endpoint velocity so the braking tail joins the reading drift continuously.
  const sigma=Math.max(.12,Math.min(.40,c.titleSigma??.21)),peak=.10;
  const erf=z=>{const sign=z<0?-1:1;z=Math.abs(z);const k=1/(1+.3275911*z);return sign*(1-(((((1.061405429*k-1.453152027)*k)+1.421413741)*k-.284496736)*k+.254829592)*k*Math.exp(-z*z));};
  const cdf=v=>(1+erf((v-peak)/(sigma*Math.SQRT2)))/2;
  const floor=Math.exp(-.5*((1-peak)/sigma)**2)/(sigma*Math.sqrt(2*Math.PI));
  const bell=(cdf(x)-cdf(0)-x*floor)/(cdf(1)-cdf(0)-floor);
  return bezier+(bell-bezier)*clamp(c.titleGaussian??.85);
}
// Authored cluster ranks. Punctuation resolves last, but letters do not default
// to reading order. The fallback is deterministic for arbitrary editable copy.
export function headlineRanks(text='',count=text.length,variant=0){
  const authored={'From a':[2,0,1,0,2,1],'brief.':[2,0,3,1,2,4],'To':[1,0],'this.':[1,3,0,2,4],'Again.':[2,0,3,1,2,4]};
  if(authored[text]?.length===count)return authored[text];
  const order=Array.from({length:count},(_,i)=>i).sort((a,b)=>Math.abs(a-(count-1)*.5)-Math.abs(b-(count-1)*.5)||((variant%2)?b-a:a-b));
  return Array.from({length:count},(_,i)=>order.indexOf(i));
}
// Word travel has a longer braking tail; glyph assembly has its own finite
// smooth curve, so neither reveal nor opacity inherits the fast word ramp.
export function headlineMotion(age,duration,c={},anchor=100,width=400,word=0,text=''){
  const entry=Math.min(c.titleEntry??.46,duration*.44),exit=Math.min(c.titleExit??.22,duration*.23);
  const delay=word*Math.min(.026,duration*.03),arrive=titleEase((age-delay)/entry,c);
  // Cut at the velocity crest, while the word may still occupy the frame.
  // Exit distance is editorial intent, not the distance to the screen edge.
  const phase=clamp((age-(duration-exit))/exit);
  const leave=(1-titleEase(1-.9*phase,c))/(1-titleEase(.1,c));
  const exitTravel=c.titleExitTravel??240;
  const drift=(c.titleDrift??24)*(.5-age/duration);
  const cutEntry=text==='To';
  return {x:anchor+(cutEntry?(c.toEntryTravel??96):(1980-anchor))*(1-arrive)-exitTravel*leave+drift,
    y:0,scaleX:1,
    reveal:(i,n)=>{
      if(cutEntry)return 1;
      const ranks=headlineRanks(text,n,word),rank=ranks[i]/Math.max(1,...ranks);
      const spread=Math.min((c.letterStagger??.055)*2,entry*.30);
      const start=delay+entry*.10+rank*spread;
      const length=entry*.54;
      const u=clamp((age-start)/length);
      return u*u*u*(u*(u*6-15)+10);
    }};
}

export function openingCarry(real,c={}){
  const q=clamp(real/3);
  return {x:960-(c.introPan??160)*2.0625*(1-q)**3,scale:(c.introDriftScale??.07)*(1-q)**1.35};
}
export function brandAssetDrop(real,c={}){
  const duration=Math.max(.5,Math.min(.9,c.assetDragDuration??.68)),start=2.18-duration;
  const u=clamp((real-start)/duration),travel=u*u*u*(u*(u*6-15)+10);
  const approach=smooth((real-(start-.35))/.25),press=smooth((real-(start-.10))/.10)*(1-smooth((real-2.18)/.12));
  const cards=Array.from({length:3},(_,i)=>({x:(1022+i*14)*(1-travel)+(370+i*270)*travel,y:(565-i*10)*(1-travel)+516*travel-4*press}));
  const front=cards[2];
  return {cards,alpha:smooth((real-(start-.30))/.14),cursor:{x:front.x+170+75*(1-approach),y:front.y+50+55*(1-approach),scale:1.15-.12*press,alpha:smooth((real-(start-.35))/.08),visible:real<2.33},press};
}
export function lightPresetState(progress,c={}){
  const width=Math.max(.02,c.lightSwitchTime??.08);
  const soft=smooth((progress-.30)/width),hard=smooth((progress-.67)/width);
  return {weights:[1-soft,soft-hard,hard],selected:progress<.30+width/2?0:progress<.67+width/2?1:2};
}
export function closingCTA(age){
  return [{text:'vibe coding, for commercials',y:684,size:32,tracking:.15,color:'#bec5d0',start:.14,duration:.46},
    {text:'download now',y:744,size:23,tracking:.9,color:'#d7f56b',start:.70,duration:.28}]
    .map(line=>({...line,count:Math.floor(line.text.length*clamp((age-line.start)/line.duration))}));
}

export function wavePose(elapsed,c={}){
  const u=Math.max(0,elapsed)*(c.waveSpeed??1),launch=1-Math.exp(-u*5.7),travel=c.waveTravel??1;
  return {scale:2.3-1.87*launch,x:travel*(Math.sin(u*2)*2.05+launch*.18),y:travel*Math.sin(u*2.7)*1.14,
    rotation:new T.Euler(.18+Math.sin(u*2.5)*.46,-.4+u*2,-.25+u*.84)};
}

// New waves follow the moving source briefly, then release into screen space.
// Older centres never get dragged by the current product pose. Birth identities
// and the integrated follow clock make forward/backward seeking deterministic.
export function concentricField(elapsed,c={}){
  const pose=wavePose(elapsed,c),projection=540/Math.tan(42*Math.PI/360);
  const count=Math.max(5,Math.min(15,Math.round((c.waveCount??58)/6)));
  const speed=500*(c.waveExpansion??2.6),gap=1180/count,interval=gap/speed;
  const follow=Math.max(0,c.waveFollowTime??.44),latest=Math.floor(elapsed/interval);
  const centre={x:960+projection*pose.x/6,y:540-projection*pose.y/6};
  const rings=[];
  for(let id=latest-count+1;id<=latest;id++){
    const birth=id*interval,age=elapsed-birth,q=age/interval;if(q<=0||q>=count)continue;
    const a=follow?clamp(age/follow):1;
    // Integral of 1-smoothstep(a): follow velocity reaches zero continuously.
    const followed=follow*(a-a*a*a+.5*a**4),anchor=wavePose(birth+followed,c),born=wavePose(birth,c);
    const breathing=1+.025*(c.waveWarp??1)*Math.sin(birth*2.4);
    rings.push({id,birth,age,centre:{x:960+projection*anchor.x/6,y:540-projection*anchor.y/6},
      radius:projection*1.32*born.scale/6+26+speed*age*breathing,width:Math.min(gap*.44,34*(c.waveWeight??1)),
      alpha:smooth(elapsed/.14)*smooth(q/.48)*(1-smooth((q-(count-1.2))/1.2))*(1-.40*smooth(q/count))});
  }
  return {centre,rings};
}

// A grazing pass along the polished shoulder and metal seam, rather than
// another distant turntable. Camera and product can sample their own clocks.
export function rimDetailPose(progress,c={}){
  const q=clamp(progress),travel=(.34*(1-(1-q)**4)+.32*q+.34*q**4)*(c.detailTravel??1);
  const angle=.20+.95*travel;
  return {point:new T.Vector3(Math.cos(angle)*1.24,Math.sin(angle)*1.24,.31),
    offset:new T.Vector3(1.15-1.3*travel,.25,1.15+.35*Math.sin(q*Math.PI)),
    rotation:new T.Euler(.12,-.28+.60*travel,-.30+.30*travel)};
}

export const arrayPalette=['#f75b12','#9ebbd2','#d5d9de','#8d63ee','#d9ec54','#087b86'];
export function arraySpeakerRotation(index,elapsed,c={}){
  const i=index%6,u=elapsed*(c.arraySpin??1);
  return new T.Euler(
    [-.65,.25,.55,-.35,.75,-.5][i]+u*[1.15,-.7,.8,-1.05,.6,-.9][i],
    [-.2,.55,-.6,.18,.8,-.9][i]+u*[1.4,-1.8,1.1,.9,-1.3,1.65][i],
    [-.3,.2,-.15,.4,-.25,.1][i]+u*[-.45,.65,-.8,.35,.75,-.55][i]);
}

// Birth identity stays fixed across emissions and seeks. The emitted contour
// keeps flowing after birth rather than freezing at its historical pose.
export function waveHistory(elapsed,c={}){
  const count=Math.round(c.waveCount??58),spacing=2.4/count,samples=[],emitter=wavePose(elapsed,c);
  for(let id=0;id<count;id++){
    const birth=id*spacing,age=elapsed-birth;if(age<=0)continue;
    const pose=wavePose(birth,c),flow=age*(c.waveSpeed??1),follow=.24*(1-Math.exp(-age*3));
    pose.x+=(emitter.x-pose.x)*follow+.24*flow;
    pose.y+=(emitter.y-pose.y)*follow+.16*Math.sin(flow*2.4);
    pose.rotation.z+=flow*.38;
    pose.rotation.y+=.20*Math.sin(flow*1.8);
    pose.scale*=Math.exp(-flow*.10);
    samples.push({id,birth,pose,alpha:smooth(age/.075)*(1-smooth((age-1.85)/.5))});
  }
  return samples;
}

// Begin the recession across the whole closing shot, not in a sudden last-half-
// second collapse. Log-radius interpolation keeps the visual scale rate smooth;
// the late horizontal acceleration carries the peak through the brand cut.
const hermite=(a,b,va,vb,u,d)=>{
  const u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a+(u3-2*u2+u)*va*d+(-2*u3+3*u2)*b+(u3-u2)*vb*d;
};
export function logoPose(age,c={}){
  const settle=Math.max(.12,Math.min(.35,c.logoSettle??.20));
  const carry=Math.exp(-Math.max(0,age)/settle);
  return {x:960+210*carry,y:540,scale:1+.16*carry};
}
export function endingOpeningWeight(age,c={}){
  const duration=Math.max(.9,Math.min(50/30,c.endingPullback??1.6));
  const u=clamp((age+duration)/(duration*.55));
  return 1-u*u*u*(u*(u*6-15)+10);
}
export function endingProductTurn(age,c={}){
  // A continuous twist: brisk arrival, central braking, then a second impulse.
  // Land before the brand cut so the circular face still matches the mark.
  const u=clamp((age+50/30)/(50/30-.08));
  const phase=.70*(1-(1-u)**3)+.30*smooth((u-.55)/.40);
  const remaining=(1-phase)*(c.endingTurn??1);
  return new T.Euler(.14*remaining,-.55*remaining,-.85*remaining);
}
export function productHandoff(age,c={}){
  const end=logoPose(0,c),endX=end.x-290*end.scale,endR=67.5*end.scale;
  if(age>=0){const p=logoPose(age,c);return {x:p.x-290*p.scale,y:p.y,radius:67.5*p.scale};}
  const duration=Math.max(.9,Math.min(50/30,c.endingPullback??1.6)),settle=Math.max(.12,Math.min(.35,c.logoSettle??.20));
  const startX=1040,startR=650,dx=endX-startX,startVX=-6,startVR=-18;
  const endVX=(-210+290*.16)/settle,endVR=-67.5*.16/settle;
  // Fast arrival from the right, a readable central recovery, then the existing
  // late acceleration into the mark. Arrival is gone before the approved tail.
  const arrival=(c.endingArrival??1)*(1-clamp((age+50/30)/(50/30*.55)))**(c.endingArrivalCurve??6);
  if(age< -duration){const before=age+duration;return {x:startX+startVX*before+650*arrival,y:540,radius:startR-185+startVR*before+85*arrival};}
  const u=clamp((age+duration)/duration),linear=startVX*duration/dx,power=(endVX*duration/dx-linear)/(1-linear);
  return {x:startX+dx*(linear*u+(1-linear)*u**power)+650*arrival,y:540,
    radius:Math.exp(hermite(Math.log(startR),Math.log(endR),startVR/startR,endVR/endR,u,duration))-185*endingOpeningWeight(age,c)+85*arrival};
}
