import './founder-panel.css';
import {createCommercialBrief, validateCommercialBrief, briefToAgentPrompt, COMMERCIAL_LIMITS} from '../engine/commercial-brief.js';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const button = (text, className = '') => {
  const element = node('button', className, text);
  element.type = 'button';
  return element;
};
const dataURL = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(Error('This image could not be read. Try a different file.'));
  reader.readAsDataURL(blob);
});

/** Decode, resize and embed local raster files so recipes remain portable. */
async function portableImage(file, kind) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG or WebP image.');
  if (file.size > 20 * 1024 * 1024) throw Error('Choose an image smaller than 20 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw Error('This image could not be opened. Try another PNG, JPEG or WebP.'); }
  try {
    if (bitmap.width * bitmap.height > 60_000_000) throw Error('This image is too large. Resize it below 60 megapixels first.');
    const scale = Math.min(1, (kind === 'logo' ? 512 : 1280) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw Error('Image preparation is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
    if (!blob) throw Error('This image could not be prepared. Try a smaller image.');
    return {name: file.name.slice(0, COMMERCIAL_LIMITS.assetName), src: await dataURL(blob)};
  } finally { bitmap.close(); }
}

/** Guided editing of a real, fixed 24-second commercial template. No runtime AI call. */
export function mountFounderPanel({mount, getCommercial = () => null, onCreate = async () => {}} = {}) {
  if (!mount) throw Error('The commercial flow needs a mount element.');
  const trigger = button('New commercial', 'founder-trigger');
  trigger.id = 'founder-open';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'founder-dialog');
  mount.append(trigger);

  const dialog = node('dialog', 'founder-dialog');
  dialog.id = 'founder-dialog';
  dialog.setAttribute('aria-labelledby', 'founder-title');
  const form = node('form', 'founder-form');
  form.noValidate = true;
  const header = node('header', 'founder-header');
  const heading = node('div');
  heading.append(node('span', 'founder-eyebrow', 'YOUR PRODUCT. IN MOTION.'));
  const title = node('h2', '', 'Make your launch film');
  title.id = 'founder-title';
  heading.append(title, node('p', 'founder-intro', 'Your brand, your screens, a 24-second commercial.'));
  const closeButton = button('×', 'founder-close');
  closeButton.setAttribute('aria-label', 'Close commercial setup');
  header.append(heading, closeButton);
  const steps = node('ol', 'founder-steps');
  const stepsLabels = ['Product', 'Screens', 'Review'];
  const stepMarkers = stepsLabels.map((label, index) => {
    const item = node('li');
    item.append(node('span', '', String(index + 1).padStart(2, '0')), document.createTextNode(label));
    steps.append(item);
    return item;
  });
  const status = node('p', 'founder-status');
  status.id = 'founder-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const body = node('div', 'founder-body');
  const panels = stepsLabels.map((label, index) => {
    const panel = node('section', 'founder-step');
    panel.id = 'founder-step-' + index;
    panel.setAttribute('aria-label', label);
    panel.tabIndex = -1;
    body.append(panel);
    return panel;
  });
  const fields = {};
  function field(parent, key, label, limit, {placeholder = '', wide = false, required = false, type = 'text'} = {}) {
    const wrapper = node('label', 'founder-field' + (wide ? ' founder-field--wide' : ''));
    wrapper.append(node('span', '', label));
    const input = node('input');
    input.id = 'founder-' + key;
    input.name = key;
    input.type = type;
    input.maxLength = limit;
    input.placeholder = placeholder;
    input.required = required;
    input.autocomplete = 'off';
    input.setAttribute('aria-describedby', status.id);
    fields[key] = input;
    wrapper.append(input);
    parent.append(wrapper);
    return input;
  }
  const productTop = node('div', 'founder-section-heading');
  productTop.append(node('h3', '', 'What are you launching?'));
  const sample = button('Try an example', 'founder-text-action');
  productTop.append(sample);
  panels[0].append(productTop);
  const productGrid = node('div', 'founder-grid');
  field(productGrid, 'name', 'Product name', COMMERCIAL_LIMITS.brandName, {placeholder: 'Your product', required: true});
  field(productGrid, 'tagline', 'Short description · optional', COMMERCIAL_LIMITS.tagline, {placeholder: 'What your product does'});
  field(productGrid, 'headline', 'Opening headline', COMMERCIAL_LIMITS.headline, {placeholder: 'The big reason to care.', wide: true, required: true});
  const benefits = node('div', 'founder-benefits founder-field--wide');
  for (let i = 0; i < 3; i++) field(benefits, 'feature' + i, 'Benefit ' + (i + 1), COMMERCIAL_LIMITS.feature, {placeholder: ['Less busywork', 'A clearer picture', 'More room to grow'][i], required: true});
  productGrid.append(benefits);
  field(productGrid, 'cta', 'Call to action', COMMERCIAL_LIMITS.cta, {placeholder: 'Start your free trial', required: true});
  field(productGrid, 'url', 'Website shown in the film · optional', COMMERCIAL_LIMITS.url, {placeholder: 'yourproduct.com'});
  const colors = node('div', 'founder-colors founder-field--wide');
  field(colors, 'background', 'Background', 7, {type: 'color'});
  field(colors, 'foreground', 'Text', 7, {type: 'color'});
  field(colors, 'accent', 'Accent', 7, {type: 'color'});
  productGrid.append(colors);
  panels[0].append(productGrid);

  panels[1].append(node('h3', '', 'Make it unmistakably yours.'), node('p', 'founder-help', 'Add a logo and up to 3 product screenshots. PNG, JPEG or WebP. Images are resized and embedded in your recipe.'));
  const assetsGrid = node('div', 'founder-assets');
  const logoBox = node('div', 'founder-asset-card');
  const screensBox = node('div', 'founder-asset-card');
  logoBox.append(node('h4', '', 'Logo'), node('p', '', 'Optional · a transparent background works best.'));
  screensBox.append(node('h4', '', 'Product screens'), node('p', '', 'Optional · up to 3 screenshots, in presentation order.'));
  const logoList = node('div', 'founder-asset-list');
  const screensList = node('div', 'founder-asset-list');
  function uploadField(parent, label, id, multiple) {
    const wrapper = node('label', 'founder-upload');
    wrapper.append(node('span', '', label));
    const input = node('input');
    input.type = 'file';
    input.id = id;
    input.accept = 'image/png,image/jpeg,image/webp';
    input.multiple = multiple;
    input.setAttribute('aria-label', label);
    wrapper.append(input);
    parent.append(wrapper);
    return input;
  }
  logoBox.append(logoList);
  screensBox.append(screensList);
  const logoInput = uploadField(logoBox, 'Choose logo', 'founder-logo', false);
  const screensInput = uploadField(screensBox, 'Add screenshots', 'founder-screenshots', true);
  assetsGrid.append(logoBox, screensBox);
  panels[1].append(assetsGrid);
  const assetNote = node('p', 'founder-help');
  panels[1].append(assetNote);
  const review = node('div', 'founder-review');
  panels[2].append(node('h3', '', 'Your story. Five shots.'), node('p', 'founder-help', 'Apply the template, then refine its motion and appearance in Studio. Your existing saved versions stay available.'), review);
  const copyPrompt = button('Copy brief for your coding agent', 'founder-text-action');
  panels[2].append(copyPrompt, node('p', 'founder-help founder-agent-note', 'Want a different creative direction? Give this brief and the recipe to your coding agent.'));

  const footer = node('footer', 'founder-footer');
  const back = button('Back', 'founder-back');
  const progress = node('span', 'founder-progress');
  const next = button('Continue', 'founder-next');
  footer.append(back, progress, next);
  form.append(header, steps, body, status, footer);
  dialog.append(form);
  document.body.append(dialog);
  let step = 0, draft = createCommercialBrief(), busy = false, opened = false, editing = false;
  function message(text = '', error = false) {
    status.textContent = text;
    status.classList.toggle('founder-status--error', error);
  }
  function writeFields(brief) {
    for (const key of ['name', 'tagline']) fields[key].value = brief.brand[key];
    for (const key of ['headline', 'cta', 'url']) fields[key].value = brief.copy[key];
    brief.copy.features.forEach((feature, i) => fields['feature' + i].value = feature);
    for (const key of ['background', 'foreground', 'accent']) fields[key].value = brief.brand.colors[key];
  }
  function collect() {
    draft.brand.name = fields.name.value.trim();
    draft.brand.tagline = fields.tagline.value.trim();
    draft.brand.colors = Object.fromEntries(['background', 'foreground', 'accent'].map(key => [key, fields[key].value]));
    for (const key of ['headline', 'cta', 'url']) draft.copy[key] = fields[key].value.trim();
    draft.copy.features = [0, 1, 2].map(i => fields['feature' + i].value.trim());
    return draft;
  }
  function productValid() {
    for (const input of Object.values(fields)) {
      if (input.required && !input.value.trim()) {
        message('Add ' + input.closest('label').querySelector('span').textContent.toLowerCase() + ' to continue.', true);
        input.focus();
        return false;
      }
    }
    try { validateCommercialBrief(collect()); return true; }
    catch (error) { message(error.message, true); return false; }
  }
  function assetTotal(assets = draft.assets) { return (assets.logo?.src.length || 0) + assets.screenshots.reduce((sum, image) => sum + image.src.length, 0); }
  function renderAssets() {
    logoList.replaceChildren();
    screensList.replaceChildren();
    function card(asset, kind, index) {
      const item = node('div', 'founder-asset');
      const image = node('img');
      image.src = asset.src;
      image.alt = asset.name;
      const label = node('span', '', asset.name);
      const remove = button('×', 'founder-remove');
      remove.setAttribute('aria-label', 'Remove ' + asset.name);
      remove.disabled = busy;
      remove.onclick = () => { if (kind === 'logo') draft.assets.logo = null; else draft.assets.screenshots.splice(index, 1); renderAssets(); message(); };
      item.append(image, label, remove);
      return item;
    }
    if (draft.assets.logo) logoList.append(card(draft.assets.logo, 'logo', 0));
    else logoList.append(node('span', 'founder-empty-asset', 'Your product name will stand in for the logo.'));
    draft.assets.screenshots.forEach((asset, index) => screensList.append(card(asset, 'screenshot', index)));
    if (!draft.assets.screenshots.length) screensList.append(node('span', 'founder-empty-asset', 'Without screenshots, the film uses clearly marked sample screens.'));
    assetNote.textContent = `${Math.round(assetTotal() / 1024)} / ${Math.floor(COMMERCIAL_LIMITS.assetData / 1024)} KB embedded · images travel with your recipe.`;
  }
  function renderReview() {
    collect();
    review.replaceChildren();
    const brand = node('div', 'founder-brand-preview');
    brand.style.background = draft.brand.colors.background;
    brand.style.color = draft.brand.colors.foreground;
    const dot = node('span', 'founder-brand-dot');
    dot.style.background = draft.brand.colors.accent;
    brand.append(dot, node('strong', '', draft.brand.name), node('small', '', '24 SEC · 16:9'));
    review.append(brand);
    const beats = [
      ['01', 'Opening hook · 0–4 s', draft.copy.headline],
      ['02', 'Product overview · 4–9 s', draft.copy.features[0]],
      ['03', 'Feature focus · 9–14 s', draft.copy.features[1]],
      ['04', 'Product detail · 14–19 s', draft.copy.features[2]],
      ['05', 'Call to action · 19–24 s', [draft.copy.cta, draft.copy.url].filter(Boolean).join(' · ')]
    ];
    for (const [number, label, text] of beats) {
      const row = node('div', 'founder-beat');
      const copy = node('div');
      copy.append(node('small', '', label), node('p', '', text));
      row.append(node('span', 'founder-beat-number', number), copy);
      review.append(row);
    }
  }
  function setStep(value, focus = true) {
    step = value;
    panels.forEach((panel, index) => { panel.hidden = index !== step; });
    stepMarkers.forEach((item, index) => { if (index === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current'); item.classList.toggle('is-done', index < step); });
    back.hidden = step === 0;
    next.textContent = step === 2 ? (editing ? 'Update commercial' : 'Create commercial') : 'Continue';
    progress.textContent = `Step ${step + 1} of 3`;
    body.scrollTop = 0;
    message();
    if (step === 2) renderReview();
    if (focus) panels[step].focus({preventScroll: true});
  }
  function setBusy(value) {
    busy = value;
    for (const input of [next, back, logoInput, screensInput, sample, copyPrompt, ...Object.values(fields)]) input.disabled = value;
    dialog.setAttribute('aria-busy', String(value));
    renderAssets();
  }
  async function upload(input, kind) {
    const files = [...input.files];
    if (!files.length) return;
    if (kind === 'screenshot' && files.length + draft.assets.screenshots.length > COMMERCIAL_LIMITS.screenshots) {
      message('Keep up to 3 screenshots. Remove one before adding another.', true); input.value = ''; return;
    }
    setBusy(true);
    message('Preparing your images…');
    try {
      const prepared = [];
      for (const file of files) prepared.push(await portableImage(file, kind));
      const assets = structuredClone(draft.assets);
      if (kind === 'logo') assets.logo = prepared[0]; else assets.screenshots.push(...prepared);
      if (assetTotal(assets) > COMMERCIAL_LIMITS.assetData) throw Error('These images exceed the portable recipe limit. Use smaller screenshots or remove one and try again.');
      draft.assets = assets;
      message('Images ready. They will appear in your commercial.');
    } catch (error) { message(error.message, true); }
    finally { input.value = ''; setBusy(false); }
  }
  logoInput.onchange = () => upload(logoInput, 'logo');
  screensInput.onchange = () => upload(screensInput, 'screenshot');
  sample.onclick = () => {
    const assets = draft.assets;
    draft = createCommercialBrief();
    draft.assets = assets;
    writeFields(draft);
    message('Example copy loaded. Replace it with your own when ready.');
  };
  next.onclick = async () => {
    if (busy) return;
    if (step === 0 && !productValid()) return;
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true);
    message('Opening your commercial…');
    try { const commercial = validateCommercialBrief(collect()); await onCreate(commercial); dialog.close(); }
    catch (error) { message(error.message || 'The commercial could not be created. Please try again.', true); }
    finally { setBusy(false); }
  };
  back.onclick = () => { if (!busy && step > 0) setStep(step - 1); };
  copyPrompt.onclick = async () => {
    try { await navigator.clipboard.writeText(briefToAgentPrompt(validateCommercialBrief(collect()))); message('Brief copied. Export the recipe from Versions to include your images.'); }
    catch (error) { message('Could not copy the brief. Clipboard access may be unavailable in this browser.', true); }
  };
  form.onsubmit = event => { event.preventDefault(); next.click(); };
  function open() {
    if (dialog.open) return;
    const existing = getCommercial();
    editing = Boolean(existing);
    title.textContent = editing ? 'Refine your launch film' : 'Make your launch film';
    if (existing) { draft = createCommercialBrief(existing); writeFields(draft); }
    else if (!opened) {
      draft = createCommercialBrief();
      writeFields(draft);
      for (const key of ['name', 'tagline', 'headline', 'feature0', 'feature1', 'feature2', 'cta', 'url']) fields[key].value = '';
    }
    opened = true;
    renderAssets();
    setStep(0, false);
    dialog.showModal();
    fields.name.focus({preventScroll: true});
  }
  function close() { if (!busy) dialog.close(); }
  trigger.onclick = open;
  closeButton.onclick = close;
  // Keep Studio playback and undo shortcuts outside this modal; native dialog
  // keyboard behavior (Tab, Escape and form submission) remains available.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => trigger.focus({preventScroll: true}));
  let outsideDown = false;
  const outside = event => { const rect = dialog.getBoundingClientRect(); return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom); };
  dialog.addEventListener('pointerdown', event => { outsideDown = outside(event); });
  dialog.addEventListener('pointerup', event => { if (outsideDown && outside(event)) close(); outsideDown = false; });
  function refresh() { trigger.textContent = getCommercial() ? 'Edit commercial' : 'New commercial'; }
  refresh();
  return {open, close, destroy: () => { dialog.remove(); trigger.remove(); }, refresh};
}
