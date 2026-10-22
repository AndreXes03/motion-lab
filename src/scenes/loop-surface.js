import * as T from 'three';
const clamp=x=>Math.max(0,Math.min(1,x));

// Balanced over / under yarns, with separate geometry relief and fibre shading.
export function weaveHeight(u,v){
  const tau=Math.PI*2;
  const x=u*104+.12*Math.sin(v*tau*7)+.04*Math.sin(u*tau*19+v*tau*3);
  const y=v*112+.10*Math.sin(u*tau*9)+.035*Math.sin(v*tau*17-u*tau*4);
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const warp=Math.sin(fx*Math.PI)**2.7,weft=Math.sin(fy*Math.PI)**2.4,over=(ix+iy)%2===0;
  const thickness=.94+.06*Math.sin(ix*1.71+iy*.37);
  return Math.max(warp*(over?1:.42),weft*(over?.42:1))*thickness;
}
export const CLOTH_STRANDS=201;
export function clothProfile(x,y,radius=1.128){return .016*Math.max(0,1-(x*x+y*y)/(radius*radius));}
// Crossing centres have opposite height. The open space between the yarns
// is real geometry, rather than shadows painted onto an unbroken plane.
export function yarnCentre(axis,strand,s,spacing,radius=1.128){
  const c=strand*spacing,x=axis===0?s:c,y=axis===0?c:s;
  return clothProfile(x,y,radius)+(axis===0?1:-1)*spacing*.158*Math.cos(Math.PI*(s/spacing+strand));
}
export function acousticClothGeometry(radius=1.128){
  const positions=[],uvs=[],profiles=[],groups=Array.from({length:6},()=>[]);
  const spacing=radius*2/(CLOTH_STRANDS+1),half=(CLOTH_STRANDS-1)/2,sides=6;
  for(let axis=0;axis<2;axis++)for(let strand=-half;strand<=half;strand++){
    const c=strand*spacing,variation=Math.sin(strand*1.73+axis*2.4);
    const width=spacing*(.435+.015*variation),height=spacing*.075*(1+.08*variation);
    const extent=Math.sqrt(Math.max(0,(radius-.0015)**2-(Math.abs(c)+width)**2));
    const segments=Math.ceil(extent*2/spacing*2),start=positions.length/3;
    const material=Math.abs(Math.floor(Math.sin(strand*13.71+axis*6.13)*17843))%groups.length,indices=groups[material];
    for(let j=0;j<=segments;j++){
      const s=-extent+j/segments*extent*2,z=yarnCentre(axis,strand,s,spacing,radius);
      const slope=-.032*s/(radius*radius)-(axis===0?1:-1)*.158*Math.PI*Math.sin(Math.PI*(s/spacing+strand));
      const inv=1/Math.hypot(1,slope);
      for(let k=0;k<sides;k++){
        const angle=k*Math.PI*2/sides,side=width*Math.cos(angle),normal=height*Math.sin(angle);
        const longitudinal=s-slope*inv*normal;
        const x=axis===0?longitudinal:c+side,y=axis===0?c+side:longitudinal;
        positions.push(x,y,z+normal*inv);profiles.push(clothProfile(x,y,radius));
        // UV follows each yarn. Fibre microstructure never draws a second grid.
        uvs.push((s+radius)/(radius*2),k/sides);
      }
    }
    for(let j=0;j<segments;j++)for(let k=0;k<sides;k++){
      const a=start+j*sides+k,b=start+j*sides+(k+1)%sides,c=a+sides,d=b+sides;
      if(axis===0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  const indices=[];for(let i=0;i<groups.length;i++){g.addGroup(indices.length,groups[i].length,i);for(const index of groups[i])indices.push(index);}
  g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();
  g.userData.clothProfile=Float32Array.from(profiles);g.userData.yarnCount=CLOTH_STRANDS*2;
  return g;
}

// Periodic in U (the housing seam) and bounded inside (0,1). A completed
// coating reaches every surface; progress zero leaves the original untouched.
export function coatingNoise(u,v,scale=1){
  const a=u*Math.PI*2,k=scale;
  return .5+.23*Math.sin(13*Math.sin(a)*k+v*19+Math.cos(a*3)*1.7)
    +.17*Math.sin(21*Math.cos(a)*k-v*31+Math.sin(a*5))
    +.10*Math.sin(37*Math.sin(a)*k+v*53);
}
export function coatingField(u,v,scale=1){
  const sweep=(1-Math.cos(u*Math.PI*2-2.15))/2;
  return .09+.82*clamp(.08+.68*sweep+.32*(coatingNoise(u,v,scale)-.2)+.06*Math.sin(v*19));
}
export function coatingSample(u,v,progress,scale=1,edge=1){
  return coatingFromField(coatingField(u,v,scale),coatingNoise(u,v,scale*2.8),progress,edge);
}
export function coatingFromField(field,noise,progress,edge=1){
  if(progress<=0)return {blend:0,wet:0};if(progress>=1)return {blend:1,wet:0};
  const delta=progress-field,width=.028*edge;
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const n=noise;
  const seeds=n>.75?smooth((n-.75)*12)*smooth((delta+.09*edge)/(.09*edge)):0;
  const blend=Math.max(smooth((delta+width)/(width*2)),seeds);
  // Wet relief belongs to the actual colour boundary, including small islands.
  return {blend,wet:4*blend*(1-blend)};
}
