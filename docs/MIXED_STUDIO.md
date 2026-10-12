# Mixed jobs in the local Studio

The local adapter in `scripts/mixed/studio.mjs` executes a prepared [offline composition plan](COMPOSITING.md#simple-offline-compositing) through the same job protocol as the renderer CLIs. It combines existing layers; selecting Mixed does not secretly re-render Three.js or Blender.

A recipe names its project-relative JSON file:

```json
{
  "renderPolicy": {
    "version": 1,
    "renderer": "mixed",
    "source": "agent",
    "rationale": "Cycles product beauty with crisp prepared graphics.",
    "composite": {
      "enabled": true,
      "planFile": "renders/my-film/composition-plan.json",
      "audioFile": "renders/my-film/approved-mix.wav",
      "audioOffset": 0,
      "rationale": "The named frame layers have matching output dimensions."
    }
  }
}
```

This object belongs in `parameters`; strategy metadata is separate from the actual frame plan. **Studio plan input paths are relative to the project root**, not the JSON file's directory. For example, a source can be `renders/my-film/cycles/frame-%06d.png`. Neither the recipe nor the browser client can supply a different asset root. All real paths are checked to reject symlinks escaping the project, and Studio output is confined to `renders/`.

`getMixedCapabilities({root})` confirms the adapter is installed; it does not certify a particular plan. `preflightMixed({root,policy,settings,kind,time,duration})` loads at most 1 MiB of JSON, validates every referenced PNG, and checks dimensions and fps against the selected output settings. Preview/export require the complete plan frame count to match the selected scene duration. Change the settings to match available inputs or render matching inputs before submitting the job; there is no hidden rescale.

`buildMixedCommand({root,kind,snapshotPath,outputPath})` returns the executable, arguments and working directory for the existing Studio subprocess launcher. The CLI verifies its frozen snapshot command, emits `progress`, `frame` and `complete` JSON events, and transitions through `freezing`, `rendering` and `encoding`. It accepts SIGINT/SIGTERM; the reusable `runMixedJob` accepts an AbortSignal and async `onEvent` callback. Interrupted compositions retain partial frames without a completion manifest.

PNG frame jobs evaluate the deterministic plan frame at `floor(time*fps)`; the exact endpoint selects the last available frame. Video jobs produce MP4 plus intermediate PNGs in `OUTPUT.mp4.mixed/frame-%06d.png`. During rendering, the Studio can show the last completed PNG using its one-based `previewFrame`. After completion, its normal publication/download handler moves or copies the MP4. Frame jobs return a PNG directly.

Before composing, the adapter copies every referenced PNG and explicitly selected audio file into a fresh `OUTPUT.inputs/` directory, retaining the project-relative layout. It compares SHA-256 of each original before and after copying with the copied bytes; an input changing during the copy fails the job. The normalized plan and a complete byte/hash manifest are recorded there. Every subsequent frame and the audio encode use this frozen cache, so edits to original assets cannot change a running composition. Freeze is sequential rather than an atomic filesystem snapshot; keep a coherent prepared plan before launching the job.

An explicit prepared soundtrack can be stored as `renderPolicy.composite.audioFile`, a project-relative WAV, MP3, M4A, AAC, MP4, MOV or WebM with an actual audio stream. `audioOffset` optionally trims its start, defaults to zero and must lie within the supplied track. Preflight rejects a malformed file or a video without audio before the job is queued. Audio files must be nonempty and at most 2 GiB; probing is local, bounded and limited to supported media containers. The frozen copy is probed again before encoding.

An explicitly selected source can also be passed through `buildMixedCommand` or `runMixedJob` as `audioPath`. Supplied adapter/CLI audio arguments override their corresponding recipe fields. Omitting both the prepared recipe track and explicit audio argument gives a silent movie; the adapter never borrows audio implicitly. Short tracks are padded with silence and long tracks are trimmed to the full picture duration.

Prepared beauty, graphic and audio layers reflect the moment they were rendered. Live camera, light, graphics and sound controls do not alter those existing inputs. Prepare new layers or a new soundtrack before exporting changed controls through Mixed.

The source snapshot/fingerprint must include `scripts/mixed-studio.mjs`, `scripts/mixed/`, `scripts/lib/simple-compositor.mjs`, and the selected composition plan. The frozen cache records exact input provenance; renderer strategy labels cannot certify shader or color parity. If edits affect a previously rendered input, prepare a new input before using it in a new movie.

```sh
node scripts/test-simple-compositor.mjs
node scripts/test-mixed-studio.mjs
node scripts/mixed-studio.mjs export --snapshot renders/my-film/snapshot.json --out renders/my-film/final.mp4
```

Tests cover actual tiny PNG blending and MP4 encoding, duration/frame count, single-frame selection, callback progress, cancellation before and during composition, invalid settings, and output/snapshot confinement. An actual PULSE proof additionally combined two existing Cycles RGBA frames with a static dark navy gradient and vector graphics; the frames were explicitly resized to common dimensions before becoming compositor inputs. No Three.js pass was rendered for that proof.
