# Feedback that improves the film

An agent can turn “too slow”, “more premium” or “it looks fake” into a practical revision by inspecting the current film, identifying the likely cause and comparing a targeted change against the brief. Framevolve provides [agent guidance](../.agents/skills/motion-lab-product-film/references/client-feedback.md), not an in-app language model or a guarantee that a client will approve a change.

## Optional memory, explained during setup

The single-screen Mac setup includes an **unchecked** “Save a local memory of feedback and revisions” option. Choosing it opens a window explaining what is saved and why. **Enable local memory** selects it; **Not now**, closing the window or Escape leaves a previously unchecked choice off. Installing works without it. Existing installations retain the user's saved choice on setup restart.

The memory records selected revision examples: client feedback, context, agent interpretation, actual changes, constraints to preserve, textual before/after notes, visual verification and a separate client response. It helps agents retain approved choices and learn from rejected attempts within the project. An agent must follow the bundled guidance and record cases; Framevolve does not read conversations or infer outcomes automatically.

The file is `.motion-cache/feedback-memory.json`, local to this installation/project, ignored by Git. Consent and content use one atomic store. It is not an account-wide profile, encrypted vault or central dataset. Your AI provider's handling of prompts is separate from this feature.

## Review and control it in Studio

Open **Feedback memory** in the local Studio's live-review bar:

- Enable or disable saving at any time. Off stops new records and responses, retaining old entries until deleted. The agent must respect this choice.
- Refresh to see new entries; read the diagnosis, change and before/after notes.
- Add the actual client's response: Not reviewed, Better / accepted, Partly better, or Worse / rejected, with an optional note. The agent's visual inspection and the client's approval remain separate.
- Delete an entry or confirm **Delete memory & turn off**. Project files and the operational live checklist are unaffected. Existing downloads/emails cannot be recalled by local deletion.

No memory UI/API is supplied in the static public demo. Nothing requires an account or an email address.

## Share examples voluntarily

1. Select only the examples you want to share. None are preselected.
2. Choose **Prepare selected examples** and edit the exact report. It contains text, not media or project files. Local record IDs, timestamps and scene/task identifiers are omitted; obvious emails, URLs, home paths and some credential patterns are filtered. This is **not guaranteed anonymization**: remove client names, confidential content and other identifiers yourself.
3. Confirm that you reviewed the report. Editing it again clears confirmation. Download or copy exactly that text.
4. **Open email draft** addresses **framevolve.app@gmail.com**. Attach the downloaded report yourself, review the draft and press Send in your email app. A browser cannot attach a local file through `mailto:`. If no mail app opens, use your webmail and the downloaded file or copied text.

There is no automatic upload, background telemetry, auto-attachment or automatic send. Voluntarily shared examples can help Andrea improve agent instructions and workflows; they do not automatically train a model or change everyone's behavior. Sharing failures do not interrupt editing.

## Agent commands

```sh
node scripts/feedback-memory.mjs status
node scripts/feedback-memory.mjs list
# Provide a bounded JSON object on stdin, using proper shell quoting or a process stdin API:
node scripts/feedback-memory.mjs record
```

Commands accept `--repo PATH`. `record` returns `saved:false` when consent is off, without consuming stdin. The CLI cannot enable consent or mark a case accepted. See the agent guidance for the allowlisted JSON fields. New cases always start with pending client response. Store at most 500 examples / 4 MB; delete obsolete cases when full. No silent eviction. A short filesystem lock prevents lost writes and prevents an in-flight writer from restoring deleted content. An interrupted writer may leave a lock; only remove `.motion-cache/feedback-memory.json.lock` when no writer is active.

## How to use received examples

Keep the original feedback, agent hypothesis, intervention, before/after evidence and client outcome linked. Include unsuccessful attempts, not only wins. Identify repeated interpretation errors, create a small set of representative evaluation briefs and improve the guidance against those cases. Avoid turning a single client's style preference into a global rule. A positive rating is useful evidence, not proof that the change alone caused approval.
