// Run from the repository root: node examples/render-procedural.mjs
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const frames=await mkdtemp(join(tmpdir(),'motion-lab-procedural-'));
const browser=await chromium.launch({headless:true, channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});
  await page.goto(pathToFileURL(resolve('examples/procedural-field.html')).href);
  await page.evaluate(()=>window.proceduralReady);
  // Stop the live clock: every output frame uses an explicit time.
  await page.evaluate(()=> {window.requestAnimationFrame=()=>0;});
  await mkdir('demo',{recursive:true});
  await page.waitForTimeout(100);
  const duration=await page.evaluate(()=>window.proceduralSettings.duration);
  const fps=18;
  for(let i=0;i<Math.ceil(fps*duration);i++) {
    await page.evaluate(t=>window.renderAt(t),i/fps);
    await page.locator('canvas').screenshot({path:join(frames,`${String(i).padStart(4,'0')}.png`)});
  }
  await page.evaluate(t=>window.renderAt(t),duration/2);
  await page.locator('canvas').screenshot({path:resolve('demo/procedural-field-poster.png')});
  const result=spawnSync(ffmpeg,['-y','-framerate',String(fps),'-i',join(frames,'%04d.png'),'-filter_complex','[0:v]scale=800:450:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5','-loop','0','demo/procedural-showcase.gif'],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);
  console.log(`Rendered ${Math.ceil(fps*duration)} frames, 800 × 450, ${fps} fps, ${duration}-second loop.`);
} finally {await browser.close();await rm(frames,{recursive:true,force:true});}
