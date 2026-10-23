/** Move the existing controls, preserving their handlers, state and render guards. */
export function mountToolbarOverflow(){
 const header=document.querySelector('.app-header'),delivery=header?.querySelector('.delivery-actions');if(!delivery)return;
 const menu=document.createElement('details');menu.className='studio-more';
 menu.innerHTML='<summary aria-label="More Studio actions" title="More Studio actions"><span aria-hidden="true">…</span></summary><div class="studio-more-panel"><p class="studio-more-heading">More tools</p><div data-project-actions></div><div data-layout-actions></div><div data-render-actions></div></div>';
 delivery.before(menu);const summary=menu.querySelector('summary'),project=menu.querySelector('[data-project-actions]'),layout=menu.querySelector('[data-layout-actions]'),render=menu.querySelector('[data-render-actions]');
 const appDemo=header.querySelector('.app-demo-entry');if(appDemo)project.append(appDemo);
 const slots=[['.layout-picker',layout],['#save',render],['#render-frame',render],['#render-preview',render]].map(([selector,target])=>{const el=header.querySelector(selector);if(!el)return null;const home=document.createComment('toolbar control');el.before(home);return {el,home,target};}).filter(Boolean);
 const compact=matchMedia('(max-width:1280px)');
 function place(){menu.open=false;for(const {el,home,target}of slots){if(compact.matches)target.append(el);else home.after(el);}menu.hidden=!compact.matches&&!appDemo;}
 compact.addEventListener('change',place);place();
 menu.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(menu.open)));
 menu.addEventListener('click',event=>{if(event.target.closest('button'))menu.open=false;});
 document.addEventListener('pointerdown',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();menu.open=false;summary.focus();}});
}
