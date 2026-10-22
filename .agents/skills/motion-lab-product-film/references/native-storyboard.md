# Native layouts, then animation

A storyboard is a sequence of real editable compositions from the project, not AI-generated images or a second decorative implementation. Use existing renderers, assets, typography, objects and cameras. For a new film, author the key poses first; only add movement after reviewing them. For existing films, preserve the approved motion and choose representative poses without altering the video.

1. Reuse the brief, real logo/product UI and approved choices. Outline 3–6 meaningful shots; name them by what they communicate (e.g. “The problem”, “One action”, “The result”), not just 1/2/3. More shots are allowed where necessary, up to 24.
2. Construct each layout in the native scene source with reusable objects and layout functions. Establish deterministic shot windows and a fully composed representative time for each. A static first pass can hold each pose through its window. Later animation must interpolate or reveal those same objects, without rebuilding the approved layout or changing the anchor pose accidentally. Keep selected controls working. Do not claim that registering JSON creates geometry or layouts: it only points the UI to real authored poses.
3. Register a manifest using `node scripts/creative.mjs storyboard /path/to/manifest.json`. It writes `project/storyboards/SCENE.json`. Times must be ordered and within the film. Example:

```json
{"version":1,"scene":"starter","title":"A clear product promise","shots":[{"id":"hero","name":"Meet the product","time":1,"intent":"Show what the product is and the main benefit.","motion":"A brief reveal that settles into this composition."}]}
```

Each shot accepts only `id`, `name`, `time`, `intent`, `motion`. Do not supply a remote image URL or an alternate per-shot recipe. Use the actual project's current parameters and source. The existing `pop` demo has a four-card manifest as a working example; do not borrow its product identity or absolute times for unrelated work.
4. Ask the user to open **Storyboard**. Studio pauses playback, hides the timeline and shows named previews, a selected large layout and previous/next navigation. Each preview is rendered from the native scene. Verify the actual cards and check for blank entrances, transition masks, unreadable text and duplicate compositions. Never mark these checks passed from the manifest alone.
5. Let the user comment on a named scene. Use `node scripts/creative.mjs comments SCENE` to read the original text plus saved context. Preserve accepted compositions. If the user already authorized autonomous production, make a reviewable checkpoint and continue; otherwise ask for direction approval when it materially changes the film.
6. Animate the same layouts. Keep the representative poses useful, updating anchor times if the edit changes. Use **Open scene in editor** or **Video** for motion and audio review. Storyboard cards cannot demonstrate timing, transitions, temporal effects or sound. Native preview also does not certify Cycles appearance.

Previews regenerate from the current settings. Do not run source edits through another tool while a render is active. Respect paused live updates and unfinished edits. There is no background image-generation service and no automatic third-party transmission.
