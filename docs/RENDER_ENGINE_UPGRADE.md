# Render engine reliability and performance update

This update improves the existing render paths without a visual redesign. It tightens Cycles device discovery and selection, makes render-cache reuse depend on the current source and recipe, writes final files atomically, and hardens browser recording against encoder errors, cancellation and oversized in-memory output. The render pipeline also reduces repeated finishing work while preserving absolute-time seeking and deterministic output.

Cycles now probes Blender's available Metal, OptiX, CUDA, HIP and oneAPI backends instead of assuming Metal. `auto` can choose a verified GPU and fall back to CPU; `gpu` requires a verified supported GPU, while `metal` requires Metal specifically. Cycles support remains limited to PULSE. Browser and CLI paths still use the existing visual design and renderer-specific finishing behavior.

The reproducible `npm run benchmark:finishing` check measured the 1080p display-grade pixel loop at 26.82 ms median before and 16.07 ms after in this environment (8 warmup rounds, 25 timed rounds, alternating order). The output is byte-identical, including alpha. This excludes Canvas transfers, browser/GPU work and encoding. They do not establish a whole-frame or whole-film speedup: scene complexity, browser/driver, device, resolution, samples and encoding can change end-to-end time. No visual redesign is part of this update. Visual review and a real Blender/device export remain pending in environments where those tools are available.

Run the focused contracts from the repository root:

```sh
npm run test:render-engines
node scripts/cycles/test-resume.mjs
python3 -B scripts/cycles/test-devices.py
python3 -B scripts/cycles/test-curves.py
python3 -B scripts/cycles/test-progressive.py
node scripts/test-renderer-studio-api.mjs
```

These validate policy/device constraints, Cycles options and finishing, browser-recording failure/cancellation behavior, render sampling and Studio dispatch. They do not perform a real Blender render or visual approval. For full repository contracts, run `npm run build`; for an actual local Cycles frame, use the PULSE command in [Usage](USAGE.md#optional-local-cycles-and-mixed-inputs) after Blender preflight, then inspect the resulting frame. See [Renderer selection](RENDERER_SELECTION.md) for capability and fidelity limits.

The core checks cover startup ordering, terminal disposal and GPU-target resize reuse with explicit dependency doubles. Finishing checks exhaust all 24-bit RGB values for one grade, plus edge cases, alpha and random-seek grain goldens. Optional native Canvas pixel integration is available with `NATIVE_CANVAS_MODULE` pointing to an already installed `@napi-rs/canvas`; it is not a browser substitute. The completed-frame Cycles resume check uses a prepared cached PNG, not Blender rendering. `test-images.py` requires Blender’s `bpy` and was not runnable in this environment.

The existing Cycles audio test also assumes `/private/tmp` and fails on this Linux environment; that unrelated test-path portability issue remains. The build and the focused commands above pass.
