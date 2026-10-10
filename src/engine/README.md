# Engine

[runtime.js](runtime.js) evaluates a scene at a given time and produces a frame.

| File | Role |
| --- | --- |
| [runtime.js](runtime.js) | Selects 3D/2D, applies the look and composes the frame |
| [animation.js](animation.js) and [timeline.js](timeline.js) | Evaluate tracks and interpolation at absolute time |
| [camera-path.js](camera-path.js) | Camera path sampled by arc length |
| [studio.js](studio.js) | Scene lighting and environment |
| [composite.js](composite.js) | Depth of field, bloom, occlusion, distortion and finishing |
| [temporal.js](temporal.js) | Motion blur sample times and weights |
| [film-grain.js](film-grain.js) | Grain applied after temporal integration |
| [procedural.js](procedural.js) | Primitives and functions for 2D motion graphics |
| [sound-design.js](sound-design.js) and [sound-foley.js](sound-foley.js) | Analyze movement and generate SFX and music |
| [project-controls.js](project-controls.js) | Resolve presets and controls into render parameters |

[Architecture](../../docs/ARCHITECTURE.md) · [Compositing](../../docs/COMPOSITING.md) · [Sound design](../../docs/SOUND_DESIGN.md)
