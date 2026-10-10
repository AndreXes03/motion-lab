# Compositing and export

The **Finishing** panel controls grain, grain size and shutter angle. The default look uses grain 0.018, size 1.1 and a 210° shutter. Chromatic aberration and bloom remain restrained to preserve material detail. Use the clean inspection view to compare effects on and off.

Monochrome grain varies with luminance, is repeatable per frame and is applied after temporal integration. It appears in the viewer and exports, including procedural scenes. It is not denoising.

## Motion blur

Motion blur samples actual camera and object positions with centered exposure and soft shutter weights. It does not cross cuts listed in `motion.cuts` (seconds, or objects with `t`/`time`). The live viewer shows one instant; assess temporal blur in a preview or export.

24 samples are a practical default. 48 reduce artifacts in fast movement at roughly twice the rendering cost; extreme motion may need 48–64. The integration recovers linear light from tone-mapped 8-bit frames, rather than accumulating the renderer's HDR buffers.

## Export

The gear beside Export controls resolution, frame rate, format, bitrate and temporal samples. Preview uses a lighter profile independently of final settings.

- MP4: H.264.
- WebM: VP9.
- ProRes: MOV, 422 HQ, fixed quality.

MP4/WebM bitrate is a VBR target; the actual average depends on content. ProRes encodes 10-bit 4:2:2 but cannot recover source precision. It is not HDR and does not include alpha. Low-bitrate codecs can soften grain. Start at 1080p for quick tests; 4K is available.

```sh
node scripts/cli.mjs export --out renders/film.mp4 --width 3840 --height 2160 --fps 30 --format mp4 --bitrate-mbps 80 --temporal-samples 48
node scripts/cli.mjs export --out renders/master.mov --format prores --fps 30 --temporal-samples 24
```

The CLI respects `--out`. Viewer exports are copied to Downloads; snapshots and technical manifests remain in the project. History shows the destination.

## Surfaces and edges

`src/components/materials.js` builds seamless, seeded maps at four scales, with separate bump height and roughness. The 3D demo uses them on the radio ABS, dial, enamel and gyroscope. Bump changes illuminated normals, not silhouettes. Set strength, scale and seed per component.

Small bevels on the cover and lathed gyroscope hub/core are real geometry. There is no universal automatic bevel for imported meshes.

FXAA (Three.js, MIT) runs after lens distortion and before overlays and grain. The finishing panel can disable it for comparison. This spatial pass does not add scene renders or replace temporal blur.

## Render progress and full frames

Export shows completed/total frames and periodic thumbnails of the last completed frame. These do not follow viewer scrubbing or show the temporal sample currently being calculated. Encoding is a separate stage; 100% means the file is complete and published locally.

**Render full frame** uses the selected time and export resolution, frame rate and blur samples. Its PNG includes finishing, enabled FXAA and temporal integration. It is disabled while another render occupies the engine.

Click a thumbnail for the large preview. Escape or X closes it without stopping rendering. A completed single frame is shown at its original resolution and can be downloaded.

The viewer browser, including Safari, is separate from export: Chrome runs in the background for deterministic rendering. Keep the local viewer process running until export completes.

## Depth of field

A 3D bokeh pass runs before bloom, with center autofocus or manual focus distance. 2D overlays stay sharp. It is disabled by default and bypassed in inspection views; its panel is hidden in 2D mode.

Recipes store `look.post.dofEnabled`, `dofAuto`, `dofFocus` (.1–1000), `dofStrength` (0–1) and `dofMaxBlur` (0–30 pixels at 1080p).

This is a screen-space effect: transparent surfaces and blurred edges are approximate. Autofocus may jump across silhouettes; use manual focus for those shots.
