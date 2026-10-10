const assetPrefix=location.pathname.includes('/showcase/')?'../':'';
const asset=file=>assetPrefix+file+(/(?:camera|pulse)-1080\.mp4$/.test(file)?'?v=clean-v7':'');
for(const element of document.querySelectorAll('[data-asset]')){element.src=asset(element.dataset.asset);if(element.dataset.poster)element.poster=asset(element.dataset.poster);}
const films={camera:{title:'CAMERA',description:'A close flight through miniature worlds, optical hardware and an assembling diaphragm.',file:'camera-1080.mp4',poster:'camera-poster.jpg',specs:'1080p · 30 fps · 15.4 s'},pulse:{title:'PULSE',description:'Sound objects, tactile materials and cinematic movement in a rhythmic 3D studio.',file:'pulse-1080.mp4',poster:'pulse-poster.jpg',specs:'1080p · 30 fps · 13.9 s'},dot:{title:'DOT',description:'A character study in shape, expression and playful motion, combining 2D layouts and 3D forms.',file:'dot-1080.mp4',poster:'dot-poster.jpg',specs:'1080p · 30 fps · 16 s'},replay:{title:'REPLAY',description:'An editorial collage of illustration, type and spatial movement, combining 2D and 3D.',file:'replay-1080.mp4',poster:'replay-poster.jpg',specs:'1080p · 30 fps · 15 s'},bax:{title:'Objects in play',description:'A study in studio lighting, cinematic camera movement and mechanical forms.',file:'objects-in-play.mp4',poster:'hero.jpg',specs:'1080p · 25 fps · 10 s'},pop:{title:'PLAY.EXE',description:'A floating player, extruded type and a rhythmic city. Fish-eye optics and beat-synced motion.',file:'pop-motion.mp4',poster:'pop-hero.jpg',specs:'1080p · 30 fps · 10 s · 120 BPM'}};
const player=document.getElementById('demo-player');
const ambient=document.getElementById('site-ambient').getContext('2d');
let ambientRequest=null;
function paintAmbient(){if(player.readyState>=2)ambient.drawImage(player,0,0,240,135);}
function animateAmbient(){paintAmbient();if(!player.paused&&!player.ended)ambientRequest=requestAnimationFrame(animateAmbient);}
player.addEventListener('play',()=>{cancelAnimationFrame(ambientRequest);animateAmbient();});
player.addEventListener('seeked',paintAmbient);
player.addEventListener('pause',()=>{cancelAnimationFrame(ambientRequest);paintAmbient();});

function selectFilm(id){const film=films[id];if(!film)return;player.pause();player.src=asset('demo/'+film.file);player.poster=asset('demo/'+film.poster);player.setAttribute('aria-label',film.title+' rendered film');player.load();cancelAnimationFrame(ambientRequest);const poster=new Image();poster.onload=()=>{if(player.poster.endsWith(film.poster))ambient.drawImage(poster,0,0,240,135);};poster.src=asset('demo/'+film.poster);for(const button of document.querySelectorAll('[data-film]')){button.setAttribute('aria-selected',String(button.dataset.film===id));button.tabIndex=button.dataset.film===id?0:-1;}document.getElementById('film-panel').setAttribute('aria-labelledby','film-'+id);document.getElementById('film-title').textContent=film.title;document.getElementById('film-description').textContent=film.description;document.getElementById('film-specs').textContent=film.specs;document.getElementById('film-download').href=asset('demo/'+film.file);}
const filmButtons=[...document.querySelectorAll('[data-film]')];
const filmIds=filmButtons.map(button=>button.dataset.film);
function activateFilm(id){selectFilm(id);history.replaceState(null,'','#'+id);}
for(const button of filmButtons){button.onclick=()=>activateFilm(button.dataset.film);button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const count=filmIds.length,index=e.key==='Home'?0:e.key==='End'?count-1:(filmIds.indexOf(button.dataset.film)+(e.key==='ArrowRight'?1:count-1))%count;activateFilm(filmIds[index]);filmButtons[index].focus();};}
function selectHashFilm(){const id=location.hash.slice(1);if(films[id])selectFilm(id);}
const requestedFilm=new URLSearchParams(location.search).get('film');
selectFilm(Object.hasOwn(films,location.hash.slice(1))?location.hash.slice(1):Object.hasOwn(films,requestedFilm)?requestedFilm:'camera');
window.addEventListener('hashchange',selectHashFilm);
document.getElementById('copy-setup').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('setup-code').textContent);document.getElementById('copy-status').textContent='Copied. Paste these commands into Terminal.';}catch{document.getElementById('copy-status').textContent='Select the commands and copy them with ⌘C.';}};

for(const link of document.querySelectorAll('a[href="./studio/"]'))link.href=assetPrefix+'studio/';
