import loopSource from '../scenes/loop-launch.js?raw';
import loopDetailSource from '../scenes/loop-product-detail.js?raw';
import loopMotionSource from '../scenes/loop-motion.js?raw';
import loopSurfaceSource from '../scenes/loop-surface.js?raw';
import loopHeadlinesSource from '../scenes/loop-headlines.js?raw';
import loopFontSource from '../assets/fonts/space-grotesk-headlines.json?raw';
import {isLoopPreviewCurrent} from './prepared-preview-state.js';
import './prepared-preview.css';

/** Local, source-verified Cycles movie. Editing always returns to the live scene. */
export function mountPreparedPreview({container,toolbar,getState,onSelect,onChange,enabled=true}){
  const video=document.createElement('video');video.className='prepared-preview';video.hidden=true;video.playsInline=true;video.preload='auto';video.setAttribute('aria-label','Cycles rendered project preview');container.append(video);
  const button=document.createElement('button');button.type='button';button.className='prepared-preview-toggle';button.textContent='Cycles playback';button.hidden=true;button.setAttribute('aria-pressed','false');toolbar.append(button);
  let ready=false,wanted=true,failed=false,manifest=null;
  const current=()=>ready&&!failed&&getState().scene==='loop'&&isLoopPreviewCurrent(getState().parameters);
  const active=()=>wanted&&current()&&getState().review==='beauty'&&getState().mode!=='render';
  const syncAudio=()=>{const sound=getState().parameters.sound??{};video.muted=sound.enabled===false;video.volume=Math.max(0,Math.min(1,((sound.master??.8)/.8)*((sound.music??.38)/.38)));};
  button.onclick=()=>{wanted=!active();if(wanted)onSelect();else video.pause();onChange();};
  video.onloadedmetadata=()=>onChange();
  video.onerror=()=>{failed=true;video.hidden=true;button.title='Could not load the prepared preview';onChange();};
  async function load(){
    if(!enabled)return;
    try{
      const response=await fetch('/local-preview/loop.json',{cache:'no-store'});if(!response.ok)return;
      const data=await response.json();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode([loopSource,loopDetailSource,loopMotionSource,loopSurfaceSource,loopHeadlinesSource,loopFontSource].join('\n')))),v=>v.toString(16).padStart(2,'0')).join('');
      if(data.engine!=='cycles'||data.scene!=='loop'||data.sourceSHA256!==hash||data.duration!==22||!/^\/local-preview\/[a-zA-Z0-9._-]+\.mp4$/.test(data.url))return;
      manifest=data;video.src=data.url;ready=true;onChange();
    }catch{/* No prepared local render: the interactive and frame renderers remain available. */}
  }
  load();
  return {
    active,
    render(time,playing){
      const matches=current(),show=active();button.hidden=!ready||getState().scene!=='loop';button.disabled=!matches;button.title=matches?'Play the prepared Cycles render with its soundtrack':'Scene changed · use Render view or render a new preview';button.setAttribute('aria-pressed',String(show));video.hidden=!show;
      if(!show){video.pause();return false;}
      syncAudio();
      if(Number.isFinite(video.duration)&&Math.abs(video.currentTime-time)>(playing?.18:1/90))video.currentTime=Math.max(0,Math.min(video.duration-.001,time));
      if(!playing)video.pause();return true;
    },
    async play(time){if(!active())return false;syncAudio();video.currentTime=time;await video.play();return true;},
    pause(){video.pause();},
    currentTime(){return active()&&!video.paused?video.currentTime:null;},
    get label(){return `Cycles · ${manifest?.height??720}p · rendered preview`;},
    async capture(){if(!active()||video.readyState<2)return null;const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);return new Promise(resolve=>c.toBlob(resolve,'image/png'));}
  };
}
