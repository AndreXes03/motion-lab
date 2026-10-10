/** Shape-preserving cubic trajectories; shared tangents prevent a stop at each key pose. */
export function track(keys,t){
 if(t<=keys[0][0])return keys[0].slice(1);if(t>=keys.at(-1)[0])return keys.at(-1).slice(1);
 let j=0;while(keys[j+1][0]<t)j++;
 const a=keys[j],b=keys[j+1],h=b[0]-a[0],u=(t-a[0])/h;
 return a.slice(1).map((v,k)=>{const c=k+1,d=(b[c]-v)/h;
  const tangent=i=>{if(i===0)return (keys[1][c]-keys[0][c])/(keys[1][0]-keys[0][0]);if(i===keys.length-1)return (keys[i][c]-keys[i-1][c])/(keys[i][0]-keys[i-1][0]);const p=(keys[i][c]-keys[i-1][c])/(keys[i][0]-keys[i-1][0]),n=(keys[i+1][c]-keys[i][c])/(keys[i+1][0]-keys[i][0]);if(p*n<=0)return 0;const hp=keys[i][0]-keys[i-1][0],hn=keys[i+1][0]-keys[i][0],w1=2*hn+hp,w2=hn+2*hp;return (w1+w2)/(w1/p+w2/n);};
  const m0=tangent(j),m1=tangent(j+1);return (2*u**3-3*u*u+1)*v+(u**3-2*u*u+u)*h*m0+(-2*u**3+3*u*u)*b[c]+(u**3-u*u)*h*m1;
 });
}
const heroKeys=[
 [0,960,535,1300],[.72,956,535,1400],[1.35,975,535,1450],[1.51,979,535,1480],
 [1.83,1140,543,660],[2.19,1380,568,49],[2.56,1388,564,52],[2.88,1390,584,45],
 [3.14,1375,324,150],[3.43,1430,484,398],[3.7,1450,588,493],[4.36,1427,578,515],
 [4.6,1420,575,524],[5.14,1440,564,535],[5.61,1430,573,530],[5.78,1412,580,568],
 [6.08,1240,560,855],[6.32,960,540,1300]
];
export const heroPose=t=>track(heroKeys,t);
export const personalityPose=t=>track([[6.32,960,540,1300],[6.47,805,557,490],[6.68,625,590,238],[6.86,614,574,240],[7.03,623,582,233]],t);
/** Local appendages inherit the body's impulse; delayed responses preserve perceived mass. */
export function characterActing(t,local,flight,i){
 const impulse=u=>u<0?0:Math.sin(u*14)*Math.exp(-u*4.5),launch=Math.sin(Math.PI*flight),settle=impulse(local-.08),landing=impulse(Math.max(0,t-(9.85+i*.17+.49)));
 const slow=Math.sin(t*1.9+i)*.012,contact=t-(9.85+i*.17+.49),toe=u=>u<0?0:Math.sin(u*23)*Math.exp(-u*13);
 return {earL:.13*impulse(local-.035)-.085*launch+.050*impulse(contact-.025)+slow,earR:.105*impulse(local-.13)+.075*launch+.065*impulse(contact-.065)-slow,cheek:.035*settle+.02*landing,footL:.022*toe(contact),footR:.018*toe(contact-.028),antenna:.020*impulse(contact-.04),faceX:.018*Math.sin(local*2.7)-.034*settle,faceY:.018*launch-.025*settle};
}
/** A sustained optical track with compact velocity impulses across chapter seams. */
export function compositionPose(t){
 const pulse=(at,width)=>{const u=(t-at)/width;return Math.exp(-u*u)*u;};
 const seam=pulse(1.73,.13)+pulse(6.32,.12)+pulse(7.22,.12)+pulse(8.13,.12)+pulse(10.93,.14)+pulse(13.62,.16);
 const keys=[[0,-32,8,1.09,-.01],[1.5,34,-12,1.16,.008],[1.92,-36,20,1.1,-.006],[2.88,35,-5,1.14,.006],[3.7,-42,12,1.1,-.007],[5.78,45,-14,1.17,.009],[6.32,-25,10,1.13,-.012],[6.8,-34,14,1.1,-.006],[7.22,-62,-8,1.16,.007],[8.13,38,12,1.1,-.009],[8.87,-43,-9,1.17,.006],[9.65,8,9,1.09,-.005],[10.93,55,-10,1.15,.008],[12.1,-42,14,1.1,-.007],[13.62,28,-8,1.16,.005],[14.1,-28,8,1.1,-.007],[16,38,-9,1.2,.011]];
 const [x,y,scale,roll]=track(keys,t);
 return {x:x+65*seam,y:y-34*seam,scale:scale+.065*Math.abs(seam),roll:roll+.032*seam};
}
