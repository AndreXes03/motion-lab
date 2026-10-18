const assetPrefix = location.pathname.includes('/showcase/') ? '../' : '';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType ?? '');
const asset = file => {
  const version = /pulse-1080\.mp4$/.test(file)
    ? '?v=pulse-continuous-audio-blue-end-v2'
    : /(?:camera|pulse)-1080\.mp4$/.test(file) || /(?:camera|pulse)-poster\.jpg$/.test(file)
    ? '?v=cycles-motion-tools-v1'
    : /ui-(?:studio-easy|studio-pro|studio-export)\.jpg$/.test(file)
      ? '?v=studio-workspaces-v4'
      : '';
  return assetPrefix + file + version;
};

for (const element of document.querySelectorAll('[data-brand]')) {
  const url = assetPrefix + element.dataset.brand;
  if (element.tagName === 'LINK') element.href = url;
  else element.src = url;
}

let heroVideo;
for (const element of document.querySelectorAll('[data-asset]')) {
  if (element.dataset.poster) element.poster = asset(element.dataset.poster);
  if (element.hasAttribute('data-hero-motion')) {
    heroVideo = element;
    if (reducedMotion.matches || saveData) {
      element.removeAttribute('autoplay');
      continue;
    }
  }
  element.src = asset(element.dataset.asset);
}

if (heroVideo) {
  let heroVisible = true;
  const updateHeroPlayback = () => {
    if (reducedMotion.matches || saveData || document.hidden || !heroVisible) {
      heroVideo.pause();
      return;
    }
    heroVideo.play().catch(() => {});
  };
  document.addEventListener('visibilitychange', updateHeroPlayback);
  reducedMotion.addEventListener?.('change', event => {
    if (event.matches || saveData) {
      heroVideo.pause();
      heroVideo.removeAttribute('src');
      heroVideo.load();
    } else if (!heroVideo.getAttribute('src')) {
      heroVideo.src = asset(heroVideo.dataset.asset);
    }
    updateHeroPlayback();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      updateHeroPlayback();
    }, {threshold: 0.08}).observe(heroVideo);
  } else updateHeroPlayback();
}

const films = {
  pulse: {
    title: 'PULSE',
    description: 'Sound objects, tactile materials and cinematic movement in a rhythmic 3D studio.',
    file: 'pulse-1080.mp4', poster: 'pulse-poster.jpg', specs: 'Cycles · 1080p · 30 fps · 12.9 s', source: 'pulse-demo.js'
  },
  camera: {
    title: 'CAMERA',
    description: 'A close flight through miniature worlds, optical hardware and an assembling diaphragm.',
    file: 'camera-1080.mp4', poster: 'camera-poster.jpg', specs: '1080p · 30 fps · 15.4 s', source: 'afterhours-demo.js'
  },
  dot: {
    title: 'DOT',
    description: 'A character study in shape, expression and playful motion, combining 2D layouts and 3D forms.',
    file: 'dot-1080.mp4', poster: 'dot-poster.jpg', specs: '1080p · 30 fps · 16 s', source: 'mascot-demo.js'
  },
  pop: {
    title: 'PLAY.EXE',
    description: 'A floating player, extruded type and a rhythmic city. Fish-eye optics and beat-synced motion.',
    file: 'pop-motion.mp4', poster: 'pop-hero.jpg', specs: '1080p · 30 fps · 10 s · 120 BPM', source: 'pop-demo.js'
  },
  replay: {
    title: 'REPLAY',
    description: 'An editorial collage of illustration, type and spatial movement, combining 2D and 3D.',
    file: 'replay-1080.mp4', poster: 'replay-poster.jpg', specs: '1080p · 30 fps · 15 s', source: 'replay-demo.js'
  }
};

const player = document.getElementById('demo-player');
const ambientCanvas = document.getElementById('site-ambient');
const ambient = ambientCanvas.getContext('2d');
let ambientRequest = null;
let lastAmbient = 0;
let filmVisible = true;

function paintAmbient() {
  if (player.readyState >= 2) ambient.drawImage(player, 0, 0, ambientCanvas.width, ambientCanvas.height);
}

function animateAmbient(now = 0) {
  if (document.hidden || reducedMotion.matches || !filmVisible) return;
  if (now - lastAmbient > 83) {
    paintAmbient();
    lastAmbient = now;
  }
  if (!player.paused && !player.ended) ambientRequest = requestAnimationFrame(animateAmbient);
}

