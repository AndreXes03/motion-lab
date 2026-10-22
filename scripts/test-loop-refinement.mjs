import assert from 'node:assert/strict';
import * as T from 'three';
import {wavePose,waveHistory,concentricField,rimDetailPose,arrayPalette,arraySpeakerRotation,productHandoff,logoPose,headlineMotion,headlineRanks,titleEase} from '../src/scenes/loop-motion.js';
import {drawHeadline} from '../src/scenes/loop-headlines.js';
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

// The source follows the speaker, while older centres freeze in screen space.
// Rings keep expanding, including across birth/release boundaries and seeks.
for(let t=.1;t<2.4;t+=.013){
  const field=concentricField(t),later=concentricField(t+1e-6),pose=wavePose(t),projection=540/Math.tan(42*Math.PI/360);
  assert.equal(field.centre.x,960+projection*pose.x/6);assert.equal(field.centre.y,540-projection*pose.y/6);
  assert.deepEqual(field,concentricField(t));
  assert.ok(field.rings.length>=8);
  for(const ring of field.rings){
    const next=later.rings.find(r=>r.id===ring.id);
    if(next){assert.ok(next.radius>ring.radius&&next.radius-ring.radius<.1);assert.ok(Math.hypot(next.centre.x-ring.centre.x,next.centre.y-ring.centre.y)<.01);if(ring.age>=.44)assert.deepEqual(next.centre,ring.centre);}
    assert.ok(ring.width>=30&&ring.alpha>=0&&ring.alpha<=1);
  }
}
assert.notDeepEqual(concentricField(1.7),concentricField(1.8));
const ringSpeed=(t,c)=>{const a=concentricField(t,c).rings.find(r=>r.id===0),b=concentricField(t+.0001,c).rings.find(r=>r.id===0);return (b.radius-a.radius)/.0001;};
assert.ok(ringSpeed(.7,{waveExpansion:2.6})>ringSpeed(.7,{waveExpansion:1})*2.5);
assert.deepEqual(concentricField(.7,{waveExpansion:4}).centre,concentricField(.7,{waveExpansion:.5}).centre);
for(const follow of [0,.44,1])for(const speed of [.5,2.6,4])for(const age of [0.00001,follow-.000001,follow+.000001]){
  if(age<0)continue;
  const c={waveFollowTime:follow,waveExpansion:speed},a=concentricField(age,c).rings.find(r=>r.id===0),b=concentricField(age+.000001,c).rings.find(r=>r.id===0);
  if(a&&b){assert.ok(Math.hypot(b.centre.x-a.centre.x,b.centre.y-a.centre.y)<.01);if(age>=follow)assert.deepEqual(a.centre,b.centre);}
}
const recent=concentricField(.00001).rings.find(r=>r.id===0);
assert.ok(Math.hypot(recent.centre.x-concentricField(.00001).centre.x,recent.centre.y-concentricField(.00001).centre.y)<.001);
// Macro pass has substantial camera parallax with the camera clear of the lip.
assert.ok(rimDetailPose(0).offset.distanceTo(rimDetailPose(1).offset)>1.2);
for(let q=0;q<=1;q+=.02){const view=rimDetailPose(q);assert.ok(view.point.z+view.offset.z>1.4);}
assert.notDeepEqual(rimDetailPose(.8,{detailTravel:.5}),rimDetailPose(.8));
assert.equal(new Set(arrayPalette).size,6);
for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
  const qa=t=>new T.Quaternion().setFromEuler(arraySpeakerRotation(i,t));
  const qb=t=>new T.Quaternion().setFromEuler(arraySpeakerRotation(j,t));
  assert.ok(qa(0).invert().multiply(qb(0)).angleTo(qa(.8).invert().multiply(qb(.8)))>.1,'Array turns must change relative orientations');
}
assert.deepEqual(arraySpeakerRotation(3,0,{arraySpin:0}),arraySpeakerRotation(3,1,{arraySpin:0}));

// Product centre/radius and incoming mark remain C1 across the hard cut.
const h=.00001,at=productHandoff(0),left=productHandoff(-h),right=productHandoff(h),logo=logoPose(0);
assert.equal(at.x,logo.x-290*logo.scale);assert.equal(at.radius,67.5*logo.scale);
for(const key of ['x','y','radius'])assert.ok(Math.abs((at[key]-left[key])/h-(right[key]-at[key])/h)<.2,key+' velocity mismatch');
assert.ok((right.x-left.x)/(2*h)<-750,'The cut must carry a visible positional velocity, not a completed stop');
for(let t=-1.7;t<1.4;t+=.007){const p=productHandoff(t);assert.ok(p.radius>0&&Number.isFinite(p.x));}

