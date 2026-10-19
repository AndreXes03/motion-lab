// Self-contained function: Playwright serializes it into the render page.
// temporalModule is injectable so Node tests exercise the same evaluator with
// a mocked canvas and the real scheduling module, without installing a browser.
export async function renderCliFrame({time,width,height,parameters={},temporalSamples=1,fps=30,duration=10,reportSamples=false,temporalModule='/src/engine/temporal.js'}) {
    if (![width,height].every(n=>Number.isInteger(n)&&n>0&&n<=3840) || width*height>8294400) throw new Error('Render dimensions must be positive integers up to 3840 with at most 8294400 pixels');
    const canvas = document.querySelector('#renderCanvas');
    if (!canvas) throw new Error('#renderCanvas disappeared');
    if (!Number.isInteger(temporalSamples) || temporalSamples < 1 || temporalSamples > 64) throw new Error('Temporal samples must be an integer from 1 to 64');
    const shutterAngle=window.motion.shutterAngleAt?.(time,parameters)??parameters.look?.post?.shutterAngle??210;
    const requestedCount=temporalSamples===1?1:window.motion.temporalSamplesAt?.(time,temporalSamples,parameters)??temporalSamples;
    if (!Number.isFinite(requestedCount)) throw new Error('Scene temporal sample count must be finite');
    const sampleCount=Math.min(64,Math.max(1,Math.round(requestedCount)));
    const {shutterSamples}=await import(temporalModule);
    const schedule=shutterSamples(time,{fps,duration,samples:sampleCount,shutterAngle,cuts:window.motion.cutTimes?.(parameters)??parameters.motion?.cuts??[],profile:parameters.look?.post?.shutterProfile??'cosine'});
    if (schedule.length === 1) {
      await window.motion.render(time, { width, height, parameters:{...parameters,renderSample:{fps}} });
    } else {
      if(typeof window.motion.finishFrame!=='function')throw new Error('Multisample render requires motion.finishFrame for grain after integration');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Temporal integration requires a 2D render canvas');
      const scratchKey = Symbol.for('motion-lab.cli.temporal');
      let scratch = canvas[scratchKey];
      if (!scratch || scratch.width !== width || scratch.height !== height) {
        const linear=new Float32Array(256);for(let i=0;i<256;i++){const s=i/255;linear[i]=s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);}
        scratch = canvas[scratchKey] = {width,height,linear,accumulated:new Float32Array(width*height*4),averaged:ctx.createImageData(width,height)};
      }
      const {accumulated,linear,averaged} = scratch;
      accumulated.fill(0);
      for (let i = 0; i < schedule.length; i++) {
        const sample = schedule[i];
        await window.motion.render(sample.time, { width, height, parameters:{...parameters,renderSample:{frameTime:time,grain:false,fps}} });
        const pixels = ctx.getImageData(0, 0, width, height).data;
        for (let p = 0; p < accumulated.length; p++) accumulated[p] += (p%4===3?pixels[p]/255:linear[pixels[p]]) * sample.weight;
        if (reportSamples) await window.__motionLabProgress({ phase: 'sampling', sample: i + 1, totalSamples: schedule.length, frames: 0, total: 1, percent: Math.floor((i + 1) / schedule.length * 80) });
      }
      for (let p = 0; p < accumulated.length; p++){const l=accumulated[p];averaged.data[p]=255*(p%4===3?l:l<=.0031308?12.92*l:1.055*Math.pow(l,1/2.4)-.055);}
      ctx.putImageData(averaged, 0, 0);
      await window.motion.finishFrame(ctx,time,width,height,{...parameters,renderSample:{fps}});
    }
    return canvas.toDataURL('image/png');
}
