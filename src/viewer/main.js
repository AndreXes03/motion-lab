import {mountLiveReview,readLiveRecovery} from './live-review.js';
import {mountPreparedPreview} from './prepared-preview.js';
import {canonicalScene,migrateLegacyScene} from '../engine/legacy-scene.js';
import {createRenderFrameView} from './render-frame-view.js';
import {mountRenderFrameSurface} from './render-frame-surface.js';
import {mountViewportToolbar} from './viewport-toolbar.js';
import {getAuthoredAnimationTracks,validateAuthoredMotion} from '../engine/authored-animation.js';
import {previewReviewModes,resolvePreviewReview} from '../engine/preview-review.js';
import {observeIcons,setIcon,icon} from './studio-icons.js';
import {deriveWorkspaceModel} from './workspace-model.js';
import {getBrowserExportCapabilities,exportBrowserVideo} from './browser-export.js';
import {mountRenderPanel} from './render-panel.js';
import {createRenderPlan,validateRenderPlan} from '../engine/render-policy.js';
import renderRecommendations from '../../project/render-plans.json';
import {mountPreviewQuality} from './preview-quality.js';
import {getControlPresets} from '../engine/control-presets.js';
import {getControlCatalog,createControlManifest,validateControlManifest,resolveControlManifest,readControlValue,assertSafeControlDocument} from '../engine/control-catalog.js';
import {validateParameterAnimation} from '../engine/parameter-animation.js';
import {renderControl} from './control-widget.js';
import {mountMotionPanel} from './motion-panel.js';
import {sceneIds,sceneConfig,isNewScene} from '../scene-registry.js';
import {mountInspector,mergeLook} from './studio-inspector.js';
import {mountSoundPanel} from './sound-panel.js';
import './style.css';
import {brandReady} from '../components/brand.js';
import {mountReferencePanel} from './reference-panel.js';
import {createRuntime} from '../engine/runtime.js';
import {studioProjects,resolveParameters} from '../engine/project-controls.js';
import savedMotion from '../../project/motion.json';
await brandReady;
const $=id=>document.getElementById(id);
observeIcons(document.body);
const viewportToolbar=mountViewportToolbar({container:$('preview-review-controls'),select:$('review'),onChange:()=>{if($('review').value==='beauty')previewQuality?.setMode('render');else if(previewQuality?.getMode()==='render')previewQuality.setMode('interactive');syncReviewNote();draw();}});
const publicDemo=import.meta.env.VITE_PUBLIC_DEMO==='true';
const browserExportCaps=getBrowserExportCapabilities(),exportStorageKey=publicDemo?'motion-lab-browser-export-settings':'motion-lab-export-settings';
let browserExportController,browserExportURL;
const demoAsset=filename=>publicDemo?new URL('../demo/'+filename,location.href).href:'/demo/'+filename;
const browserVersionsKey='motion-lab-public-versions-v1';
function browserVersions(){try{return JSON.parse(localStorage.getItem(browserVersionsKey)||'[]');}catch{return [];}}

const liveRecovery=readLiveRecovery();
const initialScene=canonicalScene(liveRecovery?.scene??new URLSearchParams(location.search).get('scene'));
const runtime=createRuntime($('renderCanvas'),{initialScene:sceneIds.includes(initialScene)?initialScene:'objects'});window.motion=runtime;
const {fps,width,height}=runtime.config;let duration=sceneConfig(sceneIds.includes(initialScene)?initialScene:'objects').duration,lastFrame=Math.round(duration*fps)-1;
let scene=sceneIds.includes(initialScene)?initialScene:'objects',values={},preset='original',time=0,playing=false,loop=false,last=0,lastDraw=0,exact=null,versionList=[],activeJob=null,advancedMounted=false,revision=0;
let lastLiveJob=null,dialogJobId=null,dialogReturnFocus=null;
let baseLook=runtime.getLook();
let baseMotion=structuredClone(savedMotion);
let inspector,motionPanel,renderPanel,lookOverrides={},objectEdits={},animation,controlManifest,toolCategory='all',previewQuality,previewFrame=0,refineTimer=0,renderViewTimer=0,interactionUntil=0,previewBusy=false,previewWaiters=[];
const jobSettings=new Map();
const finalFrameSurface=mountRenderFrameSurface({container:document.querySelector('.viewport'),onInteractive:()=>previewQuality.setMode('interactive'),onSettings:()=>{$('export-settings').open=true;},onRetry:()=>requestFinalFrame(true)});
const finalFrameView=createRenderFrameView({api,onState:state=>{finalFrameSurface.render(state);if(state.status!=='idle'){previewQuality?.setRenderState(state.status,state.elapsedMs,state.phase);syncPreviewBadge();}}});
const preparedPreview=mountPreparedPreview({container:document.querySelector('.viewport'),toolbar:$('preview-controls'),enabled:!publicDemo,getState:()=>({scene,parameters:parameters(),review:$('review').value,mode:previewQuality?.getMode()}),onSelect:()=>{pause();$('review').value='beauty';previewQuality?.setMode('interactive');syncReviewNote();},onChange:()=>draw()});
function needsFinalFrame(){return !preparedPreview.active()&&previewQuality?.getMode()==='render'&&$('review').value==='beauty'&&['cycles','mixed'].includes(renderPanel?.getSelection({kind:'frame'}).selectedRenderer);}
function requestFinalFrame(force=false){const {width,height,fps,temporalSamples}=exportSettings();finalFrameView.request({parameters:parameters(),time,settings:{width,height,fps,temporalSamples},selection:renderPanel.getSelection({kind:'frame'}),publicDemo,force});}

const project=()=>studioProjects.find(p=>p.id===scene);
const finishFields=[['dofFocus','finish-dofFocus',8,v=>Number(v).toFixed(1)],['dofStrength','finish-dofStrength',.35,v=>Math.round(v*100)+'%'],['dofMaxBlur','finish-dofMaxBlur',12,v=>v+' px HD'],['grain','finish-grain',.018,value=>Number(value).toFixed(3)],['grainSize','finish-grain-size',1.1,value=>Number(value).toFixed(1)+'×'],['shutterAngle','finish-shutter',210,value=>Math.round(value)+'°']];
function syncFinishControls(){const post=exact?.look?.post??baseLook.post;for(const [key,id,fallback,format] of finishFields){const input=$(id);const current=Number(post?.[key]);input.value=Number.isFinite(current)?current:fallback;$(id+'-value').textContent=format(input.value);}$('finish-antialias').checked=post?.antialias!==false;for(const key of ['dofEnabled','dofAuto'])$('finish-'+key).checked=key==='dofAuto'?post?.[key]!==false:post?.[key]===true;$('finish-dofFocus').disabled=post?.dofAuto!==false;}
function unpackControlValues(p){return Object.fromEntries(getControlCatalog(p.scene).filter(c=>c.binding==='value'&&c.id!=='contrast').map(c=>[c.valueId,readControlValue(c,p)]));}
let soundPanel,playRequest=0,preparingPlay=false;

