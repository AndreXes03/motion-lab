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

## Simple offline compositing

Framevolve can combine **already rendered 8-bit sRGB PNG frames** from Cycles, Three.js or a 2D graphics pass. It does not render Three.js again, start Blender, convert shaders, or infer assets. A scene author or user supplies the frame layers and timing. This local command requires the installed Node dependencies; it does not execute on the static public website.

The renderer strategy is stored separately in `parameters.renderPolicy`. Its `composite` metadata can point to this executable plan through `planFile`; selecting a strategy alone does not supply the actual frame layers. A mixed renderer job needs available inputs and a validated plan. Disabled composition should bypass this stage and preserve the selected renderer's output.

### Plan

Save a version 1 JSON file. Layers are listed **bottom to top**. All dimensions must match exactly; the compositor never silently resizes, stretches or crops the picture. This example overlays crisp authored graphics over an existing 25 fps Cycles sequence:

```json
{
  "version": 1,
  "colorSpace": "srgb",
  "width": 1920,
  "height": 1440,
  "fps": 25,
  "frameCount": 250,
  "layers": [
    {
      "id": "cycles-beauty",
      "source": {
        "type": "sequence",
        "path": "cycles/frames/frame-%06d.png",
        "startFrame": 1,
        "fps": 25
      }
    },
    {
      "id": "titles",
      "source": {
        "type": "sequence",
        "path": "graphics/frame-%06d.png",
        "startFrame": 1,
        "fps": 25
      },
      "opacity": 1
    }
  ]
}
```

A static PNG uses `{"type":"image","path":"graphics/logo.png"}` and has no `fps` or source `startFrame`. Sequences contain exactly one `%06d` token and default to one-based file indices. Each layer optionally has:

| Field | Default | Meaning |
| --- | --- | --- |
| `startFrame` | `0` | Inclusive output timeline index, zero based |
| `endFrame` | `frameCount` | Exclusive output timeline index |
| `opacity` | `1` | Layer coverage, from 0 to 1 |
| `adjustments.exposure` | `0` | Linear-light exposure in stops, −4 to 4 |
| `adjustments.contrast` | `1` | Display-referred contrast around 50% grey, 0 to 3 |
| `adjustments.saturation` | `1` | Display-referred saturation, 0 to 3 |
| `mask` | Absent | Image or sequence source; luminance multiplied by its alpha sets coverage |
| `glow.intensity` | `0` | Highlight addition, 0 to 0.5 |
| `glow.radius` | `8` | Blur radius, 0.3 to 64 pixels |
| `glow.threshold` | `0.8` | Highlight threshold, 0 to 1 |

Glow is restrained, opt-in, and stays inside the layer's alpha. Use a separate authored glow layer for light that should extend beyond a silhouette. All adjustments and glow can stay at their identity defaults. A single default layer preserves decoded RGBA pixels exactly, including RGB under zero alpha. PNG re-encoding can change the compressed file bytes. MP4 output is a lossy delivery encode.

The sequence index is calculated as:

```text
source.startFrame + floor((outputFrame - layer.startFrame) * source.fps / plan.fps)
```

Lower frame rates hold the previous frame; higher frame rates drop frames. This is deterministic frame mapping, **not** interpolation or motion blur. A layer starts reading its own sequence at its output `startFrame`; add to `source.startFrame` when placing a trimmed section. Masks use the same layer timeline and can have their own source fps. Missing required frames fail validation. Inactive or zero-opacity layers do not need their files.

### Color and alpha

All sources must already use the **same intended display transform** and sRGB output. `colorSpace: "srgb"` is mandatory. Tagged profiles are normalized to sRGB; this does not match Cycles lighting, Three.js tone mapping or custom shaders automatically. Apply a deliberate compatible display transform while rendering each source. Linear EXR, multilayer EXR, ACES scene-linear compositing, premultiplied inputs and HDR video are outside this implementation.

Inputs use straight alpha. Layer blending is display-referred sRGB `over`. Exposure alone converts through linear sRGB; contrast and saturation operate on the display image. Transparent regions remain transparent in PNG outputs. H.264 requires every composed frame to be opaque and a full-duration unmasked bottom layer at opacity 1; supply an actual background layer when necessary. There is no implicit black background. Review the encoded movie for color and edge quality.

### Run

Paths inside the plan are relative to the explicit assets root. Traversal, absolute paths, symlinks escaping that root, animated PNGs, dimension mismatches and unknown plan fields are rejected. Plans are limited to 1 MiB at the CLI, 16 layers, 4096 pixels per side, 18,000 output frames and 1–120 fps. Existing output directories and movies are refused. These commands create a new composed sequence; they reuse existing frames without invoking either renderer:

```sh
node scripts/composite.mjs --plan composition-plan.json --assets renders/pulse --check true
node scripts/composite.mjs --plan composition-plan.json --assets renders/pulse --out renders/pulse-composite
node scripts/composite.mjs --plan composition-plan.json --assets renders/pulse --out renders/pulse-composite-video --encode true --audio approved-mix.wav
```

Omitting `--audio` produces a silent movie. Audio is never selected implicitly or taken from an unrelated render. `--audio-offset 2.5` trims the start of an explicitly supplied track. Short audio is padded with silence; long audio is trimmed to the complete picture duration. A source without an audio stream fails. The output directory contains one-based `frame-%06d.png`, a completion manifest `composition.json`, and `video.mp4` when requested. Interrupted or failed operations may leave partial frames; they have no completion manifest and require a fresh output directory.

### Integrate a local job

```js
import {
  prepareComposite,
  compositeSequence,
  encodeComposite,
} from './scripts/lib/simple-compositor.mjs';

// Preflight all supplied assets before allocating or changing output.
await prepareComposite({ plan, assetsRoot });
const composition = await compositeSequence({
  plan, assetsRoot, outputRoot: newOutputDirectory,
  signal: abortController.signal,
  onProgress: progress => reportJobProgress(progress),
});
const movie = await encodeComposite({
  composition,
  output: `${newOutputDirectory}/video.mp4`,
  audio: explicitlySelectedAudioFile,
  signal: abortController.signal,
});
```

The caller must validate `renderPolicy.composite.planFile` relative to the project and choose the asset root. Never accept arbitrary client paths into a server job. The separate renderer availability check must confirm both the desired renderer and compositor are available. A runnable compositor is not evidence that a scene has exported transparent layers or that every shader has a Cycles equivalent. Titles baked into the original beauty cannot be extracted by this stage.

### Focused verification

```sh
node scripts/test-simple-compositor.mjs
node scripts/composite.mjs --plan composition-plan.json --assets renders/pulse --check true
```

The test uses tiny synthetic frames, not the current PULSE video. It covers identity pixels, alpha order, mask/opacity, changed exposure/saturation, glow, mixed source fps, layer start/end boundaries, invalid paths/plans/dimensions, symlink escape, existing outputs, silent H.264 and explicit short audio with unchanged picture duration. For a real mixed job, inspect the first/last frame and a title transition, verify the completion manifest, then probe/decode the movie and review its compressed picture. Do not re-render an unchanged Three.js beauty to test composition.
