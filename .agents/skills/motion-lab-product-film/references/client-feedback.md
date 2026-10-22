# Translate client feedback into a better film

Treat everyday feedback as evidence about the viewing experience, not as a literal effects prescription. The aim is a clearer, more persuasive film that fits this client's brief. Do not promise approval or override taste with technical authority.

## Diagnose before changing

1. Read the current brief, approved references, locked decisions and relevant prior revisions. If feedback memory is enabled, inspect relevant records with `node scripts/feedback-memory.mjs list`. Match the scene and context; do not transfer one client's taste to a different client. Accepted means accepted in that context, not a universal design rule. Prior rejected approaches should not quietly return.
2. Preserve the client's original wording. Separate **what they said**, **your interpretation**, and **what you actually observed** in the frame or motion. Inspect the affected interval and adjacent cuts. If no preview is available, label your diagnosis a hypothesis, not a finding.
3. Translate the impression into a desired viewing outcome: understand the benefit sooner, perceive more physical weight, follow one focal point, read the title comfortably, recognize the brand. Link it to the audience and delivery format.
4. Pick the smallest coherent intervention that addresses the likely cause. State it in ordinary language: “I’ll reveal the result earlier and shorten the empty hold, while keeping the calm camera.” Use supported controls and existing scene architecture; add a real capability if needed, never invent a working control.
5. Ask one focused question only when plausible interpretations would lead to substantially different creative directions, erase approved work, change claims, or increase scope/cost. Otherwise explain your reversible assumption and proceed. For “make it more premium,” a supplied reference may already answer the question.

## Working hypotheses, not a phrase-to-preset dictionary

| Client wording | Inspect first | Possible targeted intervention | Judge success by |
| --- | --- | --- | --- |
| “Too static / no energy” | Empty holds, similar shot sizes, synchronized entrances, lack of payoff | Shorten one dead interval, vary shot purpose/scale, stagger meaningful action, shape acceleration into the cut | The idea progresses and the eye follows it; readable recovery remains |
| “More premium” | Spacing, typography hierarchy, silhouette, highlights, materials, pacing consistency | Reduce competing accents, improve material/light response, settle the hero composition | Product feels intentional and desirable in this brand’s language; not merely darker or slower |
| “I don't understand what it does” | Hook, action-to-result relationship, ambiguous UI, claims | Put one real product action beside its visible consequence; simplify copy | A new viewer can explain the benefit with sound off |
| “It looks fake / cheap” | Scale, contact, intersections, joint axes, roughness, reflection and light consistency | Correct the physical or graphic inconsistency before decorative effects | Geometry and motion hold up in clean view and intermediate frames |
| “Too slow” | Time to first payoff vs. total duration; reading intervals vs. empty pauses | Move proof earlier, remove redundant beats, tighten selected holds | Information arrives sooner without unreadable titles or indiscriminate speed-up |
| “Too busy / confusing” | Simultaneous focal points, contrast, copy density, camera competing with type | Establish one hierarchy, sequence events, simplify secondary detail | Viewer can tell where to look through the transition |
| “Text doesn't work” | Wording vs. hierarchy, contrast, line breaks, safe areas, display size, reading time | Fix the identified cause; keep approved wording unless asked | Text is understood at actual delivery size, including during motion |
| “More wow / make it sell” | Product proof, reveal, emotional contrast, memorable payoff | Build anticipation around one meaningful reveal; make the benefit visible | There is a memorable product moment; no unsupported commercial claim |
| “Not our brand” | Supplied brand assets, references, tone, motion language, typography | Restore the supplied identity and adjust the specific mismatch | Result is consistent with the approved brand, not generic trends |
| “I just don't like it” | Which shot first feels wrong; contrast with an approved reference | State two distinct plausible directions and ask which feels closer if context cannot decide | A usable criterion emerges; do not randomize the entire film |

“More dynamic” does not mean every object moves. “Premium” does not mean black and gold. “Realistic” does not necessarily require a different renderer. “Convincing” does not authorize inventing benefits, metrics, testimonials or urgency.

## Make the change reviewable

Use the live-review skill's numbered checklist and begin → publish → inspect → done loop. For each independent request:

- Preserve the previous usable recipe/source checkpoint before editing through the existing version workflow. Never overwrite an approved master to stage a comparison.
- Compare the same shot, framing, time and preview quality before and after. For pacing, show the corresponding short passage at normal playback with comparable audio; a still cannot establish motion improvement. If the cut duration changes, match the intended action, record both time ranges and do not compare unrelated hero moments.
- Record the target and what was actually checked: silhouette/contact, hierarchy, reading window, timing or product proof. Check adjacent shots for regressions. Build/export success is a separate technical check.
- Explain the visible change and its reason in one or two sentences. Invite a specific response: “Is the benefit clearer now, or should it appear even earlier?” Do not pressure the client to agree or repeatedly ask for ratings.
- Distinguish **implemented**, **visually inspected**, and **accepted by client**. The live checklist's Done means implemented and inspected; silence or proceeding to another task is not acceptance. If a change is rejected, preserve that observation and try a revised hypothesis, not more of the same effect.

## Optional local learning memory

Check `node scripts/feedback-memory.mjs status` before collecting anything. If disabled, continue the creative workflow normally; do not enable it, create a shadow feedback file, retain extra chat logs, or ask repeatedly. Operational project files and the live checklist remain separate.

If enabled, record one useful case per attempted revision, including mixed and rejected attempts. Use JSON on stdin with `node scripts/feedback-memory.mjs record`; do not put client feedback into shell arguments or tracked source files. Capture the original wording without unrelated conversation, contact details, secrets or private assets. Use a short neutral paraphrase if necessary to remove identifiers and explicitly label it as a paraphrase. Useful fields:

```json
{
  "taskId": "f2",
  "scene": "product-demo",
  "feedback": "It feels too slow",
  "context": "Short social product launch; calm camera already approved",
  "intent": "Understand the benefit earlier without losing the calm tone",
  "diagnosis": "Hypothesis: a long opening hold delays the first visible result",
  "change": "Shortened the empty hold and moved the action-to-result beat earlier",
  "preserve": "Approved camera, branding and readable closing title",
  "before": "Opening passage 0–5s; first result late in the passage",
  "after": "Corresponding opening passage; result arrives earlier",
  "verification": "Compared normal-speed passages, checked title reading time and adjacent cut",
  "visualStatus": "inspected",
  "lesson": "Candidate lesson for this project: earlier proof can add pace without faster camera motion"
}
```

Write truthful observations, exact times when known and limitations when not. Do not copy the example's verification claims. `visualStatus` is `not-reviewed`, `inspected` or `unavailable`. The CLI returns a record ID and always starts client outcome as pending. In **Studio → Feedback memory**, the user can record **Better / accepted**, **Partly better** or **Worse / rejected** and a note. Never fill in approval on their behalf. A new attempt gets a new record, preserving prior responses.

Re-read relevant accepted/rejected records before the next revision. Treat `lesson` as a candidate interpretation until supported by the client's response. Review memory manually; do not silently rewrite global skills from one client's preference.

Sharing is separate. The user selects cases, reviews/edits the exact report, confirms it, downloads/copies it and may open a draft to **framevolve.app@gmail.com**. No automatic upload or email. Never send, attach, publish or collect extra media for this purpose without an explicit request. The report contains text before/after notes, not screenshots or video; offer visual evidence only if the user explicitly wants to share it.
