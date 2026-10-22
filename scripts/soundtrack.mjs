import {browserLaunchOptions} from './browser-runtime.mjs';
import {createServer} from 'vite';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {planSound,renderSound,encodeWav,soundDefaults} from '../src/engine/sound-design.js';
import {sceneConfig,sceneRegistry} from '../src/scene-registry.js';
import {normalizeAudioTracks} from '../src/engine/audio-track.js';
import {renderTimelineAudio,validateTimelineAudioAssets} from './native/audio.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((out,v,i,a)=>i%2===0?[...out,[v.replace(/^--/,''),a[i+1]]]:out,[]));
if(!args.video||!args.recipe||!args.out)throw Error('Use --video source.mp4 --recipe source.mp4.project.json --out output.mp4');
const recipe=JSON.parse(await readFile(args.recipe,'utf8')),out=path.resolve(args.out),base=out.replace(/\.[^.]+$/,'');
const settings=args.settings?JSON.parse(await readFile(args.settings,'utf8')):(recipe.parameters?.sound??soundDefaults);
const parameters={...recipe.parameters,sound:settings,audio:normalizeAudioTracks(recipe.parameters?.audio)};
const importedAudio=parameters.audio;
const children=new Set();
for(const [signal,code]of [['SIGINT',130],['SIGTERM',143]])process.once(signal,()=>{for(const child of children)child.kill(signal);process.exit(code);});
function run(program,argv){return new Promise((resolve,reject)=>{const child=spawn(program,argv,{stdio:['ignore','pipe','pipe']});children.add(child);let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});child.on('error',reject);child.on('close',code=>{children.delete(child);code===0?resolve():reject(Error(stderr||`Process stopped (${code})`));});});}
let server,browser,telemetry,telemetrySource;
try{
 if(parameters.scene==='procedural'){const {createProductionScene}=await import('../src/engine/production-scene.js');telemetry=createProductionScene(parameters).sampleMotion();telemetrySource='native-procedural';}
 else if(['pulse','loop'].includes(parameters.scene)){
  // Match the native Cycles path's authored-cut telemetry; no browser or inferred object gestures.
  const duration=sceneConfig(parameters.scene).duration,rate=60;
  const frames=Array.from({length:Math.ceil(duration*rate)+1},(_,i)=>({time:Math.min(duration,i/rate),camera:{position:[0,0,0],quaternion:[0,0,0,1]},objects:{}}));
  telemetry={duration,rate,frames,cuts:sceneRegistry[parameters.scene].cuts};telemetrySource='native-cycles-cuts';
 }
 else {server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();const {chromium}=await import('playwright');
 browser=await chromium.launch({headless:true,...await browserLaunchOptions(),args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?render=1`);await page.waitForFunction(()=>window.motion?.sampleMotion);await page.evaluate(()=>window.motion.ready);
 telemetry=await page.evaluate(p=>window.motion.sampleMotion(p),parameters);telemetrySource='browser-runtime';}
 const plan=planSound(telemetry,settings),result=renderSound(plan,{stems:true});
 const start=recipe.start??0,end=recipe.end??telemetry.duration;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>telemetry.duration)throw Error('Recipe start/end must define a valid interval within the scene.');
 await validateTimelineAudioAssets(root,importedAudio);
 const trim=channels=>channels.map(c=>c.slice(Math.round(start*result.sampleRate),Math.round(end*result.sampleRate)));await mkdir(path.dirname(out),{recursive:true});
 const synthesizedPath=base+'.synth.wav',mixedPath=base+'.wav';
 await writeFile(synthesizedPath,encodeWav(trim(result.channels),result.sampleRate));
 for(const [name,channels]of Object.entries(result.stems))await writeFile(base+'.'+name+'.wav',encodeWav(trim(channels),result.sampleRate));
 const mixed=await renderTimelineAudio({root,audio:importedAudio,sound:settings,start,duration:end-start,destination:mixedPath,baseAudio:synthesizedPath,baseOffset:0,run});
 if(mixed!==mixedPath)await copyFile(synthesizedPath,mixedPath);
 await writeFile(base+'.sound.json',JSON.stringify({settings,stats:result.stats,bpm:plan.bpm,phase:plan.phase,events:plan.events,start,end,telemetrySource,importedTracks:importedAudio.tracks,stems:Object.keys(result.stems),mix:mixedPath,syntheticStem:synthesizedPath,videoSource:path.basename(args.video),recipeSource:path.basename(args.recipe)},null,2));
 await writeFile(base+'.telemetry.json',JSON.stringify(telemetry));
 await writeFile(out+'.project.json',JSON.stringify({...recipe,parameters},null,2));
 await run(ffmpeg,['-hide_banner','-loglevel','error','-n','-i',path.resolve(args.video),'-i',mixedPath,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart','-t',String(end-start),out]);
 console.log(JSON.stringify({output:out,...result.stats,importedTracks:importedAudio.tracks.length,modules:Object.fromEntries(['camera','objects','accents'].map(m=>[m,plan.events.filter(e=>e.module===m).length]))},null,2));
}finally{await browser?.close();await server?.close();}
