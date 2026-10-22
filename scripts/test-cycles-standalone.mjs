import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {Matrix4} from 'three';
import {adaptFrame,centerSample,prepareAdapter,worldMatrices} from './cycles/standalone/adapter.mjs';
import {renderNative} from './cycles/standalone/render.mjs';

const tr=(x,y=0,z=0)=>new Matrix4().makeTranslation(x,y,z).toArray();
const values=(source,attribute)=>{
 const found=source.match(new RegExp(`${attribute}="([^"]+)"`));
 assert.ok(found,`Missing ${attribute} in ${source.slice(0,160)}`);
 return found[1].split(' ').map(Number);
};
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-6,`${label}: expected ${expected}, got ${actual}`);
const material=(overrides={})=>({type:'MeshStandardMaterial',color:[.8,.6,.4],roughness:.4,metalness:.2,emissive:[.1,.2,.3],emissiveIntensity:1,clearcoat:0,clearcoatRoughness:0,transmission:0,ior:1.5,anisotropy:0,sheen:0,sheenRoughness:.5,sheenColor:[1,1,1],opacity:1,transparent:false,normalScale:[1,1],map:null,emissiveMap:null,roughnessMap:null,normalMap:null,bumpMap:null,bumpScale:0,basic:false,...overrides});
const png=await sharp({create:{width:2,height:2,channels:4,background:'#405060'}}).png().toBuffer();
const temp=await mkdtemp(path.join(os.tmpdir(),'framevolve-cycles-adapter-'));
try{
 await mkdir(path.join(temp,'geometries'));await mkdir(path.join(temp,'baked'));
 const data={
  textures:[{width:2,height:2,base64:Buffer.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]).toString('base64'),float:false,srgb:true,repeat:[2,3],offset:[.1,.2],flipY:true,clamp:false}],
  materials:[material({map:0}),material({color:[.2,.3,.4],basic:true})],
  objects:[{name:'fixture mesh',parent:'child',materials:[0,1],instanceColor:[.5,1,.25]}],
  nodes:[{uuid:'root',parent:null},{uuid:'child',parent:'root'}]
 };
 const geometry={position:[0,0,0,1,0,0,1,1,0,0,1,0],normal:[0,0,1,0,0,1,0,0,1,0,0,1],uv:[0,0,1,0,1,1,0,1],index:[0,1,2,0,2,3],groups:[{start:0,count:3,materialIndex:0},{start:3,count:3,materialIndex:1}]};
 await writeFile(path.join(temp,'scene.json'),JSON.stringify(data));
 await writeFile(path.join(temp,'geometries','0.json'),JSON.stringify(geometry));
 for(const [sample,x] of [[0,8],[1,10],[2,12]]){
  const snapshot={nodes:[{uuid:'root',matrix:tr(x)},{uuid:'child',matrix:tr(2,3)}],visible:[{id:0,geometry:0,matrix:tr(0,4)}],camera:{matrix:tr(0,0,5+sample),fov:60,near:.1,far:100,dof:{enabled:true,fstop:2,focusDistance:7}},materials:[],dynamics:[],lights:[],exposure:1,environment:null,environmentIntensity:0,background:`data:image/png;base64,${png.toString('base64')}`};
  await writeFile(path.join(temp,'baked',`snapshot_${String(sample).padStart(4,'0')}.json`),JSON.stringify(snapshot));
 }
 const adapter=await prepareAdapter(temp);
 const opts={command:'frame',scene:'pulse',width:64,height:64,bounces:4,denoise:false,motionBlur:true,shutter:.5,samples:8,background:'scene'};
 assert.equal(centerSample(opts,1),1);assert.equal(centerSample({...opts,command:'export'},2),3);
 const middle=JSON.parse(await readFile(path.join(temp,'baked','snapshot_0001.json'),'utf8'));
 const world=worldMatrices(middle,data.nodes);
 near(world('child').elements[12],12,'world x');near(world('child').elements[13],3,'world y');
 const converted=await adaptFrame(adapter,temp,1,opts);
 assert.deepEqual(converted.omitted,[]);
 const scene=await readFile(converted.file,'utf8');
 const objectTransforms=[...scene.matchAll(/<transform matrix="([^"]+)"><object name="o0s[01]" motion="([^"]+)"\/>/g)];
 assert.equal(objectTransforms.length,2,'Both material groups must have objects');
 for(const [,matrix,motion] of objectTransforms){
  const center=matrix.split(' ').map(Number),blur=motion.split(' ').map(Number);
  near(center[12],12,'object center x');near(center[13],7,'object center y');
  assert.equal(blur.length,36,'Three 3x4 motion matrices');
  near(blur[3],11,'shutter open x');near(blur[15],12,'shutter center x');near(blur[27],13,'shutter close x');
 }
 const camera=scene.match(/<transform matrix="([^"]+)"><camera ([^>]+)\/>/);
 assert.ok(camera,'Camera transform');near(camera[1].split(' ').map(Number)[14],6,'camera center z');
 const cameraMotion=values(camera[2],'motion');near(cameraMotion[11],5.5,'camera shutter open z');near(cameraMotion[35],6.5,'camera shutter close z');
 near(values(camera[2],'focaldistance')[0],7,'lens focus distance');
 assert.ok(values(camera[2],'aperturesize')[0]>0,'Physical depth of field enabled');
 assert.match(scene,/base_color="0\.4 0\.6 0\.1"/,'Instance color must tint first material');
 assert.match(scene,/color="0\.1 0\.3 0\.1"/,'Instance color must tint second basic material');
 assert.match(scene,/colorspace="sRGB"/,'Color texture uses sRGB');
 assert.match(scene,/tex_mapping\.scale="2 3 1"/,'UV repeat is preserved');
 const group0=await readFile(await adapter.geometry(0,0,2),'utf8');
 const group1=await readFile(await adapter.geometry(0,1,2),'utf8');
 assert.deepEqual(values(group0,'verts'),[0,1,2]);assert.deepEqual(values(group1,'verts'),[0,2,3]);
 assert.deepEqual(values(group1,'UV'),[0,0,1,1,0,1]);
 assert.deepEqual(values(group0,'N'),geometry.normal);
 assert.equal(values(group0,'tangent').length,9,'Tangents accompany normals and UVs');
 const texture=await sharp(adapter.textureFiles[0]).raw().toBuffer();
 assert.deepEqual([...texture.subarray(0,4)],[255,0,0,255],'Texture row orientation');
 await assert.rejects(()=>renderNative({directory:temp,options:{...opts,device:'metal',progressive:false},runtime:{devices:[{type:'CPU',name:'CPU'}]},pending:[1],run:()=>{throw Error('Should not run');},onEvent:()=>{}}),/METAL is unavailable/);
 console.log('Standalone Cycles fixture: hierarchy, shutter endpoints, lens, instance colors, material groups, UV/normals/tangents, texture and GPU guard passed');
}finally{await rm(temp,{recursive:true,force:true});}
