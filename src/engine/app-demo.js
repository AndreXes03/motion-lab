/** Portable, bounded content document. This contains data, never generated code. */
export const appDemoExample = {
 version:1, name:'Framevolve', benefit:'Your ideas. In motion.', ending:'Make something worth showing.', cta:'Create with Framevolve', accent:'#d7f56b', logo:null,
 slides:[
  {id:'workspace',asset:'/assets/app-demo/workspace.png',title:'Start with a clear direction.',caption:'See your video while you shape it.',duration:4,focus:{x:.52,y:.45,zoom:1.1}},
  {id:'audio',asset:'/assets/app-demo/audio.png',title:'Find your rhythm.',caption:'Move and trim your soundtrack directly.',duration:4,focus:{x:.65,y:.62,zoom:1.35}},
  {id:'delivery',asset:'/assets/app-demo/delivery.png',title:'Ready to share.',caption:'Review your settings and export your video.',duration:4,focus:{x:.5,y:.6,zoom:1.1}}
 ]
};
export function appAssetPath(value){
 if(typeof value!=='string'||!/^\/assets\/app-demo\/(?:[a-f0-9]{64}|workspace|audio|delivery)\.png$/.test(value))throw Error('Choose an image imported into this project.');return value;
}
export function validateAppDemo(input=appDemoExample){
 const fields=(o,keys)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw Error('Unsupported App Demo content.');};
 const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw Error(`${label}: use up to ${max} characters.`);return v.trim();};
 fields(input,['version','name','benefit','ending','cta','accent','logo','slides']);
 if(input.version!==1)throw Error('Unsupported App Demo version.');
 if(!/^#[a-f0-9]{6}$/i.test(input.accent))throw Error('Choose a valid brand color.');
 if(!Array.isArray(input.slides)||input.slides.length<1||input.slides.length>4)throw Error('Use one to four screenshots.');
 const ids=new Set();
 const slides=input.slides.map(s=>{fields(s,['id','asset','title','caption','duration','focus']);
  if(typeof s.id!=='string'||!/^[-a-z0-9]{1,60}$/.test(s.id)||ids.has(s.id))throw Error('Screenshot identifiers must be unique.');ids.add(s.id);
  if(!Number.isFinite(s.duration)||s.duration<3||s.duration>7||s.duration*2%1)throw Error('Reading time must be 3–7 seconds in half-second steps.');
  fields(s.focus,['x','y','zoom']);if(!['x','y'].every(k=>Number.isFinite(s.focus[k])&&s.focus[k]>=0&&s.focus[k]<=1)||!Number.isFinite(s.focus.zoom)||s.focus.zoom<1||s.focus.zoom>2)throw Error('The focus must stay inside the screenshot; zoom is 1–2×.');
  return {id:s.id,asset:appAssetPath(s.asset),title:text(s.title,100,'Headline'),caption:text(s.caption,150,'Supporting line'),duration:s.duration,focus:{...s.focus}};
 });
 return {version:1,name:text(input.name,40,'Product name'),benefit:text(input.benefit,100,'Opening'),ending:text(input.ending,100,'Closing'),cta:text(input.cta,60,'Next action'),accent:input.accent,logo:input.logo?appAssetPath(input.logo):null,slides};
}
export function appDemoDuration(doc=appDemoExample){return 6+validateAppDemo(doc).slides.reduce((n,s)=>n+s.duration,0);}
export function appDemoShots(doc=appDemoExample){const d=validateAppDemo(doc);let start=3;return [{id:'opening',name:'The promise',time:1.6,intent:d.benefit,motion:'A restrained entrance; time to read.'},...d.slides.map(s=>{const shot={id:s.id,name:s.title||'Show the product',time:start+s.duration*.6,intent:s.caption||'Show the actual product.',motion:'Move toward the chosen focus; hold the result.'};start+=s.duration;return shot;}),{id:'closing',name:'The next step',time:start+1.6,intent:d.cta||d.ending,motion:'Settle into the closing message.'}];}
export function appDemoWarnings(doc,images=new Map()){
 const d=validateAppDemo(doc),warnings=[];
 if(!d.name||!d.benefit||!d.cta)warnings.push('Add a product name, a clear opening and a next action.');
 for(const [index,s]of d.slides.entries()){if(!s.title||s.title==='Show what matters.'||s.caption==='Describe the benefit in one short sentence.')warnings.push(`Screen ${index+1}: replace the example words with the benefit this screen shows.`);const img=images.get(s.asset);if(img&&img.width<Math.min(1058,694*img.width/img.height)*s.focus.zoom*.85)warnings.push(`${s.title||'Screenshot'}: use a larger image or reduce the zoom for sharper text.`);if((s.title+' '+s.caption).split(/\s+/).length>s.duration*3)warnings.push(`${s.title||'Screenshot'}: allow more reading time or shorten the text.`);}
 return warnings;
}
