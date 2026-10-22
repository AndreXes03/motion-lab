# Framevolve repository guidance

Read [AGENTS.md](AGENTS.md) for the shared authoring, validation and ownership rules.

For product commercials, launch films, founder briefs or revisions to those films, use [.agents/skills/motion-lab-product-film/SKILL.md](.agents/skills/motion-lab-product-film/SKILL.md). Follow its relevant references. The founder guide is [docs/FOUNDER_START.md](docs/FOUNDER_START.md).

Reuse known brief answers and make technical recommendations in plain language. Preserve approved work and the user's current export/publication scope. These files guide the coding agent; they do not imply an in-app AI wizard.

For revisions and integrated-browser requests, follow [.agents/skills/framevolve-live-review/SKILL.md](.agents/skills/framevolve-live-review/SKILL.md). Show the feedback checklist, release each coherent change to the same Studio tab, and verify it before marking it Done. Use only browser capabilities actually available in this session.

For natural-language client feedback, follow `.agents/skills/motion-lab-product-film/references/client-feedback.md` alongside live review. The same optional memory consent, before/after evidence and separate client-approval rules apply to every provider. See `docs/FEEDBACK_MEMORY.md`.

## Efficient context and validation

Follow [docs/AGENT_EFFICIENCY.md](docs/AGENT_EFFICIENCY.md). Start with `npm run agent:context -- TOPIC`, read scoped files, reuse supported controls and run affected checks after each fix. Complete required final gates and visual review before delivery; avoid duplicate full-suite runs and unbounded tool output.
