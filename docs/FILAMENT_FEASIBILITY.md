# Filament native feasibility

**Decision: native rendering is now demonstrated as a smoke test on this Apple Silicon Mac; adoption is not established.** The official arm64 Filament package runs on Metal and rendered a frozen PULSE snapshot. The bounded conversion omitted important scene appearance and motion, and the captured image came back cropped to 70×270 despite requesting 480×270. No production-quality latency or fidelity claim follows from that result.

## Local probe (22 October 2026)

- Host reports `arm64`, macOS 26.6.2, and Xcode Command Line Tools at `/Library/Developer/CommandLineTools`.
- Downloaded official `filament-v1.78.1-mac.tgz` from GitHub releases. Its SHA-256 matched the published value: `d27efabcc89d4547add654bbcd40679f07d1c5591efe0e74a7ebc0257fbc8f95`.
- The archive contains `gltf_viewer`, `matc` and Filament libraries. `file` confirms these are Mach-O arm64; the archive has a `lib/arm64` directory.
- The first sandboxed Metal launch failed before loading the scene (`Selected physical device '(null)'`). Retrying with native GPU access resolved Metal to **Apple M4 Max**, feature level 3.
- Converted the existing baked PULSE snapshot at **0.5 s** to a GLTF 2 fixture with 149 mesh nodes, 591 primitives, 12 materials, and a 13,061,616-byte vertex/index buffer. The repeatable converter is [convert_pulse_frame.py](../experiments/filament/convert_pulse_frame.py). It exports static geometry, normals, UVs, material factors, and the authored camera.
- Filament ran headless with `--api metal --frames 3 --fixed-timestep 0.033 --window-size 480x270` and exited successfully. It produced a screenshot, but the file is TIFF at **70×270**, not the requested 480×270. I inspected it: the PULSE speaker is present, but the output is a narrow crop and cannot support a fidelity comparison.
- `/usr/bin/time -l` measured **2.21 s** process wall time and **953,024,512 bytes** maximum resident set size (about 909 MiB); peak memory footprint was 1,353,745,824 bytes. Wall time includes process startup, GLTF parsing and three frames, so it is not per-frame latency. These numbers describe this one headless run, not a sustained renderer benchmark.
- The run logged that Filament's handle allocator arena was full and it fell back to the system heap. No tuning was attempted.

## Upstream package and platform facts

The official release page lists `filament-v1.78.1-mac.tgz` (43.9 MB), released 21 October 2026. This host probe verified its arm64 binaries and Metal backend. [Official Filament releases](https://github.com/google/filament/releases)

Filament's native API requires an `Engine`, `Renderer`, `View`, `Scene`, `Camera`, and `SwapChain` connected to a native window such as an `NSView`; the released `gltf_viewer` also exposes a headless mode. This provides a native integration route, but it is a C++ renderer integration rather than a drop-in adapter for Framevolve's browser Three.js scene factories. [Native rendering API](https://google.github.io/filament/dup/intro.html) · [macOS build and backend notes](https://google.github.io/filament/BUILDING.md#macos) · [Filament binary package contents](https://github.com/google/filament/blob/main/filament/README.md)

## Framevolve fit and work still needed

The probe proves that the released native arm64 viewer can run against Metal and render the project's static PULSE geometry after conversion. It does not show that the existing Three.js scene can be rendered by Filament without adaptation.

The GLTF fixture deliberately omits Canvas-generated source textures, the equirectangular environment, rectangular area lights, the Three.js `Reflector` floor reflection, scene compositing and typography, and all time-varying motion. It maps only basic PBR factors. These omissions explain why the crop cannot be judged against the existing image as a renderer comparison. The source scene also regenerates cable tube geometry during motion, so exporting a frozen frame loses that behavior. PULSE construction is in `src/scenes/pulse-demo.js` and `src/scenes/pulse-instruments.js`; current native production coverage and its exceptions are described in [native production migration](NATIVE_PRODUCTION.md).

A useful follow-up is to resolve the viewer's captured output dimensions, add the PULSE environment and texture maps, and compare the 0.5 s frame against the existing browser and Metal/Cycles images at 480×270. Then inspect a second time with animated cables and the reflective floor. Record cold and warm render latency separately, process peak RSS, image difference, backend/device, and every substitution. The current 2.21 s figure must not be used as a per-frame estimate.

Filament's native API expects a native-window swap chain; its render-difference tooling documents a separate headless test harness. Whether Framevolve's production path should use a native host window or an offscreen Filament target, and how that target would integrate with current Node render jobs, remains an implementation question. [Render-difference test tooling](https://google.github.io/filament/dup/test_ci_renderdiff.html)

## Conclusion

The test verifies arm64 packaging and Metal rendering with an actual PULSE-derived scene fixture. It does not establish production image fidelity, animation coverage, a usable frame capture at the requested dimensions, steady-state speed, or memory suitability. Keep the current renderer choice unchanged until those gaps are measured.
