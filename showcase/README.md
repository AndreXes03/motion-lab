# Framevolve showcase

This static English-language page presents Framevolve as one continuous workflow: a coding agent shapes the scene code and recipe, you direct the motion and finish in the studio, then render locally. Five playable examples show its 2D, hybrid and 3D range; the PULSE film leads the page.

The visual system keeps Framevolve’s graphite panels, glass surfaces and small lime accent. The PULSE hero video loops muted only while visible, pauses when the page is hidden or the visitor scrolls away, and falls back to its poster for reduced-motion settings. The demo film player below remains user-controlled.

## Studio captures

The workflow section is a full-width screenshot gallery with Easy, Pro and Export tabs. It uses three real 1280 × 720 JPEG captures from the current application:

- `demo/ui-studio-easy.jpg`: Easy Motion with its preset cards and simplified original-curve preview.
- `demo/ui-studio-pro.jpg`: Pro Motion with the original native animation curve and keyframe controls visible.
- `demo/ui-studio-export.jpg`: the current Export panel with its delivery controls visible.

Capture all three from the running Studio after UI changes settle. Use the same browser viewport, keep the original scene motion, and do not manufacture curves or alter screenshot pixels. Use PULSE or the debranded native-motion scene; no old product marks should be visible. Inspect the captures before publication. Tabs support arrows, Home and End; each image links to its full-size capture. When replacing images, bump the UI capture version in `site.js`.

## Preview

From the repository root, run:

```sh
npm run viewer
```

Open the showcase at `http://127.0.0.1:4173/showcase/`. `site.js` prefixes video, poster and screenshot paths for this local route, while the published page uses the same assets from the site root. Studio links open PULSE at its Scene or Motion panel.

Use the running preview URL for browser-based captures. The legacy `scripts/tools-preview.mjs` produces the older two-image gallery and should not be used to refresh these three views.

## Rendering copy

3D previews use Three.js and procedural 2D uses Canvas, with Auto, Fast, Balanced and Sharp quality settings. In browsers with canvas recording support, the public Studio exports browser-rendered 720p or 1080p video, PNG frames and JSON recipes. MP4 is offered when the browser supports its encoder; otherwise the Studio offers WebM. Browser video uses the real-time Three.js/Canvas path. Blender Cycles and prepared Mixed renders remain local-only; renderer choices for those paths may be stored in recipes but are not executed on the public site. The optional Cycles path is currently scene-specific to PULSE. A mixed render requires prepared image or frame-sequence inputs and a compositing plan.

## Publication

The [GitHub Pages workflow](../.github/workflows/demo-pages.yml) copies this page and its referenced demo assets to the publication root. Keep internal notes out of the public page. Preserve the distinction between the browser preview, standard Three.js rendering and optional local renderer paths; do not imply runtime AI, native After Effects or Cinema 4D support, or general scene conversion.

## Brand assets

Framevolve is the product name. The repository and existing public URLs keep `motion-lab` for compatibility. Both the landing wordmark and favicon use `public/brand/framevolve-mark.png`, also served by the Studio. The Pages assembly must copy `public/brand` to `_site/brand` so the landing and Studio share the same asset without route assumptions. Existing authored film titles stay unchanged.
