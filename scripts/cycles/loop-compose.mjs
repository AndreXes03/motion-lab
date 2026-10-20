import sharp from 'sharp';
import {finishLoopBeauty} from './loop-optics.mjs';

/** Composite actual Cycles beauty, frosted UI backdrop, then authored typography. */
export async function composeLoopFrame({background,beauty,overlay,glassPanel,width,height,optics}){
  const foreground=optics?await finishLoopBeauty(beauty,{width,height,...optics}):await sharp(beauty).ensureAlpha().resize(width,height).png().toBuffer();
  const base=background?await sharp(background).resize(width,height).composite([{input:foreground}]).png().toBuffer():foreground;
  const layers=[];
  if(glassPanel?.alpha>0){
    const sx=width/1920,sy=height/1080,p=glassPanel;
    const mask=Buffer.from(`<svg width="${width}" height="${height}"><rect x="${p.x*sx}" y="${p.y*sy}" width="${p.width*sx}" height="${p.height*sy}" rx="${p.radius*sx}" fill="white" opacity="${p.alpha}"/></svg>`);
    const rw=Math.round(width*(p.refraction??1)),rh=Math.round(height*(p.refraction??1));
    const frost=await sharp(base).resize(rw,rh).extract({left:Math.floor((rw-width)/2),top:Math.floor((rh-height)/2),width,height}).blur(Math.max(.3,p.blur*sx)).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
    layers.push({input:frost});
  }
  layers.push({input:await sharp(overlay).resize(width,height).png().toBuffer()});
  return sharp(base).composite(layers).png().toBuffer();
}
