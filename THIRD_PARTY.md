# Third-party software and research

This local prototype uses the installed packages listed below. Their original
license and notice files are preserved under [`licenses/`](licenses/). Package
versions are those in the tested `package-lock.json`; reinstalling dependencies
may change them within the declared version ranges.

| Component | Tested version | License / source | Use |
| --- | --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) | 0.186.1 | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | WebGL scene, geometry, materials, lights, cameras |
| [Playwright](https://github.com/microsoft/playwright) and playwright-core | 1.64.0 | [Apache 2.0](https://github.com/microsoft/playwright/blob/main/LICENSE), [NOTICE](https://github.com/microsoft/playwright/blob/main/NOTICE) | Local Chromium control and frame screenshots |
| [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | 5.3.0 | GPL 3.0 or later for the npm package; see copied `LICENSE` | Locates a local FFmpeg executable for video encoding |
| [ffprobe-static](https://github.com/joshwnj/ffprobe-static) | 3.1.0 | MIT; see copied `LICENSE` | Locates a local ffprobe executable for output inspection |
| [Vite](https://github.com/vitejs/vite) | 8.3.4 | [MIT](https://github.com/vitejs/vite/blob/main/LICENSE.md) | Local viewer server and asset build |
| [sharp](https://github.com/lovell/sharp) | 0.35.5 | [Apache 2.0](https://github.com/lovell/sharp/blob/main/LICENSE) | Contact-sheet image assembly |

Three.js addons include RoundedBoxGeometry, RoomEnvironment, GTAOPass,
RectAreaLightUniformsLib and toCreasedNormals under the same MIT notice.

The bundled FFmpeg executable found at `node_modules/ffmpeg-static/ffmpeg` was
verified locally as FFmpeg 6.0. Its configure flags include `--enable-gpl`,
`--enable-version3`, `--enable-libx264` and `--enable-nonfree`. FFmpeg's own
[legal notes](https://ffmpeg.org/legal.html) explain that GPL components change
the applicable license; the package's copied `ffmpeg.LICENSE` states that an
`--enable-nonfree` binary is unredistributable. Therefore the deliverable should
contain the project files and lockfile, **not `node_modules` or this executable**.
Running `npm install` installs the required local toolchain on the user's
machine. A separate system `ffmpeg` was not present during testing.

## Demo assets

The wind texture in `src/assets/audio/wind-magnific.mp3` was generated with
Magnific / ElevenLabs. [Provenance](src/assets/audio/provenance.json) records
its source and use. This generated audio asset is separate from the MIT code
license; no third-party music track is bundled. Music is synthesized locally.

Demo marks and visual assets retain their owners’ rights. The Andrea Salvo
logo belongs to its owner. Their inclusion does not grant rights to reuse the
marks, and the MIT code license does not cover them.

## References

[Howseen’s motion-design repository](https://github.com/howseen-ai/claude-motion-design)
was studied for seeking, frame capture and encoding. No code or media was copied.