function renderCatalogControls(){
 const catalog=getControlCatalog(scene),manifest=controlManifest??createControlManifest(scene),params=parameters();
 const selected=createControlManifest(scene),all=createControlManifest(scene,'all');
 const same=(a,b)=>JSON.stringify(a.controls)===JSON.stringify(b.controls)&&JSON.stringify(a.panels)===JSON.stringify(b.panels);
 $('control-scope').value=same(manifest,selected)?'essential':same(manifest,all)?'all':'custom';
 $('control-catalog-count').textContent=`${manifest.controls.length} selected · ${catalog.length} available`;
 $('control-selection-note').textContent=manifest.rationale??'This recipe stores its own panel and control selection.';
 const parent=$('project-controls');parent.replaceChildren();
 for(const panel of manifest.panels){
  const group=document.createElement('details');group.className='catalog-group';group.dataset.category=panel.category;group.dataset.advanced=String(panel.advanced);group.open=!panel.advanced;
  const title=document.createElement('summary');title.innerHTML=icon(panel.category);title.append(document.createTextNode(panel.title));const badge=document.createElement('span');badge.textContent=panel.advanced?'Advanced':'';title.append(badge);group.append(title);
  const presets=['lights','compositing'].includes(panel.category)?getControlPresets(scene,panel.category):[];if(presets.length){const select=document.createElement('select');select.className='panel-preset';select.dataset.presetCategory=panel.category;select.setAttribute('aria-label',panel.title+' preset');const custom=new Option('Custom','');select.append(custom);for(const preset of presets)select.append(new Option(preset.label,preset.id));select.value=presets.find(preset=>Object.entries(preset.values).every(([id,value])=>readControlValue(catalog.find(c=>c.id===id),params)===value))?.id??'';select.onchange=()=>{if(select.value)applyToolPreset(panel.category,select.value);};group.append(select);}
  if(panel.help)title.title=panel.help;parent.append(group);
  for(const id of panel.controls){const def=catalog.find(c=>c.id===id);
   const value=def.binding==='value'?(values[def.valueId]??project().presets.find(p=>p.id===preset)?.values?.[def.valueId]??readControlValue(def,params)):readControlValue(def,params);
   let scrubBaseline;
   const node=renderControl(def,{value,onBegin:()=>{scrubBaseline=snapshot();},onCancel:()=>{if(scrubBaseline){restore(scrubBaseline);scrubBaseline=undefined;}},onInput:value=>{
    if(def.binding==='value'){values[def.valueId]=value;changed();refreshPanelPresets();}
    else{pause();if(exact){baseLook=structuredClone(exact.look??baseLook);exact=null;}const target=def.path[0]==='objectEdits'?objectEdits:lookOverrides;const keys=def.path.slice(1);let current=target;for(const key of keys.slice(0,-1))current=current[key]??={};current[keys.at(-1)]=value;revision++;$('version-status').textContent='Unsaved changes';draw();refreshPanelPresets();syncControlDependencies();}
   },onCommit:()=>inspector?.record()});
   node.dataset.category=panel.category;node.dataset.contexts=JSON.stringify(def.contexts??['composition']);node.dataset.search=`${def.label} ${panel.title} ${panel.category} ${def.help??''}`.toLowerCase();group.append(node);
  }
 }
 syncControlDependencies();filterCatalogControls();
}
function syncControlDependencies(){
 const post=parameters().look?.post??{}, enabled=post.dofEnabled===true, auto=post.dofAuto!==false;
 for(const id of ['dofAuto','dofFocus','dofStrength','dofMaxBlur']){
  const row=document.querySelector(`[data-control-id="${id}"]`);if(!row)continue;
  const disabled=!enabled||(id==='dofFocus'&&auto);
  row.classList.toggle('control-inactive',disabled);
  for(const input of row.querySelectorAll('input,select'))input.disabled=disabled;
  row.title=disabled?(enabled?'Turn off autofocus to set a focus distance.':'Enable depth of field to adjust focus.') : '';
 }
}
function filterCatalogControls({selection=inspector?.getSelection()??'composition'}={}){
 const workspace=document.body.dataset.panel==='compositing'?'compositing':'look';
 const model=deriveWorkspaceModel({scene,manifest:controlManifest??createControlManifest(scene),selection,workspace,category:toolCategory,query:$('control-search').value});
 toolCategory=model.category;
 const visible=new Set(model.visibleControlIds);
 for(const node of document.querySelectorAll('#project-controls .control')){
  node.hidden=!visible.has(node.dataset.controlId);
  node.dataset.searchHidden=String(node.hidden);
 }
 for(const group of document.querySelectorAll('#project-controls .catalog-group')){
  group.hidden=![...group.querySelectorAll('.control')].some(n=>!n.hidden);
  if(!group.hidden&&($('control-search').value||toolCategory!=='all'||(group.dataset.advanced!=='true'&&(workspace==='compositing'||selection!=='composition'))))group.open=true;
 }
 const rail=$('tool-categories');
 const signature=JSON.stringify(model.categoryOptions);
 if(rail.dataset.signature!==signature){
  rail.dataset.signature=signature;rail.replaceChildren();
  for(const option of [{id:'all',label:'All'},...model.categoryOptions]){
   const button=document.createElement('button');button.type='button';button.dataset.category=option.id;button.textContent=option.label;
   button.onclick=()=>{toolCategory=option.id;filterCatalogControls();};rail.append(button);
  }
 }
 rail.hidden=model.categories.length<=1;
 for(const button of rail.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.category===toolCategory));
 $('control-catalog-count').textContent=`${model.counts.visible} controls`;
 $('control-empty').hidden=model.counts.visible>0;
 $('control-empty-message').textContent=model.emptyReason==='workspace'?'This video has no selected tools for this workspace.':model.emptyReason==='selection'?'Choose Composition to see all scene tools.':'Try another search or category.';
 $('clear-control-search').hidden=model.emptyReason!=='search';
 $('presets').hidden=workspace==='compositing'||(selection!=='composition'&&selection!=='lighting');
 document.querySelector('.property-panel .section-caption').hidden=$('presets').hidden;
}
$('clear-control-search').onclick=()=>{toolCategory='all';$('control-search').value='';filterCatalogControls();$('control-search').focus();};
function refreshPanelPresets(){const p=parameters(),catalog=getControlCatalog(scene);for(const select of document.querySelectorAll('.panel-preset'))select.value=getControlPresets(scene,select.dataset.presetCategory).find(preset=>Object.entries(preset.values).every(([id,value])=>readControlValue(catalog.find(c=>c.id===id),p)===value))?.id??'';}
function applyToolPreset(category,id){const preset=getControlPresets(scene,category).find(p=>p.id===id);if(!preset)return;pause();if(exact){baseLook=structuredClone(exact.look??baseLook);values={...unpackControlValues(exact),...values};exact=null;}const catalog=getControlCatalog(scene);
 for(const [id,value]of Object.entries(preset.values)){const def=catalog.find(c=>c.id===id);if(def.binding==='value')values[def.valueId]=value;else{const target=def.path[0]==='objectEdits'?objectEdits:lookOverrides;let current=target;const keys=def.path.slice(1);for(const key of keys.slice(0,-1))current=current[key]??={};current[keys.at(-1)]=value;}}
 changed();renderCatalogControls();inspector?.sync();motionPanel?.sync();inspector?.record();$('version-status').textContent=preset.label+' · save a version';}

$('control-scope').onchange=()=>{pause();controlManifest=createControlManifest(scene,$('control-scope').value);revision++;renderCatalogControls();inspector?.sync();motionPanel?.sync();inspector?.record();$('version-status').textContent='Control selection changed · save a version';};
$('control-search').oninput=filterCatalogControls;

