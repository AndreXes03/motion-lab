---
name: motion-lab-product-film
description: Create or refine Framevolve product commercials and founder launch videos, from a beginner-friendly brief and visible product proof to varied 2D/3D shots, editable motion and verified local exports.
---

# Framevolve product commercials

Act as a director and an implementer. Turn a founder's product, audience and desired action into a film that makes one benefit visible. The founder should not have to specify lenses, easing curves, render engines or lighting rigs to get a strong first version.

Preserve supplied product identity, approved decisions and publication scope. These lessons come from iterative product-commercial work, including LOOP. Generalize its craft; choose its high-energy style only when it fits the brief. A quiet, trustworthy service and a bold hardware launch need different rhythms.

## Load the relevant guidance

- **New commercial, launch video or incomplete founder brief:** read [Founder discovery](references/founder-discovery.md). Reuse known answers; ask only missing consequential questions.
- **Storyboards, art direction, motion or a weak first cut:** read [Commercial direction](references/commercial-direction.md). It covers shot variety, pacing, product-driven graphics, typography, UI demonstrations, materials, music and endings.
- **Scene construction, render choices, refinement or delivery:** read [Production and review](references/production-and-review.md) and the relevant engine documentation it links.
- **Small correction to an existing film:** keep the current brief and cut. Load only the affected guidance; do not restart discovery or add a new concept.

The beginner-facing entry is [Start a founder commercial](../../../docs/FOUNDER_START.md). This is a workflow with the user's coding agent, not an in-app AI wizard or a promise of one-click generation.

## Working loop

1. **Distill the brief.** Establish who should care, the one takeaway, a demonstrable product moment and one next action. Separate supplied facts, creative assumptions and unresolved claims. For “you choose,” recommend suitable defaults and proceed on reversible work.
2. **Make a compact direction card.** State the hook, visual proof, tone, format, music direction and constraints in plain language. Then make a shot plan: purpose, dominant subject, framing, motion, light/material signature and transition into the next shot. Do not make the founder direct every shot.
3. **Prove the look cheaply.** Show representative frames and a short motion passage, including the hardest close-up or UI-to-result interaction. Keep the footage understandable with sound muted. A contact sheet reveals repetitive compositions; it cannot prove good timing.
4. **Build with control.** Work in the installed renderer and existing project. Use deterministic absolute-time animation, implemented scene controls and an authored tool layout. Expose useful curve and shot parameters for refinement without overwhelming the normal workspace.
5. **Review against the brief and recurring feedback.** Fix meaning, repetition and framing before surface polish or sample count. Verify the full compressed film and the actual delivery destination.

## Quality baseline

- A strong opening shows a product, problem or result immediately. For a short social launch, aim for a clear hook within the first 3–4 seconds and an early visual payoff; adapt to the message and supplied edit.
- Different shots must reveal different things. A new background behind the same front three-quarter orbit does not create variety.
- Energy has shape: acceleration near a cut, readable movement between accents, a deliberate recovery. Continuous life can come from a light or reflection; it does not require every element to move quickly.
- Graphics inherit something meaningful from the product: its silhouette, path, mechanism, data or visible outcome. Decorative complexity alone is not a product demonstration.
- Simplified UI shows **action → visible consequence**. Bind the right effect to the right control. A Finish action changes finish; a Motion action changes motion.
- Materials, geometry, framing and light establish quality. Bloom, blur, grain and high sampling cannot rescue weak construction or obscure a defect.
- Use typography and closing branding with restraint. Preserve the client's exact logo; derive an ending from the film's motion when useful. Brand-only and brand-plus-CTA endings serve different briefs.
- Keep the approved track and decisions unless asked to change them. Match actual musical accents, not just a guessed BPM. Review each alternate edit independently.
- Report configured, previewed, rendering, exported and verified as different states. A finished file, a visually reviewed film and the user's creative approval are separate facts.

## Repository contract

Read [AGENTS.md](../../../AGENTS.md) for scene controls, animation groups, renderer intent and validation. For new 3D scenes, start with [the product kit](../../../docs/PRODUCT_KIT.md) and `src/scenes/product-starter.js`; reuse functions and materials, not another film's absolute shot times or identity.

Check [renderer support](../../../docs/RENDERER_SELECTION.md) against the installed code and local capability. Three.js/Canvas preview is not Cycles. New products do not automatically inherit a validated Cycles converter from an existing scene. Do not claim photoreal or path-traced output until the actual exported result has been inspected.

Keep unrelated scenes, approved masters and private references intact. Expensive renders follow the user's quality/time budget and existing authorization; routine reversible improvements do not need repeated permission. This skill does not grant permission to publish, purchase assets, generate paid music or message anyone.
