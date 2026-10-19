import assert from 'node:assert/strict';
import {applyDisplayGrade} from '../src/engine/display-grade.js';

// Original authored grade retained only as a benchmark/reference oracle.
function legacyDisplayGrade(ctx,width,height,{colorContrast=1,colorSaturation=1}={}){
  const contrast=Math.max(.5,Math.min(1.8,Number(colorContrast)||1)),saturation=Math.max(0,Math.min(2.5,Number.isFinite(Number(colorSaturation))?Number(colorSaturation):1));
  if(contrast===1&&saturation===1)return;
  const frame=ctx.getImageData(0,0,width,height),data=frame.data;
  for(let i=0;i<data.length;i+=4){
    const luma=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
    for(let j=0;j<3;j++)data[i+j]=Math.max(0,Math.min(255,(luma+(data[i+j]-luma)*saturation-127.5)*contrast+127.5));
  }
  ctx.putImageData(frame,0,0);
}

const width=1920,height=1080,warmups=8,iterations=25;
const source=new Uint8ClampedArray(width*height*4);
for(let i=0;i<source.length;i++)source[i]=(i*17+i%137)&255;
const options={colorContrast:1.2,colorSaturation:.8};
const cases=[['legacy',legacyDisplayGrade],['optimized',applyDisplayGrade]].map(([name,apply])=>{
  const data=source.slice(),frame={data};
  return {name,apply,data,ctx:{getImageData:()=>frame,putImageData:()=>{}},times:[]};
});
function run(entry,timed){
  entry.data.set(source); // Buffer restoration is deliberately outside the timer.
  const start=performance.now();
  entry.apply(entry.ctx,width,height,options);
  const elapsed=performance.now()-start;
  if(timed)entry.times.push(elapsed);
}
for(const entry of cases)run(entry,false);
assert.deepEqual(cases[0].data,cases[1].data,'Optimized grade must exactly match legacy bytes, including alpha');
for(let round=0;round<warmups+iterations;round++){
  // Reverse the execution order each round to share warmup/scheduling effects.
  const order=round%2?cases.toReversed():cases;
  for(const entry of order)run(entry,round>=warmups);
}
assert.deepEqual(cases[0].data,cases[1].data);
console.log(`Display grade CPU pixel benchmark: ${width}×${height}, contrast ${options.colorContrast}, saturation ${options.colorSaturation}`);
console.log(`${warmups} warmup rounds, ${iterations} timed rounds per implementation; alternating order; source reset outside timing.`);
console.log('Mocked ImageData transfers: excludes browser/Canvas readback, upload, GPU work and full-frame rendering. No performance gate.');
for(const entry of cases){
  entry.times.sort((a,b)=>a-b);
  const median=entry.times[Math.floor(entry.times.length/2)];
  console.log(`${entry.name}: ${median.toFixed(2)} ms median`);
}
console.log('PASS: byte-exact legacy comparison, including alpha');
