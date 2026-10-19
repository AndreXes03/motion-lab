import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import {createLaunchDemo} from '../src/scenes/launch-demo.js';
import {createCommercialBrief} from '../src/engine/commercial-brief.js';

// Optional native-Canvas scene QA. It does not validate the browser runtime,
// Studio UI, browser fonts, MediaRecorder, or the actual CLI export pipeline.
// Use an already installed Canvas implementation; this script installs nothing.
const require=createRequire(import.meta.url);
const {createCanvas,Image,GlobalFonts}=require(process.env.NATIVE_CANVAS_MODULE || '@napi-rs/canvas');
for(const font of [process.env.NATIVE_SANS_FONT,process.env.NATIVE_SANS_BOLD_FONT].filter(Boolean))assert.ok(GlobalFonts.registerFromPath(font,'Arial'),`Register native QA font: ${font}`);
globalThis.Image=Image;
const out=path.resolve('renders/launch-native-qa');await mkdir(out,{recursive:true});
const scene=createLaunchDemo(),parameters={scene:'launch',commercial:createCommercialBrief()};
const canvas=createCanvas(960,540),ctx=canvas.getContext('2d');
const render=(time,p=parameters)=>{scene.render(ctx,time,p,960,540);return createHash('sha256').update(ctx.getImageData(0,0,960,540).data).digest('hex');};
const times=[1.6,3.7,4,4.2,6.5,9,9.25,11.5,14,14.25,16.5,19,19.2,22,23.9666666667];
const board=createCanvas(1920,Math.ceil(times.length/2)*570),boardCtx=board.getContext('2d');
const checks=[];await scene.prepare(parameters);
for(let index=0;index<times.length;index++){
 const time=times[index],hash=render(time);render(23.8);render(.2);assert.equal(render(time),hash,`Deterministic seek at ${time}`);
 const file=path.join(out,`frame-${String(time).replace('.','_')}.png`);await writeFile(file,canvas.toBuffer('image/png'));
 const x=index%2*960,y=Math.floor(index/2)*570;boardCtx.drawImage(canvas,x,y);boardCtx.fillStyle='#ffffff';boardCtx.font='18px sans-serif';boardCtx.fillText(`${time.toFixed(3)} s`,x+16,y+562);checks.push({time,hash});
}
await writeFile(path.join(out,'contact.png'),board.toBuffer('image/png'));
const portrait=createCanvas(540,960);scene.render(portrait.getContext('2d'),6.5,parameters,540,960);await writeFile(path.join(out,'portrait.png'),portrait.toBuffer('image/png'));
const controls={typeScale:1.2,screenshotScale:1.3,screenshotPanX:.5,screenshotPanY:.5,revealSpeed:.5,motionStrength:0,framingZoom:.8,framingX:.5,framingY:.5,cameraMotion:0,backgroundGlow:0,cardShadow:0,detailOpacity:0};
for(const [id,value]of Object.entries(controls)){
 const time=['revealSpeed','motionStrength'].includes(id)?4.5:6.5,baseline=render(time);
 assert.notEqual(render(time,{...parameters,sceneControls:{[id]:value}}),baseline,`${id} changes pixels`);
}
const assetCanvas=createCanvas(640,360),assetCtx=assetCanvas.getContext('2d');assetCtx.fillStyle='#a617eb';assetCtx.fillRect(0,0,640,360);assetCtx.fillStyle='white';assetCtx.font='bold 52px sans-serif';assetCtx.fillText('YOUR PRODUCT',30,180);
const asset={name:'custom-product.png',src:assetCanvas.toDataURL('image/png')};
const custom={scene:'launch',commercial:createCommercialBrief({brand:{name:'Custom Product'},assets:{logo:asset,screenshots:[asset]}})};
assert.throws(()=>render(6.5,custom),/not prepared/);
await scene.prepare(custom);const customHash=render(6.5,custom);assert.notEqual(customHash,render(6.5));render(6.5,custom);await writeFile(path.join(out,'custom-asset.png'),canvas.toBuffer('image/png'));
const replay=createLaunchDemo(),replayCanvas=createCanvas(960,540);await replay.prepare(JSON.parse(JSON.stringify(custom)));replay.render(replayCanvas.getContext('2d'),6.5,JSON.parse(JSON.stringify(custom)),960,540);
assert.equal(createHash('sha256').update(replayCanvas.getContext('2d').getImageData(0,0,960,540).data).digest('hex'),customHash,'Portable embedded asset recipe reconstructs identical pixels');replay.dispose();
// Malformed-image rejection is covered by test-asset-readiness.mjs in a browser;
// the optional native image decoder is not used for hostile/corrupt inputs.
await scene.prepare(parameters);
const file=path.join(out,'launch-native-preview.mp4');
const encoder=spawn(ffmpeg,['-y','-v','error','-f','rawvideo','-pix_fmt','rgba','-video_size','960x540','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','ignore','pipe']});
let errors='';encoder.stderr.on('data',chunk=>errors+=chunk);const finished=once(encoder,'close');
for(let frame=0;frame<720;frame++){render(frame/30);if(!encoder.stdin.write(Buffer.from(ctx.getImageData(0,0,960,540).data)))await once(encoder.stdin,'drain');}
encoder.stdin.end();const [status]=await finished;assert.equal(status,0,errors);
const probe=JSON.parse(execFileSync(ffprobe.path,['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
const video=probe.streams.find(stream=>stream.codec_type==='video');assert.equal(video.width,960);assert.equal(video.height,540);assert.equal(Number(video.nb_read_frames),720);assert.equal(video.avg_frame_rate,'30/1');assert.equal(Number(probe.format.duration),24);
execFileSync(ffmpeg,['-v','error','-i',file,'-f','null','-']);
const report={passed:true,renderer:'native Canvas2D direct scene harness',browserVerified:false,fontSubstitution:process.env.NATIVE_SANS_FONT??'Native font defaults',duration:24,frames:720,width:960,height:540,fps:30,controls:Object.keys(controls),seekChecks:checks,embeddedAssetRoundTrip:true,corruptAssetRejection:'Pending real-browser test',portrait:'Letterboxed landscape composition; no adaptive vertical layout.',audio:false};
await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await writeFile(path.join(out,'recipe.project.json'),JSON.stringify({parameters},null,2));scene.dispose();console.log(JSON.stringify({passed:true,out,...report}));
