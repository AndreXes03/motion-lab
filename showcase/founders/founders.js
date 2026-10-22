import {films, publishedFilms} from './films.js';
import {buildFounderBrief} from './brief.js';

// The same static files work in the repository preview and at /motion-lab/founders/.
const localPreview = location.pathname.includes('/showcase/founders');
const publishedBase = document.querySelector('meta[name="framevolve-base"]')?.content;
const base = new URL(publishedBase || (localPreview ? '../../' : '../'), location.href);
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
    player.src = asset(film.playback || film.file);
    const download = document.querySelector('#film-download');
    download.href = asset(film.file);
    download.textContent = film.playback ? 'Download master · 30 Mbps ↓' : 'Download film ↓';
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
const launchDirections = {
  launch: {format:'THE BIG INTRODUCTION', overline:'MEET YOUR NEXT FAVORITE THING.', lines:['Small team.', 'Big entrance.'], sticker:'WE’RE LIVE ↗', vibe:'Playful and bold', cta:'Try it today'},
  feature: {format:'THE FEATURE DROP', overline:'ONE LESS THING IN YOUR WAY.', lines:['Less friction.', 'More flow.'], sticker:'JUST SHIPPED ↗', vibe:'Fast and energetic', cta:'See what’s new'},
  homepage: {format:'THE FIRST IMPRESSION', overline:'SHOW WHAT MAKES YOU DIFFERENT.', lines:['Oh, that’s', 'what it does.'], sticker:'TAKE A LOOK ↗', vibe:'Clean and confident', cta:'Explore the product'}
};
let selectedDirection = 'launch';
const directionTabs = [...document.querySelectorAll('[data-moment]')];
const selectDirection = id => {
  const direction = launchDirections[id];
  selectedDirection = id;
  const preview = document.querySelector('#moment-preview');
  preview.dataset.direction = id;
  preview.setAttribute('aria-labelledby', `moment-tab-${id}`);
  document.querySelector('#moment-format').textContent = direction.format;
  document.querySelector('#moment-overline').textContent = direction.overline;
  document.querySelector('#moment-sticker').textContent = direction.sticker;
  const headline = document.querySelector('#moment-headline');
  headline.replaceChildren(document.createTextNode(direction.lines[0]), document.createElement('br'), document.createTextNode(direction.lines[1]));
  for (const tab of directionTabs) {
    const selected = tab.dataset.moment === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
};
for (const [index, tab] of directionTabs.entries()) {
  tab.addEventListener('click', () => selectDirection(tab.dataset.moment));
  tab.addEventListener('keydown', event => {
    const delta = ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 0;
    let next = delta ? (index + delta + directionTabs.length) % directionTabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? directionTabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    directionTabs[next].focus();
    selectDirection(directionTabs[next].dataset.moment);
  });
}
document.querySelector('#use-direction').addEventListener('click', () => {
  const direction = launchDirections[selectedDirection];
  // Preserve the founder's own writing when exploring a different direction.
  if (!briefForm.elements.cta.value.trim()) briefForm.elements.cta.value = direction.cta;
  if (!briefForm.elements.vibe.dataset.userEdited) briefForm.elements.vibe.value = direction.vibe;
  document.querySelector('.brief-drawer').open = true;
});
briefForm.elements.vibe.addEventListener('change', () => { briefForm.elements.vibe.dataset.userEdited = 'true'; });
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
  briefOutput.value = buildFounderBrief(Object.fromEntries(data));
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
