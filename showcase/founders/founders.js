import {films, publishedFilms} from './films.js';

// The same static files work in the repository preview and at /motion-lab/founders/.
const localPreview = location.pathname.includes('/showcase/founders');
const base = new URL(localPreview ? '../../' : '../', location.href);
const asset = name => new URL(`demo/${name}`, base).href;
for (const el of document.querySelectorAll('[data-brand]')) {
  const url = new URL(localPreview ? 'public/brand/framevolve-mark.png' : 'brand/framevolve-mark.png', base).href;
  if (el.tagName === 'LINK') el.href = url; else el.src = url;
}
for (const el of document.querySelectorAll('[data-image]')) el.src = asset(el.dataset.image);
for (const el of document.querySelectorAll('[data-poster]')) el.poster = asset(el.dataset.poster);
for (const el of document.querySelectorAll('[data-studio]')) el.href = new URL(localPreview ? './' : 'studio/', base).href;
document.querySelector('[data-capture]').href = asset('ui-studio-easy.jpg');
document.querySelector('[data-license]').href = new URL('LICENSE', base).href;
document.querySelector('[data-original]').href = new URL(localPreview ? 'showcase/' : './', base).href;

const hero = document.querySelector('#hero-video');
const featuredId = publishedFilms[0];
const featuredFilm = films[featuredId];
hero.poster = asset(featuredFilm.poster);
hero.setAttribute('aria-label', featuredFilm.title);
document.querySelector('#hero-film-label').textContent = `${featuredFilm.name} / MADE IN FRAMEVOLVE`;
document.querySelector('#hero-caption').textContent = `${featuredFilm.name} — made in Framevolve.`;
document.querySelector('#watch-featured').dataset.film = featuredId;
const gallery = document.querySelector('#film-grid');
for (const id of publishedFilms) {
  const film = films[id];
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'film-card';
  card.dataset.film = id;
  card.setAttribute('aria-label', `Watch ${film.title}`);
  // The catalog is authored locally; user input never reaches this markup.
  card.innerHTML = `<div class="film-image"><img src="${asset(film.poster)}" width="1920" height="1080" alt="${film.alt}" loading="lazy"><span class="play">↗</span></div><span class="film-label"><strong>${film.name}</strong><span>${film.caption}</span></span>`;
  gallery.append(card);
}
const playButton = document.querySelector('#hero-play');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType ?? '');
let wantsPlayback = !reducedMotion.matches && !saveData;
let heroVisible = false;
const updatePlayback = () => {
  if (!wantsPlayback || !heroVisible || document.hidden || dialog.open) {
    hero.pause();
    return;
  }
  if (!hero.getAttribute('src')) hero.src = asset(featuredFilm.preview);
  hero.play().catch(() => {});
};
const syncPlayButton = () => {
  playButton.textContent = hero.paused ? '▶' : 'Ⅱ';
  playButton.setAttribute('aria-label', `${hero.paused ? 'Play' : 'Pause'} product film preview`);
};
hero.addEventListener('play', syncPlayButton);
hero.addEventListener('pause', syncPlayButton);
hero.addEventListener('error', () => {
  wantsPlayback = false;
  playButton.textContent = '↻';
  playButton.setAttribute('aria-label', 'Retry product film preview');
});
playButton.addEventListener('click', () => {
  wantsPlayback = hero.paused;
  if (wantsPlayback && hero.error) hero.load();
  updatePlayback();
});
document.addEventListener('visibilitychange', updatePlayback);
reducedMotion.addEventListener('change', () => {
  wantsPlayback = !reducedMotion.matches && !saveData;
  updatePlayback();
});

const dialog = document.querySelector('#film-dialog');
const player = document.querySelector('#film-player');
const status = document.querySelector('#film-status');
let filmTrigger;
for (const button of document.querySelectorAll('[data-film]')) {
  button.addEventListener('click', () => {
    const film = films[button.dataset.film];
    filmTrigger = button;
    status.textContent = '';
    document.querySelector('#dialog-title').textContent = film.title;
    player.setAttribute('aria-label', film.title);
    player.poster = asset(film.poster);
    player.src = asset(film.file);
    dialog.showModal();
    hero.pause();
    player.play().catch(() => { status.textContent = 'Press play to watch the film.'; });
  });
}
document.querySelector('#close-film').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  player.pause();
  player.removeAttribute('src');
  player.load();
  updatePlayback();
  filmTrigger?.focus({preventScroll: true});
});
player.addEventListener('error', () => { if (dialog.open) status.textContent = 'The film could not load. Please close it and try again.'; });
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    updatePlayback();
  }, {threshold: .1}).observe(hero);
} else { heroVisible = true; updatePlayback(); }

const briefForm = document.querySelector('#brief-form');
for (const link of document.querySelectorAll('a[href="#brief"]')) {
  link.addEventListener('click', () => { document.querySelector('.brief-drawer').open = true; });
}
for (const button of document.querySelectorAll('[data-color]')) {
  button.addEventListener('click', () => {
    document.querySelector('.refine-art').dataset.tone = button.dataset.color;
    for (const swatch of document.querySelectorAll('[data-color]')) {
      swatch.setAttribute('aria-pressed', String(swatch === button));
    }
  });
}
const briefOutput = document.querySelector('#brief-output');
const copyStatus = document.querySelector('#copy-status');
briefForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(briefForm);
  const value = name => String(data.get(name) ?? '').trim();
  for (const name of ['product', 'message', 'cta']) {
    const input = briefForm.elements.namedItem(name);
    input.setCustomValidity(value(name) ? '' : 'Please add a few words.');
    if (!input.reportValidity()) return;
  }
  briefOutput.value = [
    'Help me create a launch video in Framevolve.',
    '',
    `Product: ${value('product')}`,
    `Main message: ${value('message')}`,
    `Look and feel: ${value('vibe')}`,
    `Closing call to action: ${value('cta')}`,
    `Reference: ${value('reference') || 'No reference yet. Suggest a direction based on the product and message.'}`,
    '',
    'I will provide my logo and product screenshots separately. Ask me for any missing assets or audience details before building.',
    'Start by proposing a simple story. Keep the product and its message central, and give me focused controls to refine the result in Framevolve.'
  ].join('\n');
  document.querySelector('#brief-result').hidden = false;
  copyStatus.textContent = '';
  briefOutput.focus({preventScroll: true});
  briefOutput.scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center'});
});
briefForm.addEventListener('input', event => { event.target.setCustomValidity?.(''); });
document.querySelector('#copy-brief').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(briefOutput.value);
    copyStatus.textContent = 'Copied. Bring your brief and assets to your AI assistant.';
  } catch {
    briefOutput.focus();
    briefOutput.select();
    copyStatus.textContent = 'Your brief is selected. Press ⌘C on Mac or Ctrl+C on Windows to copy.';
  }
});