const authoredMotionCache=new Map();let authoredTimer,authoredResolve;
function inspectAuthoredTracks({groupId,start,end,parameters:p}){
 if(scene==='objects')return getAuthoredAnimationTracks(scene,groupId,{motion:p.motion});
 const baseline=structuredClone(p);delete baseline.animation;delete baseline.inspect;delete baseline.review;
 const key=JSON.stringify([scene,groupId,start,end,baseline]);clearTimeout(authoredTimer);authoredTimer=0;authoredResolve?.([]);authoredResolve=null;if(authoredMotionCache.has(key)){finishPreviewWaiters();return authoredMotionCache.get(key);}
 return new Promise(resolve=>{authoredResolve=resolve;authoredTimer=setTimeout(()=>{authoredTimer=0;authoredResolve=null;if($('inspector-motion').hidden||p.scene!==scene){resolve([]);finishPreviewWaiters();return;}try{const tracks=runtime.sampleAuthoredAnimation(p,groupId,{start,end,count:25,restoreTime:time,previewQuality:previewOptions().previewQuality});if(authoredMotionCache.size>=16)authoredMotionCache.delete(authoredMotionCache.keys().next().value);authoredMotionCache.set(key,tracks);resolve(tracks);}catch(error){$('version-status').textContent='Motion inspection: '+error.message;resolve([]);}finally{draw();}},140);});
}
function sceneRenderPlan(){return createRenderPlan(renderRecommendations.scenes[scene]??{});}
function parameters(){const p=exact?structuredClone(exact):resolveParameters(scene,values,preset,baseLook);p.look??=structuredClone(baseLook);p.motion??=structuredClone(baseMotion);p.look=mergeLook(p.look,lookOverrides);p.objectEdits=structuredClone(objectEdits);if(animation)p.animation=structuredClone(animation);else delete p.animation;if(soundPanel)p.sound=soundPanel.getSettings();p.renderPolicy=renderPanel?.getPlan()??validateRenderPlan(p.renderPolicy??sceneRenderPlan());p.studio={values:structuredClone(values),preset,lookOverrides:structuredClone(lookOverrides),controlManifest:structuredClone(controlManifest??createControlManifest(scene))};delete p.review;if(scene==='objects'){if($('inspect').value)p.inspect={object:$('inspect').value,yaw:20};else delete p.inspect;}return p;}
function syncReviewNote(){
 viewportToolbar.sync();
 const mode=resolvePreviewReview(scene,$('review').value);
 $('review-preview-note').hidden=mode==='beauty';
 $('review-preview-note').textContent=mode==='beauty'?'':'Preview only';
 $('review').title='Viewport inspection only. Video exports keep the final look.';
}
function syncReviewModes(){
 const value=resolvePreviewReview(scene,$('review').value),options=previewReviewModes(scene);
 $('review').replaceChildren(...options.map(option=>new Option(option.label,option.id)));
 $('review').value=value;$('preview-review-controls').hidden=options.length===1;
 syncReviewNote();
}
function previewOptions(){const settings=previewQuality?.getSettings(performance.now()<interactionUntil)??{width:960,height:540,quality:'full'};return {width:settings.width,height:settings.height,previewQuality:settings.quality,previewReview:resolvePreviewReview(scene,$('review').value)};}
function finishPreviewWaiters(){if(previewFrame||previewBusy||refineTimer||renderViewTimer||authoredTimer)return;for(const resolve of previewWaiters.splice(0))resolve();}
function syncPreviewBadge(){
 if(preparedPreview.active()){$('preview-badge').hidden=false;$('preview-badge').textContent=preparedPreview.label;$('preview-badge').setAttribute('aria-label','Actual Cycles movie with edited soundtrack');return;}
 const engine=renderPanel?.getSelection({kind:'frame'}).selectedRenderer, native=needsFinalFrame();
 if(previewQuality?.getMode()==='render'){
  const label=native?(engine==='cycles'?'Cycles':'Mixed'):(project().kind==='2d'?'Canvas':'Three.js');
  $('preview-badge').hidden=false;$('preview-badge').textContent='Render view · '+label;
  $('preview-badge').setAttribute('aria-label','Full-resolution '+label+' frame');
  $('preview-badge').title=native?'Actual frame from the selected final renderer':'Full-resolution live renderer';return;
 }
 $('preview-badge').setAttribute('aria-label','Interactive preview. Final renderer and quality may differ.');$('preview-badge').title='Interactive preview. Final renderer and quality may differ.';
 const opts=previewOptions();$('preview-badge').hidden=!(opts.previewQuality==='fast'||opts.width<exportSettings().width||['cycles','mixed'].includes(engine));
 $('preview-badge').textContent=['cycles','mixed'].includes(engine)&&project().kind!=='2d'?'Interactive · Three.js':'Fast preview';
}
function queuePreview(){if(!previewFrame){if(previewQuality?.getMode()==='render'&&!needsFinalFrame())previewQuality.setRenderState?.('rendering');previewFrame=requestAnimationFrame(renderPreview);}}
function draw(){
 clearTimeout(renderViewTimer);renderViewTimer=0;
 if(needsFinalFrame()){queuePreview();return;}
 if(previewQuality?.getMode()==='render'&&performance.now()>=interactionUntil){
  if(previewFrame){cancelAnimationFrame(previewFrame);previewFrame=0;}
  previewQuality.setRenderState?.('pending');renderViewTimer=setTimeout(()=>{renderViewTimer=0;queuePreview();},260);
 }else queuePreview();
}
function renderPreview(){previewFrame=0;previewBusy=true;const started=performance.now();try{
 const options=previewOptions();syncPreviewBadge();if(preparedPreview.render(time,playing)){finalFrameView.suspend();}else if(needsFinalFrame()){requestFinalFrame();}else{finalFrameView.suspend();runtime.render(time,{...options,parameters:parameters()});inspector?.renderComparison(time);}motionPanel?.updateTime(time);
 const f=Math.min(lastFrame,Math.round(time*fps));$('seek').value=f;$('time').textContent=`00:${String(Math.floor(f/fps)).padStart(2,'0')}:${String(f%fps).padStart(2,'0')} · F${String(f).padStart(3,'0')}`;
 document.querySelectorAll('#moments button').forEach(b=>b.classList.toggle('active',Math.abs(time-Number(b.dataset.time))<.25));if(!needsFinalFrame())previewQuality?.reportFrame(performance.now()-started);if(previewQuality?.getMode()==='render'&&!needsFinalFrame())previewQuality.setRenderState?.(performance.now()<interactionUntil?'pending':'ready',performance.now()-started);
 }catch(e){$('render-status').textContent='Preview: '+e.message;playing=false;}finally{previewBusy=false;finishPreviewWaiters();}}
function markPreviewInteraction(){scheduleRecoveryDraft();if(needsFinalFrame())previewQuality.setMode(previewQuality.getInteractiveMode());interactionUntil=performance.now()+180;clearTimeout(refineTimer);refineTimer=setTimeout(()=>{refineTimer=0;draw();},230);}
document.addEventListener('input',e=>{if(e.target.matches('.direction input,#seek'))markPreviewInteraction();},true);
window.motionPreview={whenIdle:()=>new Promise(resolve=>{previewWaiters.push(resolve);finishPreviewWaiters();}),getSettings:()=>previewOptions()};

