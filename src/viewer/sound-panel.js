import './sound-panel.css';
import {soundDefaults,soundKits,normalizeSound,planSound,renderSound,encodeWav} from '../engine/sound-design.js';
import {normalizeMusicTrack,mixMusicPcm} from '../engine/music-track.js';
import {analyzeMusicPcm,proposeMusicExcerpt,proposeBeatAlignedEdits} from '../engine/music-analysis.js';
import {hashMusicBlob,saveMusicAsset,loadMusicAsset} from './music-asset-store.js';
import {createMusicDecodeCache} from './music-decode-cache.js';
const timbres={air:'Air',silk:'Silk',deep:'Deep',grain:'Grainy',swirl:'Swirl',reverse:'Reverse',bright:'Bright',riser:'Riser',mechanical:'Mechanical',metal:'Metal',plastic:'Plastic',glass:'Glass',rubber:'Rubber',wood:'Wood',electric:'Electric',ceramic:'Ceramic',soft:'Soft',click:'Click',knock:'Knock',snap:'Snap',ping:'Ping',sub:'Sub',chime:'Chime',pop:'Pop'};
const labels={camera:'Camera movement',objects:'Object movement',accents:'Accents',music:'Music volume',master:'Master volume',density:'Effect frequency',dial:'Dial clicks',hinge:'Hinge movement',gyro:'Gyroscope movement'};
export function mountSoundPanel({runtime,parameters,onChange,onPause,getTime,getDuration=()=>runtime.config.duration,getEditorial=()=>null,onEditProposal=()=>{}}){
 const panel=document.createElement('details');panel.className='finish-tools sound-panel';panel.id='sound-tools';panel.open=true;
 panel.innerHTML='<summary>Sound design</summary><div class="sound-heading"><h3>Sound design</h3><label class="finish-checkbox sound-enable"><input id="sound-enabled" type="checkbox" checked> Enable audio</label></div>';
 let settings={...soundDefaults},musicTrack=null,analysis=null,assetStatus='empty',loadVersion=0;
 let context,source,buffer,cacheKey='',generation=0,startTime=0,offset=0,building=null;
 const fields={};
 function section(title,{advanced=false}={}){
  const group=document.createElement(advanced?'details':'section');group.className=advanced?'sound-section sound-disclosure':'sound-section';
  const heading=document.createElement(advanced?'summary':'h4');heading.textContent=title;group.append(heading);panel.append(group);return group;
 }
 const mix=section('Mix');
 const sfx=section('Motion effects');
 const music=section('Music settings',{advanced:true});
 const imported=section('Your music');
 const mechanics=section('Mechanical detail',{advanced:true});
 function edit(){stop();cacheKey='';settings=normalizeSound(settings);onPause();onChange();status.textContent='Audio updated · press Play';}
 for(const key of ['master','music','camera','objects','accents','density','dial','hinge','gyro']){
  const label=labels[key];
  const row=document.createElement('div');row.className='finish-control sound-control';
  const head=document.createElement('div');head.className='sound-control-head';
  const title=document.createElement('label');title.textContent=label;title.htmlFor='sound-'+key;
  const value=document.createElement('span');value.className='sound-value';
  const out=document.createElement('input');out.type='number';out.min=0;out.max=100;out.step=1;out.id='sound-'+key+'-value';out.setAttribute('aria-label',label+' percent');
  const unit=document.createElement('span');unit.textContent='%';unit.setAttribute('aria-hidden','true');value.append(out,unit);head.append(title,value);
  const input=document.createElement('input');input.id='sound-'+key;input.type='range';input.min=0;input.max=1;input.step=.01;row.append(head,input);
  (['master','music'].includes(key)?mix:['dial','hinge','gyro'].includes(key)?mechanics:sfx).append(row);
  fields[key]={input,out,row};input.onchange=()=>{settings[key]=Number(input.value);edit();};input.oninput=()=>{out.value=Math.round(Number(input.value)*100);out.setCustomValidity('');};
  function applyNumber(report=false){const value=out.valueAsNumber;if(!Number.isInteger(value)||value<0||value>100){out.setCustomValidity('Enter a whole number from 0 to 100.');if(report)out.reportValidity();return;}out.setCustomValidity('');input.value=value/100;if(settings[key]!==value/100){settings[key]=value/100;edit();}}
  out.oninput=()=>applyNumber();out.onchange=()=>applyNumber(true);

 }
 for(const [module,kits] of Object.entries(soundKits)){
  const key=module==='objects'?'objectKit':module==='accents'?'accentKit':'cameraKit';const row=document.createElement('label');row.className='sound-timbre';row.textContent='Sound';const select=document.createElement('select');select.id='sound-'+key;select.setAttribute('aria-label',labels[module]+' sound');for(const kit of kits)select.add(new Option(timbres[kit],kit));row.append(select);fields[module].row.append(row);fields[key]={input:select};select.onchange=()=>{settings[key]=select.value;edit();};
 }
 function choice(parent,label,id){const row=document.createElement('label');row.className='sound-field';const text=document.createElement('span');text.textContent=label;const input=document.createElement('select');input.id=id;row.append(text,input);parent.append(row);return input;}
 const musicStyle=choice(music,'Music style','sound-musicStyle');for(const [v,label] of [['scene','Scene default'],['techno','Techno'],['ambient','Soft electronic']])musicStyle.add(new Option(label,v));fields.musicStyle={input:musicStyle};musicStyle.onchange=()=>{settings.musicStyle=musicStyle.value;edit();};
 const tempo=choice(music,'Tempo','sound-tempo');tempo.add(new Option('Automatic','auto'));tempo.add(new Option('Manual','manual'));fields.tempo={input:tempo};tempo.onchange=()=>{settings.tempo=tempo.value;sync();edit();};
 const bpmLabel=document.createElement('label');bpmLabel.className='sound-field sound-bpm';bpmLabel.textContent='Beats per minute';const bpm=document.createElement('input');bpm.id='sound-bpm';bpm.type='number';bpm.min=60;bpm.max=180;bpmLabel.append(bpm);music.append(bpmLabel);fields.bpm={input:bpm};bpm.onchange=()=>{settings.bpm=Math.max(60,Math.min(180,Number(bpm.value)||112));sync();edit();};
 const musicFile=document.createElement('input');musicFile.type='file';musicFile.accept='audio/*,.mp3,.m4a,.wav,.ogg,.flac';musicFile.id='sound-import-file';musicFile.hidden=true;
 const relinkFile=document.createElement('input');relinkFile.type='file';relinkFile.accept=musicFile.accept;relinkFile.id='sound-relink-file';relinkFile.hidden=true;
 const fileActions=document.createElement('div');fileActions.className='sound-music-actions';
 const importButton=document.createElement('button');importButton.type='button';importButton.textContent='Import song';importButton.onclick=()=>musicFile.click();
 const relinkButton=document.createElement('button');relinkButton.type='button';relinkButton.textContent='Relink file';relinkButton.onclick=()=>relinkFile.click();
 const clearButton=document.createElement('button');clearButton.type='button';clearButton.textContent='Remove song';clearButton.onclick=()=>{loadVersion++;musicTrack=analysis=null;musicDecodeCache.clear();assetStatus='empty';commitMusic('Imported song removed');};
 fileActions.append(importButton,relinkButton,clearButton,musicFile,relinkFile);imported.append(fileActions);
 const musicName=document.createElement('p');musicName.className='sound-music-name';imported.append(musicName);
 const waveform=document.createElement('canvas');waveform.className='sound-waveform';waveform.width=600;waveform.height=76;waveform.setAttribute('aria-label','Imported song waveform');waveform.setAttribute('role','img');imported.append(waveform);
 const musicFields={};
 for(const [key,label,step] of [['trimStart','Start in song (seconds)',.01],['trimDuration','Use duration (seconds)',.01],['gain','Song gain',.01],['fadeIn','Fade in (seconds)',.01],['fadeOut','Fade out (seconds)',.01]]){
  const row=document.createElement('label');row.className='sound-field';row.textContent=label;
  const input=document.createElement('input');input.type='number';input.id='sound-music-'+key;input.min=0;input.step=step;row.append(input);imported.append(row);musicFields[key]=input;
  input.onchange=()=>{
   if(!musicTrack)return;
   const value=input.valueAsNumber;
   try{musicTrack=normalizeMusicTrack({...musicTrack,[key]:value});commitMusic('Song edit updated');}
   catch(error){status.textContent=error.message;syncMusic();}
  };
 }
 const suggestionActions=document.createElement('div');suggestionActions.className='sound-music-actions';
 const suggestExcerpt=document.createElement('button');suggestExcerpt.type='button';suggestExcerpt.textContent='Suggest excerpt';
 const applyExcerpt=document.createElement('button');applyExcerpt.type='button';applyExcerpt.textContent='Use suggested excerpt';
 const suggestSync=document.createElement('button');suggestSync.type='button';suggestSync.textContent='Suggest beat sync';
 const applySync=document.createElement('button');applySync.type='button';applySync.textContent='Apply beat sync';
 suggestionActions.append(suggestExcerpt,applyExcerpt,suggestSync,applySync);imported.append(suggestionActions);
 const suggestionNote=document.createElement('p');suggestionNote.className='sound-music-note';imported.append(suggestionNote);
 let excerptProposal=null,editProposal=null;
 function drawWaveform(){
  const ctx=waveform.getContext('2d'),w=waveform.width,h=waveform.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#171d20';ctx.fillRect(0,0,w,h);
  if(!analysis?.waveform?.length)return;
  const bins=analysis.waveform;ctx.fillStyle='#78cbb0';
  for(let x=0;x<w;x++){const peak=bins[Math.min(bins.length-1,Math.floor(x*bins.length/w))]??0,height=Math.max(1,peak*(h-10));ctx.fillRect(x,(h-height)/2,1,height);}
  if(musicTrack){const left=Math.max(0,Math.min(w,w*musicTrack.trimStart/musicTrack.duration)),right=Math.max(left,Math.min(w,w*(musicTrack.trimStart+musicTrack.trimDuration)/musicTrack.duration));ctx.fillStyle='rgba(9,12,16,.64)';ctx.fillRect(0,0,left,h);ctx.fillRect(right,0,w-right,h);}
 }
 function syncMusic(){
  musicName.textContent=musicTrack?`${musicTrack.name} · ${musicTrack.duration.toFixed(1)} s${assetStatus==='missing'?' · file missing: relink the original song':''}${assetStatus==='loading'?' · loading…':''}`:'No song imported · the scene soundtrack remains available.';
  relinkButton.hidden=clearButton.hidden=!musicTrack;
  for(const [key,input] of Object.entries(musicFields)){input.disabled=!musicTrack;input.value=musicTrack?.[key]??'';input.max=key==='gain'?2:key==='trimStart'?musicTrack?.duration??0:key==='trimDuration'?musicTrack?.duration-musicTrack?.trimStart||0:musicTrack?.trimDuration??0;}
  suggestExcerpt.disabled=suggestSync.disabled=!analysis||assetStatus!=='ready';
  applyExcerpt.disabled=!excerptProposal;applySync.disabled=!editProposal||!editProposal.snappedCuts;
  suggestionNote.textContent=analysis?`Analysis: ${analysis.status}${analysis.bpm?` · about ${Math.round(analysis.bpm)} BPM`:''}. Suggestions are editable estimates.`:'';
  drawWaveform();
 }
 function commitMusic(message){stop();cacheKey='';excerptProposal=editProposal=null;onPause();onChange();syncMusic();status.textContent=message;}
 async function ensureContext(){if(!context)context=new AudioContext({sampleRate:48000});return context;}
 async function decodeMusic(blob){const audioContext=await ensureContext();const decoded=await audioContext.decodeAudioData(await blob.arrayBuffer());if(!decoded?.length||!decoded.duration)throw Error('This browser could not decode the selected audio file');return decoded;}
 function analyzeDecoded(decoded){return analyzeMusicPcm({channels:Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),sampleRate:decoded.sampleRate});}
 async function loadOriginalMusic(assetId){
  try{const local=await loadMusicAsset(assetId);if(local)return local;}catch{/* Studio may still have the original. */}
  // A saved Studio version can be reopened in another browser on the same
  // computer. Verify the original bytes before caching the server copy.
  try{
   const response=await fetch('/api/studio/music-assets/'+assetId);
   if(!response.ok||Number(response.headers.get('content-length'))>50*1024*1024)return null;
   const blob=await response.blob();if(await hashMusicBlob(blob)!==assetId)return null;
   try{await saveMusicAsset(blob);}catch{/* Playback can use the verified Studio copy. */}return blob;
  }catch{return null;}
 }
 const musicDecodeCache=createMusicDecodeCache(async assetId=>{
  const blob=await loadOriginalMusic(assetId);
  if(!blob)throw Error(`Imported song is missing. Relink the original file in Sound design.`);
  return decodeMusic(blob);
 });
 async function refreshMusicAsset(){
  const version=++loadVersion,track=musicTrack;musicDecodeCache.clear();analysis=null;assetStatus=track?'loading':'empty';syncMusic();if(!track)return;
  try{
   const decoded=await musicDecodeCache.get(track.assetId);if(version!==loadVersion)return;
   analysis=analyzeDecoded(decoded);assetStatus='ready';syncMusic();
  }catch(error){if(version===loadVersion){assetStatus='missing';status.textContent='Song unavailable: '+error.message;syncMusic();}}
 }
 async function importMusic(file,relink=false){
  if(!file)return;
  const version=++loadVersion;
  try{
   status.textContent='Reading song…';const assetId=await hashMusicBlob(file);
   if(relink&&assetId!==musicTrack?.assetId)throw Error('Relink requires the original song file; its fingerprint does not match. Use Import song to replace it.');
   const decoded=await decodeMusic(file);if(decoded.duration>600)throw Error('Choose a song shorter than 10 minutes');
   const mimeType=file.type||({mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',flac:'audio/flac'}[file.name.split('.').at(-1)?.toLowerCase()]??'audio/octet-stream');
   const candidate=relink?musicTrack:normalizeMusicTrack({assetId,name:file.name.split(/[\\/]/).at(-1).slice(0,160),mimeType,bytes:file.size,duration:decoded.duration,trimStart:0,trimDuration:Math.min(decoded.duration,getDuration()),gain:1,fadeIn:0,fadeOut:Math.min(.25,decoded.duration)});
   await saveMusicAsset(file);if(version!==loadVersion)return;
   musicTrack=candidate;musicDecodeCache.prime(assetId,decoded);analysis=analyzeDecoded(decoded);assetStatus='ready';commitMusic(relink?'Original song relinked':'Song imported · trim and fades are editable');
  }catch(error){if(version===loadVersion){status.textContent='Song import: '+error.message;syncMusic();}}
 }
 musicFile.onchange=()=>{const file=musicFile.files?.[0];musicFile.value='';importMusic(file);};
 relinkFile.onchange=()=>{const file=relinkFile.files?.[0];relinkFile.value='';importMusic(file,true);};
 suggestExcerpt.onclick=()=>{try{excerptProposal=proposeMusicExcerpt(analysis,getDuration());editProposal=null;syncMusic();status.textContent=`Suggested song window ${excerptProposal.start.toFixed(2)}–${excerptProposal.end.toFixed(2)} s. Review, then choose Use suggested excerpt.`;}catch(error){status.textContent=error.message;}};
 applyExcerpt.onclick=()=>{if(!excerptProposal||!musicTrack)return;try{musicTrack=normalizeMusicTrack({...musicTrack,trimStart:excerptProposal.start,trimDuration:excerptProposal.duration,fadeIn:Math.min(musicTrack.fadeIn,excerptProposal.duration),fadeOut:Math.min(musicTrack.fadeOut,excerptProposal.duration)});commitMusic('Suggested excerpt applied · trim remains editable');}catch(error){status.textContent=error.message;}};
 suggestSync.onclick=()=>{try{const editorial=getEditorial();if(!editorial)throw Error('Add video edits before suggesting beat sync');editProposal=proposeBeatAlignedEdits(analysis,editorial,{musicStart:musicTrack?.trimStart??0});syncMusic();status.textContent=editProposal.snappedCuts?`${editProposal.snappedCuts} of ${editProposal.totalCuts} cuts can move toward detected beats. Review, then choose Apply beat sync.`:editProposal.reason;}catch(error){status.textContent=error.message;}};
 applySync.onclick=()=>{if(!editProposal)return;try{onEditProposal(editProposal.edit);editProposal=null;syncMusic();status.textContent='Beat sync applied · video edits remain editable and undoable';}catch(error){status.textContent=error.message;}};
 const status=document.createElement('p');status.id='sound-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Ready · press Play to listen';panel.append(status);
 const buttons=document.createElement('div');buttons.className='output-links sound-actions';const variation=document.createElement('button');variation.type='button';variation.textContent='New variation';variation.title='Generate a new sound variation with the current mix';variation.onclick=()=>{settings.seed=(settings.seed+1)%1000000;edit();};const download=document.createElement('button');download.type='button';download.textContent='Download WAV';download.className='sound-download';download.onclick=async()=>{try{onPause();await prepare();if(!buffer)return;const bytes=encodeWav([buffer.getChannelData(0),buffer.getChannelData(1)],buffer.sampleRate);const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));const a=document.createElement('a');a.href=url;a.download='framevolve-sound-design.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status.textContent=e.message;}};const subtle=document.createElement('button');subtle.type='button';subtle.textContent='Subtle mix';subtle.title='Reset movement and mechanical levels to the authored subtle mix';subtle.onclick=()=>{for(const k of ['camera','objects','accents','dial','hinge','gyro'])settings[k]=soundDefaults[k];sync();edit();};buttons.append(subtle,variation,download);panel.append(buttons);
 document.querySelector('.property-panel').append(panel);
 panel.querySelector('#sound-enabled').onchange=e=>{settings.enabled=e.target.checked;edit();};
 function sync(){for(const [key,f] of Object.entries(fields)){f.input.value=settings[key];if(f.out){f.out.value=Math.round(settings[key]*100);f.out.setCustomValidity('');}}bpm.disabled=settings.tempo==='auto';bpmLabel.hidden=settings.tempo==='auto';panel.querySelector('#sound-enabled').checked=settings.enabled;}
 function stop(){generation++;if(source){source.onended=null;source.stop();source.disconnect();source=null;}}
 async function renderFilmAudio(p){
  const imported=p.music?normalizeMusicTrack(p.music):null;
  const rendered=renderSound(planSound(runtime.sampleMotion(p),imported?{...p.sound,music:0}:p.sound));
  if(!imported||p.sound?.enabled===false)return rendered;
  const decoded=await musicDecodeCache.get(imported.assetId);
  return {...rendered,channels:mixMusicPcm({baseChannels:rendered.channels,musicChannels:Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),outputSampleRate:rendered.sampleRate,musicSampleRate:decoded.sampleRate,track:imported,musicLevel:2*(p.sound?.music??soundDefaults.music)*(p.sound?.master??soundDefaults.master)})};
 }
 async function prepare(){
  await ensureContext();await context.resume();
  const p=parameters();
  const key=JSON.stringify(p);if(cacheKey===key&&buffer)return;
  status.textContent='Preparing audio…';await new Promise(r=>setTimeout(r,20));
  const rendered=await renderFilmAudio(p);
  buffer=context.createBuffer(2,rendered.channels[0].length,rendered.sampleRate);for(let c=0;c<2;c++)buffer.copyToChannel(rendered.channels[c],c);cacheKey=key;
  status.textContent=p.music?`Imported song · ${rendered.stats.eventCount} motion effects`:`${rendered.stats.bpm} BPM · ${rendered.stats.eventCount} sound effects`;
 }
 async function play(time){stop();const token=generation;if(!settings.enabled)return false;building=prepare();await building;if(token!==generation||!buffer)return false;source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);offset=time;startTime=context.currentTime;source.start(0,Math.min(time,buffer.duration-.001));return true;}
 async function exportBuffer(p){await new Promise(resolve=>setTimeout(resolve,0));const rendered=await renderFilmAudio(p);const result=new AudioBuffer({numberOfChannels:2,length:rendered.channels[0].length,sampleRate:rendered.sampleRate});for(let c=0;c<2;c++)result.copyToChannel(rendered.channels[c],c);return result;}
 function setScene(scene){
  panel.hidden=false;
  // Mirrors runtime.sampleMotion: only OBJECTS emits local mechanical profiles;
  // DOT has fixed authored cues; these study adapters currently emit no SFX.
  const is2d=['procedural','pop','dot','replay'].includes(scene);
  const hasMotionEffects=!['starter','pulse','camera'].includes(scene);
  const authoredCues=scene==='dot';
  mechanics.hidden=scene!=='objects';sfx.hidden=!hasMotionEffects;subtle.hidden=!hasMotionEffects;
  for(const key of ['dial','hinge','gyro'])fields[key].row.hidden=scene!=='objects';
  fields.objects.row.hidden=authoredCues;fields.density.row.hidden=authoredCues;
  const sceneLabels=is2d?{camera:'Transitions',objects:'Shapes and text',accents:'Entrances and stops'}:{camera:labels.camera,objects:labels.objects,accents:labels.accents};
  for(const [key,label]of Object.entries(sceneLabels)){
   fields[key].row.querySelector('label').textContent=label;
   fields[key].out.setAttribute('aria-label',label+' percent');
   const kitKey=key==='objects'?'objectKit':key==='accents'?'accentKit':'cameraKit';
   fields[kitKey].input.setAttribute('aria-label',label+' sound');
   fields[kitKey].input.closest('label').hidden=authoredCues;
  }
 }
 sync();syncMusic();return {exportBuffer,setScene,getSettings:()=>({...settings}),getMusicTrack:()=>musicTrack?{...musicTrack}:null,
  setMusicTrack(value){stop();musicTrack=value?normalizeMusicTrack(value):null;cacheKey='';excerptProposal=editProposal=null;refreshMusicAsset();},
  async resolveMusicAsset(p){const track=p?.music?normalizeMusicTrack(p.music):musicTrack;return track?loadMusicAsset(track.assetId):null;},
  setSettings(value){stop();settings=normalizeSound(value??soundDefaults);cacheKey='';sync();},play,stop,currentTime:()=>source?offset+context.currentTime-startTime:null};
}
