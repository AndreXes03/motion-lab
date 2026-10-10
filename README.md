<div align="center">

# Motion Lab

**Code-driven rendering for vibe motion.**

2D motion graphics and 3D scenes: code, preview and local rendering.

![Three.js](https://img.shields.io/badge/Three.js-WebGL-111111?style=flat-square)
![Procedural motion](https://img.shields.io/badge/Motion-procedural-173bd5?style=flat-square)
![MIT](https://img.shields.io/badge/Code-MIT-f34a13?style=flat-square)

[Demo](https://andrexes03.github.io/motion-lab/) · [Setup](#setup) · [Architecture](docs/ARCHITECTURE.md) · [Docs](docs/README.md)

</div>

Work with Codex or Claude on scenes, formulas and JSON recipes, then inspect the result in the viewer. Camera, materials and timing remain editable: precise changes do not require another prompt-based video generation.

## Procedural motion

![Procedural motion graphics](demo/procedural-showcase.gif)

Flow fields, a parametric torus, 720 transforming elements, waves and tunnels. Original techno at 132 BPM, with movement-driven SFX.

[Watch with audio](https://andrexes03.github.io/motion-lab/#procedural-video) · [MP4](demo/procedural-techno.mp4) · [Live example](https://andrexes03.github.io/motion-lab/examples/procedural-field.html) · [Code and formulas](src/scenes/procedural-demo.js)

After Effects and Cinema 4D have procedural tools too. Here, the logic lives directly in source code, readable and editable by you and your coding agent.

## Studio

![Scene, timeline and controls](demo/ui-studio.png)

Timeline, presets, camera and look controls. Saved JSON recipes and temporal motion blur.

![Export settings](demo/ui-export.png)

MP4, WebM and ProRes export with adjustable resolution, frame rate, samples and bitrate.

**Compositing:** 3D depth of field, ambient occlusion, bloom, highlight control, chromatic aberration, vignette and lens distortion. Grain is applied after motion blur; 2D overlays stay above the render. [Source](src/engine/composite.js).

**Sound design:** movement-driven 2D/3D SFX, separate modules and procedural music with automatic or manual BPM. [Guide](docs/SOUND_DESIGN.md).

## 3D demo

[![Objects in play](demo/hero.jpg)](https://andrexes03.github.io/motion-lab/)

Objects in play tests lighting, camera movement and kinematics.

**1080p · 25 fps · 24 samples · target 6 Mb/s · modular SFX.**

[Watch in browser](https://andrexes03.github.io/motion-lab/) · [MP4](demo/objects-in-play.mp4) · [Recipe](demo/objects-in-play.project.json) · [More demos](demo/README.md)

## Setup

Tested on **macOS, Node.js 22.12+ and Google Chrome**. Internet is needed for the first installation.

```sh
git clone https://github.com/AndreXes03/motion-lab.git
cd motion-lab
npm ci
npm run viewer
```

Open **http://127.0.0.1:4173/**. Viewer exports go to Downloads. The static build has fewer features; Windows and Linux require adaptation and are untested. [Usage and export](docs/USAGE.md).

Render the demo:

```sh
npm run export -- --snapshot demo/objects-in-play.project.json --out renders/film.mp4 --width 1920 --height 1080 --fps 25 --temporal-samples 24 --bitrate-mbps 6
```

## Explore

| Area | Source / guide |
| --- | --- |
| Rendering, time and camera | [Engine](src/engine/) · [Architecture](docs/ARCHITECTURE.md) |
| Compositions and objects | [Scenes](src/scenes/) · [Components](src/components/) |
| Interface and parameters | [Viewer](src/viewer/) · [JSON recipes](project/README.md) |
| Rendering and checks | [Scripts](scripts/README.md) |
| Working with agents | [Workflow](docs/AGENT_WORKFLOW.md) |
| All guides | [Documentation](docs/README.md) |

## Status and licenses

In development. glTF import is not implemented. Pixel differences were found after switching 2D → 3D → 2D: reopen the scene before comparisons. [Checks and limits](docs/VALIDATION.md).

Code by Andrea Salvo, [MIT](LICENSE). Demo trademarks and assets retain their respective rights. FFmpeg binaries are not included. [Dependencies and notices](THIRD_PARTY.md).
