import * as T from 'three';
/** Barrel lens for the complete 2D + 3D image. The corner-normalized sampling
 * stays inside the source texture: no black wedges when the camera rolls.
 * Zero is an exact bypass. Diagnostic object views bypass this stage too.
 */
export function createGraphicLens(canvas){
 const renderer=new T.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
 const material=new T.ShaderMaterial({uniforms:{image:{value:texture},strength:{value:0},aspect:{value:16/9}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`uniform sampler2D image;uniform float strength;uniform float aspect;varying vec2 vUv;
 void main(){vec2 p=vUv*2.-1.;vec2 radial=p*vec2(aspect,1.);float r2=dot(radial,radial)/(aspect*aspect+1.);vec2 uv=.5+.5*p*(1.+strength*r2)/(1.+strength);gl_FragColor=texture2D(image,uv);
 #include <colorspace_fragment>
 }`});
 const scene=new T.Scene();scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));const camera=new T.Camera();let width=0,height=0;
 return {dispose(){texture.dispose();material.dispose();scene.children[0].geometry.dispose();renderer.dispose();renderer.forceContextLoss();},apply(ctx,amount=.3){if(!Number.isFinite(amount)||amount<0||amount>.6)throw Error('Fish-eye must be 0..0.6');if(amount===0)return;const w=canvas.width,h=canvas.height;if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);}texture.needsUpdate=true;material.uniforms.strength.value=amount;material.uniforms.aspect.value=w/h;renderer.render(scene,camera);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(renderer.domElement,0,0,w,h);ctx.restore();}};
}
