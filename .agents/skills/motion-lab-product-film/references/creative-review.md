# Evidence-based creative review

Use before delivery and after consequential revisions. The objective is to communicate the actual product convincingly, while preserving the brief and approved choices. Do not beautify without a diagnosed viewing problem. Read only relevant frame feedback and memory cases when consent permits research memory.

1. Read `node scripts/creative.mjs status SCENE` for the current source revision, named storyboard, working feedback and previous review. Capture the current recipe from Studio's recipe download; do not substitute defaults for edited parameters. Source files and settings must match the reviewed picture.
2. Inspect native storyboard cards and representative frames at the intended delivery size. Check the product benefit, authentic proof, actual brand assets, text hierarchy, cropping, overlap and contrast. Distinguish deliberate stylistic choices from defects. If the brief has no CTA, evaluate whether the ending meets its actual objective instead of inventing one.
3. Watch the full animated preview, plus any fast transition or dense text passage. Evaluate settled reading time, shot variety, pauses, coherent acceleration, transitions and ending. Listen to sound if available. A screenshot cannot establish pacing or audio quality; a passing build cannot establish visual quality.
4. For each issue, name the concrete observation, explain its effect and make the smallest useful correction. Preserve approved music, logo, camera and copy unless the issue requires changing them and authorization allows it. Publish each coherent revision and inspect again. Do not loop indefinitely over personal stylistic preferences.
5. Save a report through `node scripts/creative.mjs review FILE`. Provide all seven criteria: `benefit`, `legibility`, `reading`, `brand`, `rhythm`, `ending`, `continuity`. Each has `pass`, `fix` or `unverified`, plus specific evidence. Use `unverified` if you cannot see the image, play the passage, hear audio or access needed reference material. Never invent timestamps, observations or client approval.

Report schema:
```json
{"version":1,"scene":"starter","sourceRevision":"64-character hash from current status","snapshot":{"parameters":{"scene":"starter"}},"checks":[{"id":"benefit","status":"unverified","evidence":"Product brief not yet provided."}]}
```
This abbreviated example is not a complete valid report. Replace `snapshot` with the full actual recipe and include all seven criteria. Read status again after edits; old source hashes are rejected. Studio labels reports out of date when source or parameters differ. A report is the agent's evidence, not an automated score, formal accessibility certification or client approval. Any `fix` or `unverified` item must remain visible in the handoff. Do not block a user's explicitly requested draft export merely because creative review is incomplete.
