# Renderer selection

Framevolve keeps its interactive 3D preview in Three.js and its procedural 2D preview in Canvas. Each recipe can also store an agent-authored final-render strategy in `parameters.renderPolicy`. The user can override the engine in the export panel. Selecting an engine is separate from verifying that the local machine can execute it.

- **Auto** uses the agent's preference when local capabilities and the requested time budget permit it. Otherwise it selects Three.js and explains the reason.
- **Three.js** preserves the working scene, procedural shaders and existing finish. It is the default for motion graphics and fast iteration.
- **Cycles** uses the local Blender path for a supported scene. The first supported scene is PULSE; other scenes require an explicit converter and a quality check. Blender installation, available devices and scene support must be checked locally before exporting.
- **Mixed** records a strategy for rendered layers or shots from different engines. It requires a prepared local compositing plan and verified inputs. Metadata by itself never starts a mixed render.

In browsers with canvas recording support, the public Studio exports browser-rendered video at 720p or 1080p, PNG frames and JSON recipes. MP4 is offered when the browser supports its encoder; otherwise it offers WebM. Public video uses the real-time Three.js/Canvas path. Blender/Cycles and prepared file-based compositing run in the local app. The selector may preserve a requested local renderer in a downloaded recipe, but the public site does not execute Cycles or Mixed jobs.

## Full-resolution Render View

**Render View** pauses playback and renders the current timeline position at the output dimensions selected in Export. **Final look** uses that resolved final engine: Three.js/Canvas renders directly in the browser; a selected Cycles or Mixed engine requests an actual local frame. Cycles still supports **PULSE only** and requires a successful Blender capability check. Its samples, device, denoising and motion-blur choice come from the same recipe and output settings as export. The frame may take time to finish; increasing display resolution does not turn a Three.js preview into Cycles.

For viewport-only Cycles jobs, one Blender process first traces a quarter-resolution pass with up to 4 samples, then a half-resolution pass with up to 16 samples, and finally the requested full-resolution/sample settings. These are real render passes with the same scene, materials, display grade and titles; they are not blurred placeholders. Scene baking and Blender setup must complete before the first image can appear. Ordinary PNG/video exports keep their single final-quality path.

The viewport displays these intermediate images as they arrive and keeps the previous rendered frame visible while the next one is pending. Changes are debounced, only one local frame runs at a time, and intermediate requests are replaced by the newest snapshot. Obsolete completions are never displayed. Render failures and unavailable engines are shown explicitly, with Retry, renderer settings and a return to interactive preview. Playback returns to interactive mode. Diagnostic Clay, Wireframe and Normals remain browser inspection modes.

On the public site, an explicit Cycles or Mixed selection shows that the local renderer is required; it never labels a browser-rendered frame as Cycles. Open the local Studio for those frames. Auto may resolve to Three.js according to the existing fallback policy.

`src/viewer/render-frame-view.js` submits `POST /api/studio/render` with `kind: 'frame'` and `purpose: 'viewport'`, polls the job and verifies its actual engine before displaying its image. These cached viewport jobs remain under `renders/studio`, are omitted from export history, and are not automatically copied into Downloads. Regular export jobs retain their existing delivery behavior. The Preview PNG action downloads the completed displayed engine frame.

## Recipe contract

```js
parameters.renderPolicy = {
  version: 1,
  renderer: 'auto',                  // auto | threejs | cycles | mixed
  source: 'agent',                   // agent | user
  intent: 'photoreal',               // motion-graphics | product | photoreal
  preferredRenderer: 'cycles',       // preference applied by Auto only
  rationale: 'Traced reflections suit this metal product close-up.',
  quality: 'balanced',               // draft | balanced | final
  budgetSeconds: 3600,               // optional measured-time budget; null = no budget
  cycles: {
    samples: 64, denoise: true,
    device: 'auto',                  // auto | cpu | gpu | metal
    workers: 'auto'                  // auto | 1 | 2, bounded by local preflight
  },
  shots: [{id: 'hero', start: 0, end: 4, renderer: 'cycles', rationale: 'Product hero'}],
  layers: [{id: 'product', renderer: 'cycles', role: 'beauty', opacity: 1}],
  composite: {enabled: false, planFile: null, rationale: '', audioFile: null, audioOffset: 0}
};
```

`validateRenderPlan` rejects unknown fields, unsupported versions, invalid types, duplicate IDs, invalid shot ranges and unsafe plan paths. It normalizes defaults and supports JSON round trips. `overrideRenderPlan(plan, engine)` records a user override. A single engine override applies to every resolved shot and layer. Engine metadata never changes the authored scene, `animation`, `animation.groups`, `animation.rates`, audio or existing finishing parameters.

`resolveRenderPlan(plan, context)` returns `requestedRenderer`, `selectedRenderer`, `previewRenderer`, `runnable`, `availability`, `reason`, `warnings`, resolved `shots`/`layers`, and `estimateSeconds`/`estimateNote`. A requested but unavailable explicit engine remains selected with `runnable: false`; it must not silently export through another engine. Auto can fall back with a visible reason.

## Local capability contract

The integrated local API exposes `GET /api/studio/capabilities` and returns `{capabilities: {...}}`. The Cycles helper probes Blender's available Metal, OptiX, CUDA, HIP and oneAPI backends; do not infer GPU support from installation or RAM/CPU usage. `gpu` accepts any verified supported GPU backend, while `metal` requires a verified Metal device. `auto` selects an available supported GPU or falls back to CPU.

