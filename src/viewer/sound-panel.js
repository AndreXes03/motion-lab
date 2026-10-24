import {hasVoiceover,hasMusic,duckGeneratedMusic,validateVoiceoverDuration} from '../engine/voiceover.js';
import {normalizeSoundState,usesEditedSoundtrack} from './sound-state.js';
import {mountAudioImportPanel} from './audio-import-panel.js';
import './sound-panel.css';
import {soundDefaults,soundKits,normalizeSound,planSound,renderSound,encodeWav,masterGain} from '../engine/sound-design.js';
const timbres={air:'Air',silk:'Silk',deep:'Deep',grain:'Grainy',swirl:'Swirl',reverse:'Reverse',bright:'Bright',riser:'Riser',mechanical:'Mechanical',metal:'Metal',plastic:'Plastic',glass:'Glass',rubber:'Rubber',wood:'Wood',electric:'Electric',ceramic:'Ceramic',soft:'Soft',click:'Click',knock:'Knock',snap:'Snap',ping:'Ping',sub:'Sub',chime:'Chime',pop:'Pop'};
const labels={camera:'Camera movement',objects:'Object movement',accents:'Accents',music:'Generated music volume',master:'Master volume',density:'Effect frequency',dial:'Dial clicks',hinge:'Hinge movement',gyro:'Gyroscope movement'};
export function mountSoundPanel({runtime,parameters,onChange,onPause,getTime,getDuration,onSeek}){
 const panel=document.createElement('details');panel.className='finish-tools sound-panel';panel.id='sound-tools';panel.open=true;
 panel.innerHTML='<summary>Sound design</summary><div class="sound-heading"><h3>Sound design</h3><label class="finish-checkbox sound-enable"><input id="sound-enabled" type="checkbox" checked> Generated sound</label></div>';
 let settings={...soundDefaults},context,source,buffer,cacheKey='',generation=0,startTime=0,offset=0,building=null;
 let activeScene='',editedTrack=null,decodedTrack=null,audioRevision=0,defaultRequest=null,defaultKey='';
 const editedReady=import.meta.env.VITE_PUBLIC_DEMO==='true'?Promise.resolve():fetch('/local-preview/loop-audio.json').then(r=>r.ok?r.json():null).then(data=>{if(data?.scene==='loop'&&/^\/local-preview\/[a-zA-Z0-9._-]+\.mp3$/.test(data.url)){editedTrack=data;cacheKey='';setScene(activeScene);}}).catch(()=>{});
 const fields={};
 function section(title,{advanced=false}={}){
  const group=document.createElement(advanced?'details':'section');group.className=advanced?'sound-section sound-disclosure':'sound-section';
  const heading=document.createElement(advanced?'summary':'h4');heading.textContent=title;group.append(heading);panel.append(group);return group;
 }
 const imported=mountAudioImportPanel({container:panel,getTime,getDuration,onSeek,onPause,onImport:role=>{audioRevision++;if(role==='music')settings.music=0;sync();},onEdit:()=>{stop();cacheKey='';setScene(activeScene);onPause();onChange();}});
 const mix=section('Global mix');
 const muteLabel=document.createElement('label');muteLabel.className='audio-track-enabled sound-global-mute';const mute=document.createElement('input');mute.id='sound-muted';mute.type='checkbox';mute.onchange=()=>{settings.muted=mute.checked;edit();};muteLabel.append(mute,document.createTextNode('Mute all audio'));mix.append(muteLabel);
 const masterNote=document.createElement('p');masterNote.className='audio-import-note';masterNote.textContent='Master volume controls voice, music and effects. 80% is the authored mix level.';mix.append(masterNote);panel.insertBefore(mix,panel.querySelector('.imported-audio'));
 const sfx=section('Motion effects');
 const music=section('Music settings',{advanced:true});
 const mechanics=section('Mechanical detail',{advanced:true});
 function edit(){audioRevision++;stop();cacheKey='';settings=normalizeSound(settings);onPause();onChange();status.textContent='Audio updated · press Play';}
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
 const status=document.createElement('p');status.id='sound-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Ready · press Play to listen';panel.append(status);
 const buttons=document.createElement('div');buttons.className='output-links sound-actions';const variation=document.createElement('button');variation.type='button';variation.textContent='New variation';variation.title='Generate a new sound variation with the current mix';variation.onclick=()=>{settings.seed=(settings.seed+1)%1000000;edit();};const download=document.createElement('button');download.type='button';download.textContent='Download WAV';download.className='sound-download';download.onclick=async()=>{try{onPause();await prepare();if(!buffer)return;const bytes=encodeWav([buffer.getChannelData(0),buffer.getChannelData(1)],buffer.sampleRate);const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));const a=document.createElement('a');a.href=url;a.download='framevolve-sound-design.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status.textContent=e.message;}};const subtle=document.createElement('button');subtle.type='button';subtle.textContent='Subtle mix';subtle.title='Reset movement and mechanical levels to the authored subtle mix';subtle.onclick=()=>{for(const k of ['camera','objects','accents','dial','hinge','gyro'])settings[k]=soundDefaults[k];sync();edit();};buttons.append(subtle,variation,download);panel.append(buttons);
 (document.querySelector('#inspector-audio')??document.querySelector('.property-panel')).append(panel);
 panel.querySelector('#sound-enabled').onchange=e=>{settings.enabled=e.target.checked;edit();};
 function sync(){for(const [key,f] of Object.entries(fields)){f.input.value=settings[key];if(f.out){f.out.value=Math.round(settings[key]*100);f.out.setCustomValidity('');}}bpm.disabled=settings.tempo==='auto';bpmLabel.hidden=settings.tempo==='auto';panel.querySelector('#sound-enabled').checked=settings.enabled;mute.checked=settings.muted;}
 function stop(){generation++;if(source){source.onended=null;source.stop();source.disconnect();source=null;}}
 async function prepare(){
  if(!context)context=new AudioContext({sampleRate:48000});await context.resume();
  await defaultRequest;const p=parameters();
  const key=JSON.stringify(p);if(cacheKey===key&&buffer)return;
  status.textContent='Preparing audio…';await new Promise(r=>setTimeout(r,20));
  await editedReady;if(usesEditedSoundtrack(p.scene,p.sound,editedTrack,p.audio)){buffer=await imported.mix(await editedBuffer(p),context,p.audio,p.sound,{baseIsMusic:true});cacheKey=key;status.textContent='Edited soundtrack · LOOP';return;}
  const telemetry=runtime.sampleMotion(p),plan=planSound(telemetry,p.sound),rendered=duckGeneratedMusic(renderSound(plan,{stems:hasVoiceover(p.audio)}),p.audio);
  buffer=context.createBuffer(2,rendered.channels[0].length,rendered.sampleRate);for(let c=0;c<2;c++)buffer.copyToChannel(rendered.channels[c],c);buffer=await imported.mix(buffer,context,p.audio,p.sound);cacheKey=key;
  status.textContent=(p.scene==='loop'&&p.sound?.musicStyle==='scene'&&!editedTrack&&!p.audio?.tracks?.some(t=>t.enabled)?'LOOP edited soundtrack unavailable in this installation · synthesized preview · ':'')+`${plan.bpm} BPM · ${plan.events.length} sound effects`;
 }
 async function play(time){stop();const token=generation;if(!settings.enabled&&!imported.getAudio().tracks.some(t=>t.enabled))return false;building=prepare();await building;if(token!==generation||!buffer)return false;source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);offset=time;startTime=context.currentTime;source.start(0,Math.min(time,buffer.duration-.001));return true;}
 async function editedBuffer(p){
  if(!context)context=new AudioContext({sampleRate:48000});
  if(!decodedTrack){const response=await fetch(editedTrack.url);if(!response.ok)throw new Error('Soundtrack unavailable');decodedTrack=await context.decodeAudioData(await response.arrayBuffer());}
  const result=context.createBuffer(decodedTrack.numberOfChannels,decodedTrack.length,decodedTrack.sampleRate),gain=(p.sound?.enabled===false?0:1)*(masterGain(p.sound))*((p.sound?.music??soundDefaults.music)/soundDefaults.music);
  for(let c=0;c<result.numberOfChannels;c++){const input=decodedTrack.getChannelData(c),output=result.getChannelData(c);for(let i=0;i<input.length;i++)output[i]=input[i]*gain;}return result;
 }
 async function exportBuffer(p){validateVoiceoverDuration(p.audio,getDuration());await editedReady;if(usesEditedSoundtrack(p.scene,p.sound,editedTrack,p.audio))return imported.mix(await editedBuffer(p),context,p.audio,p.sound,{baseIsMusic:true});await new Promise(resolve=>setTimeout(resolve,0));const rendered=duckGeneratedMusic(renderSound(planSound(runtime.sampleMotion(p),p.sound),{stems:hasVoiceover(p.audio)}),p.audio);const result=new AudioBuffer({numberOfChannels:2,length:rendered.channels[0].length,sampleRate:rendered.sampleRate});for(let c=0;c<2;c++)result.copyToChannel(rendered.channels[c],c);if(!context)context=new AudioContext({sampleRate:48000});return imported.mix(result,context,p.audio,p.sound);}
 function loadSceneDefault(scene){
  if(import.meta.env.VITE_PUBLIC_DEMO==='true'||scene!=='loop'||settings.musicStyle!=='scene'||settings.music<=0||hasMusic(imported.getAudio()))return;
  const revision=audioRevision,key=scene+':'+revision;if(defaultKey===key)return;defaultKey=key;
  defaultRequest=fetch('/api/studio/audio/authored/loop',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error??'Authored soundtrack unavailable');if(revision!==audioRevision||activeScene!==scene||hasMusic(imported.getAudio())||settings.musicStyle!=='scene')return;if(data.audio){const current=imported.getAudio();imported.setAudio({...current,tracks:[...data.audio.tracks,...current.tracks]});settings={...settings,...data.sound};cacheKey='';sync();setScene(scene);onChange();}}).catch(error=>{if(revision===audioRevision&&activeScene===scene)status.textContent=error.message;});
 }
 function setScene(scene){
  if(activeScene!==scene)audioRevision++;activeScene=scene;loadSceneDefault(scene);panel.hidden=false;const edited=usesEditedSoundtrack(scene,settings,editedTrack,imported.getAudio());music.hidden=edited;variation.hidden=edited;
  // Mirrors runtime.sampleMotion: only OBJECTS emits local mechanical profiles;
  // DOT has fixed authored cues; these study adapters currently emit no SFX.
  const is2d=['procedural','pop','dot','replay'].includes(scene);
  const hasMotionEffects=!['starter','pulse','camera'].includes(scene);
  const authoredCues=scene==='dot';
  mechanics.hidden=edited||scene!=='objects';sfx.hidden=edited||!hasMotionEffects;subtle.hidden=edited||!hasMotionEffects;if(edited)status.textContent='Edited soundtrack · LOOP';
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
 function setState(value){const next=normalizeSoundState(value);audioRevision++;stop();cacheKey='';settings=next.sound;imported.setAudio(next.audio);sync();setScene(value?.scene??activeScene);}
 sync();return {get ready(){return defaultRequest??Promise.resolve();},setState,resetForScene(scene){setState({scene});},refreshTimeline:imported.refreshTimeline,getAudio:imported.getAudio,setAudio(value){audioRevision++;stop();cacheKey='';imported.setAudio(value);setScene(activeScene);},exportBuffer,setScene,getSettings:()=>({...settings}),setSettings(value){audioRevision++;stop();settings=normalizeSound(value??soundDefaults);cacheKey='';sync();setScene(activeScene);},play,stop,currentTime:()=>source?offset+context.currentTime-startTime:null};
}
