# Publication checks

Checked on October 10, 2026, on macOS with Chrome and Node.js 25.8.1.

- Vite build passed, with a bundle-size warning.
- Camera, grain and temporal sampling checks passed.
- Short MP4 exports at 24/25/30/50/60 fps, WebM and ProRes passed.
- Studio API, version saving, rendering and persistence passed.
- Runtime: 6 of 7 checks passed. Switching 2D → 3D → 2D changes the 2D pixels; returning to 3D passes.
- 3D web demo: 1920 × 1080, 25 fps, 250 frames, 10 seconds, H.264 yuv420p, 24 temporal samples, 6 Mb/s target bitrate, 7,451,311 bytes, stereo AAC at 48 kHz. Full decoding and identical-hash seeking passed.
- Gyroscope cover: 2.4-second frame with 24 samples and no corner logo. Frames from the new video and real UI screenshots were visually checked.
- 3D depth of field: on/off, restoration, deterministic seeking, inspection bypass, UI and version saving passed (`node scripts/test-dof.mjs`). Disabled by default.
- Procedural demo: 1080p, 30 fps, 300 frames, 10 seconds, stereo AAC at 48 kHz, 132 BPM techno and 57 SFX. No client references in the text.

## Audio

Dedicated checks: `npm run test:sound`, `node scripts/test-sound-browser.mjs`, `node scripts/test-sound-2d.mjs` and `node scripts/test-sound-2d-browser.mjs`. Synthesis, 2D/3D movement, transport, WAV and persistence passed on the public checkout.

Browser checks covered 202 3D events and 35 2D events, unchanged frames, play/pause/seek, WAV, BPM and recipes without errors. 2D exports with audio on and off passed. The 3D demo audio mux preserves all 250 video packets unchanged.

Technical validation does not establish listening or creative approval. Windows and Linux have not been tested.

The public copy excludes previous Git history, personal references and screenshots, local versions, logs, intermediate output, caches and installed dependencies. Selected text was checked for personal paths, email addresses and common credential patterns. Third-party notices retain their original attribution.

The crisp procedural update preserves decoded audio exactly. Order/Chaos exported with one or four temporal samples produces identical PNG pixels.
