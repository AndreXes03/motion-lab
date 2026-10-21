import assert from 'node:assert/strict';
import * as T from 'three';
import {waveHistory,productHandoff,logoPose,headlineMotion,headlineRanks} from '../src/scenes/loop-motion.js';
import {acousticClothGeometry,CLOTH_STRANDS,clothProfile,yarnCentre,coatingField,coatingSample} from '../src/scenes/loop-surface.js';

// Birth identity is stable, but existing contours must keep moving.
const a=waveHistory(.481),b=waveHistory(.491);
for(const before of a){const after=b.find(x=>x.id===before.id);assert.ok(after);assert.notDeepEqual(after.pose,before.pose);assert.equal(after.birth,before.birth);}
assert.deepEqual(waveHistory(.481),a);
// A new emission must not jump existing contours. Test either side of a birth.
const birth=12*2.4/58,previous=waveHistory(birth-1e-6),next=waveHistory(birth+1e-6);
for(const before of previous){const after=next.find(x=>x.id===before.id);assert.equal(after.birth,before.birth);for(const key of ['x','y','scale'])assert.ok(Math.abs(after.pose[key]-before.pose[key])<1e-4);}
// The visible older trail must continue moving late in the shot.
for(const t of [1.2,1.7,2.1]){const before=waveHistory(t).find(h=>h.id===12),after=waveHistory(t+.1).find(h=>h.id===12);assert.ok(Math.abs(after.pose.rotation.z-before.pose.rotation.z)>.01);}
for(const count of [28,58,90])for(let t=0;t<2.4;t+=.017){
  const history=waveHistory(t,{waveCount:count});assert.ok(history.length<=count);
  for(const h of history)assert.ok(h.alpha>=0&&h.alpha<=1);
}

// Product centre/radius and incoming mark remain C1 across the hard cut.
const h=.00001,at=productHandoff(0),left=productHandoff(-h),right=productHandoff(h),logo=logoPose(0);
assert.equal(at.x,logo.x-290*logo.scale);assert.equal(at.radius,67.5*logo.scale);
for(const key of ['x','y','radius'])assert.ok(Math.abs((at[key]-left[key])/h-(right[key]-at[key])/h)<.2,key+' velocity mismatch');
assert.ok((right.x-left.x)/(2*h)<-1000,'The cut must carry a visible positional velocity, not a completed stop');
for(let t=-1.7;t<1.4;t+=.007){const p=productHandoff(t);assert.ok(p.radius>0&&Number.isFinite(p.x));}

// Titles must enter and leave offscreen, read without bounce, and preserve
// leftward momentum when the entrance tail joins the reading interval.
for(const [anchor,width,word] of [[100,350,0],[1400,425,1]]){
  const d=1.16,start=headlineMotion(0,d,{},anchor,width,word),end=headlineMotion(d,d,{},anchor,width,word);
  assert.ok(start.x>=1920);assert.ok(end.x+width<0);
  let previous=Infinity;
  for(let age=0;age<=d;age+=.002){const p=headlineMotion(age,d,{},anchor,width,word);assert.ok(p.x<=previous+1e-8);previous=p.x;}
  for(const age of [.48,.6,.83]){const p=headlineMotion(age,d,{},anchor,width,word);assert.equal(p.reveal(4,5),1);assert.ok(Math.abs(p.x-anchor)<12);}
}

// The entry must blend into the reading drift without a stopped frame.
for(const word of [0,1]){const boundary=.42+word*.026,at=headlineMotion(boundary,1.16,{},100,350,word),before=headlineMotion(boundary-h,1.16,{},100,350,word),after=headlineMotion(boundary+h,1.16,{},100,350,word);assert.ok(Math.abs((at.x-before.x)/h-(after.x-at.x)/h)<1);assert.ok(after.x<at.x);}

// Letter assembly is deterministic but visibly not a reading-order wipe.
for(const text of ['brief.','this.','Again.']){
 const ranks=headlineRanks(text);assert.deepEqual(ranks,headlineRanks(text));
 assert.ok(ranks.some((rank,i)=>i>0&&rank<ranks[i-1]));
 const p=headlineMotion(.15,1.16,{},1400,425,0,text),q=[...text].map((_,i)=>p.reveal(i,text.length));
 assert.ok(q.some((value,i)=>i>0&&value>q[i-1]),text+' should visibly assemble out of order');
 assert.deepEqual(q,[...text].map((_,i)=>headlineMotion(.15,1.16,{},1400,425,0,text).reveal(i,text.length)));
 for(let i=0;i<text.length;i++)assert.equal(headlineMotion(.42,1.16,{},1400,425,0,text).reveal(i,text.length),1);
}

// No unpainted islands at completion, early paint at zero, or U-seam jump.
for(const detail of [.5,1,2])for(const edge of [.4,1,1.8])for(let j=0;j<=40;j++)for(let i=0;i<=40;i++){
  const u=i/40,v=j/40,f=coatingField(u,v,detail);
  assert.ok(f>0&&f<1);assert.equal(coatingSample(u,v,0,detail,edge).blend,0);assert.equal(coatingSample(u,v,1,detail,edge).blend,1);
  let previous=0;for(let p=0;p<=1.001;p+=.025){const sample=coatingSample(u,v,Math.min(1,p),detail,edge);assert.ok(sample.blend+1e-8>=previous,'Coating must not retract');previous=sample.blend;}
}
for(let v=0;v<1;v+=.01)assert.ok(Math.abs(coatingField(0,v)-coatingField(1,v))<1e-10);

const cloth=acousticClothGeometry(),p=cloth.attributes.position;
assert.equal(cloth.userData.yarnCount,CLOTH_STRANDS*2);
assert.equal(cloth.groups.length,6);assert.equal(cloth.groups.reduce((n,g)=>n+g.count,0),cloth.index.count);
assert.ok(cloth.boundingBox.max.z-cloth.boundingBox.min.z>.019);
assert.ok(cloth.boundingBox.max.z-cloth.boundingBox.min.z<.024);
const spacing=2*1.128/(CLOTH_STRANDS+1);
for(let i=-15;i<=15;i++)for(let j=-15;j<=15;j++){
  const h=yarnCentre(0,i,j*spacing,spacing),v=yarnCentre(1,j,i*spacing,spacing);
  assert.ok(Math.abs(h-v)>spacing*.31,'Crossing yarns must remain separated');
  assert.ok(Math.abs((h+v)/2-clothProfile(j*spacing,i*spacing))<1e-10);
}
const fabric=new T.Mesh(cloth,Array.from({length:6},()=>new T.MeshBasicMaterial({side:T.DoubleSide})));
const ray=(x,y)=>new T.Raycaster(new T.Vector3(x,y,.1),new T.Vector3(0,0,-1)).intersectObject(fabric);
assert.equal(ray(spacing*.5,spacing*.5).length,0,'Pores must be open, not a textured plane');
assert.ok(ray(0,0).length>=2,'A crossing must contain actual yarn surfaces');
for(const n of cloth.attributes.normal.array)assert.ok(Number.isFinite(n));
fabric.material.forEach(m=>m.dispose());cloth.dispose();console.log('LOOP: stable trail history, C1 logo handoff, complete coating and separated woven yarns with open pores passed.');
