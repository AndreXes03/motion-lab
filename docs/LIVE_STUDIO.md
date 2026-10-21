# Watch your agent edit in Studio

Keep Studio open while Codex, Claude or another coding agent works on the project. Ask:

> Open Framevolve in your integrated browser if available. Use the framevolve-live-review skill, list my feedback, and show each completed change in the same Studio tab as you work.

The repository's shared agent instructions apply this workflow to video revisions. The agent tracks To do, In progress, Done and Blocked items, shown in Studio under **Agent feedback** and summarized in the conversation. Done means the agent has checked the result, not just written the code.

## Browser choice

`npm run studio:live -- start --browser integrated --scene pop` starts or reuses the local server and returns its exact URL. The agent then uses an available visible browser tool. Browser availability depends on the host app and session; choosing Codex or Claude does not guarantee one. A terminal-only agent can still work with Studio open alongside it. A browser on a different machine needs an actually supported connection to the local server.

For the Mac's default external browser, use `npm run studio:live -- start --browser external --scene pop`. Both views use the same local project, and both receive updates. The browser used for rendering is an independent setting.

## Changes as they are completed

- Saving scene code or top-level project JSON triggers a checked update after a short settling delay. Source changes reload the same tab automatically, retaining the scene and review time and pausing playback.
- For changes spanning several files, the agent groups them with `begin` and releases them with `publish`, so you see one coherent change at a time.
- Updated recipes published with `--recipe` apply without a page reload. Arbitrary recipe files are not automatically selected just because they changed on disk.
- A syntax-invalid source or JSON update stays pending; the existing page remains on its last checkpoint until the agent fixes it. This syntax check does not prove every future frame is free of runtime or visual errors.
- You can **Pause live updates**. Studio also waits if you have local manual edits or an active Studio render. **Apply latest** backs up your current manual edits in the same tab; **Restore local edits** retrieves that backup and pauses updates. The backup contains the most recent replaced local state, not a complete version history. Save important variations as named versions.

Keep the tab visible to see each checkpoint promptly. Browsers may throttle background tabs; switching back retrieves the latest checkpoint. Several extremely rapid saves may be combined. Near-live refers to the interactive preview, not continuous re-rendering of a final Cycles movie.

The agent should leave the Studio server running when it finishes. Files under `.motion-cache/` hold the local feedback/checkpoint state. The endpoint is local and read-only; it does not start an agent or collect provider credentials. Public hosted demos and render-only pages do not follow local edits.

Implementation protocol and commands: [.agents/skills/framevolve-live-review/SKILL.md](../.agents/skills/framevolve-live-review/SKILL.md).
