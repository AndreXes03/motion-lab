/**
 * Flaticon Uicons Regular Rounded 3.3.1.
 * Local original glyphs; see public/vendor/uicons/{SOURCE.json,LICENSE.txt}.
 * Keep the exported attribution link visible in the application's credits.
 *
 * HTML: <span data-icon="motion"></span> then mountIcons(container).
 * Dynamic HTML: observeIcons(container) returns a disconnect function.
 * Buttons: setIcon(button, 'play', { label: 'Play', iconOnly: true }).
 */
import './studio-icons.css';

export const ICON_SPRITE_URL = `${import.meta.env?.BASE_URL || '/'}vendor/uicons/regular-rounded.svg`;
export const ICON_ATTRIBUTION = '<a class="studio-icon-credit" href="https://www.flaticon.com/uicons" target="_blank" rel="noopener noreferrer">Uicons by Flaticon</a>';

export const ICONS = Object.freeze({
  scene: 'cube', motion: 'graph-curve', compositing: 'layers', audio: 'waveform',
  sound: 'waveform', versions: 'time-past', code: 'code-simple', render: 'clapperboard-play',
  play: 'play', pause: 'pause', stop: 'stop', undo: 'undo', redo: 'redo', reset: 'refresh',
  export: 'download', import: 'upload', frame: 'camera-viewfinder', settings: 'settings-sliders',
  search: 'search', panels: 'grid', panel: 'sliders-v', inspector: 'settings-sliders',
  'panels-bottom': 'list-timeline', compare: 'copy', loop: 'refresh', reference: 'picture',
  tree: 'folder-tree', folder: 'folder-open', object: 'cube', group: 'folder',
  camera: 'camera', lens: 'camera-viewfinder', lights: 'bulb', light: 'bulb',
  appearance: 'palette', material: 'palette', graphics: 'picture', character: 'model-cube-space',
  visible: 'eye', hidden: 'eye-crossed', eye: 'eye', lock: 'lock', unlock: 'unlock',
  add: 'plus', plus: 'plus', minus: 'minus', close: 'cross-small',
  left: 'angle-small-left', right: 'angle-small-right', down: 'angle-small-down', up: 'angle-small-up',
  back: 'arrow-left', next: 'arrow-right', external: 'arrow-up-right',
  expand: 'expand', fullscreen: 'expand', collapse: 'compress', fit: 'frame',
  more: 'menu-dots', menu: 'menu-burger', duplicate: 'copy', copy: 'copy',
  delete: 'trash', check: 'check', info: 'info', warning: 'triangle-warning',
  keyframe: 'diamond', time: 'clock', volume: 'volume', mute: 'volume-mute',
  headphones: 'headphones', effects: 'magic-wand', filter: 'filter', timeline: 'list-timeline',
  save: 'disk', file: 'file', source: 'file-code', image: 'picture', video: 'clapperboard-play',
  zoomIn: 'zoom-in', zoomOut: 'zoom-out', cursor: 'cursor', hand: 'hand', rotate: 'rotate-right',
  stepForward: 'step-forward', stepBackward: 'step-backward', help: 'book-alt',
  link: 'link', unlink: 'link-slash', keyboard: 'keyboard', globe: 'globe',
  sun: 'sun', moon: 'moon', favorite: 'star', screen: 'screen',
});
const glyphs = new Set(Object.values(ICONS));
const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Return trusted SVG markup. Unknown icon names deliberately use a neutral info glyph. */
export function icon(name, { className = '', size, label } = {}) {
  const glyph = ICONS[name] || (glyphs.has(name) ? name : 'info');
  const accessible = label ? `role="img" aria-label="${escapeAttribute(label)}"` : 'aria-hidden="true"';
  const dimensions = Number.isFinite(size) && size > 0 ? ` width="${size}" height="${size}" style="--studio-icon-size:${size}px"` : '';
  return `<svg class="studio-icon${className ? ` ${escapeAttribute(className)}` : ''}" viewBox="0 0 24 24" focusable="false" ${accessible}${dimensions}><use href="${ICON_SPRITE_URL}#${glyph}"></use></svg>`;
}

/** Preserve button listeners and existing text unless iconOnly is explicitly requested. */
export function setIcon(element, name, { label, iconOnly = false, className = '', size } = {}) {
  if (!element) return element;
  element.querySelector(':scope > .studio-icon')?.remove();
  if (iconOnly) element.replaceChildren();
  element.insertAdjacentHTML('afterbegin', icon(name, { className, size }));
  element.classList.add('studio-has-icon');
  element.classList.toggle('studio-icon-only', iconOnly);
  if (label) {
    element.setAttribute('aria-label', label);
    element.setAttribute('title', label);
  }
  return element;
}

/** data-icon is intended for a dedicated icon slot, not an interactive container. */
export function mountIcons(root = document) {
  const nodes = [...(root.matches?.('[data-icon]') ? [root] : []), ...root.querySelectorAll('[data-icon]')];
  for (const element of nodes) {
    const name = element.dataset.icon;
    if (element.dataset.mountedIcon === name && element.querySelector(':scope > .studio-icon')) continue;
    element.innerHTML = icon(name, { className: element.dataset.iconClass || '' });
    element.dataset.mountedIcon = name;
    element.classList.add('studio-icon-slot');
  }
}

/** Observe only newly inserted icon slots and data-icon changes; no global polling. */
export function observeIcons(root = document.body) {
  mountIcons(root);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') mountIcons(record.target);
      else for (const node of record.addedNodes) if (node.nodeType === 1) mountIcons(node);
    }
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-icon'] });
  return () => observer.disconnect();
}
