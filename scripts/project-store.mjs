import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ranges={camera:{fov:[20,100]},lighting:{key:[0,500],fill:[0,2],rim:[0,8],environment:[0,3]},surface:{shellRoughness:[.05,1],grainScale:[0,.1]},post:{exposure:[.1,3],bloomStrength:[0,1],bloomThreshold:[0,10],bloomRadius:[0,1],aberrationPx:[0,12],grain:[0,.08],vignette:[0,.6]},motion:{amount:[0,2]}};
export async function readProject(name){return JSON.parse(await readFile(path.join(ROOT,'project',name+'.json'),'utf8'))}
export function validateLook(look){
for(const key of ['dofEnabled','dofAuto'])if(look?.post?.[key]!==undefined&&typeof look.post[key]!=='boolean')throw Error('Invalid post.'+key);
for(const [key,min,max] of [['dofFocus',.1,1000],['dofStrength',0,1],['dofMaxBlur',0,30]])if(look?.post?.[key]!==undefined&&(!Number.isFinite(look.post[key])||look.post[key]<min||look.post[key]>max))throw Error('Invalid post.'+key);
if(look?.post?.antialias!==undefined&&typeof look.post.antialias!=='boolean')throw Error('post.antialias must be boolean');for(const [section,fields] of Object.entries(ranges)){if(!look[section])throw Error(`Missing ${section}`);for(const [k,[min,max]] of Object.entries(fields)){const x=look[section][k];if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw Error(`${section}.${k} must be ${min}..${max}`)}}if(look.post.grainSize!==undefined&&(!Number.isFinite(look.post.grainSize)||look.post.grainSize<.5||look.post.grainSize>3))throw Error('post.grainSize must be 0.5..3');for(const k of ['keyPosition','keyTarget','rimPosition']){const a=look.lighting[k];if(a!==undefined&&(!Array.isArray(a)||a.length!==3||!a.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100)))throw Error(`Invalid lighting.${k}`)}
for(const k of ['keyColor','rimColor'])if(look.lighting[k]!==undefined&&!/^#[0-9a-f]{6}$/i.test(look.lighting[k]))throw Error(`Invalid lighting.${k}`);
for(const [key,max] of [['lensDistortion',.6],['aoIntensity',1],['shutterAngle',360]])if(look.post[key]!==undefined&&(!Number.isFinite(look.post[key])||look.post[key]<0||look.post[key]>max))throw Error(`Invalid post.${key}`);
return look}
export async function saveLook(look){validateLook(look);const previous=await readProject('look');await mkdir(path.join(ROOT,'project/history'),{recursive:true});await writeFile(path.join(ROOT,'project/history',Date.now()+'-look.json'),JSON.stringify(previous,null,2));const target=path.join(ROOT,'project/look.json');await writeFile(target+'.tmp',JSON.stringify(look,null,2)+'\n');await rename(target+'.tmp',target);for(const [key,max] of [['lensDistortion',.6],['aoIntensity',1],['shutterAngle',360]])if(look.post[key]!==undefined&&(!Number.isFinite(look.post[key])||look.post[key]<0||look.post[key]>max))throw Error(`Invalid post.${key}`);
return look}
