import {createProceduralDemo} from '../src/scenes/procedural-demo.js';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),scene=createProceduralDemo({duration:10});
const logo=new Image();logo.src='../demo/andrea-salvo-logo.png';
window.proceduralReady=logo.decode();
window.renderAt=time=>{ctx.save();ctx.scale(.5,.5);scene.render(ctx,time,{graphics:{cleanPreview:true}});ctx.restore();if(logo.complete&&logo.naturalWidth){ctx.drawImage(logo,28,485,150,logo.naturalHeight/logo.naturalWidth*150);}};
window.proceduralSettings={duration:100/11,width:960,height:540};
const start=performance.now();window.proceduralReady.then(()=>{function tick(now){window.renderAt(((now-start)/1000)%(100/11));requestAnimationFrame(tick)}requestAnimationFrame(tick)});
