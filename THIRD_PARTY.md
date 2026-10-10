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

`RoundedBoxGeometry` and `RoomEnvironment` are imported directly from the
official three.js addons in the installed version. Their implementations were
checked before use. `RoundedBoxGeometry(width, height, depth, segments, radius)`
extends `BoxGeometry`, clamps the radius to half the shortest side, and creates
rounded edges with modified normals and UVs. It suits the device shell and
buttons. `RoomEnvironment` constructs a fixed room with emissive panels and a
point light for `PMREMGenerator.fromScene()`. It provides reflections for the
plastic and metal materials without a remote HDR asset. The demo's use of both
matches their documented constructors and intended PMREM workflow. See the
[geometry source](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/geometries/RoundedBoxGeometry.js)
and [environment source](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/environments/RoomEnvironment.js).

The bundled FFmpeg executable found at `node_modules/ffmpeg-static/ffmpeg` was
verified locally as FFmpeg 6.0. Its configure flags include `--enable-gpl`,
`--enable-version3`, `--enable-libx264` and `--enable-nonfree`. FFmpeg's own
[legal notes](https://ffmpeg.org/legal.html) explain that GPL components change
the applicable license; the package's copied `ffmpeg.LICENSE` states that an
`--enable-nonfree` binary is unredistributable. Therefore the deliverable should
contain the project files and lockfile, **not `node_modules` or this executable**.
Running `npm install` installs the required local toolchain on the user's
machine. A separate system `ffmpeg` was not present during testing.

The [Howseen claude-motion-design repository](https://github.com/howseen-ai/claude-motion-design)
was examined as a reference only. Its [render script](https://github.com/howseen-ai/claude-motion-design/blob/main/examples/howseen-launch/render.py)
waits for readiness, seeks to exact times, takes Chromium screenshots, builds a
contact sheet and encodes frames. Its [film source](https://github.com/howseen-ai/claude-motion-design/blob/main/examples/howseen-launch/film.html)
waits for fonts and images before marking the page ready. No Howseen code or
media was copied into this prototype. The repository is [MIT licensed](https://github.com/howseen-ai/claude-motion-design/blob/main/LICENSE)
and credits Howseen AI / Raphaël Aubry (2026).

[Remotion](https://github.com/remotion-dev/remotion) was evaluated but omitted:
its composition/rendering layer does not simplify the direct Three.js seeking
and Chromium frame pipeline needed here. Its [license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)
allows free use by individuals and companies with up to three employees, with
a company license required outside those categories.

No third-party images, music, logos or font files are bundled for the demo.

La revisione hard surface riutilizza inoltre GTAOPass, RectAreaLightUniformsLib e toCreasedNormals dalla stessa distribuzione Three.js (MIT, avviso già incluso). Il logo della demo è materiale fornito dall’utente, non incluso nella licenza MIT del codice. La sua disponibilità in questo progetto non concede diritti di riutilizzo ad altri soggetti.
