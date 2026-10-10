// Project editable 2D cards as actual quadrilaterals in a 3D camera space.
// Tessellation gives both vertical/horizontal foreshortening without WebGL copies.
const focal=1800,cx=960,cy=540;
export function projectReplayPoint(p,u=0,v=0){
 const x=u*p.scale,y=v*p.scale,cz=Math.cos(p.rotation),sz=Math.sin(p.rotation);
 const dx=x*cz-y*sz,dy=x*sz+y*cz;
 const wy=dy*Math.cos(p.pitch),wz=dy*Math.sin(p.pitch);
 const wx=dx*Math.cos(p.yaw)+wz*Math.sin(p.yaw);
 const z=(p.z??0)-dx*Math.sin(p.yaw)+wz*Math.cos(p.yaw);
 const k=focal/(focal-z);
 return {x:cx+(p.x-cx+wx)*k,y:cy+(p.y-cy+wy)*k,z};
}
function triangle(c,image,uv,points){
 const [u0,u1,u2]=uv,[p0,p1,p2]=points;
 const du1=u1[0]-u0[0],dv1=u1[1]-u0[1],du2=u2[0]-u0[0],dv2=u2[1]-u0[1];
 const dx1=p1.x-p0.x,dy1=p1.y-p0.y,dx2=p2.x-p0.x,dy2=p2.y-p0.y;
 const det=du1*dv2-du2*dv1;
 const a=(dx1*dv2-dx2*dv1)/det,b=(dy1*dv2-dy2*dv1)/det;
 const cc=(du1*dx2-du2*dx1)/det,d=(du1*dy2-du2*dy1)/det;
 c.save();c.beginPath();const mx=(p0.x+p1.x+p2.x)/3,my=(p0.y+p1.y+p2.y)/3;
 for(let i=0;i<3;i++){const p=points[i],dx=p.x-mx,dy=p.y-my,r=Math.hypot(dx,dy),k=(r+.3)/r;c[i?'lineTo':'moveTo'](mx+dx*k,my+dy*k)}c.closePath();c.clip();
 c.transform(a,b,cc,d,p0.x-a*u0[0]-cc*u0[1],p0.y-b*u0[0]-d*u0[1]);c.drawImage(image,0,0,250,300);c.restore();
}
export function drawReplayCard3D(c,image,p,alpha=1){
 c.save();c.globalAlpha*=alpha;c.imageSmoothingQuality='high';
 const nx=4,ny=6;
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const uv=[[x*250/nx,y*300/ny],[(x+1)*250/nx,y*300/ny],[(x+1)*250/nx,(y+1)*300/ny],[x*250/nx,(y+1)*300/ny]];
  const points=uv.map(([u,v])=>projectReplayPoint(p,u-125,v-150));
  triangle(c,image,[uv[0],uv[1],uv[2]],[points[0],points[1],points[2]]);
  triangle(c,image,[uv[0],uv[2],uv[3]],[points[0],points[2],points[3]]);
 }
 c.restore();
}
