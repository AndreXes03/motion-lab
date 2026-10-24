#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizeAudioTracks} from '../src/engine/audio-track.js';
import {normalizeNarration,importSpeechTiming,speechMarkers,narrationCue} from '../src/engine/narration.js';
import {importAudioAsset,resolveAudioAsset} from './audio-assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args={};for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i];if(!['--recipe','--audio','--track','--timing','--script','--cues','--out'].includes(key)||!process.argv[i+1])throw Error('Use --recipe FILE [--audio VO.wav] [--track ID] [--timing words.json|captions.srt] [--script text.txt] [--cues plan.json] [--out NEW.recipe.json]');args[key.slice(2)]=process.argv[i+1];}
if(!args.recipe)throw Error('--recipe is required');
if((args.audio||args.timing||args.script||args.cues)&&!args.out)throw Error('Use --out to save the revised recipe separately');
const recipe=JSON.parse(await readFile(args.recipe,'utf8'));if(recipe.schemaVersion!==2||!recipe.parameters)throw Error('Choose a Framevolve recipe');
const previous=normalizeAudioTracks(recipe.parameters.audio),audio={...previous,version:2,ducking:previous.ducking??true};
const voices=audio.tracks.filter(t=>t.role==='voiceover');let track=args.track?voices.find(t=>t.id===args.track):voices.length===1?voices[0]:undefined;
if(args.track&&!track)throw Error('Voiceover track not found');
if(args.audio){const asset=await importAudioAsset(root,createReadStream(path.resolve(args.audio)),{name:path.basename(args.audio)});if(track){Object.assign(track,{assetId:asset.assetId,name:asset.name,sourceStart:0,duration:asset.duration});delete track.narration;}else{track={id:randomUUID(),assetId:asset.assetId,name:asset.name,role:'voiceover',enabled:true,sourceStart:0,timelineStart:0,duration:asset.duration,volume:1,fadeIn:0,fadeOut:0};audio.tracks.push(track);}}
if(!track)throw Error('Select --track when there are several voices, or add --audio');
if(args.script){track.narration=normalizeNarration({version:1,source:'manual',text:await readFile(args.script,'utf8'),segments:[],cues:[]});}
if(args.timing)track.narration=importSpeechTiming(await readFile(args.timing,'utf8'));
if(args.cues){if(!track.narration?.segments.length)throw Error('Import measured speech timing before binding cues');track.narration=normalizeNarration({...track.narration,cues:JSON.parse(await readFile(args.cues,'utf8'))});}
const normalized=normalizeAudioTracks(audio),asset=await resolveAudioAsset(root,track.assetId);
if(track.narration?.segments.some(s=>s.end>asset.metadata.duration+.025))throw Error('Speech timing exceeds the voice source');
recipe.parameters.audio=normalized;
const cueTimes=(track.narration?.cues??[]).map(c=>narrationCue(normalized,c.id,{trackId:track.id,fps:recipe.exportSettings?.fps??recipe.config?.fps??30}));
if(args.out)await writeFile(path.resolve(args.out),JSON.stringify(recipe,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:args.out?path.resolve(args.out):null,trackId:track.id,voiceEnd:track.timelineStart+track.duration,script:track.narration?.text??'',markers:speechMarkers(track),cues:cueTimes,instruction:'Author scenes around the spoken concepts. Use narrationCue/evaluateNarrationCue from src/engine/narration.js for shots, supers and their actions; keep the project duration at least voiceEnd. No scene has been automatically rewritten.'},null,2));