// Check the whole departure, not merely the cut. Neither centre nor apparent
// radius reverses; the late acceleration and logo carry remain continuous.
for(const endingPullback of [.9,1.6,1.66])for(const logoSettle of [.12,.20,.35]){
  const c={endingPullback,logoSettle};let previous=productHandoff(-endingPullback,c);
  for(let age=-endingPullback+h;age<=0;age+=.004){const p=productHandoff(age,c);assert.ok(p.radius<=previous.radius&&p.x<=previous.x);previous=p;}
  const start=productHandoff(-endingPullback,c);
  assert.ok(productHandoff(-endingPullback/2,c).radius<start.radius-(start.radius-productHandoff(0,c).radius)*.4,'Departure must use the shot, not its last half second');
  for(const key of ['x','radius']){const at=productHandoff(0,c),before=productHandoff(-h,c),after=productHandoff(h,c);assert.ok(Math.abs((at[key]-before[key])/h-(after[key]-at[key])/h)<.3);}
}
const closingSpeed=t=>Math.abs((productHandoff(t+h).x-productHandoff(t).x)/h);
assert.ok(closingSpeed(-1.65)>2500,'Fast entry');
assert.ok(closingSpeed(-.85)<40,'Central recovery');
assert.ok(closingSpeed(-.04)>650,'Reaccelerate towards the logo');
assert.ok(productHandoff(-1.6).x>productHandoff(-1.6,{endingArrival:0}).x+400);
assert.notEqual(productHandoff(-1,{endingPullback:1.2}).radius,productHandoff(-1,{endingPullback:1.6}).radius);
assert.notEqual(logoPose(.1,{logoSettle:.12}).x,logoPose(.1,{logoSettle:.35}).x);
// Preserve the closing tail Andrea preferred; only the opening framing changes.
for(const [age,x,radius] of [[-.5,1016.8,150.1],[-.3,982.2,109],[-.1,902.5,85.2]]){const p=productHandoff(age);assert.ok(Math.abs(p.x-x)<.1&&Math.abs(p.radius-radius)<.1);}

// Titles enter from offscreen and cut while still visible at speed. Preserve
// leftward momentum when the entrance tail joins the reading interval.
for(const [anchor,width,word] of [[100,350,0],[1400,425,1]]){
  const d=1.16,start=headlineMotion(0,d,{},anchor,width,word),end=headlineMotion(d,d,{},anchor,width,word);
  assert.ok(start.x>=1920);assert.ok(end.x+width>0&&end.x<1920);
  const last=headlineMotion(d-h,d,{},anchor,width,word),earlier=headlineMotion(d-.08,d,{},anchor,width,word),beforeEarlier=headlineMotion(d-.08-h,d,{},anchor,width,word);
  const cutSpeed=(last.x-end.x)/h,earlierSpeed=(beforeEarlier.x-earlier.x)/h;
  assert.ok(cutSpeed>1800&&cutSpeed>earlierSpeed,'Disappear on a strong impulse, not after clearing the edge');
  let previous=Infinity;
  for(let age=0;age<=d;age+=.002){const p=headlineMotion(age,d,{},anchor,width,word);assert.equal(p.y,0);assert.ok(p.x<=previous+1e-8);previous=p.x;}
  for(const age of [.48,.6,.83]){const p=headlineMotion(age,d,{},anchor,width,word);assert.equal(p.reveal(4,5),1);assert.ok(Math.abs(p.x-anchor)<12);}
}

// Assert actual glyph transforms, not only the carrier: no diagonal motion or
// opposing letters even with a large saved letter-travel setting.
const originalPath=globalThis.Path2D;globalThis.Path2D??=class {constructor(path){this.path=path;}};
for(const text of ['brief.','this.','Again.'])for(const travel of [0,.12,.65]){
  const previous=Array(text.length).fill(Infinity);
  for(let age=0;age<1.16;age+=.002){
    const pose=headlineMotion(age,1.16,{},100,500,0,text);let i=0;
    const ctx={globalAlpha:1,save(){},restore(){},scale(){},fill(){},translate(x,y){assert.equal(y,0);const at=pose.x+x;assert.ok(at<=previous[i]+1e-7);previous[i++]=at;}};
    // Keep all glyphs in the mock so indices stay stable during partial reveals.
    drawHeadline(ctx,text,0,0,230,{rise:travel,reveal:(index,n)=>Math.max(1e-12,pose.reveal(index,n))});
  }
}
if(originalPath===undefined)delete globalThis.Path2D;

// The entry must blend into the reading drift without a stopped frame.
for(const word of [0,1]){const boundary=.46+word*.026,at=headlineMotion(boundary,1.16,{},100,350,word),before=headlineMotion(boundary-h,1.16,{},100,350,word),after=headlineMotion(boundary+h,1.16,{},100,350,word);assert.ok(Math.abs((at.x-before.x)/h-(after.x-at.x)/h)<1);assert.ok(after.x<at.x);}

// Both refinement controls affect motion, remain monotonic and preserve endpoints.
for(const sigma of [.12,.21,.40])for(const strength of [0,.5,1]){let prev=0;for(let i=0;i<=200;i++){const value=titleEase(i/200,{titleSigma:sigma,titleGaussian:strength});assert.ok(value>=prev-1e-7&&value<=1);prev=value;}assert.equal(titleEase(1,{titleSigma:sigma,titleGaussian:strength}),1);}
assert.notEqual(titleEase(.25,{titleSigma:.12}),titleEase(.25,{titleSigma:.4}));
assert.notEqual(titleEase(.25,{titleGaussian:0}),titleEase(.25,{titleGaussian:1}));

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
