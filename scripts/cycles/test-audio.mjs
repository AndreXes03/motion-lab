import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sampleRuntimeSound,renderProceduralAudio} from './audio.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=await mkdtemp('/private/tmp/motion-cycles-sound-');let browser;
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});server.middlewares.use('/__sound-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Sound test</title>');});
try{
 await server.listen();browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__sound-test`);
 const parameters={scene:'pulse',sound:{enabled:true,music:.4,master:.8}};const telemetry=await sampleRuntimeSound(page,parameters);assert.equal(telemetry.duration,13.9);assert.ok(telemetry.frames.length>800);
 const telemetryPath=path.join(out,'telemetry.json');await writeFile(telemetryPath,JSON.stringify(telemetry));const result=await renderProceduralAudio({frozenRoot:root,telemetryPath,destination:path.join(out,'sound.wav'),parameters});const wav=await readFile(result.path);assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(result.channels,2);assert.equal(result.sampleRate,48000);assert.equal(result.duration,13.9);let audible=0;for(let i=44;i<wav.length;i+=2)if(Math.abs(wav.readInt16LE(i))>100)audible++;assert.ok(audible>1000);console.log(JSON.stringify({test:'cycles-procedural-audio',passed:true,duration:result.duration,sampleRate:result.sampleRate,channels:result.channels,audibleSamples:audible,telemetry:'runtime.sampleMotion'}));
}finally{await browser?.close();await server.close();await rm(out,{recursive:true,force:true});}
