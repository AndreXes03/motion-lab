import * as T from 'three';
// Deterministic submillimetre finish variation; geometry and lighting stay untouched.
export function finishMap(kind='satin') {
 const n=256,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const hash=Math.sin(x*127.1+y*311.7)*43758.5453,noise=hash-Math.floor(hash);
  const brushed= .5+.28*Math.sin(y*1.83)+.12*Math.sin(y*.39+x*.018);
  const v=Math.round(kind==='brush'?55+195*brushed:kind==='rubber'?50+200*noise:100+150*noise);
  data.set([v,v,v,255],(y*n+x)*4);
 }
 const tex=new T.DataTexture(data,n,n,T.RGBAFormat);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(2,2);tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.anisotropy=8;tex.needsUpdate=true;return tex;
}
export function refinePulse(scene){
 const brush=finishMap('brush'),rubber=finishMap('rubber'),satin=finishMap();const seen=new Set();
 scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(!m?.isMeshStandardMaterial||seen.has(m)||m.map||m.emissiveMap||m.transmission>0||m.transparent)continue;seen.add(m);
  const hsl={};m.color.getHSL(hsl);if(m.emissive?.getHex()>0&&m.emissiveIntensity>.3)continue;
  if(m.metalness>.7){m.metalness=.96;m.roughness=.27;m.roughnessMap=brush;if(m.isMeshPhysicalMaterial){m.clearcoat=.12;m.clearcoatRoughness=.26;}}
  else if(hsl.l<.06){m.metalness=.015;m.roughness=.66;m.roughnessMap=rubber;if(m.isMeshPhysicalMaterial)m.clearcoat=.04;}
  else if(m.roughness>=.43){m.metalness=.015;m.roughness=.64;m.roughnessMap=rubber;if(m.isMeshPhysicalMaterial)m.clearcoat=.06;}
  else{m.metalness=hsl.s>.45?.28:.04;m.roughness=hsl.s>.45?.29:.43;m.roughnessMap=satin;if(m.isMeshPhysicalMaterial){m.clearcoat=hsl.s>.45?.65:.22;m.clearcoatRoughness=.19;}}
  m.needsUpdate=true;
 }});
}

// Periodic, band-limited surface patterns avoid unstable single-pixel noise.
export function tactileMap(kind='weave',albedo=false){
 const n=512,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n*Math.PI*2,v=y/n*Math.PI*2;
  const warp=Math.sin(u*32),weft=Math.sin(v*32);
  let h=kind==='weave'?.5+.22*warp+.22*weft+.05*Math.sin(u*64+v*32):kind==='leather'?.5+.17*Math.sin(u*19+1.8*Math.sin(v*13))+.17*Math.sin(v*23+1.4*Math.sin(u*17))+.08*Math.sin(u*61+v*47):.5+.3*Math.sin(v*90+.25*Math.sin(u*3))+.1*Math.sin(v*150);
  const value=Math.round(albedo?160+85*h:255*Math.max(0,Math.min(1,h)));data.set([value,value,value,255],(y*n+x)*4);
 }
 const t=new T.DataTexture(data,n,n,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(kind==='leather'?3:2,kind==='leather'?3:2);t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=8;t.needsUpdate=true;if(albedo)t.colorSpace=T.SRGBColorSpace;return t;
}
