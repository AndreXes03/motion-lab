import assert from 'node:assert/strict';
import {applyFilmGrain} from '../src/engine/film-grain.js';
function render(time,amount=.018){const data=new Uint8ClampedArray(64*36*4).fill(128);for(let i=3;i<data.length;i+=4)data[i]=255;const ctx={getImageData:()=>({data}),putImageData:()=>{}};applyFilmGrain(ctx,time,64,36,{amount,size:1.1,fps:30});return data;}
const a=render(1);render(7);assert.deepEqual(a,render(1));assert.notDeepEqual(a,render(1+1/30));assert.equal(render(1,0)[0],128);for(let i=0;i<a.length;i+=4){assert.equal(a[i],a[i+1]);assert.equal(a[i],a[i+2]);assert.equal(a[i+3],255);}console.log('PASS: deterministic grain, evolving frames, bypass, monochrome and alpha preservation');
