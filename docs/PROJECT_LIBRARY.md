# Saving and moving projects

The installed Studio creates **My first project** from your current workspace on first use. Your projects stay on this Mac; no account or cloud upload is involved.

- **Save icon** (or **⌘S / Ctrl+S**): save now. Controls, animation, audio choices and export settings also save automatically after a short pause. Wait for **Saved** before closing or moving work.
- **Folder icon → New project**: name a project and start a fresh Procedural composition. The current project is saved first. A new project starts with the installed workspace's authored scene library.
- **Folder icon → Recent projects**: reopen a saved project, including its scene source and local assets. Opening a project saves the current work and preserves a disk backup before switching. One active project belongs to each installed workspace; multiple windows share it. Stale windows are blocked from overwriting newer edits.
- **Example selector**: choose **New project** to open the example independently, or **Replace current** to reset this project to the example. Replace first saves a visible copy named “Project name · before Example” in Recent projects, including the previous scene recipe and managed assets. Cancel keeps the current editor and Undo history. After either confirmed choice, the new scene starts with fresh defaults.
- **Folder icon → Manage projects & Trash**: rename or duplicate any saved project. Move inactive projects to Trash and restore them from the same dialog; no project files or assets are permanently deleted. Open another project before moving the active project to Trash. These operations keep revision, session and active-render guards.
- **Folder icon → Export portable project**: review the included file list, missing or external references and required application/renderer components, then choose **Download .framevolve** or **Cancel**. The download is tied to the reviewed revision; if another save changes the project, review it again. This creates one `.framevolve` file. On the other computer install a compatible Framevolve version, then choose **Open .framevolve file**. Import adds a new copy to the collection. Review its notes and open it only if you trust the source: scene files contain executable code.

Agent file changes save after a short pause while Studio runs. The existing `node scripts/live-studio.mjs publish` workflow also saves the active project when the browser is closed. Edits made while Studio is stopped are captured when Studio starts again. Framevolve never makes an AI request to save a project. **Saving…** and errors are shown beside its name; failed saves are not reported as saved. A separate tab recovery draft helps with interrupted UI edits, but is not a portable backup.

## Included in a portable project

### Your music

Open **Audio → Import music** and choose a downloaded MP3, WAV or M4A (up to 100 MB). Framevolve keeps a local copy with the project. Adjust its start, duration, volume and fades in the same panel. Imported music replaces generated background music. **Global mix → Master volume** and **Mute all audio** affect generated sound and imported music together in preview and exported video; 80% retains the authored mix level. **Generated sound** only enables the synthesizer/effects, while each imported clip has its own Enabled checkbox and volume.

Drag a waveform to move its clip, or either edge to trim it. Arrow keys adjust the focused clip or trim edge by 0.1 seconds (Shift: 1 second). Use the audio ruler to seek and **Clip settings** for exact source start, timeline start, duration, volume and fades. A new import is trimmed to the film length. A longer existing clip shows **tail outside film**; only the overlapping part exports.

The saved project owns its audio settings and imported tracks. Changing the scene restores that scene's defaults; opening another saved project restores its own mix. If your installation already has LOOP's edited soundtrack, it is copied into managed local assets and included in your portable project. That personal soundtrack is not bundled in the public repository. A missing local soundtrack is reported explicitly.

### Package contents

The saved recipe plus authored files under `src/scenes/`, `src/components/`, `src/product-kit/`, `src/assets/`, `src/config.js`, `project/` and `public/assets/`. This includes local imported audio, models, textures, fonts and license files kept there. Snapshots share identical file blobs on disk. Package import checks file hashes, safe paths and size limits before applying anything.

Excluded: the application and its dependencies, renderer binaries, renders, caches, hidden/private files, credentials, feedback, briefs and history/version folders. The package does not replace `src/engine/`, `src/viewer/` or `src/scene-registry.js`. A newly registered scene therefore needs a compatible app with that registration. Native project documents in `.motion-cache/projects/` remain a separate API and are not automatically packaged.

The export review lists verified included paths and their total uncompressed size. Auto renderer preferences (including a possible Cycles path) and Mixed prepared inputs are reported as destination requirements. Mixed inputs outside those included paths still need separate copying. External URLs, absolute file paths and missing imported audio receive portability notes; copy needed assets into managed folders and update the scene's references before exporting. Computed paths cannot all be discovered automatically. The package needs a compatible Framevolve application and supported renderers on the destination computer. Cycles is installed separately when needed; an exported project does not install it.

Current limits: 100 MiB compressed package, 200 MiB decoded package/managed source data, 100 MiB per file and 10,000 files. Larger projects need smaller media or external resources. Verify the first frame after moving to another machine; portability is not a promise of identical fonts, external media or unsupported engines.

## Storage and recovery

The collection lives in `.motion-cache/project-library/` inside the Framevolve installation folder; `.motion-cache/active-project.json` identifies the active project. Keep this folder when moving/backing up the entire installation. **Save** writes locally; **Export portable project** creates a separate transferable backup. Neither is cloud sync. The public web demo keeps its existing behavior and has no disk project collection.

Collection changes preserve immutable asset blobs; duplicates and the copies made before example replacement are independent saved projects. Trash marks a project recoverable and hides it from Recent projects until restored. A failed example publication restores the prior active recipe/pointer when safe and reports any recovery copy preserved. Writes are atomic, revisions reject concurrent conflicting edits, and opening a project uses a rollback journal. Interrupted opens recover before subsequent project operations. Switching is blocked during active renders or declared agent editing. If an error reports newer workspace edits or manual recovery, preserve the installation folder and the named backup before making further changes. Do not edit manifests or blobs directly.

The existing **Versions**, recipe export and revision history tools remain available for variations and older workflows; a recipe JSON alone does not include scene source or assets.
