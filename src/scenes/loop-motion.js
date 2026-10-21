import * as T from 'three';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

export function titleEase(x,c={}){
  x=clamp(x);if(x===0||x===1)return x;
  let lo=0,hi=1,u=x;
  const cubic=(q,a,b)=>3*(1-q)**2*q*a+3*(1-q)*q*q*b+q*q*q;
  for(let i=0;i<20;i++){u=(lo+hi)/2;if(cubic(u,c.titleEaseX1??.16,c.titleEaseX2??.24)<x)lo=u;else hi=u;}
  return cubic(u,c.titleEaseY1??.68,c.titleEaseY2??1);
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
  const entry=Math.min(c.titleEntry??.42,duration*.42),exit=Math.min(c.titleExit??.20,duration*.24);
  const delay=word*Math.min(.026,duration*.03),arrive=titleEase((age-delay)/entry,c),leave=1-titleEase((duration-age)/exit,c);
  const drift=(c.titleDrift??24)*(.5-age/duration);
  return {x:anchor+(1980-anchor)*(1-arrive)+(-width-120-anchor)*leave+drift,
    y:9*(1-arrive),scaleX:1,
    reveal:(i,n)=>{
      const ranks=headlineRanks(text,n,word),rank=ranks[i]/Math.max(1,...ranks);
      const spread=Math.min((c.letterStagger??.055)*2,entry*.30);
      const start=delay+entry*.10+rank*spread;
      const length=entry*(.46+.045*((i+word)%3));
      const u=clamp((age-start)/length);
      return u*u*u*(u*(u*6-15)+10);
    }};
}

export function wavePose(elapsed,c={}){
  const u=Math.max(0,elapsed)*(c.waveSpeed??1),launch=1-Math.exp(-u*5.7),travel=c.waveTravel??1;
  return {scale:2.3-1.87*launch,x:travel*(Math.sin(u*2)*2.05+launch*.18),y:travel*Math.sin(u*2.7)*1.14,
    rotation:new T.Euler(.18+Math.sin(u*2.5)*.46,-.4+u*2,-.25+u*.84)};
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

// Same screen-space trajectory on either side of the product / brand-mark cut.
// Hermite endpoints match position AND velocity, including the apparent radius.
const hermite=(a,b,va,vb,u,d)=>{
  const u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a+(u3-2*u2+u)*va*d+(-2*u3+3*u2)*b+(u3-u2)*vb*d;
};
export function logoPose(age){
  const carry=Math.exp(-Math.max(0,age)/.14);
  return {x:960+210*carry,y:540,scale:1+.16*carry};
}
export function productHandoff(age){
  const end=logoPose(0),endX=end.x-290*end.scale,endR=67.5*end.scale;
  if(age>=0){const p=logoPose(age);return {x:p.x-290*p.scale,y:p.y,radius:67.5*p.scale};}
  const duration=.56,u=clamp((age+duration)/duration);
  if(age< -duration){const travel=age+duration;return {x:1010+45*travel,y:540,radius:625-68*travel};}
  return {x:hermite(1010,endX,45,(-210+290*.16)/.14,u,duration),y:540,
    radius:hermite(625,endR,-68,-67.5*.16/.14,u,duration)};
}
