const assetPrefix=location.pathname.includes('/showcase/')?'../':'';
const asset=file=>assetPrefix+file;
for(const element of document.querySelectorAll('[data-asset]')){element.src=asset(element.dataset.asset);if(element.dataset.poster)element.poster=asset(element.dataset.poster);}
const films={bax:{title:'Objects in play',description:'A study in studio lighting, cinematic camera movement and mechanical forms.',file:'objects-in-play.mp4',poster:'hero.jpg',specs:'1080p · 25 fps · 10 s'},procedural:{title:'Procedural systems',description:'Flow fields, parametric structures, waves and tunnels. Original techno at 132 BPM.',file:'procedural-techno.mp4',poster:'procedural-techno-poster.jpg',specs:'1080p · 30 fps · 10 s · 132 BPM'},pop:{title:'PLAY.EXE',description:'A floating player, extruded type and a rhythmic city. Fish-eye optics and beat-synced motion.',file:'pop-motion.mp4',poster:'pop-hero.jpg',specs:'1080p · 30 fps · 10 s · 120 BPM'}};
const player=document.getElementById('demo-player');
const ambient=document.getElementById('site-ambient').getContext('2d');
let ambientRequest=null;
function paintAmbient(){if(player.readyState>=2)ambient.drawImage(player,0,0,240,135);}
function animateAmbient(){paintAmbient();if(!player.paused&&!player.ended)ambientRequest=requestAnimationFrame(animateAmbient);}
player.addEventListener('play',()=>{cancelAnimationFrame(ambientRequest);animateAmbient();});
player.addEventListener('seeked',paintAmbient);
player.addEventListener('pause',()=>{cancelAnimationFrame(ambientRequest);paintAmbient();});

function selectFilm(id){const film=films[id];player.pause();player.src=asset('demo/'+film.file);player.poster=asset('demo/'+film.poster);player.setAttribute('aria-label',film.title+' rendered film');player.load();cancelAnimationFrame(ambientRequest);const poster=new Image();poster.onload=()=>{if(player.poster.endsWith(film.poster))ambient.drawImage(poster,0,0,240,135);};poster.src=asset('demo/'+film.poster);for(const button of document.querySelectorAll('[data-film]')){button.setAttribute('aria-selected',String(button.dataset.film===id));button.tabIndex=button.dataset.film===id?0:-1;}document.getElementById('film-panel').setAttribute('aria-labelledby','film-'+id);document.getElementById('film-title').textContent=film.title;document.getElementById('film-description').textContent=film.description;document.getElementById('film-specs').textContent=film.specs;document.getElementById('film-download').href=asset('demo/'+film.file);}
for(const button of document.querySelectorAll('[data-film]')){button.onclick=()=>selectFilm(button.dataset.film);button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const ids=Object.keys(films),index=e.key==='Home'?0:e.key==='End'?2:(ids.indexOf(button.dataset.film)+(e.key==='ArrowRight'?1:2))%3;selectFilm(ids[index]);document.getElementById('film-'+ids[index]).focus();};}
selectFilm(Object.hasOwn(films,new URLSearchParams(location.search).get('film'))?new URLSearchParams(location.search).get('film'):'bax');
document.getElementById('copy-setup').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('setup-code').textContent);document.getElementById('copy-status').textContent='Copied. Paste these commands into Terminal.';}catch{document.getElementById('copy-status').textContent='Select the commands and copy them with ⌘C.';}};

for(const link of document.querySelectorAll('a[href="./studio/"]'))link.href=assetPrefix+'studio/';
