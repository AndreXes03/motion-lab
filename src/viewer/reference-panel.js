import './reference-panel.css';
import lightingPresets from '../../project/lighting-presets.json';

const CONTROLS = [
  ['camera','fov','Field of view',32,85,1,'°','Increase for a wider view and stronger perspective.'],
  ['lighting','key','Key light',0,500,1,'','Light from above and the side. Increase for stronger highlights.'],
  ['lighting','fill','Fill light',0,1,.005,'','Increase to lighten shadows; reduce for deeper contrast.'],
  ['lighting','rim','Rim light',0,5,.1,'','Increase edge lighting to separate the object from the background.'],
  ['surface','shellRoughness','Radio roughness',.1,1,.01,'','Lower for sharp reflections; higher for matte plastic.'],
  ['post','exposure','Exposure',.3,2,.01,'','Brighten or darken the 3D scene.'],
  ['post','bloomStrength','Bloom',0,.4,.01,'','Soft glow around highlights. Lower values preserve detail.'],
  ['post','aberrationPx','Chromatic aberration',0,12,.1,' px','Separate red and blue near the edges. Overlays stay sharp.'],
  ['post','lensDistortion','Lens distortion',0,.6,.01,'','Bend lines near the edges, with cropping to avoid black corners.'],
  ['post','shutterAngle','Export motion blur',0,360,15,'°','Motion blur for multi-sample video exports. Live playback does not simulate blur.'],
  ['post','vignette','Vignette',0,.6,.01,'','Darken the edges.'],
  ['post','aoIntensity','Contact shadows',0,1,.05,'','Strengthen shadows between nearby surfaces.'],
  ['motion','amount','Motion amount',0,1.5,.01,'','0 freezes the initial pose; 1 uses the original motion; above 1 amplifies it.']
];
const ROLES = [
  ['look', 'Style and materials'],
  ['camera', 'Camera motion'],
  ['elements', 'Object motion']
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

async function request(url, options) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  return data;
}

function roleSelect() {
  const select = el('select');
  for (const [value, label] of ROLES) {
    const option = el('option', '', label);
    option.value = value;
    select.append(option);
  }
  return select;
}

function isVideo(value = '') { return /\.(mp4|mov|webm|m4v)$/i.test(value); }
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

