#!/usr/bin/env node
import {videoEncodeArgs} from './video-encode.mjs';
import {normalizeAudioTracks} from '../src/engine/audio-track.js';
import {renderTimelineAudio,validateTimelineAudioAssets} from './native/audio.mjs';
import {browserLaunchOptions} from './browser-runtime.mjs';
import {applyRenderQuality} from '../src/engine/render-quality.js';
import {openFrameCache,sourceFingerprint} from './render-cache.mjs';
import {sceneConfig,sceneIds} from '../src/scene-registry.js';
import { createServer } from 'vite';
import {planSound,renderSound,encodeWav,normalizeSound} from '../src/engine/sound-design.js';
import { config } from '../src/config.js';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import ffprobe from 'ffprobe-static';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let DEFAULT = config;
const subprocesses=new Set();

function output(type, payload = {}) { process.stdout.write(`${JSON.stringify({ type, ...payload })}\n`); }
function fail(message, extra = {}) { output('error', { message, ...extra }); process.exitCode = 1; }
function parseArgs(argv) {
  const [command, ...rest] = argv;
  let opts = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'help') { opts.help = true; continue; }
    if (!rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error(`Missing value for --${key}`);
    opts[key] = rest[++i];
  }
  opts=applyRenderQuality(opts);
  let parameters = {};
  if (opts.parameters !== undefined) {
    try { parameters = JSON.parse(opts.parameters); } catch { throw new Error('--parameters must be valid JSON'); }
    if (!parameters || Array.isArray(parameters) || typeof parameters !== 'object') throw new Error('--parameters must be a JSON object');
  }
  if(opts.scene){if(!sceneIds.includes(opts.scene))throw new Error('--scene must be '+sceneIds.join(', '));parameters.scene=opts.scene;}
  return { command, opts, parameters };

}
function help() {
  output('help', { scene: '--scene '+sceneIds.join('|')+' (all commands)', audio:'--sound on|off (3D and procedural 2D; subtle default mix, saved with the recipe)', quality:'--quality preview|lookdev|final|premium|supersampled (explicit dimensions and sample counts override the preset)', resume:'--resume on|off --keep-frames on|off (matching source/settings only; premium enables resume)', settings:'--fps 24|25|30|50|60 --format mp4|webm|prores --bitrate-mbps 2..200 --temporal-samples 1..64 (24 recommended)', commands: {
    viewer: 'viewer [--width 1920 --height 1080] (opens local preview on :4173)',
    frame: 'frame --out frame.png [--time 0 --width 1920 --height 1080]',
    contact: 'contact --out contact.png [--samples 6 --width 1920 --height 1080]',
    preview: 'preview --out preview.mp4 [--start 0 --end 9 --temporal-samples 1 --width 960 --height 540]',
    export: 'export --out final.mp4 [--start 0 --end 9 --temporal-samples 1 --width 1920 --height 1080]',
    verify: 'verify [--out final.mp4 --time 1.25 --parameters \"{...}\"] (seek stability + optional ffprobe metadata)'
  }});
}
async function startVite(port = 0) {
  // Isolated renders may share node_modules, but must not invalidate each
  // other's optimized dependencies while their browser is loading.
  const server = await createServer({ root: ROOT, cacheDir: path.join(ROOT, '.motion-cache', 'vite'), server: { host: '127.0.0.1', port, strictPort: port !== 0, hmr: port !== 0, watch: port === 0 ? null : {} }, logLevel: 'error' });
  await server.listen();
  const address = server.httpServer.address();
  return { server, url: `http://127.0.0.1:${address.port}/` };
}
async function openMotion(browser, url, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.exposeFunction('__motionLabProgress', event => output('progress', event));
  page.on('pageerror', e => output('browser-error', { message: e.message }));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.motion && !!window.motion.ready, null, { timeout: 30000 });
  await page.evaluate(async () => { await window.motion.ready; });
  const hasRender = await page.evaluate(() => typeof window.motion.render === 'function');
  if (!hasRender) throw new Error('window.motion.render(time,{width,height,parameters}) is missing');
  if (await page.locator('#renderCanvas').count() !== 1) throw new Error('Expected exactly one #renderCanvas');
  return page;
}
async function renderPng(page, time, width, height, parameters = {}, temporalSamples = 1, fps = DEFAULT.fps, reportSamples = false) {
  if(page.engine==='skia')return page.renderPng(time,width,height,parameters,temporalSamples,fps,reportSamples?event=>output('progress',event):undefined);
  const dataUrl = await page.evaluate(async ({ time, width, height, parameters, temporalSamples, fps, duration, reportSamples }) => {
    const canvas = document.querySelector('#renderCanvas');
    if (!canvas) throw new Error('#renderCanvas disappeared');
    const shutterAngle=window.motion.shutterAngleAt?.(time,parameters)??parameters.look?.post?.shutterAngle??210;
    const sampleCount=temporalSamples===1?1:Math.min(64,Math.max(1,Math.round(window.motion.temporalSamplesAt?.(time,temporalSamples,parameters)??temporalSamples)));
    if (sampleCount === 1 || shutterAngle === 0) {
      await window.motion.render(time, { width, height, parameters:{...parameters,renderSample:{fps}} });
    } else {
      const ctx = canvas.getContext('2d');
      const accumulated = new Float32Array(width * height * 4);
      const linear=new Float32Array(256);for(let i=0;i<256;i++){const s=i/255;linear[i]=s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);}
      const {shutterSamples}=await import('/src/engine/temporal.js');
      const schedule=shutterSamples(time,{fps,duration,samples:sampleCount,shutterAngle,cuts:window.motion.cutTimes?.(parameters)??parameters.motion?.cuts??[],profile:parameters.look?.post?.shutterProfile??'cosine'});
      for (let i = 0; i < schedule.length; i++) {
        const sample = schedule[i];
        await window.motion.render(sample.time, { width, height, parameters:{...parameters,renderSample:{frameTime:time,grain:false,fps}} });
        const pixels = ctx.getImageData(0, 0, width, height).data;
        for (let p = 0; p < accumulated.length; p++) accumulated[p] += (p%4===3?pixels[p]/255:linear[pixels[p]]) * sample.weight;
        if (reportSamples) await window.__motionLabProgress({ phase: 'sampling', sample: i + 1, totalSamples: schedule.length, frames: 0, total: 1, percent: Math.floor((i + 1) / schedule.length * 80) });
      }
      const averaged = ctx.createImageData(width, height);
      for (let p = 0; p < accumulated.length; p++){const l=accumulated[p];averaged.data[p]=255*(p%4===3?l:l<=.0031308?12.92*l:1.055*Math.pow(l,1/2.4)-.055);}
      ctx.putImageData(averaged, 0, 0);
      if(typeof window.motion.finishFrame!=='function')throw new Error('Multisample render requires motion.finishFrame for grain after integration');
      await window.motion.finishFrame(ctx,time,width,height,{...parameters,renderSample:{fps}});
    }
    return canvas.toDataURL('image/png');
  }, { time, width, height, parameters, temporalSamples, fps, duration: DEFAULT.duration, reportSamples });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}