function pause(){preparedPreview.pause();playRequest++;preparingPlay=false;soundPanel?.stop();playing=false;setIcon($('play'),'play',{label:'Play',iconOnly:true});}
function changed(){scheduleRecoveryDraft();inspector?.markChanged();if(playing||preparingPlay)pause();exact=null;revision++;$('version-status').textContent='Unsaved changes';draw();}
function controls(){const p=project();duration=sceneConfig(scene).duration;lastFrame=Math.round(duration*fps)-1;$('seek').max=lastFrame;time=Math.min(time,lastFrame/fps);const single=$('export-samples');if(![...single.options].some(o=>o.value==='1'))single.insertBefore(new Option('Off · 1 sample','1'),single.firstChild);if(![...single.options].some(o=>o.value==='4'))single.insertBefore(new Option('Light · 4 samples','4'),single.options[1]);single.disabled=['dot','replay'].includes(scene);if(isNewScene(scene))single.value=['pulse','camera'].includes(scene)?'4':'1';$('finish-shutter').disabled=['dot','replay'].includes(scene);syncExportSettings();$('dof-tools').hidden=p.kind!=='3d';soundPanel?.setScene(scene);$('project-title').textContent=p.title;$('project-kind').textContent=p.kind==='3d'?'PRODUCT FILM / 3D':p.kind==='hybrid'?'MOTION GRAPHICS / 2D + 3D':'MOTION GRAPHICS / PROCEDURAL';$('project-subtitle').textContent=p.subtitle;$('scene').value=scene;$('review-tools').hidden=p.kind!=='3d';$('advanced-toggle').hidden=publicDemo||p.kind!=='3d';$('advanced-container').hidden=true;$('advanced-toggle').setAttribute('aria-expanded','false');$('presets').replaceChildren();
 for(const choice of p.presets){const b=document.createElement('button');b.textContent=choice.label;b.classList.toggle('active',choice.id===preset);b.setAttribute('aria-pressed',String(choice.id===preset));b.onclick=()=>{lookOverrides={};preset=choice.id;values={...choice.values,...Object.fromEntries(Object.entries(values).filter(([k])=>['shell','knob','display','title'].includes(k)))};controls();changed();};$('presets').append(b);}
 previewQuality?.syncScene();syncReviewModes();renderPanel?.refresh();renderCatalogControls();
 $('moments').replaceChildren();for(const m of p.moments){const b=document.createElement('button');b.textContent=m.label;b.dataset.time=m.time;b.onclick=()=>{pause();time=m.time;draw();};$('moments').append(b);}const prefix=scene==='objects'?'objects-hard':'procedural';$('contact-link').href=scene==='pop'?demoAsset('pop-contact-sheet.png'):demoAsset('procedural-contact-sheet.png');$('preview-link').href=scene==='pop'?demoAsset('pop-motion.mp4'):demoAsset('procedural.mp4');$('final-link').href=$('preview-link').href;document.querySelector('.demo-files').hidden=scene==='objects'||isNewScene(scene);syncFinishControls();renderVersions();inspector?.sync();motionPanel?.sync();}
