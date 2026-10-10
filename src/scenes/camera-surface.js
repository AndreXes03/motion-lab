import * as T from 'three';
/** Deterministic circular tool marks in physical blade coordinates, kept below the broad studio glints. */
export function createMachinedFinish(){
 const size=1024,rough=new Uint8Array(size*size*4),normal=new Uint16Array(size*size*4),aniso=new Uint8Array(size*size*4);
 const hash=(x,y)=>{const z=Math.sin(x*127.1+y*311.7+19.3)*43758.5453;return z-Math.floor(z);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=(x/size-.5)*40,py=(y/size-.5)*40,r=Math.hypot(px,py),theta=Math.atan2(py,px),noise=hash(x,y)-.5;
  const groove=Math.sin(r*43.8+Math.sin(theta*4)*.03),patina=Math.sin(px*.8)*Math.cos(py*.6)*.007;
  const v=Math.max(190,Math.min(254,Math.round(236+groove*5+noise*4+patina*255))),i=(y*size+x)*4;
  rough.set([v,v,v,255],i);
  // Tiny opposing slopes, not embossed scratches. The geometry still owns the bevel silhouette.
  const slope=Math.cos(r*43.8)*.035,nx=-Math.cos(theta)*slope,ny=-Math.sin(theta)*slope;
  normal.set([T.DataUtils.toHalfFloat(nx*.5+.5),T.DataUtils.toHalfFloat(ny*.5+.5),T.DataUtils.toHalfFloat(1),T.DataUtils.toHalfFloat(1)],i);
  aniso.set([Math.round((Math.cos(theta+Math.PI/2)*.5+.5)*255),Math.round((Math.sin(theta+Math.PI/2)*.5+.5)*255),220,255],i);
 }
 const texture=(data,highPrecision=false)=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat,highPrecision?T.HalfFloatType:T.UnsignedByteType);t.colorSpace=T.NoColorSpace;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;};
 const roughnessMap=texture(rough),normalMap=texture(normal,true),anisotropyMap=texture(aniso);
 function mapPlanarUV(geometry){const p=geometry.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)/40+.5;uv[i*2+1]=p.getY(i)/40+.5;}geometry.setAttribute('uv',new T.BufferAttribute(uv,2));}
 function configure(material){material.roughnessMap=roughnessMap;material.normalMap=normalMap;material.normalScale.set(.10,.10);material.anisotropyMap=anisotropyMap;material.anisotropy=.65;material.clearcoatRoughness=Math.max(.19,material.clearcoatRoughness??.2);material.needsUpdate=true;return material;}
 return {roughnessMap,normalMap,anisotropyMap,mapPlanarUV,configure,dispose(){roughnessMap.dispose();normalMap.dispose();anisotropyMap.dispose();}};
}
/** Separate isotropic paint and linear metal finishes; neither reuses radial blade machining. */
export function createMaterialFinishes(){
 const size=512,paint=new Uint8Array(size*size*4),brush=new Uint8Array(size*size*4),peel=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,n=.5+.24*Math.sin(x*1.19+y*.71)+.16*Math.sin(x*.43-y*1.31),p=Math.round(221+24*n),b=Math.round(215+15*Math.sin(x*.83)+7*Math.sin(x*2.37));paint.set([p,p,p,255],i);brush.set([b,b,b,255],i);peel.set([Math.round(128+2*Math.cos(x*1.19+y*.71)),Math.round(128+2*Math.sin(x*.43-y*1.31)),255,255],i);}
 const make=data=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.colorSpace=T.NoColorSpace;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;};
 const sprayedRoughness=make(paint),linearBrushRoughness=make(brush),orangePeelNormal=make(peel);
 return{sprayedRoughness,linearBrushRoughness,orangePeelNormal,dispose(){sprayedRoughness.dispose();linearBrushRoughness.dispose();orangePeelNormal.dispose();}};
}