function outPath(value) { if (!value) throw new Error('This command requires --out <path>'); return path.resolve(process.cwd(), value); }
async function writeImage(png, target) { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, png); }
async function encodeFrames(frameDir, target, width, height, fps, format, bitrateMbps, audioPath=null, frameCount) {
  await mkdir(path.dirname(target), { recursive: true });
  const args=videoEncodeArgs({frameDir,target,fps,format,bitrateMbps,audioPath,frameCount});
  await run(ffmpegPath, args);
  const video=(await probeVideo(target,false)).streams[0];
  if(video.width!==width||video.height!==height||video.nb_frames&&Number(video.nb_frames)!==frameCount)throw Error('Encoded video dimensions or frame count do not match the render');
}
async function writeProgressJpeg(page, png, target) {
  const jpeg = await sharp(png).resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).jpeg({quality:76}).toBuffer();
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, jpeg);
  await rename(temporary, target);
}
function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });subprocesses.add(child);child.on('close',()=>subprocesses.delete(child)); let err = '';
    child.stderr.on('data', d => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} exited ${code}: ${err.trim()}`)));
  });
}
async function exportVideo(page, target, width, height, parameters, start, end, temporalSamples, fps, format, bitrateMbps, cacheOptions) {
  await validateTimelineAudioAssets(ROOT,parameters.audio);
  // Progress JPEGs are written before encoding, including the very first frame.
  await mkdir(path.dirname(target), { recursive: true });
  const cache = await openFrameCache(ROOT, {source:cacheOptions.resume?await sourceFingerprint(ROOT):null,
    width,height,parameters,start,end,temporalSamples,fps,browser:page.engine==='skia'?page.version:page.context().browser().version()},cacheOptions);
  const frameDir = cache.directory;
  const total = Math.round((end - start) * fps);
  const previewPath = `${target}.progress.jpg`;
  let lastPreviewAt = 0, previewFrame = 0, success = false, reused = 0;
  try {
    for (let i = 0; i < total; i++) {
      let png = await cache.read(i);
      if (png) reused++;
      else { png = await renderPng(page, start + i / fps, width, height, parameters, temporalSamples, fps); await cache.write(i,png); }
      const now = Date.now();
      if (now - lastPreviewAt >= 1000 || i === total - 1) {
        await writeProgressJpeg(page, png, previewPath);
        lastPreviewAt = Date.now();
        previewFrame = i + 1;
      }
      output('progress', { phase: 'rendering', frames: i + 1, total, reused, previewFrame, percent: Math.min(98, Math.round((i + 1) / total * 98)) });
    }
    output('progress', { phase: 'encoding', frames: total, total, percent: 99 });
    let audioPath=null;
    if(parameters.sound?.enabled){
      const telemetry=page.engine==='skia'?page.sampleMotion():await page.evaluate(p=>window.motion.sampleMotion(p),parameters);
      const result=renderSound(planSound(telemetry,parameters.sound));
      const channels=result.channels.map(c=>c.slice(Math.round(start*result.sampleRate),Math.round(end*result.sampleRate)));
      audioPath=path.join(frameDir,'sound.wav');await writeFile(audioPath,encodeWav(channels,result.sampleRate));
    }
    audioPath=await renderTimelineAudio({root:ROOT,audio:parameters.audio,sound:parameters.sound,start,duration:total/fps,destination:path.join(frameDir,'timeline-mix.wav'),baseAudio:audioPath,run});
    await encodeFrames(frameDir, target, width, height, fps, format, bitrateMbps,audioPath,total);
    success = true;
  } finally { await cache.close(success); }
}
async function contactSheet(page, target, samples, width, height, parameters, fps) {
  const cellW = Math.min(640, width); const cellH = Math.round(cellW * height / width);
  const cols = Math.min(3, samples); const rows = Math.ceil(samples / cols);
  const shots = [];
  for (let i = 0; i < samples; i++) {
    const time = DEFAULT.duration * i / Math.max(1, samples - 1);
    shots.push({ time, png: (await renderPng(page, time, width, height, parameters, 1, fps)).toString('base64') });
  }
  if(page.engine==='skia'){await writeImage(await page.contactSheet({shots,cellW,cellH,cols,rows}),target);return;}
  const data = await page.evaluate(async ({ shots, cellW, cellH, cols, rows }) => {
    const c = document.createElement('canvas'); c.width = cols * cellW; c.height = rows * (cellH + 28);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < shots.length; i++) {
      const img = new Image(); img.src = `data:image/png;base64,${shots[i].png}`; await img.decode();
      const x = (i % cols) * cellW; const y = Math.floor(i / cols) * (cellH + 28);
      ctx.drawImage(img, x, y, cellW, cellH); ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(`${shots[i].time.toFixed(2)}s`, x + 8, y + cellH + 19);
    }
    return c.toDataURL('image/png');
  }, { shots, cellW, cellH, cols, rows });
  await writeImage(Buffer.from(data.split(',')[1], 'base64'), target);
}
async function probeVideo(target,countFrames=true) {
  if (!ffprobe?.path) throw new Error('ffprobe-static did not provide an executable');
  const stdout = await new Promise((resolve, reject) => {
    const child=spawn(ffprobe.path,['-v','error',...(countFrames?['-count_frames']:[]),'-select_streams','v:0','-show_entries','stream=codec_name,pix_fmt,width,height,r_frame_rate,duration,nb_frames,nb_read_frames:format=duration','-of','json',target]);let out='',err='';
    child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(new Error(err.trim())));
  });
  return JSON.parse(stdout);
}
async function checkEncoder(format){
 const encoder={mp4:'libx264',webm:'libvpx-vp9',prores:'prores_ks'}[format];
 const available=await new Promise((resolve,reject)=>{const child=spawn(ffmpegPath,['-hide_banner','-encoders']);let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(new Error(err)));});
 if(!available.split('\n').some(line=>line.trim().split(/\s+/)[1]===encoder))throw new Error(`Bundled ffmpeg does not include ${encoder}`);
}
async function readSnapshot(file,optional=false){
  try{const value=JSON.parse(await readFile(file,'utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Snapshot must be an object');if(value.parameters!==undefined&&(!value.parameters||typeof value.parameters!=='object'||Array.isArray(value.parameters)))throw new Error('Snapshot parameters must be an object');return value;}
  catch(error){if(optional&&error.code==='ENOENT')return {};throw error;}
}
async function main() {
  const { command, opts, parameters: explicitParameters } = parseArgs(process.argv.slice(2));
  if(command!=='viewer')for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{for(const child of subprocesses)child.kill(signal);process.exit(signal==='SIGINT'?130:143);});
  if (opts.help || command === 'help' || !command) return help();
  if (!['viewer', 'frame', 'contact', 'preview', 'export', 'verify'].includes(command)) throw new Error(`Unknown command: ${command}`);
  for (const key of ['resume','keep-frames']) if (opts[key] !== undefined && !['on','off'].includes(opts[key])) throw Error('--'+key+' must be on or off');
  if (opts['keep-frames'] === 'on' && opts.resume !== 'on') throw Error('--keep-frames on requires --resume on');
  const target = ['frame', 'contact', 'preview', 'export'].includes(command) ? outPath(opts.out) : opts.out ? outPath(opts.out) : undefined;
  // CLI arguments win over an explicit snapshot; an explicit snapshot wins over the video's sidecar.
  const sidecar=command==='verify'&&target?await readSnapshot(target+'.project.json',true):{};
  const requested=opts.snapshot?await readSnapshot(path.resolve(opts.snapshot)):{};
  const saved={...sidecar,...requested};
  const parameters={...sidecar.parameters,...requested.parameters,...explicitParameters};
  DEFAULT=sceneConfig(parameters.scene??saved.config?.scene??config.scene);parameters.scene=DEFAULT.scene;
  if(opts.sound!==undefined){if(!['on','off'].includes(opts.sound))throw Error('--sound must be on or off');parameters.sound=normalizeSound({...parameters.sound,enabled:opts.sound==='on'});}
  if(parameters.audio!==undefined)parameters.audio=normalizeAudioTracks(parameters.audio);
  if(parameters.sound!==undefined)parameters.sound=normalizeSound(parameters.sound);
  const number=(key,savedValue,fallback)=>{const n=Number(opts[key]??savedValue??fallback);if(!Number.isFinite(n))throw new Error(`--${key} must be finite`);return n;};
  // Legacy sidecars described design resolution instead of the encoded preview resolution.
  const metadata=command==='verify'&&target?await probeVideo(target):null;
  const legacy=Object.keys(sidecar).length>0&&sidecar.schemaVersion!==2;
  const width=number('width',saved.settings?.width??saved.width??(legacy?metadata?.streams?.[0]?.width:saved.config?.width),command==='preview'?960:DEFAULT.width);
  const height=number('height',saved.settings?.height??saved.height??(legacy?metadata?.streams?.[0]?.height:saved.config?.height),command==='preview'?540:DEFAULT.height);
  const start=number('start',saved.start,0),end=number('end',saved.end,DEFAULT.duration);
  const time=number('time',saved.time,0),temporalSamples=number('temporal-samples',saved.settings?.temporalSamples??saved.temporalSamples,['pulse','camera'].includes(parameters.scene)?4:1),samples=number('samples',saved.samples,6);
  const fps=number('fps',saved.settings?.fps??saved.fps??saved.config?.fps,DEFAULT.fps),format=opts.format??saved.settings?.format??saved.format??'mp4',bitrateMbps=format==='prores'?null:number('bitrate-mbps',saved.settings?.bitrateMbps??saved.bitrateMbps,16);
  if(![24,25,30,50,60].includes(fps))throw new Error('--fps must be 24, 25, 30, 50 or 60');
  if(!['mp4','webm','prores'].includes(format))throw new Error('--format must be mp4, webm or prores');
  if(format!=='prores'&&(bitrateMbps<2||bitrateMbps>200))throw new Error('--bitrate-mbps must be 2..200');
  if(![width,height].every(n=>Number.isInteger(n)&&n>0&&n<=3840)||width*height>8294400)throw new Error('--width and --height must be positive integers up to 3840 with at most 8294400 pixels');
  if(['preview','export'].includes(command)&&(width%2||height%2))throw new Error('Video width and height must be even for the selected codec');
  if(!Number.isInteger(temporalSamples)||temporalSamples<1||temporalSamples>64)throw new Error('--temporal-samples must be an integer from 1 to 64');
  if(!Number.isInteger(samples)||samples<2||samples>60)throw new Error('--samples must be an integer from 2 to 60');
  if (time < 0 || time > DEFAULT.duration) throw new Error(`--time must be between 0 and ${DEFAULT.duration} seconds`);
  if (start < 0 || end > DEFAULT.duration || end <= start) throw new Error(`--start and --end must satisfy 0 <= start < end <= ${DEFAULT.duration}`);
  for (const [name, value] of [['--start', start], ['--end', end]]) {
    if (Math.abs(value * fps - Math.round(value * fps)) > 1e-7) throw new Error(`${name} must align to a ${1 / fps}-second frame boundary`);
  }
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide an executable');
  if(command!=='viewer'){
    if(!parameters.look)parameters.look=JSON.parse(await readFile(path.join(ROOT,'project/look.json'),'utf8'));
    if(!parameters.motion)parameters.motion=JSON.parse(await readFile(path.join(ROOT,'project/motion.json'),'utf8'));
  }
  if(['preview','export'].includes(command))await checkEncoder(format);
  const saveSnapshot=async()=>{if(target&&command!=='verify'&&command!=='viewer')await writeFile(target+'.project.json',JSON.stringify({schemaVersion:2,production:{version:1,backend:native?'native':'browser-reference',renderer:native?'skia':'threejs'},command,config:{...DEFAULT,width,height,fps},parameters,width,height,fps,format,bitrateMbps,settings:{width,height,fps,format,bitrateMbps,temporalSamples},start,end,time,samples,temporalSamples,createdAt:new Date().toISOString()},null,2));};
  const requestedBackend=opts.backend??saved.production?.backend;
  const native=parameters.scene==='procedural'&&command!=='viewer'&&requestedBackend!=='browser-reference';
  if(opts.backend&&!['native','browser-reference'].includes(opts.backend))throw Error('Unknown --backend');
  if(opts.backend==='native'&&!native)throw Error('No native 2D adapter for this scene');
  let server,browser,url,page;
  try {
    if(native){page=(await import('./native/renderer.mjs')).createNativeRenderer(parameters);}
    else {({server,url}=await startVite(command==='viewer'?4173:0));const {chromium}=await import('playwright');
    browser = await chromium.launch({ ...await browserLaunchOptions(), headless: command !== 'viewer', args: ['--disable-gpu-sandbox'] });
    page = await openMotion(browser, command==='viewer'?url+'?scene='+(parameters.scene||'objects')+(opts.sound?'&sound='+opts.sound:''):url+'?render=1&scene='+parameters.scene, width, height);}
    output('ready', { command, url, width, height, start, end, temporalSamples, engine:native?'skia':'threejs',device:native?'CPU':undefined,config:native?page.config:await page.evaluate(() => window.motion.config ?? null) });
    if (command === 'viewer') {
      await new Promise(resolve => { browser.on('disconnected', resolve); process.on('SIGINT', resolve); process.on('SIGTERM', resolve); });
    } else if (command === 'frame') {
      const png = await renderPng(page, time, width, height, parameters, temporalSamples, fps, true);
      await writeImage(png, target);
      await writeProgressJpeg(page, png, `${target}.progress.jpg`);
      output('progress', { phase: 'rendering', frames: 1, total: 1, previewFrame: 1, sample: temporalSamples, totalSamples: temporalSamples, percent: 98 });
      output('complete', { path: target, time, width, height, temporalSamples });
    } else if (command === 'contact') {
      await contactSheet(page, target, samples, width, height, parameters, fps); output('complete', { path: target, samples, width, height });
    } else if (command === 'preview' || command === 'export') {
      const frames = Math.round((end - start) * fps);
      const w = width;
      const h = height;
      await exportVideo(page, target, w, h, parameters, start, end, temporalSamples, fps, format, bitrateMbps,{resume:opts.resume==='on',keepFrames:opts['keep-frames']==='on'}); output('complete', { path: target, width: w, height: h, fps, format, bitrateMbps, duration: end - start, frames, start, end, temporalSamples });
    } else if (command === 'verify') {
      const interveningTimes = [DEFAULT.duration*.85, DEFAULT.duration*.05, DEFAULT.duration*.55].filter(t => t <= DEFAULT.duration && t !== time);
      for (const seekTime of interveningTimes) await renderPng(page, seekTime, width, height, parameters, temporalSamples, fps);
      const first = await renderPng(page, time, width, height, parameters, temporalSamples, fps);
      const a = createHash('sha256').update(first).digest('hex');
      const result = { deterministic: false, time, width, height, start, end, temporalSamples, sha256: a, interveningTimes };
      const afterMoreSeeks = [3.1, 8.2, 1.7].filter(t => t <= DEFAULT.duration && t !== time);
      for (const seekTime of afterMoreSeeks) await renderPng(page, seekTime, width, height, parameters, temporalSamples, fps);
      const second = await renderPng(page, time, width, height, parameters, temporalSamples, fps);
      const b = createHash('sha256').update(second).digest('hex');
      result.deterministic = a === b;
      result.sha256AfterSeek = b;
      let valid = result.deterministic;
      if (target) {
        const meta = metadata;
        const video = meta.streams?.[0] ?? null;
        const actualFps = (() => { const [n,d=1] = (video?.r_frame_rate ?? '0/1').split('/').map(Number); return n/d; })();
        const duration = Number(video?.duration ?? meta.format?.duration);
        const frames = Number(video?.nb_frames??video?.nb_read_frames);
      const expected = { width, height, fps, format, bitrateMbps, duration: end - start, frames: Math.round((end - start) * fps), start, end };
        const checks = {
          width: Number(video?.width) === expected.width,
          height: Number(video?.height) === expected.height,
          fps: Math.abs(actualFps - expected.fps) < 0.01,
          duration: Math.abs(duration - expected.duration) <= 1 / expected.fps + 0.001,
          frames: frames === expected.frames,
          codec: video?.codec_name===({mp4:'h264',webm:'vp9',prores:'prores'}[format])
        };
        valid = valid && Object.values(checks).every(Boolean);
        result.video = video;
        result.videoPath = target;
        result.expected = expected;
        result.metadataChecks = checks;
      }
      result.valid = valid;
      output('verification', result);
      if (!valid) process.exitCode = 2;
    }
    await saveSnapshot();
  } finally { await browser?.close().catch(() => {}); if(native)await page?.close(); await server?.close(); }
}
main().catch(e => fail(e.message));
