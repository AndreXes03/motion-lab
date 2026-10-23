# App Demo

Choose **Create an app demo** in the top bar. If another project is open, **Start with the example** saves it before creating a separate App Demo. If an App Demo is already open, the button returns to its content.

1. **Your product:** give the product a name and one clear promise. Add 1–4 PNG/JPG screenshots (10 MB each). The first import replaces the example screens. Images are copied locally, oriented correctly and normalized; original files are untouched.
2. **The story:** choose a screen, write its headline and supporting line, reorder it or replace it. Allow 3–7 seconds per screen. Click a focus point and adjust zoom; arrow keys move the focus accessibly. **Show the whole screen** resets the crop.
3. **The finishing touches:** add your closing message, next action, brand color and optional transparent PNG logo. Music is optional and uses the existing Studio audio tools. **Keep this version** preserves a recipe before further changes; Versions in Studio restores it. A coding assistant is optional.
4. **Your video:** watch the complete video with its current audio. **Export Full HD video** produces a 1920×1080, 30 fps MP4 using the project's renderer plan. Progress, cancellation, completion and downloads use the existing Exports area. **Save a portable project** includes the screenshots and editable content.

The default native renderer is Skia on supported Apple Silicon Macs. No AI calls or credits are needed. The existing Auto fallback remains available on other installations. A small image or dense text produces a suggestion to improve sharpness or reading time, without pretending to measure subjective quality.

The duration is 3 seconds of opening + the individual screens + 3 seconds of closing (9–34 seconds). The fixed 16:9 composition deliberately keeps text outside the real product screenshot. Zoom stays within the image; no UI is fabricated. Tall images are fitted intact before zooming. This release accepts still screenshots, not video recordings.

## For a coding assistant

Read the active content without modifying it:

```sh
node scripts/app-demo.mjs read
```

Write the returned object to a JSON file, modify its `appDemo` field, preserve `projectId` and `revision`, then run:

```sh
node scripts/app-demo.mjs update path/to/content.json
```

The update rejects a changed project/revision and uses the existing project library save operation. Never write library records directly. Images must be imported through Studio. The same `parameters.appDemo` document is used by Canvas previews, Skia exports, recipe versions, portable packages, sound timing and the derived storyboard. Image filenames are content hashes; imported images are excluded from Git but included in portable projects. Shared layout rules live in `src/scenes/app-demo.js`.

User screenshots may contain private information: review them before sharing a portable project. Nothing is uploaded to an AI provider by this workflow.

## Example materials

Bundled screenshots are existing Framevolve documentation captures: `docs/cycles-evidence/studio-ready.png`, `docs/ux-workflow/audio-timeline.png` and `docs/ux-workflow/export-summary.png`. They show the real application; they are not synthetic product interfaces.
