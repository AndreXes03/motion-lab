// Short visual labels keep parameter rows scannable. The complete authored label
// and help remain attached to the inputs for assistive technology and tooltips.
const conciseLabels = {
  'Camera field of view': 'Field of view',
  'Authored motion gain': 'Motion amount',
  'Depth of field strength': 'Focus strength',
  'Maximum focus blur': 'Maximum blur',
  'Motion blur shutter': 'Shutter angle',
  'Speaker and record motion': 'Speaker & record',
  'City vehicle motion': 'Vehicle motion'
};
function controlUnit(def) {
  if (def.unit) return def.unit;
  if (['fov', 'shutterAngle'].includes(def.id) || def.path?.at(-1) === 'yaw') return '°';
  if (def.id === 'aberrationPx') return 'px';
  if (def.id === 'dofMaxBlur') return 'px at HD';
  return '';
}

/** Shared, accessible control renderer. Values are emitted as their native type. */
export function renderControl(def, {value, onInput = () => {}, onCommit = () => {}, onBegin = () => {}, onCancel = () => {}, prefix = 'control-'} = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'control';
  wrap.dataset.controlId = def.id;
  const top = document.createElement('div');
  top.className = 'control-top';
  const label = document.createElement('label');
  label.htmlFor = prefix + def.id;
  const fullLabel = def.label ?? def.id;
  const shortLabel = conciseLabels[fullLabel] ?? fullLabel;
  const unit = controlUnit(def);
  label.textContent = shortLabel + (unit ? ` · ${unit}` : '');
  const accessibleLabel = label.textContent + (shortLabel !== fullLabel ? ` (${fullLabel})` : '');
  top.append(label);
  wrap.append(top);
  const numeric = ['range', 'number'].includes(def.type);
  const finite = n => Number.isFinite(Number(n));
  const sanitize = raw => {
    if (raw === '' || !finite(raw)) return null;
    let n = Number(raw);
    if (finite(def.min)) n = Math.max(Number(def.min), n);
    if (finite(def.max)) n = Math.min(Number(def.max), n);
    const step = Number(def.step);
    if (step > 0) {
      const origin = finite(def.min) ? Number(def.min) : 0;
      n = origin + Math.round((n - origin) / step) * step;
      n = Number(n.toFixed(10));
    }
    if (finite(def.min)) n = Math.max(Number(def.min), n);
    if (finite(def.max)) n = Math.min(Number(def.max), n);
    return n;
  };
  let current = value ?? def.default;
  let input;
  let numericInput;
  if (numeric) {
    const output = document.createElement('output');
    output.className = 'control-number';
    const number = document.createElement('input');
    numericInput = number;
    number.type = 'number';
    number.id = prefix + def.id + (def.type === 'range' ? '-number' : '');
    number.setAttribute('aria-label', accessibleLabel + ' value');
    number.style.width = '76px';
    for (const key of ['min', 'max', 'step']) if (def[key] !== undefined) number[key] = String(def[key]);
    current = sanitize(current) ?? sanitize(def.default) ?? 0;
    let lastInput = current;
    number.value = String(current);
    if (def.type === 'range') {
      input = document.createElement('input');
      input.type = 'range';
      input.id = prefix + def.id;
      for (const key of ['min', 'max', 'step']) if (def[key] !== undefined) input[key] = String(def[key]);
      input.value = String(current);
      output.append(number);
      top.append(output);
      wrap.append(input);
    } else {
      input = number;
      wrap.append(number);
    }
    const emit = (source, commit) => {
      const next = sanitize(source.value);
      if (next === null) {
        source.setAttribute('aria-invalid', 'true');
        if (commit) { source.value = String(current); source.removeAttribute('aria-invalid'); }
        return;
      }
      source.removeAttribute('aria-invalid');
      current = next;
      if (source !== number || commit) number.value = String(next);
      input.value = String(next);
      if (!commit || next !== lastInput) { onInput(next); lastInput = next; }
      if (commit) onCommit(next);
    };
    input.addEventListener('input', () => emit(input, false));
    input.addEventListener('change', () => emit(input, true));
    if (number !== input) {
      number.addEventListener('input', () => emit(number, false));
      number.addEventListener('change', () => emit(number, true));
      number.addEventListener('blur', () => emit(number, true));
    }
  } else {
    input = document.createElement(def.type === 'select' ? 'select' : 'input');
    input.id = prefix + def.id;
    if (def.type === 'select') {
      for (const option of def.options ?? []) {
        const o = document.createElement('option');
        o.value = String(typeof option === 'object' ? option.value ?? option.id : option);
        o.textContent = String(typeof option === 'object' ? option.label ?? o.value : option);
        input.append(o);
      }
      input.value = String(current ?? '');
    } else if (def.type === 'toggle' || def.type === 'checkbox' || def.type === 'boolean') {
      input.type = 'checkbox';
      input.checked = Boolean(current);
    } else {
      input.type = def.type === 'color' ? 'color' : 'text';
      if (input.type === 'text') input.maxLength = def.maxLength ?? 22;
      input.value = String(current ?? (def.type === 'color' ? '#ffffff' : ''));
    }
    const read = () => input.type === 'checkbox' ? input.checked : input.value;
    let lastInput = read();
    input.addEventListener('input', () => { lastInput = read(); onInput(lastInput); });
    input.addEventListener('change', () => {
      const next = read();
      if (next !== lastInput) { onInput(next); lastInput = next; }
      onCommit(next);
    });
    wrap.append(input);
  }
  input.setAttribute('aria-label', accessibleLabel);
  if (def.help) {
    const help = document.createElement('small');
    help.id = prefix + def.id + '-help';
    help.textContent = def.help;
    // Keep constraints in the authored schema without repeating a paragraph
    // beneath every slider. Native tooltips are also available on the label.
    help.hidden = true;
    label.title = def.help;
    input.title = def.help;
    input.setAttribute('aria-describedby', help.id);
    if (numericInput && numericInput !== input) {
      numericInput.title = def.help;
      numericInput.setAttribute('aria-describedby', help.id);
    }
    wrap.append(help);
  }
  if (numeric) {
    label.classList.add('control-scrub-label'); label.title = (def.help ? def.help + ' ' : '') + 'Drag to adjust · Shift for larger steps · Escape to cancel';
    let scrub, escapeScrub;
    label.addEventListener('pointerdown', event => {
      if (event.button !== 0 || input.disabled) return;
      event.preventDefault(); onBegin();document.addEventListener('keydown',escapeScrub); scrub = {x:event.clientX, value:current, moved:false, pointerId:event.pointerId}; label.setPointerCapture(event.pointerId);
    });
    label.addEventListener('pointermove', event => {
      if (!scrub || scrub.pointerId !== event.pointerId) return;
      if (!scrub.moved && Math.abs(event.clientX-scrub.x)<3) return;
      const next=sanitize(scrub.value+(event.clientX-scrub.x)*(Number(def.step)||.01)*(event.shiftKey?10:1));
      scrub.moved=true;current=next;input.value=String(next);numericInput.value=String(next);onInput(next);
    });
    const finish = (cancelled=false) => {
      if(!scrub)return;
      const g=scrub;scrub=null;document.removeEventListener('keydown',escapeScrub);
      if(g.moved){if(cancelled){current=g.value;input.value=String(current);numericInput.value=String(current);onInput(current);onCancel();}else onCommit(current);}
      else numericInput.focus();
      if(label.hasPointerCapture(g.pointerId))label.releasePointerCapture(g.pointerId);
    };
    label.addEventListener('pointerup',()=>finish());label.addEventListener('pointercancel',()=>finish(true));label.addEventListener('lostpointercapture',()=>finish(true));
    escapeScrub=event=>{if(event.key==='Escape'&&scrub){event.preventDefault();event.stopPropagation();finish(true);}};
    label.addEventListener('click',event=>event.preventDefault());
  }
  return wrap;
}
