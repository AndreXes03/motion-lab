// Framevolve Free Use License. Versioned adapter for the pinned Cycles node API.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {Matrix4,Vector3,Quaternion,BufferGeometry,Float32BufferAttribute} from 'three';
const xml=v=>String(Array.isArray(v)?v.join(' '):v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const tag=(name,attrs={},children=null)=>`<${name} ${Object.entries(attrs).filter(([,v])=>v!==undefined).map(([k,v])=>`${k}="${xml(v)}"`).join(' ')}${children===null?'/>' : '>'+children+`</${name}>`}`;
const connect=(a,b)=>tag('connect',{from:a,to:b});
const matrix=a=>new Matrix4().fromArray(a);
const packed=m=>[0,1,2].flatMap(i=>[m.elements[i],m.elements[i+4],m.elements[i+8],m.elements[i+12]]);
const identity=()=>new Matrix4();
function interpolate(a,b,t){const p=new Vector3(),q=new Quaternion(),s=new Vector3(),p2=p.clone(),q2=q.clone(),s2=s.clone();a.decompose(p,q,s);b.decompose(p2,q2,s2);return new Matrix4().compose(p.lerp(p2,t),q.slerp(q2,t),s.lerp(s2,t));}
export function worldMatrices(snapshot,nodes){const local=new Map(snapshot.nodes.map(n=>[n.uuid,matrix(n.matrix)])),cache=new Map(),parents=new Map(nodes.map(n=>[n.uuid,n.parent]));function get(id){if(cache.has(id))return cache.get(id);const m=local.get(id)??identity(),p=parents.get(id);const w=p&&local.has(p)?get(p).clone().multiply(m):m.clone();cache.set(id,w);return w;}return get;}
export const centerSample=(options,frame)=>options.command==='frame'?1:(frame-1)*2+1;
export async function prepareAdapter(directory){
 const data=JSON.parse(await readFile(path.join(directory,'scene.json'),'utf8'));
 const folder=path.join(directory,'native');await mkdir(folder,{recursive:true});
 const textureFiles=[];
 for(let id=0;id<data.textures.length;id++){
  const t=data.textures[id],raw=Buffer.from(t.base64,'base64');let file=path.join(folder,`texture-${id}.${t.float?'pfm':'png'}`);
  if(t.float){const pixels=Buffer.alloc(t.width*t.height*12);for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++)for(let c=0;c<3;c++){const sy=t.flipY?t.height-1-y:y;pixels.writeFloatLE(raw.readFloatLE(((sy*t.width+x)*4+c)*4),((y*t.width+x)*3+c)*4);}await writeFile(file,Buffer.concat([Buffer.from(`PF\n${t.width} ${t.height}\n-1.0\n`),pixels]));}
  else{let im=sharp(raw,{raw:{width:t.width,height:t.height,channels:4}});if(!t.flipY)im=im.flip();await im.png().toFile(file);}
  textureFiles.push(file);
 }
 const geomCache=new Map();
 async function geometry(id,slot,slots){const key=`${id}-${slot}-${slots}`;if(geomCache.has(key))return geomCache.get(key);
  const g=JSON.parse(await readFile(path.join(directory,'geometries',id+'.json'),'utf8'));
  const all=g.index??Array.from({length:g.position.length/3},(_,i)=>i),idx=[];
  for(let i=0;i<all.length;i+=3){const group=g.groups.find(a=>i>=a.start&&i<a.start+a.count);if(Math.min(group?.materialIndex??0,slots-1)===slot)idx.push(...all.slice(i,i+3));}
  if(!idx.length){geomCache.set(key,null);return null;}
  let tangent;
  if(g.uv&&g.normal){const bg=new BufferGeometry();bg.setAttribute('position',new Float32BufferAttribute(g.position,3));bg.setAttribute('normal',new Float32BufferAttribute(g.normal,3));bg.setAttribute('uv',new Float32BufferAttribute(g.uv,2));bg.setIndex(all);bg.computeTangents();tangent=bg.attributes.tangent?.array;bg.dispose();}
  const mesh=tag('mesh',{P:g.position,verts:idx,nverts:Array(idx.length/3).fill(3),N:g.normal??undefined,UV:g.uv?idx.flatMap(i=>g.uv.slice(i*2,i*2+2)):undefined,tangent:tangent?idx.flatMap(i=>Array.from(tangent.slice(i*4,i*4+3))):undefined,tangent_sign:tangent?idx.map(i=>tangent[i*4+3]):undefined});
  const file=path.join(folder,`geometry-${key}.xml`);await writeFile(file,tag('cycles',{},mesh));geomCache.set(key,file);return file;
 }
 return {data,folder,textureFiles,geometry};
}
function materialGraph(m,textures,files){
 let nodes='',counter=0;
 function tex(id,role){const name='tex'+counter++,t=textures[id];nodes+=tag('image_texture',{name,filename:path.basename(files[id]),colorspace:role==='color'&&t.srgb?'sRGB':'raw',extension:t.clamp?'clamp':'periodic','tex_mapping.scale':[...t.repeat,1],'tex_mapping.translation':[...t.offset,0]});return name;}
 const base=m.color,emission=m.emissive;
 nodes+=tag('principled_bsdf',{name:'p',base_color:base,roughness:m.roughness,metallic:m.metalness,emission_color:emission,emission_strength:m.emissiveIntensity,coat_weight:m.clearcoat,coat_roughness:m.clearcoatRoughness,transmission_weight:m.transmission,ior:m.ior,anisotropic:m.anisotropy,sheen_weight:m.sheen,sheen_roughness:m.sheenRoughness,sheen_tint:m.sheenColor,alpha:m.transparent?m.opacity:1});
 let baseOut=null;
 for(const [key,tint,dest] of [['map',base,'base_color'],['emissiveMap',emission,'emission_color']])if(m[key]!==null){const t=tex(m[key],'color'),mix='mix'+counter++;nodes+=tag('mix',{name:mix,mix_type:'multiply',fac:1,color2:tint})+connect(`${t} color`,`${mix} color1`)+connect(`${mix} color`,`p ${dest}`);if(key==='map'){baseOut=`${mix} color`;if(m.transparent)nodes+=connect(`${t} alpha`,'p alpha');}}
 if(m.roughnessMap!==null){const t=tex(m.roughnessMap,'data');nodes+=tag('separate_color',{name:'channels'})+tag('math',{name:'rough',math_type:'multiply',value2:m.roughness})+connect(`${t} color`,'channels color')+connect('channels g','rough value1')+connect('rough value','p roughness');}
 if(m.normalMap!==null){const t=tex(m.normalMap,'data');nodes+=tag('normal_map',{name:'normal',strength:m.normalScale[0]})+connect(`${t} color`,'normal color')+connect('normal normal','p normal');}
 else if(m.bumpMap!==null){const t=tex(m.bumpMap,'data');nodes+=tag('bump',{name:'bump',distance:m.bumpScale})+connect(`${t} color`,'bump height')+connect('bump normal','p normal');}
 if(m.basic){nodes+=tag('emission',{name:'basic',color:base,strength:1});if(baseOut)nodes+=connect(baseOut,'basic color');nodes+=connect('basic emission','output surface');}
 else nodes+=connect('p BSDF','output surface');
 return nodes;
}
export async function adaptFrame(adapter,directory,frame,options){
 const {data,folder,geometry}=adapter,c=centerSample(options,frame);
 const snapshots=await Promise.all([c-1,c,c+1].map(async i=>JSON.parse(await readFile(path.join(directory,'baked',`snapshot_${String(i).padStart(4,'0')}.json`),'utf8'))));
 const [before,s,after]=snapshots;const transforms=snapshots.map(a=>worldMatrices(a,data.nodes));
 const files=[...adapter.textureFiles];for(const d of s.dynamics){const file=path.join(folder,`dynamic-${frame}-${d.id}.png`);await writeFile(file,Buffer.from(d.png.split(',')[1],'base64'));files[d.id]=file;}
 const materials=data.materials.map((m,i)=>({...m,...s.materials.find(a=>a.id===i)}));
 let body=tag('integrator',{max_bounce:options.bounces,transparent_max_bounce:8,use_denoise:options.denoise,denoiser_type:'openimagedenoise',denoise_use_gpu:false,motion_blur:options.motionBlur,use_adaptive_sampling:true,adaptive_threshold:options.samples>=512?.003:.015,seed:0})+tag('film',{exposure:s.exposure,filter_type:'blackman_harris',filter_width:1.5});
 const cameraMatrix=snap=>matrix(snap.camera.matrix).multiply(new Matrix4().makeScale(1,1,-1));
 const cam=cameraMatrix(s),dof=s.camera.dof,camMotion=options.motionBlur?[interpolate(cam,cameraMatrix(before),options.shutter),cam,interpolate(cam,cameraMatrix(after),options.shutter)].flatMap(packed):undefined;
 const fov=s.camera.fov*Math.PI/180;
 body+=tag('transform',{matrix:cam.toArray()},tag('camera',{width:options.width,height:options.height,type:'perspective',fov,nearclip:s.camera.near,farclip:s.camera.far,shuttertime:options.shutter,motion:camMotion,use_perspective_motion:options.motionBlur,fov_pre:(s.camera.fov+(before.camera.fov-s.camera.fov)*options.shutter)*Math.PI/180,fov_post:(s.camera.fov+(after.camera.fov-s.camera.fov)*options.shutter)*Math.PI/180,aperturesize:dof?.enabled?(.012/Math.tan(fov/2))/(2*dof.fstop):0,focaldistance:dof?.focusDistance??10}));
 const bgFile=path.join(folder,`background-${frame}.png`);await writeFile(bgFile,Buffer.from(s.background.split(',')[1],'base64'));
 let background=tag('background',{name:'env',strength:s.environmentIntensity,color:[0,0,0]});
 if(s.environment!==null)background+=tag('environment_texture',{name:'hdr',filename:path.basename(files[s.environment]),colorspace:'raw','tex_mapping.rotation':[Math.PI/2,0,0]})+connect('hdr color','env color');
 background+=tag('texture_coordinate',{name:'coord'})+tag('image_texture',{name:'bgtex',filename:path.basename(bgFile),colorspace:'sRGB',extension:'clamp'})+tag('background',{name:'paint',strength:1})+tag('light_path',{name:'ray'})+tag('mix_closure',{name:'mix'})+connect('coord window','bgtex vector')+connect('bgtex color','paint color')+connect('ray is_camera_ray','mix fac')+connect('env background','mix closure1')+connect('paint background','mix closure2')+connect('mix closure','output surface');
 body+=tag('background',{transparent:options.background==='transparent'||options.scene==='loop'},background);
 // Explicit environment light enables MIS for the world shader.
 body+=tag('light',{light_type:'background',use_mis:true});
 const omitted=[],shaders=new Map();
 for(const visible of s.visible){const o=data.objects[visible.id];if(o.materials.some(id=>materials[id].type==='ShaderMaterial'||materials[id].basic&&materials[id].transparent)){omitted.push(o.name);continue;}
  const matrices=snapshots.map((snap,j)=>{const state=snap.visible.find(a=>a.id===visible.id)??visible;return transforms[j](o.parent).clone().multiply(matrix(state.matrix));});
  const center=matrices[1],motion=options.motionBlur?[interpolate(center,matrices[0],options.shutter),center,interpolate(center,matrices[2],options.shutter)].flatMap(packed):undefined;
  for(let slot=0;slot<o.materials.length;slot++){const mid=o.materials[slot],key=mid+'-'+(o.instanceColor?.join('-')??'base');let name=shaders.get(key);
   if(!name){name='m'+shaders.size;let m={...materials[mid]};if(o.instanceColor){m.color=m.color.map((x,i)=>x*o.instanceColor[i]);m.emissive=m.emissive.map((x,i)=>x*o.instanceColor[i]);}body+=tag('shader',{name},materialGraph(m,data.textures,files));shaders.set(key,name);}
   const file=await geometry(visible.geometry,slot,o.materials.length);if(!file)continue;
   const object=`o${visible.id}s${slot}`;
   body+=tag('transform',{matrix:center.toArray()},tag('object',{name:object,motion})+tag('state',{object,shader:name,interpolation:'smooth'},tag('include',{src:path.basename(file)})));
  }
 }
 body+=tag('shader',{name:'light'},tag('emission',{name:'e',color:[1,1,1],strength:1})+connect('e emission','output surface'));
 for(const light of s.lights){const type={RectAreaLight:'area',PointLight:'point',DirectionalLight:'sun',SpotLight:'spot'}[light.type];if(!type)throw Error('Unsupported native light '+light.type);
  const lm=matrix(light.matrix), lightMotion=options.motionBlur?[interpolate(lm,matrix(before.lights.find(x=>x.uuid===light.uuid)?.matrix??light.matrix),options.shutter),lm,interpolate(lm,matrix(after.lights.find(x=>x.uuid===light.uuid)?.matrix??light.matrix),options.shutter)].flatMap(packed):undefined;
  const power=light.intensity*(type==='area'?light.width*light.height*Math.PI:['point','spot'].includes(type)?4*Math.PI:1);
  body+=tag('state',{shader:'light'},tag('transform',{matrix:light.matrix},tag('light',{light_type:type,motion:lightMotion,strength:light.color.map(x=>x*power),normalize:true,use_mis:true,sizeu:light.width,sizev:light.height,radius:.04,angle:type==='spot'?light.angle*2:0,smooth:light.penumbra})));
 }
 const file=path.join(folder,`frame-${frame}.xml`);await writeFile(file,tag('cycles',{},body));
 return {file,snapshot:s,omitted};
}