/** Mounts a local, agent-facing reference and look panel below the viewer. */
export async function mountReferencePanel({ onRecipe = () => {} } = {}) {
  const main = document.querySelector('main');
  if (!main) throw new Error('Viewer is missing <main>.');
  const panel = el('section', 'reference-panel');
  panel.id = 'reference-panel';
  const header = el('div', 'reference-panel__header');
  const heading = el('div');
  heading.append(el('p', 'reference-panel__eyebrow', 'REFERENCE / LOOK DEVELOPMENT'));
  heading.append(el('h2', '', 'Visual direction'));
  const hint = el('p', 'reference-panel__hint', 'Add images or videos to guide your agent. References do not automatically change the scene.');
  header.append(heading, hint);
  const status = el('p', 'reference-panel__status');
  status.setAttribute('role', 'status');
  const grid = el('div', 'reference-panel__grid');
  const refsBox = el('div', 'reference-panel__card');
  refsBox.append(el('h3', '', 'Reference'));
  const refsList = el('div', 'reference-panel__refs');
  const fileForm = el('form', 'reference-panel__form');
  const file = el('input'); file.type = 'file'; file.accept = 'image/*,video/*'; file.required = true;
  file.setAttribute('aria-label', 'Reference image or video');
  const fileRole = roleSelect();
  const fileNote = el('input'); fileNote.type = 'text'; fileNote.placeholder = 'Note for your agent';
  fileNote.setAttribute('aria-label', 'Reference note');
  const upload = el('button', '', 'Upload file'); upload.type = 'submit';
  fileForm.append(file, fileRole, fileNote, upload);
  const linkForm = el('form', 'reference-panel__form reference-panel__form--link');
  const link = el('input'); link.type = 'url'; link.required = true; link.placeholder = 'https://…';
  link.setAttribute('aria-label', 'Reference URL');
  const linkRole = roleSelect();
  const linkNote = el('input'); linkNote.type = 'text'; linkNote.placeholder = 'Note for your agent';
  linkNote.setAttribute('aria-label', 'Link note');
  const addLink = el('button', '', 'Add link'); addLink.type = 'submit';
  linkForm.append(link, linkRole, linkNote, addLink);
  refsBox.append(refsList, fileForm, linkForm);

  const lookBox = el('div', 'reference-panel__card');
  lookBox.append(el('h3', '', 'Scene look'));
  const presetBox=el('div','reference-panel__preset');
  const presetLabel=el('label','','Lighting preset');
  const presetSelect=el('select');presetSelect.setAttribute('aria-label','Lighting preset');
  const custom=el('option','','Custom');custom.value='custom';presetSelect.append(custom);
  for(const [id,preset] of Object.entries(lightingPresets)){const option=el('option','',preset.label);option.value=id;presetSelect.append(option)}
  const presetHint=el('p','reference-panel__control-help');
  presetLabel.append(presetSelect);presetBox.append(presetLabel,presetHint);
  const sliders = el('div', 'reference-panel__sliders');
  const actions = el('div', 'reference-panel__actions');
  const save = el('button', 'reference-panel__primary', 'Save look');
  const download = el('button', '', 'Export settings');
  save.type = download.type = 'button';
  actions.append(save, download);
  lookBox.append(presetBox, sliders, actions);
  grid.append(refsBox, lookBox);
  panel.append(header, status, grid);
  main.append(panel);

  let look;
  let references = [];
  const message = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle('reference-panel__status--error', error);
  };
  function renderReferences() {
    refsList.replaceChildren();
    if (!references.length) {
      refsList.append(el('p', 'reference-panel__empty', 'No references yet. Add a file or link.'));
      return;
    }
    for (const ref of references) {
      const card = el('article', 'reference-panel__ref');
      const localPath = ref.path || (ref.filename ? `project/references/${ref.filename}` : null);
      const source = localPath ? `/${String(localPath).replace(/^\/+/, '')}` : ref.url;
      if (localPath && (ref.kind === 'video' || isVideo(localPath))) {
        const media = el('video'); media.src = source; media.controls = true; media.muted = true; media.preload = 'metadata';
        card.append(media);
      } else if (localPath) {
        const media = el('img'); media.src = source; media.alt = ref.note || ref.name || 'Reference'; media.loading = 'lazy';
        card.append(media);
      } else if (ref.url) {
        const anchor = el('a', 'reference-panel__external', 'Open reference ↗');
        anchor.href = ref.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
        card.append(anchor);
      }
      const copy = el('div', 'reference-panel__ref-copy');
      copy.append(el('strong', '', ROLES.find(([value]) => value === ref.role)?.[1] || ref.role || 'Reference'));
      copy.append(el('span', '', ref.name || ref.filename || ref.url || localPath || ref.id || 'Untitled'));
      if (ref.note) copy.append(el('p', '', ref.note));
      card.append(copy);
      refsList.append(card);
    }
  }
  function renderControls() {
    presetSelect.value=look.lighting.preset||'custom';presetHint.textContent=lightingPresets[presetSelect.value]?.description||'Adjust lighting with the controls below.';
    sliders.replaceChildren();
    for (const [group, key, label, min, max, step, unit, help] of CONTROLS) {
      const current = look?.[group]?.[key];
      if (typeof current !== 'number') continue;
      const row = el('label', 'reference-panel__slider');
      const name = el('span', '', label);
      const hint = el('small','reference-panel__control-help',help);hint.id=`help-${group}-${key}`;
      const input = el('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = current;
      input.setAttribute('aria-label',label);input.setAttribute('aria-describedby',hint.id);
      const value = el('output', '', `${current}${unit}`);
      input.addEventListener('input', () => {
        look[group][key] = Number(input.value);
        if(group==='lighting'){look.lighting.preset='custom';presetSelect.value='custom';presetHint.textContent='Custom lighting. Save look to keep it.';}
        value.textContent = `${input.value}${unit}`;
        onRecipe(structuredClone(look));
        message('Preview changes. Save look to keep them.');
      });
      row.append(name, input, value, hint);
      sliders.append(row);
    }
  }
  presetSelect.addEventListener('change',()=>{const preset=lightingPresets[presetSelect.value];if(!preset)return;look.lighting=structuredClone(preset.lighting);renderControls();onRecipe(structuredClone(look));message('Lighting preset previewed. Save look to keep it.');});
  async function reload() {
    const project = await request('/api/project');
    if (!project?.look || typeof project.look !== 'object') throw new Error('Project has no valid look settings.');
    look = structuredClone(project.look);
    references = Array.isArray(project.references) ? project.references : [];
    renderReferences();
    renderControls();
    onRecipe(structuredClone(look));
    message('Look and references loaded from the local project.');
  }
  fileForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!file.files?.[0]) return;
    upload.disabled = true;
    message('Loading reference…');
    try {
      const selected = file.files[0];
      await request('/api/references', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selected.name, role: fileRole.value, note: fileNote.value.trim(), data: await readAsBase64(selected) })
      });
      fileForm.reset();
      await reload();
      message('Reference saved in the local project.');
    } catch (error) { message(error.message, true); }
    finally { upload.disabled = false; }
  });
  linkForm.addEventListener('submit', async event => {
    event.preventDefault();
    addLink.disabled = true;
    try {
      await request('/api/references', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.value.trim(), role: linkRole.value, note: linkNote.value.trim() })
      });
      linkForm.reset();
      await reload();
      message('Link saved in the local project.');
    } catch (error) { message(error.message, true); }
    finally { addLink.disabled = false; }
  });
  save.addEventListener('click', async () => {
    if (!look) return;
    save.disabled = true;
    try {
      await request('/api/look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(look) });
      message('Look saved in the local project.');
    } catch (error) { message(error.message, true); }
    finally { save.disabled = false; }
  });
  download.addEventListener('click', () => {
    if (!look) return;
    const blob = new Blob([JSON.stringify(look, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = el('a'); anchor.href = url; anchor.download = 'motion-lab-look.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  try { await reload(); } catch (error) { message(error.message, true); }
  return { reload, getLook: () => look && structuredClone(look) };
}
