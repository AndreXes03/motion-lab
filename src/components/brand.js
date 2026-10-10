import * as T from 'three';
// Reuse the user's actual wordmark pixels. No font substitution or generative redraw.
// Original screenshot remains unchanged; the material isolates blue ink at load time.
const source=new Image();source.src=new URL('../assets/bax-brand-reference.png',import.meta.url).href;
let ink,inkWidth,inkHeight;const cache=new Map();
export const brandReady=source.decode().then(()=>{
 const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
 const image=ctx.getImageData(0,0,c.width,c.height);let left=c.width,right=0,top=c.height,bottom=0;
 for(let y=105;y<434;y++)for(let x=20;x<c.width-20;x++){const i=(y*c.width+x)*4;if(image.data[i+2]-Math.max(image.data[i],image.data[i+1])>60){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}
 if(right<=left)throw Error('BAX logo ink could not be isolated');
 inkWidth=right-left+1;inkHeight=bottom-top+1;ink=new Uint8Array(inkWidth*inkHeight);
 for(let y=0;y<inkHeight;y++)for(let x=0;x<inkWidth;x++){const i=((y+top)*c.width+x+left)*4;ink[y*inkWidth+x]=Math.min(255,Math.max(0,(image.data[i+2]-Math.max(image.data[i],image.data[i+1]))*1.1));}
});
export function createBrandTexture({color='#ffffff'}={}){
 if(!ink)throw Error('Await brandReady before creating branded objects');if(cache.has(color))return cache.get(color);
 const c=document.createElement('canvas');c.width=inkWidth;c.height=inkHeight;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);const image=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<ink.length;i++)image.data[i*4+3]=ink[i];ctx.putImageData(image,0,0);
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;texture.userData.aspect=inkWidth/inkHeight;cache.set(color,texture);return texture;
}
