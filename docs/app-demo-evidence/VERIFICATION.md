# App Demo candidate verification — 23 October 2026

Environment: macOS Apple Silicon, local development copy.

- Required build and existing prebuild contracts passed. The remaining bundle-size advisory is pre-existing; no build error.
- Focused App Demo checks: bounded content and timing, image normalization and deduplication, corrupt/oversized image rejection, symlink rejection, deterministic native seeking, non-silent generated audio.
- After integrating main commit cf8d2f1, project-library controller and session checks: 29 passed. Motion workflow contract passed after dynamic-duration integration.
- Browser journey: imported two actual PNG screenshots, changed separate headlines and captions, moved their order, adjusted duration and focus/zoom, reloaded the app, and exported from the guided final step. No browser errors in the final journey.
- Creating an App Demo from a different scene preserved the previous projects and opened a separate App Demo.
- Portable export was imported and opened in a fresh temporary directory. Snapshot and screenshot bytes matched, with zero portability warnings. Package: approximately 1.4 MB.
- One final MP4: 1920×1080, H.264, 30 fps, 450 frames, exactly 15 seconds; stereo AAC at 48 kHz. Mean audio level −25.0 dB, peak −8.9 dB, no sample clipping. Audio was checked technically; a subjective full listen is not claimed.
- Reviewed actual exported frames covering opening, both screenshot chapters and closing. The native output retains the real UI, separate readable text and a clear next action. Browser preview and native framing agree visually.
- Brief dialog inspected in the browser: dark background, matching typography, quiet borders and lime primary action.

Evidence: contact.png (actual exported video), brief.png, editor.png, export-metadata.json. The MP4 and portable project are delivered alongside the candidate outside the source repository.

Not covered: Windows/Intel setup, screen-recording inputs, automatic vertical layouts, a first-time tester session, subjective audio listening. Public release and changes to the existing installed checkout are not part of this candidate.
