export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
export function sampleCamera(keys,t){
 let i=0;while(i<keys.length-2 && t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],u=smooth((t-a.t)/(b.t-a.t));
 return {position:a.position.map((v,j)=>v+(b.position[j]-v)*u),target:a.target.map((v,j)=>v+(b.target[j]-v)*u)};
}
