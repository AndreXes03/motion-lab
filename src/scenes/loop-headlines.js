import font from '../assets/fonts/space-grotesk-headlines.json' with {type:'json'};

// Synchronous licensed outlines keep native baking and Canvas composition identical.
const paths=new Map();
const advance=char=>font.glyphs[char]?.advance??font.glyphs[' '].advance;
const kern=(a,b)=>font.kerning?.[a+b]??0;
export const headlineWidth=(text,size,tracking=0)=>[...text].reduce((w,c,i)=>w+(advance(c)+(i?kern(text[i-1],c):0))*size/font.unitsPerEm+(i?tracking:0),0);
export function drawHeadline(ctx,text,x,y,size,{reveal=()=>1,color='#f6f7f8',rise=.12,tracking=-1.5}={}){
  ctx.fillStyle=color;let cursor=x;
  [...text].forEach((char,i)=>{
    if(i)cursor+=kern(text[i-1],char)*size/font.unitsPerEm;
    const glyph=font.glyphs[char],q=reveal(i,text.length),tail=1-q;
    if(glyph?.path&&q>0){
      if(!paths.has(char))paths.set(char,new Path2D(glyph.path));
      ctx.save();ctx.globalAlpha*=Math.min(1,q*4);
      // Keep the baseline fixed: every letter shares the word's leftward axis.
      // `rise` retains recipe compatibility but now controls horizontal travel.
      ctx.translate(cursor+tail*size*rise,y);
      ctx.scale(size/font.unitsPerEm,-size/font.unitsPerEm);ctx.fill(paths.get(char));ctx.restore();
    }
    cursor+=advance(char)*size/font.unitsPerEm+tracking;
  });
}