player.addEventListener('play', () => {
  cancelAnimationFrame(ambientRequest);
  animateAmbient();
});
player.addEventListener('seeked', paintAmbient);
player.addEventListener('pause', () => {
  cancelAnimationFrame(ambientRequest);
  paintAmbient();
});
document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(ambientRequest);
  if (!document.hidden && !player.paused) animateAmbient();
});
new IntersectionObserver(entries => {
  filmVisible = entries[0].isIntersecting;
  cancelAnimationFrame(ambientRequest);
  if (filmVisible && !player.paused) animateAmbient();
}).observe(player);

const videoStatus = document.getElementById('video-status');
player.addEventListener('error', () => {
  videoStatus.hidden = false;
  videoStatus.textContent = 'Playback unavailable. You can still download the film below.';
});
player.addEventListener('loadeddata', () => { videoStatus.hidden = true; });

function selectFilm(id) {
  const film = films[id];
  if (!film) return;
  player.pause();
  videoStatus.hidden = true;
  player.src = asset('demo/' + film.file);
  player.poster = asset('demo/' + film.poster);
  player.setAttribute('aria-label', film.title + ' rendered film');
  player.load();
  cancelAnimationFrame(ambientRequest);
  const poster = new Image();
  poster.onload = () => {
    if (new URL(player.poster).pathname.endsWith(film.poster)) {
      ambient.drawImage(poster, 0, 0, ambientCanvas.width, ambientCanvas.height);
    }
  };
  poster.src = asset('demo/' + film.poster);

  for (const button of document.querySelectorAll('[data-film]')) {
    const active = button.dataset.film === id;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  document.getElementById('film-panel').setAttribute('aria-labelledby', 'film-' + id);
  document.getElementById('film-title').textContent = film.title;
  document.getElementById('film-description').textContent = film.description;
  document.getElementById('film-specs').textContent = film.specs;
  document.getElementById('film-source').href = 'https://github.com/AndreXes03/motion-lab/blob/main/src/scenes/' + film.source;
  document.getElementById('film-download').href = asset('demo/' + film.file);
}

const filmButtons = [...document.querySelectorAll('[data-film]')];
const filmIds = filmButtons.map(button => button.dataset.film);
function activateFilm(id) {
  selectFilm(id);
  history.replaceState(null, '', '#' + id);
}
for (const button of filmButtons) {
  button.onclick = () => activateFilm(button.dataset.film);
  button.onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const count = filmIds.length;
    const current = filmIds.indexOf(button.dataset.film);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (current + (event.key === 'ArrowRight' ? 1 : count - 1)) % count;
    activateFilm(filmIds[index]);
    filmButtons[index].focus();
  };
}
function selectHashFilm() {
  const id = location.hash.slice(1);
  if (films[id]) selectFilm(id);
}
const requestedFilm = new URLSearchParams(location.search).get('film');
selectFilm(Object.hasOwn(films, location.hash.slice(1))
  ? location.hash.slice(1)
  : Object.hasOwn(films, requestedFilm) ? requestedFilm : 'pulse');
window.addEventListener('hashchange', selectHashFilm);

document.getElementById('copy-setup').onclick = async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById('setup-code').textContent);
    document.getElementById('copy-status').textContent = 'Copied. Paste these commands into Terminal.';
  } catch {
    document.getElementById('copy-status').textContent = 'Select the commands and copy them with ⌘C.';
  }
};

for (const link of document.querySelectorAll('a[href^="./studio/"]')) {
  link.href = assetPrefix + link.getAttribute('href').slice(2);
}


const studioViewTabs = [...document.querySelectorAll('[data-studio-view]')];
function selectStudioView(index, focus = false) {
  studioViewTabs.forEach((tab, i) => {
    const active = i === index;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
  if (focus) studioViewTabs[index].focus();
}
studioViewTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectStudioView(index));
  tab.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % studioViewTabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + studioViewTabs.length) % studioViewTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = studioViewTabs.length - 1;
    else return;
    event.preventDefault();
    selectStudioView(next, true);
  });
});
for (const link of document.querySelectorAll('[data-capture]')) {
  link.href = asset(link.dataset.capture);
}
