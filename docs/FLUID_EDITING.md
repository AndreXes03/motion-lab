# Editing and launch behavior

## Desktop Studio

- Drag an empty area of either curve graph to scrub the preview and film timeline continuously. Easy mode also supports scrubbing.
- Shift-click or Cmd/Ctrl-click keyframes to select several. Shift-drag an empty area to select points in a box. Cmd/Ctrl+A selects visible points.
- Drag a selected key to move the selection together. Spacing and value differences are preserved; unselected neighbours cannot be crossed. Native vector channels keep shared times and easing and preserve untouched axis values.
- Snap to frames is on by default and can be disabled. Precision fields retain their exact numeric times.
- Shift+arrow keys nudge the selection. Horizontal arrows move one output frame; vertical arrows adjust values. Ordinary arrows retain key navigation and single-landmark retiming.
- Native Bézier handles preview the interior of the changed segment while dragging. Key and retiming moves also update the live renderer before mouse release.
- Each drag is one undo step. Escape, pointer cancellation and lost pointer capture restore the baseline; Escape also restores the pre-gesture preview time.
- Numeric control labels support horizontal dragging, Shift for larger steps and Escape to restore the exact pre-edit recipe. Ordinary number inputs and sliders remain available.
- A tab-local session draft restores scene parameters, preview time and workspace after a reload. It is separate from named versions and does not synchronize between tabs or browsers.

## Launching and updates

`npm run studio`, `scripts/Anteprima-Studio.command` and the installed macOS launcher use `scripts/launch-studio.mjs`. The local Codex bridge delegates to this same entry point when it exists.

Every start checks official `origin/main`. The updater verifies the repository, requires a clean `main`, serializes updates, and applies fast-forward commits only. It never stashes, resets, cleans or pushes. Dependency changes are installed with `npm ci`; a failed installation stays marked pending for the next start.

Local changes, a work branch or local commits preserve the local copy. Network failure allows an offline launch. ZIP installations launch without Git, but require a clone for future automatic updates. Active queued/running exports defer updates. If an update is applied to an idle running service, only the verified owned instance is restarted. Other processes and ports are never stopped.

## Web trial

The public build has its own small entry point and six-mesh 3D scene, no textures, no shadow maps and no multipass compositor. It does not load the desktop runtime or full films. Motion templates load only when the Motion panel is opened. The preview runs at 640 × 360 and pauses when the tab is hidden.

The web trial includes material, lens and light controls, timeline scrubbing, basic undo/redo and PNG capture. Pro opens an explanatory download dialog. Full scenes, keyframe editing, code, sound and video exports are available in the downloaded Studio. The homepage uses a compressed 5-second silent loop; full films remain available on request. Reduced-motion and data-saving preferences suppress the automatic loop.
