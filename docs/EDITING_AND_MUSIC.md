# Edit a film and add music

The Studio storyboard reorders and trims authored shots from the current scene. It does not combine different scenes or add newly filmed media. Each row shows a thumbnail and its source and output times. Use the arrows to reorder shots; edit **Source in**, **Source out** and **Duration** to trim or retime one. **Reset story** restores the scene's original shot order and timing. Edits are undoable and can be saved in a recipe.

Shot times refer to the original scene. Retiming maps the output time back into that source window, so the scene's authored animation continues on its original clock. A 2-second source window displayed over 4 seconds plays at half speed; reordering does not restart the source animation. The edit keeps the current scene's authored visuals and shot windows.

To add a song, open Sound design, choose **Import song**, then adjust the waveform trim, gain and fades. Imports are limited to 50 MB and 10 minutes. The original file is saved in browser IndexedDB and, in the local Studio, under `project/references/music/`. Recipes store a content-hash reference and editable track settings rather than embedding the audio. On another computer, choose **Relink file** and select the exact original file; its hash must match. Keep the rights needed to use the music in your export.

**Suggest excerpt** analyzes sampled PCM energy and onsets and proposes an energetic window; listen and review it before choosing **Use suggested excerpt**. **Suggest beat sync** estimates a beat grid and proposes nearby output cut adjustments. Review the result and choose **Apply beat sync** to commit it. Both actions are explicit and editable; music changes and applied story edits can be undone, and **Reset story** returns the montage to its original timing. The analysis uses local signal statistics. It does not identify genre, lyrics, meaning or story relevance, and an estimated beat grid may be wrong.

Auto, Balanced, Fast and Sharp affect only interactive preview quality. Paused previews use a bounded frame cache; playback and final render settings remain independent. Exports run through a bounded queue of one active render and up to eight waiting jobs. A failed or interrupted job can be retried with the same job ID when its saved recipe and project source still match. This is a retry path, not a general pause control.

Edited shot timelines currently require Three.js/Canvas. An explicit Cycles or Mixed request is blocked for a non-identity edit; Auto can fall back to Three.js. Imported songs work with Three.js and the supported PULSE Cycles export. Mixed uses its prepared soundtrack, so it blocks imported-track recipes. See [Renderer selection](RENDERER_SELECTION.md) for the full renderer limits.

Run the focused contracts with:

```sh
node scripts/test-editorial.mjs
node scripts/test-storyboard-preview.mjs
node scripts/test-music-analysis.mjs
node scripts/test-music-track.mjs
node scripts/test-music-assets.mjs
node scripts/test-job-recovery.mjs
```

These cover edit mapping, thumbnail lifecycle, bounded music analysis and mixing, asset references, and mocked job recovery. They do not replace a full Studio browser session or real audio/video encodes. Browser UI and real encodes remain to be reviewed in an environment with the required browser tools.
