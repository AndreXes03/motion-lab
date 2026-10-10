import './reference-panel.css';
import lightingPresets from '../../project/lighting-presets.json';

const CONTROLS = [
  ['camera','fov','Grandangolo',32,85,1,'°','Aumenta per accentuare la prospettiva e includere più scena. La camera resta nella stessa posizione.'],
  ['lighting','key','Luce principale',0,500,1,'','Illumina il soggetto dall’alto e di lato. Aumenta per rendere più forti le zone colpite dalla luce.'],
  ['lighting','fill','Luce nelle ombre',0,1,.005,'','Aumenta per schiarire le parti scure. Riduci per ottenere ombre più profonde e maggiore contrasto.'],
  ['lighting','rim','Luce sui bordi',0,5,.1,'','Aumenta il riflesso lungo il profilo del prodotto, separandolo dallo sfondo.'],
  ['surface','shellRoughness','Plastica della radio',.1,1,.01,'','A sinistra: riflessi lucidi e definiti. A destra: riflessi più larghi e una plastica più opaca.'],
  ['post','exposure','Luminosità generale',.3,2,.01,'','Schiarisce o scurisce tutta la scena 3D, senza cambiare la posizione delle luci.'],
  ['post','bloomStrength','Alone sulle luci',0,.4,.01,'','Aggiunge un bagliore morbido intorno ai riflessi più brillanti. Valori bassi mantengono i dettagli.'],
  ['post','aberrationPx','Frange di colore',0,12,.1,' px','Separa rosso e blu soprattutto ai bordi. Valori alti producono frange marcate; il logo sovrapposto resta nitido.'],
  ['post','lensDistortion','Curvatura della lente',0,.6,.01,'','Piega le linee dritte verso i bordi, come un obiettivo fisheye. Include un ritaglio per evitare angoli neri.'],
  ['post','shutterAngle','Scia nel video esportato',0,360,15,'°','Aumenta il motion blur nel rendering video a più campioni. Questo controllo non simula il blur nel playback live del viewer.'],
  ['post','vignette','Vignettatura',0,.6,.01,'','Scurisce gradualmente i bordi e concentra lo sguardo al centro.'],
  ['post','aoIntensity','Ombre nelle giunzioni',0,1,.05,'','Rafforza il contatto tra anelli, incastri e superfici vicine.'],
  ['motion','amount','Ampiezza dei movimenti',0,1.5,.01,'','0 ferma camera e oggetti nella posa iniziale; 1 usa il movimento previsto; oltre 1 lo amplifica. La durata del video resta invariata.']
];
const ROLES = [
  ['look', 'Stile e materiali'],
  ['camera', 'Movimento camera'],
  ['elements', 'Movimento oggetti']
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
  if (!response.ok) throw new Error(data?.error || data?.message || `Richiesta fallita (${response.status})`);
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
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

/** Mounts a local, agent-facing reference and look panel below the viewer. */
export async function mountReferencePanel({ onRecipe = () => {} } = {}) {
  const main = document.querySelector('main');
  if (!main) throw new Error('Il viewer non contiene <main>.');
  const panel = el('section', 'reference-panel');
  panel.id = 'reference-panel';
  const header = el('div', 'reference-panel__header');
  const heading = el('div');
  heading.append(el('p', 'reference-panel__eyebrow', 'REFERENCE / LOOK DEVELOPMENT'));
  heading.append(el('h2', '', 'Direzione visiva'));
  const hint = el('p', 'reference-panel__hint', 'Carica immagini o video per guidare l’agente. Le reference non trasformano automaticamente la scena 3D.');
  header.append(heading, hint);
  const status = el('p', 'reference-panel__status');
  status.setAttribute('role', 'status');
  const grid = el('div', 'reference-panel__grid');
  const refsBox = el('div', 'reference-panel__card');
  refsBox.append(el('h3', '', 'Reference'));
  const refsList = el('div', 'reference-panel__refs');
  const fileForm = el('form', 'reference-panel__form');
  const file = el('input'); file.type = 'file'; file.accept = 'image/*,video/*'; file.required = true;
  file.setAttribute('aria-label', 'Immagine o video reference');
  const fileRole = roleSelect();
  const fileNote = el('input'); fileNote.type = 'text'; fileNote.placeholder = 'Nota per l’agente';
  fileNote.setAttribute('aria-label', 'Nota sulla reference');
  const upload = el('button', '', 'Carica file'); upload.type = 'submit';
  fileForm.append(file, fileRole, fileNote, upload);
  const linkForm = el('form', 'reference-panel__form reference-panel__form--link');
  const link = el('input'); link.type = 'url'; link.required = true; link.placeholder = 'https://…';
  link.setAttribute('aria-label', 'URL della reference');
  const linkRole = roleSelect();
  const linkNote = el('input'); linkNote.type = 'text'; linkNote.placeholder = 'Nota per l’agente';
  linkNote.setAttribute('aria-label', 'Nota sul link');
  const addLink = el('button', '', 'Aggiungi link'); addLink.type = 'submit';
  linkForm.append(link, linkRole, linkNote, addLink);
  refsBox.append(refsList, fileForm, linkForm);

  const lookBox = el('div', 'reference-panel__card');
  lookBox.append(el('h3', '', 'Aspetto della scena'));
  const presetBox=el('div','reference-panel__preset');
  const presetLabel=el('label','','Schema luci');
  const presetSelect=el('select');presetSelect.setAttribute('aria-label','Schema luci');
  const custom=el('option','','Personalizzato');custom.value='custom';presetSelect.append(custom);
  for(const [id,preset] of Object.entries(lightingPresets)){const option=el('option','',preset.label);option.value=id;presetSelect.append(option)}
  const presetHint=el('p','reference-panel__control-help');
  presetLabel.append(presetSelect);presetBox.append(presetLabel,presetHint);
  const sliders = el('div', 'reference-panel__sliders');
  const actions = el('div', 'reference-panel__actions');
  const save = el('button', 'reference-panel__primary', 'Salva aspetto');
  const download = el('button', '', 'Esporta impostazioni');
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
      refsList.append(el('p', 'reference-panel__empty', 'Nessuna reference. Aggiungi un file o un link per definire la direzione.'));
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
        const anchor = el('a', 'reference-panel__external', 'Apri reference ↗');
        anchor.href = ref.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
        card.append(anchor);
      }
      const copy = el('div', 'reference-panel__ref-copy');
      copy.append(el('strong', '', ROLES.find(([value]) => value === ref.role)?.[1] || ref.role || 'Reference'));
      copy.append(el('span', '', ref.name || ref.filename || ref.url || localPath || ref.id || 'Senza nome'));
      if (ref.note) copy.append(el('p', '', ref.note));
      card.append(copy);
      refsList.append(card);
    }
  }
  function renderControls() {
    presetSelect.value=look.lighting.preset||'custom';presetHint.textContent=lightingPresets[presetSelect.value]?.description||'Illuminazione modificabile con i controlli qui sotto.';
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
        if(group==='lighting'){look.lighting.preset='custom';presetSelect.value='custom';presetHint.textContent='Illuminazione modificata a mano. Salva aspetto per conservarla.';}
        value.textContent = `${input.value}${unit}`;
        onRecipe(structuredClone(look));
        message('Modifiche in anteprima. Premi Salva aspetto per conservarle.');
      });
      row.append(name, input, value, hint);
      sliders.append(row);
    }
  }
  presetSelect.addEventListener('change',()=>{const preset=lightingPresets[presetSelect.value];if(!preset)return;look.lighting=structuredClone(preset.lighting);renderControls();onRecipe(structuredClone(look));message('Schema luci applicato in anteprima. Salva aspetto per conservarlo.');});
  async function reload() {
    const project = await request('/api/project');
    if (!project?.look || typeof project.look !== 'object') throw new Error('Il progetto non contiene impostazioni visive valide.');
    look = structuredClone(project.look);
    references = Array.isArray(project.references) ? project.references : [];
    renderReferences();
    renderControls();
    onRecipe(structuredClone(look));
    message('Aspetto e reference caricati dal progetto locale.');
  }
  fileForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!file.files?.[0]) return;
    upload.disabled = true;
    message('Caricamento reference…');
    try {
      const selected = file.files[0];
      await request('/api/references', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selected.name, role: fileRole.value, note: fileNote.value.trim(), data: await readAsBase64(selected) })
      });
      fileForm.reset();
      await reload();
      message('Reference salvata nel progetto locale.');
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
      message('Link salvato nel progetto locale.');
    } catch (error) { message(error.message, true); }
    finally { addLink.disabled = false; }
  });
  save.addEventListener('click', async () => {
    if (!look) return;
    save.disabled = true;
    try {
      await request('/api/look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(look) });
      message('Aspetto salvato nel progetto locale.');
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
