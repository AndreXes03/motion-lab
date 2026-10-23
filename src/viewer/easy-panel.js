import {getControlCatalog} from '../engine/control-catalog.js';
import {easyControlsFor,easyChoiceState,applyEasyChoice} from '../engine/easy-controls.js';
import './easy-panel.css';

const expandedHelp=new Set();

export function renderEasyPanel({scene,manifest,getSnapshot,onApply,onPro,onAppDemo}){
 let root=document.getElementById('easy-controls');
 if(!root){root=document.createElement('section');root.id='easy-controls';root.setAttribute('aria-label','Easy scene controls');document.getElementById('inspector-look').prepend(root);}
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
  legend.append(label,help);card.append(legend,description);
  const choices=node('div','','easy-choices');
  for(const choice of group.choices){const button=node('button',choice.label);button.type='button';button.dataset.easyChoice=group.id+':'+choice.id;button.setAttribute('aria-pressed',String(state.selected===choice.id));button.disabled=state.animated;
   button.onclick=()=>{try{onApply(applyEasyChoice(getSnapshot(),group,choice.id));document.querySelector(`[data-easy-choice="${group.id}:${choice.id}"]`)?.focus();}catch(error){feedback.textContent=error.message;feedback.hidden=false;}};choices.append(button);
  }
  card.append(choices);if(state.animated)card.append(node('small','Custom animation · adjust this in Pro','easy-note'));else if(!state.selected)card.append(node('small','Custom settings kept until you choose an option.','easy-note'));
  root.append(card);
 }
 if(!groups.length)root.append(node('p','This project needs its own Easy controls. Ask your agent to define them for this scene.','easy-help'));
 const footer=node('footer','','easy-footer'),pro=node('button','Open Pro controls','easy-pro-link');pro.type='button';pro.onclick=onPro;const arrow=node('span','→');arrow.setAttribute('aria-hidden','true');pro.append(arrow);footer.append(pro);root.append(feedback,footer);
}