for(const p of studioProjects){const o=document.createElement('option');o.value=p.id;o.textContent=p.title;$('scene').append(o);}
$('scene').onchange=()=>{scene=$('scene').value;toolCategory='all';$('control-search').value='';animation=undefined;controlManifest=undefined;baseMotion=structuredClone(savedMotion);lookOverrides={};objectEdits={};inspector?.resetScene();values={};preset='original';exact=null;time=0;pause();$('review').value='beauty';$('inspect').value='';controls();changed();};
$('play').onclick=async()=>{if(playing||preparingPlay)return pause();if(previewQuality?.getMode()==='render')previewQuality.setMode(previewQuality.getInteractiveMode());if(time>=lastFrame/fps)time=0;inspector?.stopCompare();const request=++playRequest;preparingPlay=true;try{if(!await preparedPreview.play(time))await soundPanel.play(time);}catch(e){$('sound-status').textContent='Audio: '+e.message;}if(request!==playRequest)return;preparingPlay=false;playing=true;last=performance.now();setIcon($('play'),'pause',{label:'Pause',iconOnly:true});};$('seek').max=lastFrame;$('seek').oninput=()=>{markPreviewInteraction();pause();time=Number($('seek').value)/fps;draw();};$('loop').onclick=()=>{loop=!loop;$('loop').setAttribute('aria-pressed',String(loop));};
$('inspect').onchange=()=>{revision++;draw();};$('review').onchange=()=>{syncReviewNote();draw();};$('reset').onclick=()=>{pause();inspector?.stopCompare();soundPanel.setSettings();toolCategory='all';$('control-search').value='';animation=undefined;controlManifest=undefined;baseMotion=structuredClone(savedMotion);lookOverrides={};objectEdits={};values={};preset='original';exact=null;baseLook=runtime.getLook();renderPanel?.setPlan(sceneRenderPlan());$('review').value='beauty';$('inspect').value='';controls();changed();};
for(const [key,id,,format] of finishFields){$(id).oninput=()=>{if(exact){values={...unpackControlValues(exact),...values};baseLook=structuredClone(exact.look??baseLook);}else baseLook=structuredClone(baseLook);baseLook.post[key]=Number($(id).value);$(id+'-value').textContent=format($(id).value);changed();};}
for(const key of ['dofEnabled','dofAuto'])$('finish-'+key).onchange=()=>{if(exact){values={...unpackControlValues(exact),...values};baseLook=structuredClone(exact.look??baseLook);}else baseLook=structuredClone(baseLook);baseLook.post[key]=$('finish-'+key).checked;changed();syncFinishControls();};
$('finish-antialias').onchange=()=>{if(exact){values={...unpackControlValues(exact),...values};baseLook=structuredClone(exact.look??baseLook);}else baseLook=structuredClone(baseLook);baseLook.post.antialias=$('finish-antialias').checked;changed();};
document.addEventListener('keydown',e=>{if($('render-dialog').open||e.target.closest('input,select,textarea,button,summary'))return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();pause();time=Math.max(0,Math.min(lastFrame/fps,time+(e.key==='ArrowLeft'?-1:1)/fps));draw();}});
function tick(now){if(playing){const audioTime=preparedPreview.currentTime()??soundPanel.currentTime();time=audioTime??(time+Math.min((now-last)/1000,.2));if(time>=duration){if(loop){time=0;pause();$('play').click();}else{time=lastFrame/fps;pause();}}if(now-lastDraw>=1000/fps||!playing){draw();lastDraw=now;}}last=now;requestAnimationFrame(tick);}
function download(name,blob){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=async()=>{pause();if(preparedPreview.active()){const blob=await preparedPreview.capture();if(blob)download(`framevolve-${scene}-${Math.round(time*fps)}-cycles.png`,blob);return;}if(needsFinalFrame()){const frame=finalFrameSurface.getReadyFrame();if(frame){const a=document.createElement('a');a.href=frame.url;a.download=`framevolve-${scene}-${Math.round(time*fps)}-${frame.engine}.png`;a.click();}else $('render-status').textContent='Wait for the rendered frame before downloading.';return;}runtime.render(time,{width,height,previewReview:resolvePreviewReview(scene,$('review').value),parameters:parameters()});$('renderCanvas').toBlob(blob=>{if(blob)download(`framevolve-${scene}-${Math.round(time*fps)}${$('review').value==='beauty'?'':'-'+$('review').value}.png`,blob);},'image/png');draw();};
function exportSettings(){const [width,height]=$('export-resolution').value.split('x').map(Number);const format=$('export-format').value;const requested=Number($('export-bitrate').value);return {width,height,fps:Number($('export-fps').value),format,bitrateMbps:format==='prores'?null:Math.max(publicDemo?1:8,Math.min(publicDemo?20:200,Number.isFinite(requested)?requested:publicDemo?10:35)),temporalSamples:publicDemo||['dot','replay'].includes(scene)?1:Number($('export-samples').value)};}
function setExportSettings(settings={}){const resolution=`${settings.width}x${settings.height}`;if([...$('export-resolution').options].some(o=>o.value===resolution))$('export-resolution').value=resolution;for(const [id,value] of [['export-fps',settings.fps],['export-format',settings.format],['export-samples',settings.temporalSamples]])if([...$(id).options].some(o=>o.value===String(value)))$(id).value=String(value);if(settings.bitrateMbps!=null&&Number.isFinite(Number(settings.bitrateMbps)))$('export-bitrate').value=Math.max(publicDemo?1:8,Math.min(publicDemo?20:200,Number(settings.bitrateMbps)));syncExportSettings();}
function syncExportSettings(){if(publicDemo){const s=exportSettings();$('export-bitrate').disabled=false;$('export-settings-note').textContent=`Browser · Three.js / Canvas · ${s.width} × ${s.height} · ${s.fps} fps. Keep this tab visible during recording.`;$('export-button-label').textContent=`Export ${browserExportCaps.extension?.toUpperCase()??'video'} `;try{localStorage.setItem(exportStorageKey,JSON.stringify(s));}catch{}return;}const settings=exportSettings();renderPanel?.refresh();const native=['cycles','mixed'].includes(renderPanel?.getSelection().selectedRenderer);$('export-samples').closest('label').hidden=native;$('native-blur-label').hidden=!native||renderPanel?.getSelection().selectedRenderer==='mixed';$('native-motion-blur').checked=settings.temporalSamples>1;$('export-bitrate').disabled=settings.format==='prores'||native;$('export-settings-note').textContent=native?'Native export uses the renderer quality settings above. Mixed keeps motion blur already present in its inputs.':settings.format==='prores'?'ProRes bitrate is managed by the codec.':`Output ${settings.width} × ${settings.height} · ${settings.fps} fps · ${settings.temporalSamples} motion blur samples.`;$('export-button-label').textContent=`Export ${settings.format==='prores'?'ProRes':settings.format==='webm'?'WebM':'MP4'} `;try{localStorage.setItem(exportStorageKey,JSON.stringify(settings));}catch{}}
$('native-motion-blur').onchange=()=>{$('export-samples').value=$('native-motion-blur').checked?'4':'1';syncExportSettings();draw();};
for(const id of ['export-resolution','export-fps','export-format','export-bitrate','export-samples'])$(id).addEventListener('change',()=>{syncExportSettings();if(previewQuality?.getMode()==='render')draw();});
if(publicDemo){const select=$('export-resolution');for(const option of [...select.options])if(!['1280x720','1920x1080'].includes(option.value))option.remove();select.value='1280x720';$('export-format').replaceChildren(new Option(browserExportCaps.extension?.toUpperCase()??'Unavailable',browserExportCaps.extension??'webm'));$('export-format').disabled=true;$('export-bitrate').min=1;$('export-bitrate').max=20;$('export-bitrate').value=10;$('export-samples').value='1';$('export-samples').closest('label').hidden=true;$('native-blur-label').hidden=true;document.querySelector('.export-popover>p').textContent='Browser recording · Three.js / Canvas. Cycles and Mixed finals render in the local app.';}
try{const saved=JSON.parse(localStorage.getItem(exportStorageKey)||'null');if(saved)setExportSettings(saved);else syncExportSettings();}catch{syncExportSettings();}
// A tab-local recovery draft survives a launcher update/reload without becoming a saved version.
let draftTimer;
const canRecoverDraft = !new URLSearchParams(location.search).has('render');
function saveRecoveryDraft(){if(!canRecoverDraft||!inspector)return;try{sessionStorage.setItem('framevolve-session-draft',JSON.stringify({version:1,snapshot:snapshot(),time,panel:document.body.dataset.panel}));}catch{}}
function scheduleRecoveryDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(saveRecoveryDraft,350);}
window.addEventListener('beforeunload',saveRecoveryDraft);
if(import.meta.hot)import.meta.hot.on('vite:beforeFullReload',saveRecoveryDraft);
document.addEventListener('change',scheduleRecoveryDraft);
function snapshot(){return {config:sceneConfig(scene),parameters:parameters(),start:0,end:duration,temporalSamples:exportSettings().temporalSamples,exportSettings:exportSettings()};}
$('download-recipe').onclick=()=>download(`framevolve-${scene}.project.json`,new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));
function restore(data){assertSafeControlDocument(data);data=migrateLegacyScene(data);const p=data.parameters;if(!p||!studioProjects.some(s=>s.id===p.scene))throw Error('Incompatible recipe: no supported scene.');resolveParameters(p.scene,p.studio?.values??{},p.studio?.preset??'original',p.look??baseLook);const restoredRenderPlan=validateRenderPlan(p.renderPolicy);const restoredAnimation=p.animation===undefined?undefined:validateParameterAnimation(p.animation,p.scene);const restoredManifest=resolveControlManifest(p.studio?.controlManifest,p.scene);baseMotion=structuredClone(validateAuthoredMotion(p?.motion??savedMotion,{cutDuration:sceneConfig(p.scene).duration}));animation=restoredAnimation;controlManifest=restoredManifest;lookOverrides=structuredClone(p?.studio?.lookOverrides??{});objectEdits=structuredClone(p?.objectEdits??{});soundPanel.setSettings(p.sound);scene=p.scene;values=p.studio?.values?structuredClone(p.studio.values):unpackControlValues(p);preset=p.studio?.preset??'original';exact=structuredClone(p);renderPanel?.setPlan(restoredRenderPlan);if(p.look)baseLook=structuredClone(p.look);if(data.exportSettings)setExportSettings(data.exportSettings);$('review').value=p.review??'beauty';$('inspect').value=p.inspect?.object??'';pause();controls();draw();revision++;}
$('import-recipe').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024)throw Error('Recipe is too large.');restore(JSON.parse(await file.text()));$('version-status').textContent='Recipe imported';}catch(e){$('version-status').textContent=e.message;}finally{$('import-recipe').value='';}};
async function api(url,body){if(publicDemo){const versions=browserVersions();if(url==='')return {versions,jobs:[]};if(url==='/versions'&&body){const version={id:crypto.randomUUID(),name:body.name,scene:body.parameters.scene,snapshot:{...snapshot(),parameters:body.parameters}};localStorage.setItem(browserVersionsKey,JSON.stringify([...versions,version]));return version;}if(url.startsWith('/versions/')){const version=versions.find(v=>v.id===decodeURIComponent(url.slice(10)));if(!version)throw Error('Version not found in this browser.');return version;}throw Error('Run Framevolve locally to render video or manage project files.');}const response=await fetch('/api/studio'+url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();if(!response.ok){const error=Error(data.error||'Operation failed');error.status=response.status;throw error;}return data;}
function renderVersions(){const select=$('versions');select.replaceChildren(new Option('Choose a version…',''));for(const v of versionList.filter(v=>!v.scene||v.scene===scene))select.add(new Option(v.name,v.id));}
async function refresh(){try{const data=await api('');versionList=data.versions||[];renderVersions();showExports(data);const running=(data.jobs||[]).find(j=>['running','queued'].includes(j.status));if(running&&!activeJob)watchJob(running.id,revision);}catch(e){$('version-status').textContent='Local versions unavailable: '+e.message;}}
$('save-version').onclick=async()=>{const b=$('save-version');b.disabled=true;try{await api('/versions',{name:$('version-name').value.trim()||'Direction '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),parameters:parameters()});$('version-name').value='';await refresh();$('version-status').textContent=publicDemo?'Version saved in this browser':'Version saved in the project';}catch(e){$('version-status').textContent=e.message;}finally{b.disabled=false;}};
$('versions').onchange=async()=>{if(!$('versions').value)return;try{const v=await api('/versions/'+encodeURIComponent($('versions').value));restore(v.snapshot??v);$('version-status').textContent='Version restored';}catch(e){$('version-status').textContent=e.message;}};
function busy(on){$('render-frame').disabled=on||publicDemo;$('render-preview').disabled=on||publicDemo;$('render-final').disabled=on||(publicDemo&&!browserExportCaps.available);$('render-progress').hidden=!on;}
function jobDescription(j){const label=jobContentDescription(j);return j.engine&&j.engine!=='threejs'?(j.engine==='cycles'?'Cycles · ':'Mixed · ')+label:label;}
function jobContentDescription(j){if(j.kind==='preview')return 'Preview';const s=j.settings??jobSettings.get(j.id);if(j.kind==='frame')return s?`PNG · ${s.width} × ${s.height}`:'Frame PNG';if(j.kind!=='export')return 'Export';if(!s)return 'Export';const format=s.format==='prores'?'ProRes':s.format==='webm'?'WebM':'MP4';return `${format} · ${s.width} × ${s.height} · ${s.fps} fps${s.format==='prores'||s.bitrateMbps==null||!Number.isFinite(Number(s.bitrateMbps))?'':` · ${s.bitrateMbps} Mb/s`}`;}
function jobExtension(j){return j.extension??(j.kind==='frame'?'.png':j.settings?.format==='webm'?'.webm':j.settings?.format==='prores'?'.mov':'.mp4');}
function renderPhase(j){const percent=`${Math.round(Number(j.progress)||0)}%`;if(j.phase==='sampling')return `Frame ${percent} · sample ${j.samples||0} / ${j.totalSamples||1}`;if(j.status==='queued')return `Queued · ${jobDescription(j)}`;if(j.phase==='encoding')return `Encoding video · ${percent} · ${jobDescription(j)}`;const frames=Number(j.frames),total=Number(j.total);const frameLabel=Number.isFinite(frames)&&Number.isFinite(total)&&total>0?` · frame ${Math.max(0,Math.min(total,frames))} / ${total}`:'';return `Rendering ${percent}${frameLabel} · ${jobDescription(j)}`;}
function updateDialog(j){if(dialogJobId!==j.id)return;const image=$('render-dialog-image'),placeholder=$('render-dialog-placeholder'),link=$('render-dialog-download');const source=j.kind==='frame'&&j.status==='completed'?j.url:j.previewUrl;if(source&&image.dataset.url!==source){image.src=source;image.dataset.url=source;}image.hidden=!source;placeholder.hidden=!!source;placeholder.textContent=j.status==='failed'?friendlyError(j.error):'The frame will appear when ready.';$('render-dialog-title').textContent=j.kind==='frame'?'PNG frame':'Render preview';$('render-dialog-status').textContent=j.status==='completed'?'Render completed':j.status==='failed'?'Render failed':renderPhase(j);link.hidden=!(j.kind==='frame'&&j.status==='completed'&&j.url);if(!link.hidden){link.href=j.downloadUrl||j.url;link.download=j.filename||j.id+'.png';}}
function openRenderDialog(j){pause();if(!$('render-dialog').open)dialogReturnFocus=document.activeElement;dialogJobId=j.id;const image=$('render-dialog-image');image.removeAttribute('src');delete image.dataset.url;$('render-dialog-download').hidden=true;updateDialog(j);if(!$('render-dialog').open)$('render-dialog').showModal();$('render-dialog-close').focus();}
$('render-dialog-close').onclick=()=>$('render-dialog').close();$('render-dialog').onclose=()=>{dialogJobId=null;if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus();dialogReturnFocus=null;};$('render-live-open').onclick=()=>{if(lastLiveJob)openRenderDialog(lastLiveJob);};
function updateRenderThumbnail(j){lastLiveJob=j;const card=$('render-live'),img=$('render-live-image'),caption=$('render-live-caption');if(j.status==='failed'){card.hidden=true;return;}const source=j.previewUrl||(j.kind==='frame'&&j.status==='completed'?j.url:null);if(source&&img.dataset.url!==source){img.src=source;img.dataset.url=source;img.hidden=false;}if(!source&&img.dataset.job!==j.id){img.removeAttribute('src');delete img.dataset.url;img.hidden=true;}img.dataset.job=j.id;$('render-live-open').disabled=!source;card.hidden=false;const frames=Number(j.previewFrame??j.frames),total=Number(j.total);caption.textContent=j.phase==='encoding'?'Last frame · encoding in progress':Number.isFinite(frames)&&Number.isFinite(total)&&total>0&&frames>0?`Last frame ${Math.min(total,frames)} of ${total}`:'Waiting for the first frame…';img.alt=Number.isFinite(frames)&&frames>0?`Last completed frame, number ${frames}`:'Render preview';}
async function watchJob(id,startRevision){activeJob=id;busy(true);try{const j=await api('/jobs/'+id);$('render-progress').value=Number(j.progress)||0;$('render-status').textContent=j.status==='completed'?'Render completed'+(revision!==startRevision?' · settings captured at the start.':'.'):j.status==='failed'?'Render failed: '+friendlyError(j.error):renderPhase(j);updateRenderThumbnail(j);updateDialog(j);if(['completed','failed'].includes(j.status)){activeJob=null;busy(false);if(j.status==='completed'){$('render-result').href=j.url;$('render-result').textContent=j.kind==='frame'?'Open PNG ↗':'Open video ↗';$('render-result').hidden=false;}await refresh();return;}setTimeout(()=>watchJob(id,startRevision),1000);}catch(e){activeJob=null;busy(false);$('render-status').textContent='Renderer connection lost: '+e.message;if(dialogJobId===id)$('render-dialog-status').textContent=$('render-status').textContent;}}
async function renderJob(kind){pause();$('export-dock').open=true;$('render-status').textContent='Preparing render…';busy(true);$('render-result').hidden=true;$('render-live').hidden=true;const selected=exportSettings();const settings=kind==='frame'?{width:selected.width,height:selected.height,fps:selected.fps,temporalSamples:selected.temporalSamples}:kind==='export'?selected:null;try{const job=await api('/render',{kind,time,parameters:parameters(),...(settings?{settings}:{})});if(settings)jobSettings.set(job.id,settings);$('export-settings').open=false;if(kind==='frame'){openRenderDialog({...job,kind,settings});dialogReturnFocus=$('render-frame');}watchJob(job.id,revision);}catch(e){busy(false);$('render-status').textContent=e.message;if(kind==='frame'&&$('render-dialog').open){$('render-dialog-status').textContent='Render failed';$('render-dialog-placeholder').textContent=e.message;}}}
async function renderBrowserVideo(){
 pause();inspector?.stopCompare();const captured=snapshot(),controller=new AbortController();browserExportController=controller;
 $('export-dock').open=true;$('export-settings').open=false;$('render-result').hidden=true;$('render-live').hidden=true;$('render-progress').value=0;$('browser-export-cancel').hidden=false;busy(true);$('render-status').textContent='Preparing video…';
 try{
  const audioBuffer=captured.parameters.sound?.enabled&&browserExportCaps.supportsAudio?await soundPanel.exportBuffer(captured.parameters):undefined;draw();
  const result=await exportBrowserVideo({scene:captured.parameters.scene,parameters:captured.parameters,settings:{...captured.exportSettings,duration:captured.config.duration},audioBuffer,signal:controller.signal,onProgress:p=>{$('render-progress').value=p.percent;$('render-status').textContent=p.phase==='recording'?`Recording ${Math.round(p.percent)}% · ${p.extension.toUpperCase()}`:p.phase==='finalizing'?'Preparing download…':'Preparing video…';}});
  if(browserExportURL)URL.revokeObjectURL(browserExportURL);browserExportURL=URL.createObjectURL(result.blob);
  const link=$('render-result');link.href=browserExportURL;link.download=result.filename;link.textContent=`Download ${result.extension.toUpperCase()} ↓`;link.hidden=false;link.click();
  $('render-status').textContent=`Video ready · ${result.width} × ${result.height}${result.droppedFrameSlots>Math.max(3,result.durationRequested*result.fpsRequested*.03)?' · reduced frame rate':''}`;
 }catch(error){$('render-status').textContent=error.name==='AbortError'?'Export cancelled':'Export failed: '+error.message;}
 finally{browserExportController=null;$('browser-export-cancel').hidden=true;busy(false);draw();}
}
$('browser-export-cancel').onclick=()=>browserExportController?.abort();
$('render-frame').onclick=()=>renderJob('frame');$('render-preview').onclick=()=>renderJob('preview');$('render-final').onclick=()=>publicDemo?renderBrowserVideo():renderJob('export');
$('advanced-toggle').onclick=async()=>{const show=$('advanced-container').hidden;$('advanced-container').hidden=!show;$('advanced-toggle').setAttribute('aria-expanded',String(show));if(show&&!advancedMounted){advancedMounted=true;try{await mountReferencePanel({onRecipe:recipe=>{baseLook=structuredClone(recipe);exact=null;revision++;values.contrast=project().presets.find(p=>p.id===preset).values.contrast;syncFinishControls();draw();}});$('advanced-container').append($('reference-panel'));}catch(e){$('version-status').textContent=e.message;}}if(show)$('advanced-container').scrollIntoView({behavior:'smooth'});};$('advanced-close').onclick=()=>{$('advanced-container').hidden=true;$('advanced-toggle').setAttribute('aria-expanded','false');};
await runtime.ready;renderPanel=mountRenderPanel({container:$('renderer-settings'),getScene:()=>scene,getParameters:()=>exact??{renderPolicy:sceneRenderPlan()},getExportSettings:()=>({...exportSettings(),duration,kind:'export'}),publicDemo,onChange:()=>{revision++;$('version-status').textContent='Renderer changed · save a version';syncExportSettings();if($('review').value==='beauty'&&['cycles','mixed'].includes(renderPanel?.getSelection().selectedRenderer))previewQuality?.setMode('render');syncPreviewBadge();draw();inspector?.record();}});if(!publicDemo)api('/capabilities').then(data=>{renderPanel.setCapabilities(data.capabilities);syncExportSettings();syncPreviewBadge();draw();}).catch(()=>{});window.motionRender=renderPanel;previewQuality=mountPreviewQuality({container:$('preview-controls'),getScene:()=>scene,getOutputSettings:exportSettings,onChange:()=>{if(previewQuality?.getMode()==='render'){pause();inspector?.stopCompare();$('review').value='beauty';syncReviewNote();}draw();}});soundPanel=mountSoundPanel({runtime,parameters,onChange:()=>{revision++;$('version-status').textContent='Unsaved changes';draw();inspector?.record();},onPause:pause,getTime:()=>time});if(new URLSearchParams(location.search).has('sound'))soundPanel.setSettings({...soundPanel.getSettings(),enabled:new URLSearchParams(location.search).get('sound')!=='off'});controls();draw();motionPanel=mountMotionPanel({container:$('inspector-motion'),getScene:()=>scene,getParameters:parameters,getAnimation:()=>animation,getAuthoredTracks:inspectAuthoredTracks,getTime:()=>time,onAuthoredChange:(nextMotion,{record=true,cancelled=false}={})=>{pause();baseMotion=structuredClone(validateAuthoredMotion(nextMotion,{cutDuration:duration}));if(exact)exact.motion=structuredClone(nextMotion);authoredMotionCache.clear();revision++;$('version-status').textContent=cancelled?'Edit cancelled':'Unsaved changes';markPreviewInteraction();draw();if(record)inspector?.record();},onChange:(next,{record=true,cancelled=false}={})=>{pause();animation=next===undefined?undefined:validateParameterAnimation(next,scene);revision++;$('version-status').textContent=cancelled?'Edit cancelled':'Animation changed · save a version';markPreviewInteraction();draw();if(record)inspector?.record();},onSeek:t=>{markPreviewInteraction();pause();time=Math.max(0,Math.min(lastFrame/fps,t));draw();}});inspector=mountInspector({runtime,getScene:()=>scene,getState:snapshot,getParameters:parameters,getTime:()=>time,getPreviewOptions:previewOptions,pause,draw,restore,onWorkspaceChange:({selection})=>{if(document.body.dataset.layout==='focus')setLayout('balanced');toolCategory='all';$('control-search').value='';filterCatalogControls({selection});if(document.body.dataset.panel==='motion')motionPanel?.sync();syncDivider();},onSelectionChange:filterCatalogControls,onEdit:(path,value)=>{if(exact){baseLook=structuredClone(exact.look);exact=null;}if(path.startsWith('objectEdits.')){const parts=path.slice('objectEdits.'.length).split('.');const key=parts.pop(),id=parts.join('.');objectEdits[id]??={};objectEdits[id][key]=value;}else{const keys=path.replace(/^look\./,'').split('.');let target=lookOverrides;for(const key of keys.slice(0,-1))target=target[key]??={};target[keys.at(-1)]=value;}revision++;$('version-status').textContent='Unsaved changes';syncFinishControls();draw();},onSeek:t=>{pause();time=t;draw();}});
const liveBaseline=snapshot();
if(canRecoverDraft&&!liveRecovery){try{const draft=JSON.parse(sessionStorage.getItem('framevolve-session-draft'));if(draft?.version===1&&(!initialScene||initialScene===draft.snapshot.parameters.scene)){restore(draft.snapshot);time=Math.max(0,Math.min(lastFrame/fps,Number(draft.time)||0));if(draft.panel)inspector.setTab(draft.panel);$('version-status').textContent='Session draft recovered';}}catch{}}
draw();requestAnimationFrame(tick);if(!new URLSearchParams(location.search).has('render'))refresh();
window.motionLive=mountLiveReview({container:$('live-review'),enabled:!publicDemo&&!!import.meta.hot&&canRecoverDraft,baseline:liveBaseline,recovery:liveRecovery,getSnapshot:snapshot,
 setSnapshot:data=>{restore(data);authoredMotionCache.clear();runtime.render(time,{...previewOptions(),parameters:parameters()});inspector?.resetScene();inspector?.sync();},
 getView:()=>({scene,time,panel:document.body.dataset.panel}),setView:view=>{pause();time=Math.max(0,Math.min(lastFrame/fps,Number(view?.time)||0));if(view?.panel)inspector?.setTab(view.panel);draw();},
 isBusy:()=>!!activeJob||!!browserExportController});


