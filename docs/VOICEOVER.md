# Voiceover

In the installed Studio, open **Audio → Audio tracks → + Voiceover**. Music has its own small import action in the same row. Voiceover keeps its complete source duration and preserves existing music and effects. Move, trim, mute and adjust its level with the existing clip controls.

**Lower music during speech** is enabled by default when a voice is present. With speech timing it follows spoken intervals, joining short pauses; without timing it lowers music across the whole voice clip. The music enters the quieter level 120 ms before speech and returns over 350 ms. Effects are preserved. A shared final soft ceiling protects the voice/music sum. The same envelope is used for browser preview and native export, including partial exports.

If the voice ends after the film, Studio displays the mismatch and video export stops with an explanation. Extend the authored film or deliberately trim the voice. Importing never stretches speech or silently shortens it to fit.

## Speech timing

Open **Speech & timing** under the voice track. Paste the spoken script if useful. **Import timing…** accepts:

- JSON with `words: [{text|word,start,end}]`, WhisperX `segments` with word timing, or ElevenLabs `alignment` / `normalized_alignment` character arrays.
- SRT or VTT: phrase timing, not word timing.
- The native narration document described below, including editorial cues.

All timestamps refer to the original audio file in seconds. Missing times are rejected instead of guessed. A script alone is not an alignment. The word/phrase selector seeks the project playhead. Measured text is read-only here; correct and reimport the timing file. Replacing timing clears old cue links unless the replacement native document supplies valid cues. A different audio take needs fresh timing.

No speech service is called by Studio. Use externally generated audio and provider timing; when unavailable, align the exact transcript with the recording using an authorized service/local tool, or supply deliberately authored manual markers. Paid generation and external upload follow the user's authority. Importing voice is local and does not upload it.

## Authoring a video from its voice

Use this workflow whenever the user requests a narrated video:

1. Establish the message, product facts, format and any fixed duration. Prepare the script and finalize the voice file before locking shot timing.
2. Import voice and music separately. Inspect measured words/phrases. Resolve missing words, ambiguous pronunciations and mismatched timing before binding scenes.
3. Make a short editorial plan: spoken concept, visual proof, shot/action, optional super, and the speech markers to which they belong. One sentence need not equal one shot. Supers summarize; captions are a separate design choice.
4. Store stable cue IDs with references to measured markers. Bind actual shot visibility, animation and supers using `narrationCue` or `evaluateNarrationCue`, rather than copying timestamp literals into scene code. Use the same resolved cue boundaries in shot metadata and render paths. Preserve manual layout/art direction and existing approved work.
5. Construct native storyboard layouts, then animate the same elements. Spoken meaning and readable holds take priority; use musical accents within the available timing windows. Keep the film duration long enough for all voice and closing holds.
6. Review the full mix and film at real speed. Verify seek, move/trim, saving/reopening and the compressed export. Rendering never runs an AI model.

Existing authored films keep their original timing unless the agent explicitly connects their shots and supers. Importing a VO alone adds the voice/mix, not an automatically rewritten film. Do not claim existing camera-group retiming moves cuts or headlines. A regenerated take must be realigned, and its new cues reviewed before replacing the old version.

## Agent command

Use a saved schema 2 recipe as input. This command imports through the same managed asset store and writes a **new** recipe; it never overwrites the source or publishes it:

```sh
node scripts/voiceover.mjs --recipe project.recipe.json --audio voice.wav --timing words.json --out narrated.recipe.json
node scripts/voiceover.mjs --recipe narrated.recipe.json
node scripts/voiceover.mjs --recipe narrated.recipe.json --cues cue-plan.json --out narrated-with-cues.recipe.json
```

`--script script.txt` saves a script without inventing timing. `--track ID` selects a voice when several exist. Replacing that track with `--audio` keeps its timeline position and resets source trim and speech timing. Add new timing and cues for the new take. Inspect output `voiceEnd`, markers and resolved cues; adjust the authored film duration where necessary. Apply the resulting recipe through the existing `live-studio.mjs publish --recipe` workflow after implementing/reviewing the scene bindings.

`cue-plan.json` is an array, for example:

```json
[{"id":"reveal","from":"w1","to":"w3","offset":-0.1,"endOffset":0.5,"label":"Show the result","super":"Your idea. In motion."}]
```

Use IDs returned by the actual timing import. For authored scene code:

```js
import {evaluateNarrationCue} from '../engine/narration.js';
const reveal = evaluateNarrationCue(parameters.audio, 'reveal', time, {
  trackId: 'the-saved-voice-track-id', fps: 30
});
// Drive the real shot's visibility and local animation, including its super.
if (reveal.active) drawResultShot(reveal.localTime, reveal.duration, reveal.super);
```

This is an authoring example, not an automatic new renderer. Resolve every required cue before expensive rendering. A missing, ambiguous or fully trimmed cue fails explicitly. Match the project's actual FPS. Source times remain unrounded; cue boundaries are quantized once at the visual frame clock. Moving the voice shifts linked cues; trimming intersects their visible intervals.

## Storage and compatibility

Audio version 1 remains accepted unchanged. New imports use version 2 with `ducking: boolean`, track `role: music | voiceover | sfx`, and optional `narration` on voice tracks. Prior tracks default to music. Narration is stored with the hash-addressed audio track and therefore travels with recipes, Undo and portable projects.

Narration version 1 contains `text`, `source: provider | aligned | captions | manual`, `segments: [{id,text,start,end}]` and `cues: [{id,from,to,offset,endOffset,label,super}]`. There are at most 16 audio tracks, 5,000 speech markers and 200 cues per voice. Imported timing files are limited to 1 MB; existing project size limits also apply.

Voice mixing works through browser/Three.js, Native 2D and supported Cycles adapters. Mixed uses a separately prepared soundtrack and rejects unbaked voice tracks rather than silently omitting them. The public web demo shows the compact Audio controls; file import remains available in the installed Studio.

Validation: `npm run test:voiceover`, `node scripts/test-audio-timeline-browser.mjs`, the project/library checks and `npm run build`. Native tests compare full and partial FFmpeg output against the same sample math used by preview, including ducking and the final ceiling.
