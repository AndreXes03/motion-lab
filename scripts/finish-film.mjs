#!/usr/bin/env node
import{spawnSync}from'node:child_process';import ffmpeg from'ffmpeg-static';import path from'node:path';
const args=process.argv.slice(2),opts={};for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Use --video input.mp4 --audio approved.mp4 --out final.mp4');opts[args[i].slice(2)]=args[i+1];}
for(const k of ['video','audio','out'])if(!opts[k])throw Error('Missing --'+k);
if([opts.video,opts.audio].some(p=>path.resolve(p)===path.resolve(opts.out)))throw Error('Output must differ from the inputs');
const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-n','-i',opts.video,'-i',opts.audio,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',opts.out],{stdio:'inherit'});process.exit(r.status??1);