```js
{
  threejs: {available: true},
  cycles: {
    available: true,
    scenes: ['pulse'],
    device: 'METAL',
    devices: [{type: 'METAL', name: 'Verified local GPU'}],
    reason: 'Local Blender ready',
    limits: {workers: 2, samples: 4096},
    measured: {secondsPerFrame: 2, width: 640, height: 480, samples: 64, device: 'METAL'}
  },
  mixed: {available: true, reason: 'Local compositor ready; prepared plan and inputs are checked before queueing.'}
}
```

Use the optional `measured` field only for a completed comparable frame benchmark on the actual device. Estimates scale by pixel count, samples and frame count and are approximate; startup, scene changes, adaptive sampling, memory limits and encoding affect elapsed time. Auto falls back to Three.js if a supplied time budget cannot be checked against a measurement. Worker counts are deliberately bounded and never used as an invented linear speed multiplier.

## Integrated viewer and server

The renderer panel lives in `src/viewer/render-panel.js`, imports its own CSS, and is mounted by the current Studio viewer. The authoring agent can save scene defaults in `project/render-plans.json`. Recipes and versions carry the selected policy in `parameters.renderPolicy`; importing a recipe restores it. Existing recipes without a policy receive a safe default.

`mountRenderPanel({container, getScene, getParameters, getExportSettings, publicDemo, onChange})` exposes `getPlan`, `setPlan`, `getSelection`, `refresh`, and `setCapabilities`. `getParameters` reads the authored source recipe, without recursively attaching the panel's current plan. The panel remembers each scene's user preference during the open session; explicit recipe imports and resets call `setPlan`. Export-setting changes refresh any available time estimate.

The viewer fetches `/api/studio/capabilities` locally, unwraps `data.capabilities`, and supplies it to the panel. The public site does not probe local Blender. It offers browser-rendered Three.js/Canvas video when recording is supported, plus PNG frames and JSON recipes; Cycles and prepared Mixed jobs remain local-only.

The server normalizes `parameters.renderPolicy` with `validateRenderPlan`, resolves it against local capabilities, and rejects unavailable explicit requests. It records the actual engine and resolved selection in each job. Three.js uses the established renderer; verified Cycles jobs use `scripts/cycles.mjs` with the canonical plan's samples, device, bounded workers and denoising settings. Cycles currently produces PNG frames and MP4 videos; WebM/ProRes require the existing Three.js route. All unrelated scene controls, animation groups/rates, and numeric tracks remain in the snapshot.

The interactive Three.js preview and Cycles output have different finishing paths; a Cycles Render View shows the actual Cycles result. PULSE materials, light units and Filmic response are translated; custom shaders and per-material environment maps are not equivalent. Preview depth of field, fisheye/edge softness, bloom and ambient occlusion do not transfer. Camera/object animation and group/rate controls are baked at absolute time; deformation and animated textures update per output frame and do not receive deformation/texture motion blur. PULSE scene exposure is preserved through its authored exposure control; `look.post.exposure` is not a separate Cycles exposure control. The default `display` finish applies the same `look.post.colorContrast` and `look.post.colorSaturation` formula as the Studio after Cycles Filmic, sampled at each absolute frame time. This shares the grading controls while preserving the renderer's different color response. CLI `--finish raw` skips this display grade.

## Simple compositing

Renderer policy stores strategy metadata: layer engine/role/opacity, shot engine/rationale, and `composite: {enabled, planFile, rationale, audioFile, audioOffset}`. The actual compositor owns a separate version 1 execution plan: output dimensions/fps/frame count and bottom-to-top image or frame-sequence sources, opacity, exposure/contrast/saturation, optional masks and restrained glow. Paths are relative to the selected local assets root. Source frame numbering is explicit; Cycles sequences commonly start at 1 while output frame offsets start at 0.

Use `scripts/composite.mjs --plan project/pulse-composite.json --assets renders --out renders/composite`. See [COMPOSITING.md](./COMPOSITING.md) for its exact executable plan and checks. Policy layer metadata is not a second execution schema. The Studio API supports Mixed jobs through the same local compositor after checking and freezing the referenced plan and prepared inputs. Prepared layers keep their rendered content; re-render them after scene edits. Optional agent-authored `composite.audioFile` points to a project-relative `.wav`, `.mp3`, `.m4a`, `.aac`, `.mp4`, `.mov`, or `.webm` source. `audioOffset` is an optional finite 0–7200 second source offset, defaults to 0, and requires an audio file if nonzero. Both are saved in the recipe; the backend validates the actual source, freezes it with the job, and passes it to the compositor. There is no soundtrack when `audioFile` is null. Current Audio panel edits do not change an already prepared layer or soundtrack; regenerate and attach the intended audio for those changes to reach a Mixed export. Keep compositing optional; an off switch preserves the previous picture. This small bridge does not claim cross-engine shader, transparency or motion-blur parity.

## Checks

`node scripts/test-render-frame-view.mjs` covers immutable full-resolution snapshots, progressive image delivery, request coalescing, serialized jobs, stale-result suppression, engine verification, local availability, renderer-busy retries and disposal. `python3 scripts/cycles/test-progressive.py` checks intermediate dimensions/sample bounds, final-setting preservation and isolation from ordinary exports.

`node scripts/test-render-policy.mjs` covers recipe round trips, user overrides, optional Pulse support, device checks, bounded workers, public local-only behavior, approximate measured costs and budgets, mixed-plan readiness, prepared soundtrack paths/offsets, and unsafe input rejection. Compare representative Cycles output frames visually before calling a converted scene validated; technical readiness alone does not establish material or animation fidelity.
