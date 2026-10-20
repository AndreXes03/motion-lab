import * as T from 'three';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

export function titleEase(x,c={}){
  x=clamp(x);if(x===0||x===1)return x;
  let lo=0,hi=1,u=x;
  const cubic=(q,a,b)=>3*(1-q)**2*q*a+3*(1-q)*q*q*b+q*q*q;
  for(let i=0;i<20;i++){u=(lo+hi)/2;if(cubic(u,c.titleEaseX1??.18,c.titleEaseX2??.30)<x)lo=u;else hi=u;}
  return cubic(u,c.titleEaseY1??.94,c.titleEaseY2??1);
}
// Authored cluster ranks. Punctuation resolves last, but letters do not default
// to reading order. The fallback is deterministic for arbitrary editable copy.
export function headlineRanks(text='',count=text.length,variant=0){
  const authored={'From a':[2,0,1,0,2,1],'brief.':[2,0,3,1,2,4],'To':[1,0],'this.':[1,3,0,2,4],'Again.':[2,0,3,1,2,4]};
  if(authored[text]?.length===count)return authored[text];
  const order=Array.from({length:count},(_,i)=>i).sort((a,b)=>Math.abs(a-(count-1)*.5)-Math.abs(b-(count-1)*.5)||((variant%2)?b-a:a-b));
  return Array.from({length:count},(_,i)=>order.indexOf(i));
}
// The word carries strong leftward momentum. Glyphs assemble visibly during
// its final approach, then remain complete throughout the reading interval.
export function headlineMotion(age,duration,c={},anchor=100,width=400,word=0,text=''){
  const entry=Math.min(c.titleEntry??.32,duration*.33),exit=Math.min(c.titleExit??.24,duration*.25);
  const delay=word*.028,arrive=titleEase((age-delay)/entry,c),leave=1-titleEase((duration-age)/exit,c);
  const drift=(c.titleDrift??16)*(.5-age/duration);
  return {x:anchor+(2000-anchor)*(1-arrive)+(-width-100-anchor)*leave+drift,
    y:5*(1-arrive),scaleX:1+.018*(1-arrive)-.018*leave,
    reveal:(i,n)=>{
      const ranks=headlineRanks(text,n,word),rank=ranks[i]/Math.max(1,...ranks);
      const spread=Math.min((c.letterStagger??.055)*2.25,entry*.40);
      const start=delay+entry*.24+rank*spread;
      const length=entry*(.36+.05*((i+word)%3));
      return titleEase((age-start)/length,c);
    }};
}

export function wavePose(elapsed,c={}){
  const u=Math.max(0,elapsed)*(c.waveSpeed??1),launch=1-Math.exp(-u*5.7),travel=c.waveTravel??1;
  return {scale:2.3-1.87*launch,x:travel*(Math.sin(u*2)*2.05+launch*.18),y:travel*Math.sin(u*2.7)*1.14,
    rotation:new T.Euler(.18+Math.sin(u*2.5)*.46,-.4+u*2,-.25+u*.84)};
}

// Each contour has a permanent birth time. Adding a contour never moves an old one.
export function waveHistory(elapsed,c={}){
  const count=Math.round(c.waveCount??58),spacing=2.4/count,samples=[];
  for(let id=0;id<count;id++){
    const birth=id*spacing,age=elapsed-birth;if(age<=0)continue;
    samples.push({id,birth,pose:wavePose(birth,c),alpha:smooth(age/.075)*(1-smooth((age-1.85)/.5))});
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
  const carry=Math.exp(-Math.max(0,age)/.16);
  return {x:960+104*carry,y:540,scale:1+.14*carry};
}
export function productHandoff(age){
  const end=logoPose(0),endX=end.x-290*end.scale,endR=67.5*end.scale;
  if(age>=0){const p=logoPose(age);return {x:p.x-290*p.scale,y:p.y,radius:67.5*p.scale};}
  const duration=.56,u=clamp((age+duration)/duration);
  if(age< -duration)return {x:960+12*(age+duration),y:540,radius:610-12*(age+duration)};
  return {x:hermite(960,endX,12,(-104+290*.14)/.16,u,duration),y:540,
    radius:hermite(610,endR,-12,-67.5*.14/.16,u,duration)};
}
