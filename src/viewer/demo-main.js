import './style.css';
import './demo.css';
import {createDemoRuntime} from './demo-runtime.js';
import {renderControl} from './control-widget.js';
import {observeIcons,setIcon} from './studio-icons.js';
import {resolveParameters} from '../engine/project-controls.js';
import {getControlCatalog,readControlValue} from '../engine/control-catalog.js';
const $=id=>document.getElementById(id),download='https://github.com/AndreXes03/motion-lab/archive/refs/heads/main.zip';
const runtime=createDemoRuntime($('renderCanvas'));
setIcon($('play'),'play',{label:'Play',iconOnly:true});setIcon($('loop'),'loop',{label:'Loop playback',iconOnly:true});
const defaults={accent:'#ff7142',shell:'#6864ff',energy:1,cameraTravel:1,palette:'electric'};
let time=0,playing=false,loop=true,last=0,pending=0,values={...defaults},animation,motionPanel,motionModule,history=[],future=[];
const params=()=>({...resolveParameters('starter',values),look:{camera:{distance:values.cameraDistance??1,keepSubjectSize:values.keepSubjectSize??true}},demo:{energy:values.energy??1,cameraTravel:values.cameraTravel??1,palette:values.palette??'electric'},...(animation?{animation}:{} )});
const idle=[];
function draw(){if(pending)return;pending=requestAnimationFrame(()=>{pending=0;runtime.render(time,{parameters:params(),width:640,height:360});$('seek').value=Math.round(time*30);$('time').textContent=`00:0${Math.floor(time)}:${String(Math.round(time*30)%30).padStart(2,'0')} · F${String(Math.round(time*30)).padStart(3,'0')}`;motionPanel?.updateTime(time);for(const resolve of idle.splice(0))resolve();});}
window.motionPreview={whenIdle:()=>pending?new Promise(resolve=>idle.push(resolve)):Promise.resolve(),getSettings:()=>({width:640,height:360,previewQuality:'fast'})};
window.motion={ready:Promise.resolve(),render:runtime.render};
function pause(){playing=false;setIcon($('play'),'play',{label:'Play',iconOnly:true});}
function record(){history.push(structuredClone({values,animation}));history=history.slice(-30);future=[];$('undo-edit').disabled=false;$('redo-edit').disabled=true;}
function restore(state){values=state.values;animation=state.animation;controls();motionPanel?.sync();draw();}
$('undo-edit').onclick=()=>{if(!history.length)return;future.push(structuredClone({values,animation}));restore(history.pop());$('undo-edit').disabled=!history.length;$('redo-edit').disabled=false;};
$('redo-edit').onclick=()=>{if(!future.length)return;history.push(structuredClone({values,animation}));restore(future.pop());$('redo-edit').disabled=!future.length;$('undo-edit').disabled=false;};
$('play').onclick=()=>{playing=!playing;last=performance.now();setIcon($('play'),playing?'pause':'play',{label:playing?'Pause':'Play',iconOnly:true});};
$('seek').max=179;$('seek').oninput=()=>{pause();time=Number($('seek').value)/30;draw();};
$('loop').setAttribute('aria-pressed','true');$('loop').onclick=()=>{loop=!loop;$('loop').setAttribute('aria-pressed',String(loop));};
function tick(now){if(playing&&!document.hidden){time+=Math.min((now-last)/1000,.08);if(time>=6){time=loop?0:179/30;if(!loop)pause();}draw();}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
$('scene').replaceChildren(new Option('3D quick demo','starter'));$('project-title').textContent='Color in motion';$('project-kind').textContent='LIGHTWEIGHT WEB DEMO';$('project-subtitle').textContent='Orbit, spin and play with color';
$('timeline-meta').textContent='6 s · 30 fps · lightweight 3D';$('timeline-ruler').replaceChildren(...Array.from({length:7},(_,i)=>{const node=document.createElement('span');node.textContent=String(i).padStart(2,'0');return node;}));
$('moments').replaceChildren();for(const [label,t]of [['Orbit',0],['Twist',1.5],['Float',3],['Swing',4.5]]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{pause();time=t;draw();};$('moments').append(button);}
for(const id of ['export-settings','render-frame','render-preview','advanced-toggle','review-tools','finish-tools','dof-tools','control-scope','control-catalog-count','tool-categories','pin-reference','compare-toggle','preview-review-controls','layout-controls','layout-focus','wide-view','export-dock','tab-code','tab-audio','tab-versions','tab-compositing','mobile-selection'])$(id).hidden=true;
for(const node of document.querySelectorAll('.demo-files,.versions,.browser-bottom,#selection-hint,.section-caption,.studio-mode-label,.mobile-selection-label,.catalog-toolbar,.layout-picker'))node.hidden=true;
$('scene-tree').replaceChildren();$('scene-count').textContent='01';
const sceneItem=document.createElement('button');sceneItem.className='scene-item';sceneItem.textContent='3D quick demo';sceneItem.setAttribute('aria-pressed','true');$('scene-tree').append(sceneItem);
$('preview-controls').textContent='640 × 360 · fast 3D';$('preview-badge').textContent='Lightweight demo';
$('reset').onclick=()=>{record();values={...defaults};animation=undefined;time=0;controls();motionPanel?.sync();draw();};
$('save').onclick=()=>{const link=document.createElement('a');link.href=$('renderCanvas').toDataURL('image/png');link.download='framevolve-web-demo.png';link.click();};
let controlBaseline;
function controls(){
 const parent=$('project-controls');parent.replaceChildren();
 const catalog=[...getControlCatalog('starter'),{id:'energy',label:'Motion energy',type:'range',min:0,max:1.6,step:.05,default:1,help:'Add more floating, twisting and orbital variation to the continuous loop.'},{id:'cameraTravel',label:'Camera travel',type:'range',min:0,max:1.5,step:.05,default:1,help:'Amount of camera travel around the sculpture.'}],p=params();
 for(const [title,ids]of [['Motion',['energy','cameraTravel']],['Materials',['accent','shell']],['Camera lens',['fov','cameraDistance','keepSubjectSize']],['Lighting',['keyStrength','fill']]]){
  const group=document.createElement('details');group.className='catalog-group';group.open=true;const heading=document.createElement('summary');heading.textContent=title;group.append(heading);
  for(const id of ids){const def=catalog.find(def=>def.id===id);const node=renderControl(def,{value:['energy','cameraTravel','cameraDistance','keepSubjectSize'].includes(id)?values[id]??def.default:readControlValue(def,p),onInput:value=>{controlBaseline??=structuredClone({values,animation});pause();values[id]=value;draw();},onBegin:()=>{controlBaseline=structuredClone({values,animation});},onCancel:()=>{if(controlBaseline){values=controlBaseline.values;animation=controlBaseline.animation;controlBaseline=undefined;draw();}},onCommit:()=>{if(controlBaseline&&JSON.stringify(controlBaseline)!==JSON.stringify({values,animation})){history.push(controlBaseline);future=[];$('undo-edit').disabled=false;$('redo-edit').disabled=true;}controlBaseline=undefined;}});group.append(node);}
  parent.append(group);
 }
 $('control-search').hidden=true;$('presets').replaceChildren();
 for(const [label,palette]of [['Electric',{shell:defaults.shell,accent:defaults.accent,palette:'electric'}],['Candy',{shell:'#fc6da3',accent:'#72dfe5',palette:'candy'}],['Sunset',{shell:'#a459dc',accent:'#ff9145',palette:'sunset'}]]){const button=document.createElement('button');button.textContent=label;button.setAttribute('aria-pressed',String(Object.entries(palette).every(([key,value])=>values[key]===value)));button.onclick=()=>{record();values={...values,...palette};controls();draw();};$('presets').append(button);}
}
async function showPanel(panel){
 if(!['look','motion'].includes(panel))return;
 document.body.dataset.panel=panel;for(const id of ['look','motion']){$('inspector-'+id).hidden=id!==panel;$('tab-'+id).setAttribute('aria-selected',String(id===panel));}
 $('workspace-title').textContent=panel==='motion'?'Motion preview':'Properties';$('workspace-kicker').textContent=panel==='motion'?'MOTION':'SCENE';
 if(panel==='motion'&&!motionPanel){motionModule??=import('./motion-panel.js');const {mountMotionPanel}=await motionModule;motionPanel=mountMotionPanel({container:$('inspector-motion'),getScene:()=> 'starter',getParameters:params,getAnimation:()=>animation,getTime:()=>time,getAuthoredTracks:({groupId,start,end,parameters})=>runtime.sampleAuthoredAnimation(parameters,groupId,{start,end}),onChange:next=>{record();animation=next;draw();},onSeek:t=>{pause();time=Math.max(0,Math.min(179/30,t));draw();}});}
 motionPanel?.sync();
}
$('tab-look').onclick=()=>showPanel('look');$('tab-motion').onclick=()=>showPanel('motion');
const pro=document.createElement('dialog');pro.className='demo-pro-dialog';pro.id='demo-pro-dialog';pro.setAttribute('aria-labelledby','demo-pro-title');
pro.innerHTML='<button class="demo-pro-close" aria-label="Close">×</button><p class="eyebrow">DESKTOP STUDIO</p><h2 id="demo-pro-title">The full editor lives on your Mac.</h2><p>Download Framevolve for Pro tools: editable curves, multiple keyframes, the full scene library, code access and local video rendering.</p><a class="demo-download" href="'+download+'">Download Studio</a><a class="demo-install-guide" href="https://github.com/AndreXes03/motion-lab#readme" target="_blank" rel="noopener">Installation guide ↗</a>';
pro.querySelector('button').onclick=()=>pro.close();pro.addEventListener('click',e=>{if(e.target===pro)pro.close();});document.body.append(pro);
$('experience-easy').onclick=()=>{};$('experience-pro').onclick=()=>{pause();pro.showModal();};$('experience-pro').setAttribute('aria-label','Pro tools · download required');$('experience-pro').title='Pro tools are available in the desktop download';
const banner=document.createElement('div');banner.className='demo-notice';banner.innerHTML='<span>Lightweight web demo <small>Pro tools are available in the desktop download.</small></span><a href="'+download+'">Download Studio ↗</a>';document.querySelector('.app-header').after(banner);
const downloadButton=document.createElement('a');downloadButton.href=download;downloadButton.className='demo-download demo-header-download';downloadButton.textContent='Download Studio';$('export-settings').after(downloadButton);
const localLink=document.querySelector('.studio-brand');localLink.href='../';document.querySelector('.studio-status>span').innerHTML='<i class="live-dot"></i> Web demo · basic tools';$('edit-status').textContent='Pro tools in the desktop download';document.body.dataset.experience='easy';document.body.dataset.layout='balanced';document.body.dataset.webDemo='true';document.body.classList.add('single-composition');
$('panel-divider').hidden=false;$('panel-divider').style.pointerEvents='none';$('panel-divider').tabIndex=-1;$('preview-mode-render')?.setAttribute('hidden','');
document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,button')||pro.open)return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();pause();time=Math.max(0,Math.min(179/30,time+(e.key==='ArrowLeft'?-1:1)/30));draw();}});
observeIcons(document.body);controls();await showPanel('look');draw();if(!matchMedia('(prefers-reduced-motion: reduce)').matches){playing=true;last=performance.now();setIcon($('play'),'pause',{label:'Pause',iconOnly:true});}
