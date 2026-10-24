import {easyIcon} from './easy-icons.js';
import {getControlCatalog} from '../engine/control-catalog.js';
import {easyControlsFor,easyChoiceState,applyEasyChoice,easySliderAmount,applyEasyAmount} from '../engine/easy-controls.js';
import './easy-panel.css';

const expandedHelp=new Set();
let sliderEditing=false;

export function renderEasyPanel({scene,manifest,getSnapshot,onApply,onPro,onAppDemo}){
 let root=document.getElementById('easy-controls');
 if(!root){root=document.createElement('section');root.id='easy-controls';root.setAttribute('aria-label','Easy scene controls');document.getElementById('inspector-look').prepend(root);}
 if(sliderEditing)return;
 root.replaceChildren();
 const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 const snapshot=getSnapshot();
 const groups=easyControlsFor(scene,manifest),catalog=getControlCatalog(scene);
 root.append(node('p','Choose a setting to preview the change.','easy-intro'));
 if(scene==='appdemo'){
  const edit=node('button','Edit screens & text','easy-edit-content');edit.type='button';edit.onclick=onAppDemo;root.append(edit);
 }
 const feedback=node('p','','easy-feedback');feedback.setAttribute('role','status');feedback.hidden=true;
 for(const group of groups){
  const state=easyChoiceState(group,snapshot.parameters,catalog),card=node('fieldset','','easy-card');
  const legend=node('legend','','easy-label'),label=node('span',group.label),help=node('button','?','easy-info'),description=node('p',group.help,'easy-help');
  const helpKey=scene+':'+group.id;description.id='easy-help-'+group.id;description.hidden=!expandedHelp.has(helpKey);
  help.type='button';help.setAttribute('aria-label','About '+group.label);help.setAttribute('aria-controls',description.id);help.setAttribute('aria-expanded',String(!description.hidden));
  help.onclick=()=>{description.hidden=!description.hidden;help.setAttribute('aria-expanded',String(!description.hidden));if(description.hidden)expandedHelp.delete(helpKey);else expandedHelp.add(helpKey);};
  if(group.icon){const glyph=node('span','','easy-category-icon');glyph.innerHTML=easyIcon(group.icon);label.prepend(glyph);}
  label.className='easy-label-text';
  legend.append(label,help);card.append(legend,description);
  const choices=node('div','','easy-choices');
  if(group.presentation==='slider'){
   const amount=easySliderAmount(group,snapshot.parameters,catalog),slider=node('input'),value=node('output','','easy-slider-value');slider.type='range';slider.min=0;slider.max=100;slider.step=1;slider.value=amount??50;slider.disabled=state.animated;slider.dataset.easySlider=group.id;slider.setAttribute('aria-label',group.label);slider.setAttribute('aria-describedby',description.id);
   const updateLabel=()=>{const v=Number(slider.value),anchor=group.choices[v===0?0:v===50?1:v===100?2:-1];value.textContent=anchor?.label??Math.round(v)+'%';slider.setAttribute('aria-valuetext',value.textContent);slider.style.setProperty('--easy-fill',v+'%');};updateLabel();if(amount===null){value.textContent='Custom';slider.setAttribute('aria-valuetext','Custom settings');}
   legend.insertBefore(value,help);const rail=node('div','','easy-slider');rail.append(slider);
   const anchors=node('div','','easy-slider-anchors');
   for(const [index,choice]of group.choices.entries()){const b=node('button',choice.label);b.type='button';b.disabled=state.animated;b.onclick=()=>onApply(applyEasyAmount(getSnapshot(),group,index*50));anchors.append(b);}rail.append(anchors);card.append(rail);
   let baseline;
   const start=()=>{baseline??=getSnapshot();};
   slider.addEventListener('pointerdown',start);slider.addEventListener('keydown',e=>{if(e.key!=='Escape')start();});
   slider.oninput=()=>{try{start();sliderEditing=true;updateLabel();onApply(applyEasyAmount(getSnapshot(),group,Number(slider.value)),{record:false});}catch(error){sliderEditing=false;feedback.textContent=error.message;feedback.hidden=false;}};
   slider.onchange=()=>{sliderEditing=false;baseline=undefined;onApply(applyEasyAmount(getSnapshot(),group,Number(slider.value)));document.querySelector(`[data-easy-slider="${group.id}"]`)?.focus();};
   const cancel=()=>{if(!baseline)return;const saved=baseline;baseline=undefined;sliderEditing=false;onApply(saved,{record:false});document.querySelector(`[data-easy-slider="${group.id}"]`)?.focus();};
   slider.addEventListener('pointercancel',cancel);slider.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();}});
   if(state.animated)card.append(node('small','Custom animation · adjust this in Pro','easy-note'));else if(amount===null)card.append(node('small','Custom settings kept until you move the slider.','easy-note'));
   root.append(card);continue;
  }
  if(group.choices.every(c=>c.icon))choices.classList.add('easy-icon-choices');
  for(const choice of group.choices){const button=node('button',choice.label);button.type='button';button.dataset.easyChoice=group.id+':'+choice.id;button.setAttribute('aria-pressed',String(state.selected===choice.id));button.disabled=state.animated;if(choice.icon){button.textContent='';const glyph=node('span','','easy-choice-icon');glyph.innerHTML=easyIcon(choice.icon);button.append(glyph,node('span',choice.label));button.setAttribute('aria-label',choice.label);button.title=choice.label;}
   button.onclick=()=>{try{onApply(applyEasyChoice(getSnapshot(),group,choice.id));document.querySelector(`[data-easy-choice="${group.id}:${choice.id}"]`)?.focus();}catch(error){feedback.textContent=error.message;feedback.hidden=false;}};choices.append(button);
  }
  card.append(choices);if(state.animated)card.append(node('small','Custom animation · adjust this in Pro','easy-note'));else if(!state.selected)card.append(node('small','Custom settings kept until you choose an option.','easy-note'));
  root.append(card);
 }
 if(!groups.length)root.append(node('p','This project needs its own Easy controls. Ask your agent to define them for this scene.','easy-help'));
 const footer=node('footer','','easy-footer'),pro=node('button','Open Pro controls','easy-pro-link');pro.type='button';pro.onclick=onPro;const arrow=node('span','→');arrow.setAttribute('aria-hidden','true');pro.append(arrow);footer.append(pro);root.append(feedback,footer);
}
