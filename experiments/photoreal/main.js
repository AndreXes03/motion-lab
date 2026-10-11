import * as T from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { createPhotoScene } from './scene.js';

window.lab = {
  async render({ width = 960, height = 720, samples = 128, asset = 'headphones' } = {}) {
    const renderer = new T.WebGLRenderer({
      antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height);
    renderer.toneMapping = T.AgXToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = T.SRGBColorSpace;
    document.body.append(renderer.domElement);
    const world = createPhotoScene(renderer, { asset, width, height });
    let pt, presentation;
    try {
      let start = performance.now();
      renderer.render(world.scene, world.camera);
      renderer.getContext().finish();
      const rasterMs = performance.now() - start;
      const raster = renderer.domElement.toDataURL('image/png');
      await window.saveImage?.('raster', raster);

      pt = new WebGLPathTracer(renderer);
      pt.bounces = 8;
      pt.filterGlossyFactor = .35;
      pt.tiles.set(2, 2);
      pt.renderDelay = 0;
      pt.fadeDuration = 0;
      pt.minSamples = 1;
      pt.rasterizeScene = false;
      // Export the accumulated target explicitly, independent of preview fading
      // and any depth/viewport state left by the raster comparison.
      pt.renderToCanvas = false;
      start = performance.now();
      pt.setScene(world.scene, world.camera);
      const setupMs = performance.now() - start;
      start = performance.now();
      let next = 128, nextFence = 16;
      const checkpoint = new Float32Array(4);
      while (pt.samples < samples) {
        if (performance.now() - start > 15 * 60 * 1000) throw Error('Render exceeded 15 minutes');
        pt.renderSample();
        if(renderer.getContext().isContextLost()) throw Error("WebGL context lost during sampling");
        if (pt.samples >= nextFence) {
          // Drain actual GPU work in bounded batches. gl.finish alone can leave
          // a long command queue in headless Chrome on this host.
          renderer.readRenderTargetPixels(pt.target, 0, 0, 1, 1, checkpoint);
          if(!checkpoint.every(Number.isFinite)) throw Error('Non-finite path-tracing buffer');
          nextFence += 16;
        }
        if (pt.samples >= next) {
          renderer.getContext().finish();
          await window.reportProgress?.({ samples: pt.samples, seconds: (performance.now() - start) / 1000 });
          next += 128;
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      renderer.getContext().finish();
      const pathMs = performance.now() - start;
      presentation = new FullScreenQuad(new T.ShaderMaterial({
        uniforms: { source: { value: pt.target.texture } },
        depthTest: false, depthWrite: false, blending: T.NoBlending,
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
        fragmentShader: `uniform sampler2D source; varying vec2 vUv;
          void main(){gl_FragColor=texture2D(source,vUv);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }));
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.clear();
      presentation.render(renderer);
      renderer.getContext().finish();
      const gl=renderer.getContext();
      if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw Error('GPU error during final capture');
      const path = renderer.domElement.toDataURL('image/png');
      if (path === raster) throw Error('Path capture matches raster; refusing a false comparison');
      await window.saveImage?.('pathtraced', path);
      return {
        asset, width, height, samples, bounces: 8, rasterMs, setupMs, pathMs,
        ...world.report,
        renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER),
        note: 'Same frozen geometry, materials, camera and lights. No denoiser, bloom, depth of field or motion blur. Basic materials adapted; custom material shaders omitted; clearcoat disabled in both views because the tested path tracer produces black coated surfaces. Surface maps from Motion Lab applied to both views. Still-image experiment.',
      };
    } finally {
      presentation?.material.dispose();
      presentation?.dispose();
      pt?.dispose();
      world.dispose();
      renderer.dispose();
    }
  },
};
