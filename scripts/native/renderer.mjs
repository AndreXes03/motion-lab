import {fileURLToPath} from 'node:url';
import {validateAppDemo} from '../../src/engine/app-demo.js';
import {readImageAsset} from '../image-assets.mjs';
import {loadImage} from 'skia-canvas';
import {createNativeCanvas} from './canvas.mjs';
import {createProductionScene} from '../../src/engine/production-scene.js';
import {renderProcedural} from '../../src/engine/procedural.js';
import {proceduralCuts,proceduralShutter} from '../../src/scenes/procedural-demo.js';
import {shutterSamples} from '../../src/engine/temporal.js';
import {applyDisplayGrade} from '../../src/engine/display-grade.js';
import {applyFilmGrain} from '../../src/engine/film-grain.js';

export function createNativeRenderer(parameters) {
  const scene=createProductionScene(parameters);
  let canvas,ctx;const images=new Map();let prepared;
  async function prepare(){if(scene.config.scene!=='appdemo')return;if(!prepared)prepared=(async()=>{const d=validateAppDemo(parameters.appDemo);const root=fileURLToPath(new URL('../../',import.meta.url));for(const asset of new Set([...d.slides.map(s=>s.asset),d.logo].filter(Boolean))){images.set(asset,await loadImage(await readImageAsset(root,asset)));}})();await prepared;}
  function draw(time,width,height) {
    if(!canvas||canvas.width!==width||canvas.height!==height){canvas?.dispose();canvas=createNativeCanvas(width,height);ctx=canvas.getContext('2d');}
    const state=scene.evaluate(time);
    ctx.reset();
    ctx.save();ctx.scale(width/state.width,height/state.height);
    try{renderProcedural(ctx,state.time,{...state,images});}finally{ctx.restore();}
    return state;
  }
  return {
    engine:'skia',device:'CPU',version:'skia-canvas-4.0.0',config:scene.config,
    sampleMotion:()=>scene.sampleMotion(),
    close:async()=>canvas?.release(),
    async renderPng(time,width,height,parameters,samples=1,fps=30,report=()=>{}) {
      await prepare();const state=scene.evaluate(time),post=state.parameters.look?.post??{};
      const shutter=scene.config.scene==='appdemo'?0:proceduralShutter(state.time,post.shutterAngle??210);
      const schedule=shutterSamples(state.time,{fps,duration:scene.config.duration,samples:shutter===0?1:samples,shutterAngle:shutter,cuts:proceduralCuts,profile:post.shutterProfile??'cosine'});
      if(schedule.length===1)draw(time,width,height);
      else {
        const accum=new Float32Array(width*height*4),linear=Float32Array.from({length:256},(_,i)=>{const v=i/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
        for(let i=0;i<schedule.length;i++){
          const sample=schedule[i];draw(sample.time,width,height);const pixels=ctx.getImageData(0,0,width,height).data;
          for(let p=0;p<pixels.length;p++)accum[p]+=(p%4===3?pixels[p]/255:linear[pixels[p]])*sample.weight;
          report({phase:'sampling',sample:i+1,totalSamples:schedule.length,frames:0,total:1,percent:Math.floor((i+1)/schedule.length*80)});
        }
        const pixels=ctx.createImageData(width,height);
        for(let p=0;p<accum.length;p++){const v=accum[p];pixels.data[p]=255*(p%4===3?v:v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055);}
        ctx.putImageData(pixels,0,0);
      }
      if(!parameters.review||parameters.review==='beauty'){
        applyDisplayGrade(ctx,width,height,post);
        applyFilmGrain(ctx,state.time,width,height,{amount:post.grain??0,size:post.grainSize??1.1,fps});
      }
      return canvas.toBuffer('png');
    },
    async contactSheet({shots,cellW,cellH,cols,rows}) {
      const sheet=createNativeCanvas(cols*cellW,rows*(cellH+28)),c=sheet.getContext('2d');
      c.fillStyle='#111';c.fillRect(0,0,sheet.width,sheet.height);c.font='14px Arial';c.fillStyle='#fff';
      for(let i=0;i<shots.length;i++){const x=i%cols*cellW,y=Math.floor(i/cols)*(cellH+28);c.drawImage(await loadImage(Buffer.from(shots[i].png,'base64')),x,y,cellW,cellH);c.fillText(`${shots[i].time.toFixed(2)} s`,x+8,y+cellH+19);}
      try{return await sheet.toBuffer('png');}finally{await sheet.release();}
    }
  };
}
