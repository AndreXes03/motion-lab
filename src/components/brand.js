import * as T from 'three';

// Original vector initials for the demo objects; no reference image is loaded.
const cache=new Map();
export const brandReady=Promise.resolve();
export function createBrandTexture({color='#ffffff'}={}) {
 if(cache.has(color))return cache.get(color);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=320;
 const ctx=canvas.getContext('2d');ctx.fillStyle=color;
 // F: broad, square-ended strokes. V: the same weight with a clean inner notch.
 ctx.fillRect(30,36,58,248);ctx.fillRect(30,36,262,58);ctx.fillRect(30,143,208,56);
 ctx.beginPath();ctx.moveTo(342,36);ctx.lineTo(408,36);ctx.lineTo(526,222);
 ctx.lineTo(644,36);ctx.lineTo(710,36);ctx.lineTo(554,284);ctx.lineTo(498,284);ctx.closePath();ctx.fill();
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=8;texture.userData.aspect=canvas.width/canvas.height;
 cache.set(color,texture);return texture;
}
