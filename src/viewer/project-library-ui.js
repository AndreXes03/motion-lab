import './project-library.css';
import { icon } from './studio-icons.js';

const TRUST_NOTICE = 'Project files can contain executable scene code. Only open projects you trust.';
const NEW_NOTE = 'Starts a fresh Procedural scene; your current project is saved first.';
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};

/** Mount the compact native project controls into a viewer-owned container. */
export function mountProjectLibraryUI({ container, actions = {}, isBusy = () => false } = {}) {
  if (!container) throw new TypeError('mountProjectLibraryUI requires a container');
  const root = document.createElement('div');
  root.className = 'project-library';
  root.innerHTML = `
    <div class="project-library-identity">
      <span class="project-library-name" data-project-name>Untitled project</span>
      <span class="project-library-status" data-project-status role="status" aria-live="polite"></span>
    </div>
    <div class="project-library-controls">
      <button type="button" class="project-library-icon" data-save aria-label="Save project" title="Save project" aria-keyshortcuts="Control+S Meta+S">${icon('save')}</button>
      <div class="project-library-menu-wrap">
        <button type="button" class="project-library-icon" data-menu-toggle aria-label="Project collection" title="Project collection" aria-haspopup="menu" aria-expanded="false">${icon('folder')}</button>
        <div class="project-library-menu" data-menu role="menu" aria-label="Project collection" hidden>
          <button type="button" role="menuitem" data-new>${icon('add')}<span>New project</span></button>
          <button type="button" role="menuitem" data-open-file>${icon('folder')}<span>Open .framevolve file</span></button>
          <button type="button" role="menuitem" data-recent aria-haspopup="menu" aria-expanded="false">${icon('time')}<span>Recent projects</span><span class="project-library-chevron">›</span></button>
          <div class="project-library-recent" data-recent-list role="menu" aria-label="Recent projects" hidden></div>
          <button type="button" role="menuitem" data-manage><span>Manage projects &amp; Trash</span></button>
          <div class="project-library-menu-separator" role="separator"></div>
          <button type="button" role="menuitem" data-export>${icon('export')}<span>Export portable project</span></button>
        </div>
      </div>
      <input class="project-library-file" data-file type="file" accept=".framevolve" tabindex="-1" aria-hidden="true">
    </div>
    <dialog class="project-library-dialog" data-dialog aria-labelledby="project-dialog-title">
      <form data-new-form>
        <h2 id="project-dialog-title">New project</h2>
        <label for="project-library-new-name">Project name</label>
        <input id="project-library-new-name" name="name" type="text" maxlength="100" required autocomplete="off">
        <p class="project-library-note">${NEW_NOTE}</p>
        <p class="project-library-error" data-dialog-error role="alert" hidden></p>
        <div class="project-library-dialog-actions"><button type="button" class="project-library-secondary" data-cancel>Cancel</button><button type="submit" class="project-library-primary" data-create>Create project</button></div>
      </form>
    </dialog>
    <dialog class="project-library-dialog project-library-trust-dialog" data-trust-dialog aria-labelledby="project-trust-title">
      <div>
        <h2 id="project-trust-title">Open imported project?</h2>
        <p class="project-library-trust-copy" data-trust-copy>${TRUST_NOTICE}</p>
        <div class="project-library-warning-wrap" data-warning-wrap hidden><strong>Portability notes</strong><ul data-warning-list></ul></div>
        <p class="project-library-error" data-trust-error role="alert" hidden></p>
        <div class="project-library-dialog-actions"><button type="button" class="project-library-secondary" data-trust-keep>Keep in collection</button><button type="button" class="project-library-primary" data-trust-open>Open project</button></div>
      </div>
    </dialog>
    <dialog class="project-library-dialog project-library-manage-dialog" data-manage-dialog aria-labelledby="project-manage-title">
      <h2 id="project-manage-title">Your projects</h2>
      <p class="project-library-note">Projects stay on this Mac. Trash keeps projects and their assets until you restore them.</p>
      <div data-manage-list></div>
      <p class="project-library-error" data-manage-error role="alert" hidden></p>
      <div class="project-library-dialog-actions"><button type="button" data-manage-close>Done</button></div>
    </dialog>
    <dialog class="project-library-dialog" data-scene-dialog aria-labelledby="project-scene-title">
      <h2 id="project-scene-title">Open example</h2>
      <p class="project-library-trust-copy" data-scene-copy></p>
      <label for="project-example-name">New project name</label><input id="project-example-name" maxlength="100" autocomplete="off">
      <p class="project-library-note">New project keeps your current project in the collection. Replace current project keeps a recoverable copy under “before…” in Recent projects, then starts this example in the current project. The scene and its Undo history will reset after you choose.</p>
      <div class="project-library-dialog-actions project-library-scene-actions"><button type="button" data-scene-cancel>Cancel</button><button type="button" data-scene-replace>Replace current</button><button type="button" class="project-library-primary" data-scene-new>New project</button></div>
    </dialog>
    <dialog class="project-library-dialog project-library-export-dialog" data-export-dialog aria-labelledby="project-export-title">
      <h2 id="project-export-title">Review portable project</h2>
      <p class="project-library-trust-copy" data-export-copy></p>
      <details><summary data-export-included></summary><ul class="project-library-export-files" data-export-files></ul></details>
      <div class="project-library-warning-wrap"><strong>Missing or external references</strong><ul data-export-warnings></ul></div>
      <div class="project-library-warning-wrap"><strong>Required on the other computer</strong><ul data-export-requirements></ul></div>
      <p class="project-library-note" data-export-limitations></p>
      <div class="project-library-dialog-actions"><button type="button" data-export-cancel>Cancel</button><button type="button" class="project-library-primary" data-export-continue>Download .framevolve</button></div>
    </dialog>`;
  container.append(root);

  const $ = selector => root.querySelector(selector);
  const menu = $('[data-menu]'), toggle = $('[data-menu-toggle]'), recentList = $('[data-recent-list]');
  const dialog = $('[data-dialog]'), trustDialog = $('[data-trust-dialog]'), nameInput = $('#project-library-new-name'), fileInput = $('[data-file]');
  let state = { active: null, projects: [], status: 'unsaved', working: false };
  let internalBusy = false, disposed = false;
  let dialogReturnFocus = null;
  let pendingTrustRecord = null, recentSignature = null, managementSignature = null, nameAction = null, sceneResolve = null, exportResolve = null;
  const manageDialog=$('[data-manage-dialog]'), sceneDialog=$('[data-scene-dialog]'), exportDialog=$('[data-export-dialog]');

  const busy = () => internalBusy || !!state.working || (typeof isBusy === 'function' ? !!isBusy() : !!isBusy);
  const setDisabled = () => {
    root.classList.toggle('is-busy', busy());
    $('[data-save]').disabled = busy();
    toggle.disabled = busy();
    $('[data-create]').disabled = busy();
    for(const button of root.querySelectorAll('[data-project-action]'))button.disabled=busy()||(button.dataset.projectAction==='trash'&&button.dataset.id===state.active?.id);
  };
  const statusText = current => {
    if (current.message) return current.message;
    return ({ loading: 'Loading…', saving: 'Saving…', saved: 'Saved', error: 'Could not save', unsaved: 'Unsaved changes' })[current.status] || '';
  };
  function render(current = {}) {
    state = { ...state, ...current };
    $('[data-project-name]').textContent = state.active?.name || 'Untitled project';
    const status = $('[data-project-status]');
    status.textContent = statusText(state);
    status.title = status.textContent;
    status.dataset.state = state.status || 'unsaved';
    const allProjects = Array.isArray(state.projects) ? state.projects : [];
    const projects = allProjects.filter(project=>!project.trashedAt);
    const signature = JSON.stringify(projects.map(project => [project.id, project.name, project.updatedAt, project.imported, !!project.customCode, project.warnings ?? project.portabilityWarnings]));
    if (signature !== recentSignature) {
      recentSignature = signature;
      recentList.replaceChildren();
      if (!projects.length) {
        const empty = document.createElement('div'); empty.className = 'project-library-empty'; empty.textContent = 'No recent projects yet'; recentList.append(empty);
      } else {
        for (const project of projects) {
          const item = document.createElement('button');
          item.type = 'button'; item.setAttribute('role', 'menuitem'); item.dataset.projectId = project.id;
          item.dataset.imported = String(!!project.imported); item.dataset.customCode = String(!!project.customCode);
          const title = document.createElement('span'); title.className = 'project-library-recent-name'; title.textContent = project.name || 'Untitled project';
          const date = document.createElement('small'); date.textContent = formatDate(project.updatedAt);
          item.append(title, date); recentList.append(item);
        }
      }
    }
    renderManagement(allProjects);
    setDisabled();
  }
  const closeMenu = ({ restoreFocus = false } = {}) => {
    menu.hidden = true; recentList.hidden = true;
    toggle.setAttribute('aria-expanded', 'false'); $('[data-recent]').setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  };
  const openMenu = () => { if (busy()) return; menu.hidden = false; toggle.setAttribute('aria-expanded', 'true'); menu.querySelector('[role=menuitem]:not([disabled])')?.focus(); };
  const announce = (message, { error = false } = {}) => {
    const status = $('[data-project-status]'); status.textContent = message || ''; status.title = status.textContent; status.dataset.state = error ? 'error' : 'notice';
  };
  async function run(action, ...args) {
    if (busy() || typeof actions[action] !== 'function') return { ok: false };
    internalBusy = true; setDisabled();
    try { const value = await actions[action](...args); return { ok: true, value }; }
    catch (error) { announce(error?.message || 'Something went wrong. Please try again.', { error: true }); return { ok: false, error }; }
    finally { internalBusy = false; if (!disposed) setDisabled(); }
  }
  function openNewDialog(record = null) {
    nameAction=record?{action:'rename',record}:null;
    $('#project-dialog-title').textContent=record?'Rename project':'New project';
    $('[data-create]').textContent=record?'Save name':'Create project';
    dialog.querySelector('.project-library-note').textContent=record?'Choose a name for this saved project.':NEW_NOTE;
    closeMenu(); $('[data-dialog-error]').hidden = true; $('[data-dialog-error]').textContent = '';
    dialogReturnFocus = toggle; dialog.showModal(); nameInput.value = record?.name||''; nameInput.focus();
  }
  function openTrustDialog(record, returnFocus = toggle) {
    pendingTrustRecord = record;
    dialogReturnFocus = returnFocus;
    const warnings = Array.isArray(record.warnings) ? record.warnings : Array.isArray(record.portabilityWarnings) ? record.portabilityWarnings : [];
    $('[data-trust-copy]').textContent = record.customCode
      ? TRUST_NOTICE
      : 'Review these portability notes before opening the imported project.';
    const warningWrap = $('[data-warning-wrap]'), warningList = $('[data-warning-list]');
    warningList.replaceChildren();
    for (const warning of warnings) {
      const item = document.createElement('li');
      item.textContent = warning && typeof warning === 'object'
        ? `${warning.reference ?? ''}${warning.reference && warning.reason ? ': ' : ''}${warning.reason ?? ''}`
        : String(warning);
      warningList.append(item);
    }
    warningWrap.hidden = warnings.length === 0;
    $('[data-trust-error]').hidden = true; $('[data-trust-error]').textContent = '';
    trustDialog.showModal(); $('[data-trust-keep]').focus();
  }
  async function openProject(record, trustCode = false) {
    const result = await run('openProject', record.id, ...(trustCode ? [{ trusted: true }] : []));
    if (result.ok) announce(`Opened ${record.name || 'project'}`);
    else if (trustCode && result.error) { const error = $('[data-trust-error]'); error.textContent = result.error.message || 'Could not open project.'; error.hidden = false; }
    return result;
  }
  $('[data-save]').addEventListener('click', async () => { const result = await run('save'); if (result.ok) announce('Saved'); });
  toggle.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
  $('[data-new]').addEventListener('click', () => openNewDialog());
  $('[data-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus(); dialogReturnFocus = null; });
  trustDialog.addEventListener('close', () => {
    pendingTrustRecord = null;
    if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus();
    dialogReturnFocus = null;
  });
  $('[data-new-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const result = nameAction?await run('manageProject','rename',nameAction.record.id,name):await run('newProject', name);
    if (result.ok) dialog.close();
    else if (result.error) { const error = $('[data-dialog-error]'); error.textContent = result.error.message || 'Could not create project.'; error.hidden = false; }
  });
  $('[data-open-file]').addEventListener('click', () => { closeMenu(); fileInput.value = ''; fileInput.click(); });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    const imported = await run('importProject', file);
    if (!imported.ok || !imported.value) return;
    const record = imported.value;
    const warnings = Array.isArray(record.warnings) ? record.warnings : Array.isArray(record.portabilityWarnings) ? record.portabilityWarnings : [];
    announce(`${record.name || file.name} was imported. ${record.customCode || warnings.length ? 'Review the project before opening.' : 'Opening project.'}`);
    if (record.customCode || warnings.length) openTrustDialog(record, toggle);
    else await openProject(record);
  });
  $('[data-export]').addEventListener('click', async () => {
    closeMenu(); const result = await run('exportProject');
    if (result.ok && result.value) announce('Portable project downloaded. Verify external references on the other computer.');
  });
  $('[data-recent]').addEventListener('click', () => {
    const button = $('[data-recent]'); const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded)); recentList.hidden = expanded;
    if (!expanded) recentList.querySelector('button')?.focus();
  });
  $('[data-trust-keep]').addEventListener('click', () => { pendingTrustRecord = null; trustDialog.close(); announce('Imported project kept in the collection.'); });
  $('[data-trust-open]').addEventListener('click', async () => {
    if (!pendingTrustRecord) return;
    const record = pendingTrustRecord;
    const result = await openProject(record, !!record.customCode);
    if (!result.ok) return;
    pendingTrustRecord = null; trustDialog.close();
  });
  recentList.addEventListener('click', async event => {
    const item = event.target.closest('[data-project-id]'); if (!item) return;
    const record = state.projects?.find(project => String(project.id) === item.dataset.projectId) || { id: item.dataset.projectId };
    closeMenu();
    const warnings = Array.isArray(record.warnings) ? record.warnings : Array.isArray(record.portabilityWarnings) ? record.portabilityWarnings : [];
    if (item.dataset.imported === 'true' && (item.dataset.customCode === 'true' || warnings.length)) openTrustDialog(record, toggle);
    else await openProject(record);
  });
  root.addEventListener('click', event => { if (!root.contains(event.target)) closeMenu(); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.open && !menu.hidden) { event.preventDefault(); closeMenu({ restoreFocus: true }); }
    if (event.key === 'ArrowDown' && event.target === toggle && menu.hidden) { event.preventDefault(); openMenu(); }
  });
  menu.addEventListener('keydown', event => {
    const items = [...menu.querySelectorAll('[role="menuitem"]')].filter(item => !item.disabled && item.getClientRects().length);
    const index = items.indexOf(event.target);
    if (index < 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); (event.key === 'Home' ? items[0] : items.at(-1))?.focus();
    } else if (event.key === 'ArrowRight' && event.target.matches('[data-recent]') && recentList.hidden) {
      event.preventDefault(); event.target.click();
    } else if (event.key === 'ArrowLeft' && recentList.contains(event.target)) {
      event.preventDefault(); recentList.hidden = true; $('[data-recent]').setAttribute('aria-expanded', 'false'); $('[data-recent]').focus();
    }
  });
  function renderManagement(projects){
    const signature=JSON.stringify([state.active?.id,projects.map(project=>[project.id,project.name,project.trashedAt])]);
    if(signature===managementSignature)return;managementSignature=signature;
    const list=$('[data-manage-list]'),focused=list.contains(document.activeElement)?{...document.activeElement.dataset}:null;list.replaceChildren();
    for(const trashed of [false,true]){
      const group=document.createElement('h3');group.textContent=trashed?'Trash':'Collection';list.append(group);
      const records=projects.filter(project=>!!project.trashedAt===trashed);
      if(!records.length){const empty=document.createElement('p');empty.className='project-library-empty';empty.textContent=trashed?'Trash is empty':'No projects yet';list.append(empty);}
      for(const project of records){
        const row=document.createElement('div');row.className='project-library-manage-row';
        const title=document.createElement('strong');title.textContent=(project.name||'Untitled project')+(project.id===state.active?.id?' · Open':'');row.append(title);
        const controls=document.createElement('div');controls.className='project-library-row-actions';
        for(const action of trashed?['restore']:['rename','duplicate','trash']){
          const button=document.createElement('button');button.type='button';button.dataset.projectAction=action;button.dataset.id=project.id;button.textContent=({rename:'Rename',duplicate:'Duplicate',trash:'Move to Trash',restore:'Restore'})[action];
          if(action==='trash'&&project.id===state.active?.id){button.disabled=true;button.title='Open another project before moving this project to Trash.';}
          controls.append(button);
        }
        row.append(controls);
        if(!trashed&&project.id===state.active?.id){const note=document.createElement('small');note.textContent='Open another project before moving this one to Trash.';row.append(note);}
        list.append(row);
      }
    }
    if(focused&&manageDialog.open&&!dialog.open){const candidates=[...list.querySelectorAll('[data-project-action]')].filter(button=>button.dataset.id===focused.id);(candidates.find(button=>button.dataset.projectAction===focused.projectAction)||candidates[0])?.focus();}
  }
  $('[data-manage]').addEventListener('click',()=>{closeMenu();$('[data-manage-error]').hidden=true;manageDialog.showModal();});
  $('[data-manage-close]').addEventListener('click',()=>manageDialog.close());
  $('[data-manage-list]').addEventListener('click',async event=>{
    const button=event.target.closest('[data-project-action]');if(!button||busy())return;
    const record=state.projects.find(project=>project.id===button.dataset.id);if(!record)return;
    if(button.dataset.projectAction==='rename'){openNewDialog(record);return;}
    const result=await run('manageProject',button.dataset.projectAction,record.id);
    if(!result.ok&&result.error){const error=$('[data-manage-error]');error.textContent=result.error.message;error.hidden=false;}
    else if(result.ok)announce(button.dataset.projectAction==='trash'?'Moved to Trash. Restore it from Manage projects & Trash.':button.dataset.projectAction==='restore'?'Project restored.':'Project duplicated.');
  });
  function chooseScene({label,active}){
    if(sceneResolve)return Promise.resolve(null);
    closeMenu();$('[data-scene-copy]').textContent=`Open “${label}” from ${active?.name||'your current project'}?`;
    $('#project-example-name').value=label||'Example project';sceneDialog.showModal();$('[data-scene-new]').focus();
    return new Promise(resolve=>{sceneResolve=resolve;});
  }
  function settleScene(value){const resolve=sceneResolve;sceneResolve=null;sceneDialog.close();resolve?.(value);}
  $('[data-scene-cancel]').addEventListener('click',()=>settleScene(null));
  $('[data-scene-replace]').addEventListener('click',()=>settleScene({mode:'replace'}));
  $('[data-scene-new]').addEventListener('click',()=>{const name=$('#project-example-name').value.trim();if(!name){$('#project-example-name').focus();return;}settleScene({mode:'new',name});});
  sceneDialog.addEventListener('close',()=>{if(sceneDialog.open)return;const resolve=sceneResolve;sceneResolve=null;resolve?.(null);});
  function addItems(selector,values,format=value=>String(value)){
    const list=$(selector);list.replaceChildren();for(const value of values){const item=document.createElement('li');item.textContent=format(value);list.append(item);}
  }
  function confirmExport(preflight){
    if(exportResolve)return Promise.resolve(false);
    $('[data-export-copy]').textContent=`“${preflight.name}” includes its saved recipe, scene files and managed local assets.`;
    $('[data-export-included]').textContent=`Included files (${preflight.files.length}) · ${(preflight.totalBytes/1024/1024).toFixed(1)} MB before compression`;
    addItems('[data-export-files]',preflight.files,file=>file.path);
    addItems('[data-export-warnings]',preflight.warnings.length?preflight.warnings:['No missing or external references detected in the references scanned.'],warning=>typeof warning==='string'?warning:`${warning.reference}: ${warning.reason}`);
    addItems('[data-export-requirements]',preflight.requirements);
    $('[data-export-limitations]').textContent=preflight.limitations;
    exportDialog.showModal();$('[data-export-cancel]').focus();return new Promise(resolve=>{exportResolve=resolve;});
  }
  function settleExport(value){const resolve=exportResolve;exportResolve=null;exportDialog.close();resolve?.(value);}
  $('[data-export-cancel]').addEventListener('click',()=>settleExport(false));
  $('[data-export-continue]').addEventListener('click',()=>settleExport(true));
  exportDialog.addEventListener('close',()=>{if(exportDialog.open)return;const resolve=exportResolve;exportResolve=null;resolve?.(false);});
  document.addEventListener('pointerdown', onOutsidePointer);
  document.addEventListener('keydown', onSaveShortcut);
  function onOutsidePointer(event) { if (!root.contains(event.target) && !menu.hidden) closeMenu(); }
  function onSaveShortcut(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      if (event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault(); $('[data-save]').click();
    }
  }
  render();

  return {
    render,chooseScene,confirmExport,
    notify: announce,
    dispose() { disposed = true; document.removeEventListener('pointerdown', onOutsidePointer); document.removeEventListener('keydown', onSaveShortcut); dialog.close(); trustDialog.close();manageDialog.close();settleScene(null);settleExport(false); root.remove(); },
  };
}
