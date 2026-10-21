---
name: framevolve-live-review
description: Keep Framevolve Studio visible while applying video feedback one item at a time, with an explicit checklist, browser capability detection and live review checkpoints.
---

# Live feedback in Framevolve

Use this skill for revisions, feedback lists, requests to watch progress, and requests to open Studio inside Codex, Claude or another agent. Follow AGENTS.md for scene ownership, controls, validation and publication scope. Existing creative direction remains authoritative.

## Keep one Studio tab visible

1. Start or reuse the server with `node scripts/live-studio.mjs start --browser integrated --scene SCENE`. This does not update the repository, stop other instances or launch an external browser. Use the exact returned URL and repository. If the default port belongs to another project, use an available `--port`; never stop somebody else's session.
2. When the user requests the integrated browser, inspect the tools actually available in this session. If a visible embedded browser can access the local server, open the URL there and reuse that tab. Follow that browser tool's instructions. The CLI emits a URL; it does not itself create an embedded tab. Codex/Claude CLI alone does not imply a graphical browser. Do not invent a provider deep link, unsupported API, or claim that an opened external browser is integrated.
3. If the browser is absent, or runs on another machine without access to this server, say so briefly and use the external browser on request: `node scripts/live-studio.mjs start --browser external --scene SCENE`. Use a supported port-forwarding facility only when actually available. Do not expose the local server publicly to make a preview work.
4. Keep the same tab and local server alive throughout the edits and after your reply. Do not switch to a static exported MP4 for live changes. Preserve the user's scene and review position unless the requested change concerns another scene or shot.

## List every feedback item

Before edits, show a compact numbered checklist in the user's language. Give each item a stable id and concrete outcome. Reuse the existing checklist for follow-ups instead of restarting or dropping items. Distinguish **To do**, **In progress**, **Done** and **Blocked**. Keep at most one item in progress unless several files are inseparable parts of the same requested change.

Write the same checklist to a local JSON array, for example `.motion-cache/feedback-plan.json`:

```json
[
  {"id":"f1","title":"Make the title larger","status":"todo"},
  {"id":"f2","title":"Slow down the final camera move","status":"todo"}
]
```

Register it with `node scripts/live-studio.mjs plan --file .motion-cache/feedback-plan.json`. Studio shows the checklist and completion count. `node scripts/live-studio.mjs status` reads the current state for resuming work. Retain completed and blocked items in subsequent plans.

## Apply and show one change at a time

For each feedback item:

1. Announce which item is in progress. Run `node scripts/live-studio.mjs begin --task f1` **before changing files**. Studio keeps showing the previous checkpoint while related source files are being edited. Do not edit a renderer's source during an active export; wait for it or work in an isolated copy. Pass the active `--port` when it differs from 4173.
2. Complete the smallest coherent change and its affected files. Run the focused validation appropriate to that change. Avoid batching ten independent feedback items into one final reveal.
3. Publish the checkpoint: `node scripts/live-studio.mjs publish --task f1 --label "Larger title"`. For recipe/parameter edits, include `--recipe path/to/updated.project.json`; saving an arbitrary JSON file alone does not select it in Studio. Keep publishing the current recipe when its parameters change. Source changes and a recipe can be published together.
4. Wait for the **same visible Studio tab** to apply the checkpoint. Inspect the relevant frame or short motion passage. Live interactive updates are not a final-render validation. Source edits may briefly reload the page; recipe updates apply in place. The review time is preserved, clamped to the new duration, and playback pauses so the change can be judged.
5. Only after verifying the actual result, run `node scripts/live-studio.mjs done --task f1` and update the conversational checklist. If visual inspection is unavailable, keep it In progress and say that implementation is ready but visual verification remains. If a real blocker prevents completion, use `node scripts/live-studio.mjs block --task f1 --label "Concrete blocker"` and report it.
6. Move to the next item. For ten independent requested changes, release and inspect ten meaningful checkpoints; do not introduce artificial delays or fake progress.

Studio waits when the user has manual edits, pauses updates, or is rendering. Do not override that choice. Explain **Apply latest** when needed: local edits are backed up in that tab and can be restored with **Restore local edits**. Syntax-invalid source/JSON keeps the existing tab on its prior checkpoint until corrected. If a batch is interrupted, inspect files and the current checklist before publishing or resuming; publishing does not undo unfinished file edits.

End with the checklist of completed and remaining items, the Studio URL, and what was actually verified. Keep the server available. Do not mark an item Done merely because code was written, a download finished, or an API call returned successfully.