function syncDivider(){const d=$('panel-divider'),horizontal=document.body.dataset.layout==='controls';d.setAttribute('aria-valuemin',horizontal?'150':'300');d.setAttribute('aria-valuemax',horizontal?String(Math.max(150,document.querySelector('.workspace').clientHeight-155)):'600');requestAnimationFrame(()=>{d.setAttribute('aria-valuenow',String(Math.round(horizontal?document.querySelector('.stage-column').getBoundingClientRect().height:document.querySelector('.direction').getBoundingClientRect().width)));});}
function setWide(wide){setLayout(wide?'focus':'balanced');}
function setLayout(layout){if(layout==='controls'&&document.body.dataset.experience==='easy')layout='balanced';if(!['balanced','controls','focus'].includes(layout))layout='balanced';document.body.dataset.layout=layout;document.body.classList.toggle('wide-view',layout==='focus');for(const option of ['balanced','controls','focus'])$('layout-'+option).setAttribute('aria-pressed',String(option===layout));$('panel-divider').setAttribute('aria-orientation',layout==='controls'?'horizontal':'vertical');$('wide-view').setAttribute('aria-pressed',String(layout==='focus'));syncDivider();try{localStorage.setItem('motion-lab-layout',layout);localStorage.setItem('motion-lab-studio-ui-v2','1');}catch{}}
for(const option of ['balanced','controls','focus'])$('layout-'+option).onclick=()=>setLayout(option);
function setExperience(mode){
 mode=mode==='pro'?'pro':'easy';document.body.dataset.experience=mode;
 for(const option of ['easy','pro'])$('experience-'+option).setAttribute('aria-pressed',String(option===mode));
 if(mode==='easy'&&(document.body.dataset.panel==='code'||document.body.dataset.layout==='controls')){setLayout('balanced');if(document.body.dataset.panel==='code')inspector?.setTab('look');}
 try{localStorage.setItem('motion-lab-experience',mode);}catch{}
}
for(const mode of ['easy','pro'])$('experience-'+mode).onclick=()=>setExperience(mode);
try{setExperience(localStorage.getItem('motion-lab-experience'));}catch{setExperience('easy');}
$('wide-view').onclick=()=>setWide(document.body.dataset.layout!=='focus');
try{setLayout(localStorage.getItem('motion-lab-studio-ui-v2')?localStorage.getItem('motion-lab-layout')||'balanced':'balanced');const w=Number(localStorage.getItem('motion-lab-studio-properties-width'))||348;document.documentElement.style.setProperty('--inspector-width',Math.max(300,Math.min(600,w))+'px');for(const panel of ['motion','code']){const pw=Number(localStorage.getItem('motion-lab-studio-'+panel+'-width'));if(pw)document.documentElement.style.setProperty('--'+panel+'-width',Math.max(300,Math.min(600,pw))+'px');}const h=Number(localStorage.getItem('motion-lab-preview-height'));if(h>=150)document.documentElement.style.setProperty('--preview-height',Math.min(h,innerHeight*.6)+'px');}catch{setLayout('balanced');}
const divider=$('panel-divider');let resizing=false;
function resizePanels(e){if(!resizing)return;const r=document.querySelector('.workspace').getBoundingClientRect();if(document.body.dataset.layout==='controls'){const h=Math.max(150,Math.min(r.height-155,e.clientY-r.top));document.documentElement.style.setProperty('--preview-height',h+'px');divider.setAttribute('aria-valuenow',String(Math.round(h)));try{localStorage.setItem('motion-lab-preview-height',h);}catch{}}else{const panel=['motion','code'].includes(document.body.dataset.panel)?document.body.dataset.panel:'properties',rail=document.querySelector('.scene-browser').getBoundingClientRect().width;const w=Math.max(300,Math.min(600,r.width-rail-245,r.right-e.clientX));document.documentElement.style.setProperty(panel==='properties'?'--inspector-width':'--'+panel+'-width',w+'px');divider.setAttribute('aria-valuenow',String(Math.round(w)));try{localStorage.setItem('motion-lab-studio-'+panel+'-width',w);}catch{}}}
divider.onpointerdown=e=>{resizing=true;divider.setPointerCapture(e.pointerId);document.body.classList.add('resizing');};divider.onpointermove=resizePanels;divider.onpointerup=()=>{resizing=false;document.body.classList.remove('resizing');};divider.onpointercancel=divider.onpointerup;
divider.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const r=document.querySelector('.workspace').getBoundingClientRect();resizing=true;const box=divider.getBoundingClientRect();resizePanels({clientX:box.x+(e.key==='ArrowLeft'?-20:20),clientY:box.y+(e.key==='ArrowUp'?-20:20)});resizing=false;};
function friendlyError(message){return /sources changed/i.test(message||'')?'Sources changed during rendering. Start a new export after editing.':message||'Unknown error';}
function showExports(data){if(publicDemo){$('export-count').textContent='';$('export-folder').textContent='Browser videos download to your device. Cycles and Mixed finals render locally.';$('export-list').replaceChildren();return;}const list=$('export-list');list.replaceChildren();const jobs=data.jobs||[];$('export-count').textContent=jobs.length?`· ${jobs.length}`:'';$('export-folder').textContent='Destination: '+(data.outputDirectory||data.outputDir||'project folder / renders / studio');if(!jobs.length){const p=document.createElement('p');p.className='empty-exports';p.textContent='No exports yet. Rendered videos are saved here automatically.';list.append(p);}for(const j of jobs.slice(0,12)){const row=document.createElement('div');row.className='export-row';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=jobDescription(j)+' · '+j.scene;const detail=document.createElement('small');detail.textContent=j.status==='completed'?(j.outputPath||j.filename||j.id+jobExtension(j)):j.status==='failed'?friendlyError(j.error):'Rendering in progress';info.append(name,detail);row.append(info);if(j.status==='completed'){const open=j.kind==='frame'?document.createElement('button'):document.createElement('a');if(j.kind==='frame'){open.type='button';open.onclick=()=>openRenderDialog(j);open.textContent='View';}else{open.href=j.url;open.target='_blank';open.rel='noopener';open.textContent='Open';}const save=document.createElement('a');save.href=j.downloadUrl||j.url;save.download=j.filename||j.id+jobExtension(j);save.textContent='Download';const reveal=document.createElement('button');reveal.textContent='Finder';reveal.onclick=async()=>{try{await api('/jobs/'+j.id+'/reveal',{});}catch(e){$('render-status').textContent=e.message;}};row.append(open,save,reveal);}else{const badge=document.createElement('span');badge.className=j.status==='failed'?'failed':'pending';badge.textContent=j.status==='failed'?'Failed':'In progress';row.append(badge);}list.append(row);}}

