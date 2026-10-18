import {icon} from './studio-icons.js';
import {sceneConfig} from '../scene-registry.js';
import {getAuthoredAnimationProtocol} from '../engine/authored-animation.js';
import {resolveControlManifest} from '../engine/control-catalog.js';
const sceneSources={starter:'product-starter.js',dot:'mascot-demo.js',pulse:'pulse-demo.js',camera:'afterhours-demo.js',replay:'replay-demo.js',objects:'objects.js',pop:'pop-demo.js',procedural:'procedural-demo.js'};
/** A focused view of the live recipe. Native values appear once, in their actual write shape. */
export function buildAnimationHandoff(scene,parameters,config=sceneConfig(scene)){
  const protocol=getAuthoredAnimationProtocol(scene,{motion:parameters.motion,animation:parameters.animation});
  const manifest=resolveControlManifest(parameters.studio?.controlManifest,scene);
  const native=protocol.groups.some(group=>group.source.editable);
  return {
    format:'motion-lab.animation-handoff',version:1,scene,
    timebase:{fps:config.fps,duration:config.duration,unit:'seconds',frameToTime:'frame / fps'},
    source:{module:`src/scenes/${sceneSources[scene]}`,nativeMotion:native?structuredClone(parameters.motion??null):null},
    schema:{
      parameterRoot:'parameters',recipePaths:protocol.recipePaths,interpolation:protocol.interpolation,
      groups:protocol.groups.map(({timing,source,...group})=>({...group,source:{...source,channels:source.channels.map(({keys,description,...channel})=>channel)}})),
      parameterTracks:{timeDomain:protocol.parameterTracks.timeDomain,sampling:protocol.parameterTracks.sampling},
      groupTiming:{time:'clip-local seconds from group.start',value:'normalized source progress [0,1]',sourceTime:'group.start + progress * (group.end - group.start)',rate:'multiplies the group-local sampling time; [0.25,2.5]'},
    },
    animation:structuredClone(parameters.animation??null),
    controls:{manifestVersion:manifest.version,ids:[...manifest.controls]},
    writeTargets:{nativeMotion:native?'parameters.motion':null,retimingAndControls:'parameters.animation',...(native?{defaultSourceFile:'project/motion.json'}:{functionSource:`src/scenes/${sceneSources[scene]}`}),scope:'Merge only requested animation changes into the existing recipe; this handoff is not an importable full recipe.'},
    invariants:[
      'Native key times are strictly increasing scene seconds within duration; values retain the channel units.',
      'Vector components share key times and outgoing easing; an axis value edit preserves the other components.',
      'Group retiming changes only that group pose clock; film time, cuts, captions and unrelated groups stay fixed.',
      'Evaluated samples are read-only observations, not native editable keys. Empty sample channels mean no runtime samples were included.',
      'Preserve hidden animation tracks, unrelated parameters and deterministic absolute-time seeking.',
    ],
  };
}
const $=id=>document.getElementById(id);
export function mergeLook(base,patch){const result=structuredClone(base);for(const [key,value] of Object.entries(patch??{}))result[key]=value&&typeof value==='object'&&!Array.isArray(value)?mergeLook(result[key]??{},value):value;return result;}
const objects=[['device.root','Radio','Material · display'],['objects.kinetic','Gyroscope','Shape · motion'],['objects.emblem','Emblem','Shape · motion']];
export function mountInspector({runtime,getScene,getState,getParameters,getTime,getPreviewOptions,pause,draw,restore,onEdit,onSeek,onWorkspaceChange=()=>{},onSelectionChange=()=>{}}){
  let selection='composition',tab='look',reference=structuredClone(getState()),comparing=false,previous=structuredClone(getState()),history=[],future=[],pending=null,replaying=false,sourceRequest=0;
  const image=$('comparison-image'),canvas=$('renderCanvas');
  if(!$('code-view').querySelector('option[value="animation"]'))$('code-view').add(new Option('Animation handoff','animation'));
  const names={composition:'Composition',camera:'Camera',lighting:'Lights',...Object.fromEntries(objects.map(o=>[o[0],o[1]]))};
  const versions=document.querySelector('.versions');$('inspector-versions').append(versions);versions.open=true;
  const sound=$('sound-tools');$('inspector-audio').append(sound);sound.open=true;
  document.querySelector('.demo-files').open=false;
  $('timeline-meta').textContent=`${runtime.config.duration} s · ${runtime.config.fps} fps · 1920 × 1080`;
  for(let i=0;i<=runtime.config.duration;i++){const tick=document.createElement('span');tick.textContent=String(i).padStart(2,'0');$('timeline-ruler').append(tick);}
  const tabs=['look','motion','compositing','audio','versions','code'];
  const workspaces={look:['SCENE','Properties'],motion:['MOTION','Animation'],compositing:['COMPOSITING','Image & effects'],audio:['AUDIO','Sound & music'],versions:['VERSIONS','Saved variations'],code:['CODE','Animation & source']};
  function setTab(next){
    if(!tabs.includes(next))return;
    tab=next;document.body.dataset.panel=tab;
    document.querySelector('.direction').scrollTop=0;
    if(['look','compositing'].includes(tab))$('inspector-'+tab).append($('workspace-catalog'));
    for(const name of tabs){
      $('tab-'+name).setAttribute('aria-selected',String(name===tab));
      $('tab-'+name).tabIndex=name===tab?0:-1;
      $('inspector-'+name).hidden=name!==tab;
    }
    const [kicker,title]=workspaces[tab];
    $('workspace-kicker').textContent=kicker;$('workspace-title').textContent=title;
    $('selection-title').hidden=!['look','compositing'].includes(tab);
    $('selection-title').textContent=tab==='compositing'?'Final image · tools for this video':names[selection];
    $('code-toggle').setAttribute('aria-pressed',String(tab==='code'));
    document.body.classList.toggle('code-open',tab==='code');
    if(document.body.dataset.layout==='focus')$('layout-balanced').click();
    $('review-tools').hidden=tab!=='look'||getScene()!=='objects';
    $('presets').hidden=tab!=='look'||(selection!=='composition'&&selection!=='lighting');
    document.querySelector('.property-panel .section-caption').hidden=$('presets').hidden;
    // Catalog controls keep the same DOM nodes, handlers and saved values.
    onWorkspaceChange({workspace:tab,selection});
    if(tab==='code')updateCode();
  }
  for(const name of tabs){
    $('tab-'+name).onclick=()=>setTab(name);
    $('tab-'+name).onkeydown=e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
      e.preventDefault();
      const forward=['ArrowRight','ArrowDown'].includes(e.key);
      const available=tabs.filter(name=>$('tab-'+name).getClientRects().length);
      const index=e.key==='Home'?0:e.key==='End'?available.length-1:(available.indexOf(tab)+(forward?1:available.length-1))%available.length;
      setTab(available[index]);$('tab-'+available[index]).focus();
    };
  }
  $('code-toggle').onclick=()=>setTab(tab==='code'?'look':'code');$('code-close').onclick=()=>setTab('look');
  function record(){if(replaying)return;const state=getState();if(JSON.stringify(state.parameters)!==JSON.stringify(previous.parameters)){history.push(pending??previous);history=history.slice(-40);future=[];previous=structuredClone(state);pending=null;$('edit-status').textContent='Preview changes';}$('undo-edit').disabled=!history.length;$('redo-edit').disabled=!future.length;if(tab==='code'&&['recipe','animation'].includes($('code-view').value))updateCode();}
  document.querySelector('.direction').addEventListener('pointerdown',e=>{if(e.target.matches('input,select,button')&&!pending)pending=structuredClone(getState());},true);
  document.querySelector('.direction').addEventListener('focusin',e=>{if(e.target.matches('input,select')&&!pending)pending=structuredClone(getState());});
  document.querySelector('.direction').addEventListener('change',()=>record());
  document.querySelector('.direction').addEventListener('click',e=>{if(e.target.closest('#presets,#reset'))queueMicrotask(record);});
  function replay(state){replaying=true;pause();stopCompare();restore(state);previous=structuredClone(getState());pending=null;sync();draw();replaying=false;$('edit-status').textContent='Version restored';$('undo-edit').disabled=!history.length;$('redo-edit').disabled=!future.length;}
  $('undo-edit').onclick=()=>{record();if(!history.length)return;future.push(structuredClone(getState()));replay(history.pop());};
  $('redo-edit').onclick=()=>{if(!future.length)return;history.push(structuredClone(getState()));replay(future.pop());};
  document.addEventListener('keydown',e=>{if(!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='z'||e.target.closest('input,textarea'))return;e.preventDefault();$(e.shiftKey?'redo-edit':'undo-edit').click();});
  function select(id){selection=id;setTab('look');sync();}
  function buildTree(){const list=$('scene-tree');list.replaceChildren();$('mobile-selection').replaceChildren();const is3d=getScene()==='objects';$('scene-count').textContent=is3d?'06':'01';const items=[['composition','Composition','Full sequence'],...(is3d?objects:[]),...(is3d?[['camera','Camera','Framing'],['lighting','Lights','Studio']]:[])];for(const [id,title,description]of items){const option=new Option(title,id);option.selected=selection===id;$('mobile-selection').add(option);const button=document.createElement('button');button.className='scene-item';button.dataset.object=id;button.setAttribute('aria-pressed',String(selection===id));const glyph=document.createElement('span');glyph.className='scene-glyph';glyph.innerHTML=icon(id==='composition'?'scene':id==='camera'?'camera':id==='lighting'?'lights':'object');const info=document.createElement('span');const label=document.createElement('strong');label.textContent=title;const detail=document.createElement('small');detail.textContent=description;info.append(label,detail);button.append(glyph,info);button.onclick=()=>select(id);list.append(button);}}
  function sync(){const cfg=sceneConfig(getScene());$('timeline-meta').textContent=`${cfg.duration} s · ${cfg.fps} fps · 1920 × 1080`;$('timeline-ruler').replaceChildren();for(let i=0;i<=cfg.duration;i++){const tick=document.createElement('span');tick.textContent=String(i).padStart(2,'0');$('timeline-ruler').append(tick);}const is3d=getScene()==='objects';document.body.classList.toggle('single-composition',!is3d);if(!is3d)selection='composition';buildTree();$('selection-title').textContent=names[selection];$('selection-hint').hidden=!is3d;$('selection-hint').textContent=selection==='composition'?'Select an object in the scene':({camera:'Camera selected',lighting:'Lights selected','device.root':'Radio selected','objects.kinetic':'Gyroscope selected','objects.emblem':'Emblem selected'}[selection]);$('context-controls').replaceChildren();const p=getParameters();const showAll=selection==='composition';
    $('presets').hidden=tab!=='look'||(!showAll&&selection!=='lighting');
    document.querySelector('.property-panel .section-caption').hidden=$('presets').hidden;
    $('dof-tools').hidden=true;$('finish-tools').hidden=true;$('review-tools').hidden=!is3d||tab!=='look';
    if(tab==='compositing')$('selection-title').textContent='Final image · tools for this video';
    onSelectionChange({selection,workspace:tab});
    if(tab==='code')updateCode();
  }
  $('mobile-selection').onchange=()=>select($('mobile-selection').value);
  canvas.addEventListener('click',e=>{if(getScene()!=='objects'||comparing)return;pause();const r=canvas.getBoundingClientRect(),ratio=16/9;const w=Math.min(r.width,r.height*ratio),h=w/ratio,x=(e.clientX-r.left-(r.width-w)/2)/w,y=(e.clientY-r.top-(r.height-h)/2)/h;if(x<0||x>1||y<0||y>1)return;const id=runtime.pickObject(x,y);if(id)select(id);});
  $('pin-reference').onclick=()=>{pause();reference=structuredClone(getState());$('edit-status').textContent='Reference updated';$('pin-reference').textContent='Reference pinned';draw();};
  function stopCompare(){comparing=false;$('compare-toggle').setAttribute('aria-pressed','false');for(const id of ['comparison-layer','comparison-current','comparison-divider','comparison-line'])$(id).hidden=true;}
  $('compare-toggle').onclick=()=>{pause();comparing=!comparing;if(comparing){$('compare-toggle').setAttribute('aria-pressed','true');for(const id of ['comparison-layer','comparison-current','comparison-divider','comparison-line'])$(id).hidden=false;draw();}else{stopCompare();draw();}};
  function updateSplit(){const value=$('comparison-divider').value;$('comparison-layer').style.clipPath=`inset(0 ${100-value}% 0 0)`;$('comparison-line').style.left=value+'%';}
  $('comparison-divider').oninput=updateSplit;updateSplit();
  function renderComparison(time){if(!comparing)return;runtime.render(time,{...(getPreviewOptions?.()??{width:960,height:540}),parameters:reference.parameters});image.src=canvas.toDataURL('image/png');runtime.render(time,{...(getPreviewOptions?.()??{width:960,height:540}),parameters:getParameters()});}
  function resetScene(){stopCompare();history=[];future=[];selection='composition';pending=null;queueMicrotask(()=>{reference=structuredClone(getState());previous=structuredClone(getState());$('edit-status').textContent='Original';record();});}
  async function updateCode(){
    const request=++sourceRequest,view=$('code-view').value;
    $('code-status').textContent='';
    if(view==='animation'){
      $('code-description').textContent='Live animation data · units, bindings and write targets';
      try{$('code-content').textContent=JSON.stringify(buildAnimationHandoff(getScene(),getParameters()),null,2);}
      catch(error){$('code-content').textContent='';$('code-status').textContent=`Animation data unavailable: ${error.message}`;}
      return;
    }
    if(view==='recipe'){
      const state=getState();
      $('code-content').textContent=JSON.stringify({parameters:state.parameters,exportSettings:state.exportSettings,config:state.config},null,2);
      $('code-description').textContent='Live recipe · current scene settings';return;
    }
    $('code-description').textContent='Scene source · read only';
    try{
      const module=await (getScene()==='starter'?import('../scenes/product-starter.js?raw'):getScene()==='dot'?import('../scenes/mascot-demo.js?raw'):getScene()==='pulse'?import('../scenes/pulse-demo.js?raw'):getScene()==='camera'?import('../scenes/afterhours-demo.js?raw'):getScene()==='replay'?import('../scenes/replay-demo.js?raw'):getScene()==='objects'?import('../scenes/objects.js?raw'):getScene()==='pop'?import('../scenes/pop-demo.js?raw'):import('../scenes/procedural-demo.js?raw'));
      if(request===sourceRequest)$('code-content').textContent=module.default;
    }catch(error){if(request===sourceRequest){$('code-content').textContent='';$('code-status').textContent=error.message;}}
  }
  $('code-view').onchange=updateCode;
  $('code-copy').onclick=async()=>{try{if(['recipe','animation'].includes($('code-view').value))await updateCode();if(!$('code-content').textContent)return;await navigator.clipboard.writeText($('code-content').textContent);$('code-status').textContent='Copied to clipboard';}catch{$('code-status').textContent='Select the text and press ⌘C';}};
  sync();setTab('look');
  return {getSelection:()=>selection,setTab,sync,resetScene,stopCompare,renderComparison,markChanged(){if(tab==='code'&&['recipe','animation'].includes($('code-view').value))queueMicrotask(updateCode);},record};
}
