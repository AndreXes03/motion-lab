/** Display-referred grain, applied once AFTER temporal integration. No playback state. */
export function applyFilmGrain(ctx, time, width, height, { amount = 0, size = 1.1, fps = 30 } = {}) {
  if (!(amount > 0)) return;
  const frame = Math.floor(Math.max(0,time) * fps + 1e-6);
  let seed = (0x51f15e ^ Math.imul(frame + 1, 0x9e3779b1)) >>> 0;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const field = new Float32Array(256 * 256);
  for(let i=0;i<field.length;i++) field[i]=(random()+random()+random()-1.5)*2;
  const cell = Math.max(.4, Math.min(3,size)) * height / 1080;
  const xs = new Int32Array(width), blends = new Float32Array(width);
  for(let x=0;x<width;x++){const u=x/cell;xs[x]=Math.floor(u)&255;blends[x]=u-Math.floor(u);}
  const pixels=ctx.getImageData(0,0,width,height), data=pixels.data;
  const strength=Math.min(.08,amount)*255;
  for(let y=0;y<height;y++){
    const v=y/cell, y0=Math.floor(v)&255, y1=(y0+1)&255, fy=v-Math.floor(v);
    for(let x=0;x<width;x++){
      const x0=xs[x],x1=(x0+1)&255,fx=blends[x];
      const a=field[y0*256+x0]*(1-fx)+field[y0*256+x1]*fx;
      const b=field[y1*256+x0]*(1-fx)+field[y1*256+x1]*fx;
      const i=(y*width+x)*4, l=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;
      // Protect deep blacks and specular whites; mostly monochromatic emulsion texture.
      const envelope=.12+.88*Math.sqrt(Math.max(0,4*l*(1-l)));
      const grain=(a*(1-fy)+b*fy)*strength*envelope;
      data[i]+=grain;data[i+1]+=grain;data[i+2]+=grain;
    }
  }
  ctx.putImageData(pixels,0,0);
}
