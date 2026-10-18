// Viewport display modes are transient: never part of a saved recipe.
const shapes={
 wireframe:'<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.5" ry="8"/><path d="M4 12h16M6 7.5h12M6 16.5h12"/>',
 clay:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" opacity=".55"/>',
 normals:'<circle cx="12" cy="12" r="8"/><path d="m12 4 0 8 7 4M12 12l-7 4"/><path d="M12 4v8l7 4a8 8 0 0 0-7-12" fill="currentColor" opacity=".4"/>',
 clean:'<circle cx="12" cy="12" r="8"/><circle cx="9" cy="9" r="2" fill="currentColor" stroke="none"/><path d="M9 19a8 8 0 0 0 10-10" stroke-width="3"/>',
 beauty:'<circle cx="11" cy="13" r="7"/><path d="m18 2 1.3 3.7L23 7l-3.7 1.3L18 12l-1.3-3.7L13 7l3.7-1.3Z" fill="currentColor" stroke="none"/><path d="M7 13a4 4 0 0 0 4 4"/>',
};
export function mountViewportToolbar({container,select,onChange}){
 select.hidden=true;
 const group=document.createElement('div');group.className='viewport-shading';group.setAttribute('role','radiogroup');group.setAttribute('aria-label','Viewport shading');
 const caption=document.createElement('span');caption.className='viewport-mode-name';caption.setAttribute('aria-live','polite');container.append(group,caption);
 function sync(){
  const options=[...select.options],signature=options.map(o=>o.value).join(',');
  if(group.dataset.modes!==signature){
   group.dataset.modes=signature;group.replaceChildren();
   for(const id of ['wireframe','clay','normals','clean','beauty']){
    const option=options.find(o=>o.value===id);if(!option)continue;
    const button=document.createElement('button');button.type='button';button.dataset.mode=id;button.setAttribute('role','radio');button.setAttribute('aria-label',option.textContent);button.title=id==='beauty'?'Final look · render with the selected engine':option.textContent+' · preview only';
    button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">'+shapes[id]+'</svg>';
    button.onclick=()=>{select.value=id;sync();onChange();};group.append(button);
   }
  }
  for(const button of group.children){const active=button.dataset.mode===select.value;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;}
  caption.textContent=options.find(o=>o.value===select.value)?.textContent??'';
 }
 group.onkeydown=e=>{const buttons=[...group.children],i=buttons.indexOf(document.activeElement);if(i<0)return;let next;if(['ArrowRight','ArrowDown'].includes(e.key))next=(i+1)%buttons.length;else if(['ArrowLeft','ArrowUp'].includes(e.key))next=(i+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].click();buttons[next].focus();};
 return {sync};
}