if(publicDemo){busy(false);$('render-progress').hidden=true;for(const id of ['render-frame','render-preview'])$(id).hidden=true;$('render-final').title=browserExportCaps.available?'Record this film in the browser · Three.js / Canvas':browserExportCaps.reason;$('export-settings').hidden=false;$('render-status').textContent=browserExportCaps.available?'Ready · browser video export':browserExportCaps.reason;document.querySelector('.delivery .eyebrow').textContent='BROWSER EXPORT';document.querySelector('.studio-brand').href='../';document.querySelector('.studio-status>span').innerHTML='<i class="live-dot"></i> Interactive web demo';document.querySelector('.browser-bottom p').textContent='Changes stay in this browser.';}

const requestedPanel=new URLSearchParams(location.search).get('panel');if(['look','motion','compositing','audio','versions','code'].includes(requestedPanel)){if(requestedPanel==='code')setExperience('pro');setLayout('balanced');$('tab-'+requestedPanel).click();}

// Horizontal tabs on small screens retain the same keyboard and focus model.
const compactNavigation=matchMedia('(max-width:700px)');
function syncNavigation(){document.querySelector('.inspector-tabs').setAttribute('aria-orientation',compactNavigation.matches?'horizontal':'vertical');syncDivider();}
compactNavigation.addEventListener('change',syncNavigation);syncNavigation();
window.addEventListener('resize',syncDivider);
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(!$('advanced-container').hidden){$('advanced-close').click();$('advanced-toggle').focus();}else if($('export-settings').open){$('export-settings').open=false;$('export-settings').querySelector('summary').focus();}});
document.addEventListener('pointerdown',event=>{if($('export-settings').open&&!$('export-settings').contains(event.target))$('export-settings').open=false;});
