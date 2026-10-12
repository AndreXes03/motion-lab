# Motion Lab showcase

This static English-language page presents Motion Lab as one continuous workflow: a coding agent shapes the scene code and recipe, you direct the motion and finish in the studio, then render locally. Six playable examples show its 2D, hybrid and 3D range; the PULSE film leads the page.

The visual system keeps Motion Lab’s graphite panels, glass surfaces and small lime accent. The PULSE hero video loops muted only while visible, pauses when the page is hidden or the visitor scrolls away, and falls back to its poster for reduced-motion settings. The demo film player below remains user-controlled.

## Studio captures

The workflow section uses `demo/ui-tools.jpg` and `demo/ui-motion-groups.jpg`. Keep those filenames stable. Capture the first from the live Properties panel with the scene-specific controls visible. Capture the second from Motion with a temporary camera-group curve visible; do not save that example curve into a project or recipe.

## Preview

From the repository root, run:

```sh
npm run viewer
```

Open the showcase at `http://127.0.0.1:4173/showcase/`. `site.js` prefixes video, poster and screenshot paths for this local route, while the published page uses the same assets from the site root. Studio links open the BAX scene at its Properties or Motion panel.

To capture the studio views from a running preview on port 4194, start Vite with `npx vite --host 127.0.0.1 --port 4194`, then run `node scripts/tools-preview.mjs`. It waits for `window.motionPreview.whenIdle()` before capturing the two JPEGs.

## Rendering copy

3D previews use Three.js and procedural 2D uses Canvas, with Auto, Fast, Balanced and Sharp quality settings. In browsers with canvas recording support, the public Studio exports browser-rendered 720p or 1080p video, PNG frames and JSON recipes. MP4 is offered when the browser supports its encoder; otherwise the Studio offers WebM. Browser video uses the real-time Three.js/Canvas path. Blender Cycles and prepared Mixed renders remain local-only; renderer choices for those paths may be stored in recipes but are not executed on the public site. The optional Cycles path is currently scene-specific to PULSE. A mixed render requires prepared image or frame-sequence inputs and a compositing plan.

## Publication

The [GitHub Pages workflow](../.github/workflows/demo-pages.yml) copies this page and its referenced demo assets to the publication root. Keep internal notes out of the public page. Preserve the distinction between the browser preview, standard Three.js rendering and optional local renderer paths; do not imply runtime AI, native After Effects or Cinema 4D support, or general scene conversion.
