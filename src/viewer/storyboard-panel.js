import {setIcon,icon} from './studio-icons.js';
import {parameterKey} from './creative-model.js';
import './storyboard-panel.css';

export function mountStoryboard({container,getState,pause,seek,createRuntime,nativeThumbnail,isBusy=()=>false}){
 const toolbar=document.createElement('div');toolbar.className='story-mode-switch';toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','View mode');
 toolbar.innerHTML='<button id="story-mode" type="button" aria-pressed="false"></button><button id="video-mode" type="button" aria-pressed="true"></button>';
 const previewToolbar=container.querySelector('#preview-controls .preview-mode-toolbar');
 (previewToolbar??container.querySelector('#preview-controls')).prepend(toolbar);
 const board=document.createElement('section');board.id='storyboard';board.hidden=true;board.setAttribute('aria-label','Storyboard');
 board.innerHTML='<div class="story-top"><div><p class="eyebrow">LAYOUTS BEFORE MOTION</p><h2 id="story-title">Your storyboard</h2></div><button id="story-refresh" type="button">Refresh previews</button></div><p id="story-status" role="status"></p><div id="story-empty" hidden><h3>Compose the scenes first.</h3><p>Ask your agent to build the actual layouts in this project and name the scenes. Previews will appear here. The same objects, typography and cameras will then be animated.</p><button id="story-copy-request" type="button">Copy storyboard request</button></div><div id="story-content" hidden><figure class="story-hero"><img id="story-hero" alt=""><figcaption><span id="story-position"></span><h3 id="story-name"></h3><details class="story-notes"><summary>Scene notes</summary><div><p id="story-intent"></p><p id="story-motion"></p></div></details></figcaption></figure><div class="story-navigation"><button id="story-previous" type="button">Previous scene</button><button id="story-edit" type="button">Open scene in editor</button><button id="story-next" type="button">Next scene</button></div><nav id="story-cards" aria-label="Storyboard scenes"></nav><p class="story-footnote">Procedural layouts use native previews; other scenes use interactive previews.</p></div>';
 (container.querySelector('.preview-strip')??container.querySelector('.stage-heading')).after(board);
 const $=id=>document.getElementById(id);
 for(const [id,name,label]of [['story-mode','panels','Storyboard'],['video-mode','video','Video'],['story-refresh','reset','Refresh previews'],['story-previous','left','Previous scene'],['story-edit','external','Open scene in editor'],['story-next','right','Next scene']]){setIcon($(id),name,{label,iconOnly:true});$(id).classList.add('quiet');}
 const notes=board.querySelector('.story-notes summary');notes.innerHTML=icon('info');notes.setAttribute('aria-label','Scene notes');notes.title='Scene notes';
 let token='',data=null,mode='video',selectedId=null,images=new Map(),generation=0,renderKey='',loading=false,scene='',lastPoll=0,disposed=false;
 try{mode=sessionStorage.getItem('framevolve-view-mode')==='storyboard'?'storyboard':'video';selectedId=sessionStorage.getItem('framevolve-story-shot');}catch{}
 const message=value=>{$('story-status').textContent=value;};
 function clearImages(){for(const image of images.values())if(image.startsWith('blob:'))URL.revokeObjectURL(image);images=new Map();}
 const node=(tag,content,cls)=>{const el=document.createElement(tag);if(content!==undefined)el.textContent=content;if(cls)el.className=cls;return el;};
 const button=(label,fn)=>{const el=node('button',label);el.type='button';el.onclick=fn;return el;};
 async function api(route,body){const response=await fetch('/__framevolve_session/'+route,{cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Framevolve-Session':token},body:JSON.stringify(body)})});const result=await response.json();if(!response.ok)throw Error(result.error||'Storyboard data unavailable.');if(result.token)token=result.token;return result;}
 async function copy(value,target='story-status'){try{await navigator.clipboard.writeText(value);$(target).textContent='Copied. Paste into your agent in this project.';}catch{const area=node('textarea');area.value=value;area.rows=8;area.setAttribute('aria-label','Copy this request');$('story-empty').append(area);area.focus();area.select();$(target).textContent='Select and copy the request, then paste into your agent.';}}
 function currentShot(){return data?.board?.shots.find(s=>s.id===selectedId)??data?.board?.shots[0];}
 function select(id){if(!data?.board)return;selectedId=id;const shots=data.board.shots,shot=currentShot(),index=shots.indexOf(shot);if(!shot)return;
 try{sessionStorage.setItem('framevolve-story-shot',selectedId);}catch{}
 const image=images.get(shot.id);$('story-hero').hidden=!image;if(image)$('story-hero').src=image;$('story-hero').alt=shot.name+' — storyboard layout preview';
 $('story-name').textContent=shot.name;$('story-position').textContent=`${index+1} / ${shots.length}`;$('story-intent').textContent=shot.intent;$('story-motion').textContent=shot.motion?'Planned motion: '+shot.motion:'';
 $('story-previous').disabled=index===0;$('story-next').disabled=index===shots.length-1;
 for(const card of $('story-cards').children){const active=card.dataset.id===shot.id;card.setAttribute('aria-current',String(active));if(active){const rail=$('story-cards'),left=card.offsetLeft;if(left<rail.scrollLeft)rail.scrollLeft=left;else if(left+card.offsetWidth>rail.scrollLeft+rail.clientWidth)rail.scrollLeft=left+card.offsetWidth-rail.clientWidth;}}
 }
 function drawCards(){const shots=data?.board?.shots??[];$('story-empty').hidden=shots.length>0;$('story-content').hidden=!shots.length;$('story-title').textContent=data?.board?.title??'Your storyboard';$('story-cards').replaceChildren();
 for(const [index,shot]of shots.entries()){const card=button('',()=>select(shot.id));card.dataset.id=shot.id;card.className='story-card';card.setAttribute('aria-label',shot.name);card.title=shot.name;const img=node('img');img.alt=shot.name;const image=images.get(shot.id);if(image)img.src=image;else img.hidden=true;card.append(img,node('small',String(index+1).padStart(2,'0')),node('strong',shot.name));$('story-cards').append(card);}
 if(shots.length)select(shots.some(s=>s.id===selectedId)?selectedId:shots[0].id);
 }
 async function generate(force=false){if(mode!=='storyboard'||!data?.board||disposed)return;if(['editing','blocked'].includes(data.phase)){message('Your agent is editing. Showing the last completed layouts.');return;}if(isBusy()){message('Previews will refresh when the active render finishes.');return;}
 const state=getState(),key=data.sourceRevision+parameterKey(state.snapshot);if(!force&&key===renderKey)return;renderKey=key;const epoch=++generation,shots=data.board.shots;clearImages();drawCards();let runtime;
 try{const cfg=state.snapshot.config,scale=Math.min(640/cfg.width,360/cfg.height),width=Math.max(64,Math.round(cfg.width*scale)),height=Math.max(64,Math.round(cfg.height*scale));let canvas;
 for(const [index,shot]of shots.entries()){if(epoch!==generation||mode!=='storyboard'||disposed)return;message(`Rendering native layouts ${index+1} / ${shots.length}…`);
 if(state.scene==='procedural'&&nativeThumbnail)images.set(shot.id,await nativeThumbnail(state.snapshot.parameters,shot.time,width,height));
 else{if(!runtime){canvas=document.createElement('canvas');runtime=createRuntime(canvas,{initialScene:state.scene});await runtime.ready;}runtime.render(shot.time,{width,height,previewQuality:'full',previewReview:'beauty',parameters:state.snapshot.parameters});images.set(shot.id,canvas.toDataURL('image/png'));}
 drawCards();await new Promise(resolve=>setTimeout(resolve,0));}
 message('Layouts rendered from your project. Browse scenes before watching the animation.');
 }catch(e){renderKey='';message('Could not render the layout: '+e.message);}finally{runtime?.dispose();}
 }
 async function refresh(force=false){if(loading||disposed)return;loading=true;try{const state=getState(),result=await api('creative?scene='+encodeURIComponent(state.scene));const live=window.motionLive?.getState?.();if(data?.board&&((live?.paused||live?.pending)&&result.sourceRevision!==data.sourceRevision)){message('Live updates are paused or waiting. Keeping the previous storyboard.');return;}const changed=scene!==state.scene||data?.sourceRevision!==result.sourceRevision;scene=state.scene;data=result;
 if(changed&&data.phase!=='editing'){clearImages();renderKey='';drawCards();}if(force)renderKey='';await generate(force);
 }catch(e){message(e.message);}finally{loading=false;}}
 function setMode(next){pause();mode=next;document.body.dataset.creativeMode=next;board.hidden=next!=='storyboard';$('story-mode').setAttribute('aria-pressed',String(next==='storyboard'));$('video-mode').setAttribute('aria-pressed',String(next==='video'));
 try{sessionStorage.setItem('framevolve-view-mode',next);}catch{}
 if(next==='storyboard')refresh();else{generation++;renderKey='';}}
 $('story-mode').onclick=()=>setMode('storyboard');$('video-mode').onclick=()=>setMode('video');$('story-refresh').onclick=()=>refresh(true);
 $('story-previous').onclick=()=>{const shots=data?.board?.shots??[],i=shots.indexOf(currentShot());if(i>0)select(shots[i-1].id);};$('story-next').onclick=()=>{const shots=data?.board?.shots??[],i=shots.indexOf(currentShot());if(i<shots.length-1)select(shots[i+1].id);};
 $('story-edit').onclick=()=>{const shot=currentShot();if(shot){setMode('video');seek(shot.time);}};
 $('story-copy-request').onclick=()=>copy(`Use motion-lab-product-film and its native-storyboard reference. Build the real static layouts first in scene ${getState().scene}, using the supplied product assets, typography and cameras. Register 3–6 named poses with node scripts/creative.mjs storyboard FILE. Show them in Studio Storyboard mode; then animate those same scene elements. Do not generate unrelated images or substitute screenshots for editable layouts.`,'story-status');
 board.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();$(e.key==='ArrowLeft'?'story-previous':'story-next').click();}});
 const timer=setInterval(()=>{if(document.hidden)return;const state=getState();if(mode==='storyboard'&&(state.scene!==scene||Date.now()-lastPoll>4000)){lastPoll=Date.now();refresh();}},1200);
 window.addEventListener('beforeunload',()=>{disposed=true;generation++;clearInterval(timer);});setMode(mode);
 return {get mode(){return mode;},refresh,setMode};
}
