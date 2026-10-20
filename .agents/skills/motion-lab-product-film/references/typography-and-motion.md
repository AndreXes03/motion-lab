# Typography and motion for product commercials

Use when designing supers (editorial on-screen headlines), comparing fonts or repairing weak text animation. Preserve the brand's exact logo and approved copy. A headline is a designed part of the shot, not a subtitle automatically centered over it.

## Make the choice easy for a founder

Reuse the established feeling and identity. If the typography remains consequentially undecided, show the actual phrase in two or three distinct faces and ask which feels closest: precise and understated, bold and compact, or expressive and playful. Recommend one in context. Never ask the founder to choose Bézier handles or classify typefaces.

Show mixed case when lowercase details carry the personality. A simple grotesque can feel more distinctive than a generic sci-fi font. Compare terminals, counters, the a/g/r/t, punctuation, width and weight at the final size. Retain the favorite as an anchor across later comparisons. Do not replace the official logo font as a side effect of choosing the editorial type. Use licensed assets with recorded provenance; verify the actual font instead of asserting a screenshot match.

## Compose before animating

- Give the phrase a reason to appear: benefit, meaningful transition, or emphasis. Remove vague filler.
- Use the moving product's silhouette and negative space. Compare a side placement, a shoulder alignment and a split phrase with the product between its words. Reserve the center for a justified accent.
- Keep a visible gap from important product edges and controls throughout the shot. A single contact-sheet frame cannot prove clearance.
- White can be the right palette. Do not mistake repeated placement or weak weight for a color problem. Match the chosen identity and contrast.
- Scale words by meaning and available space, then tune optical spacing. Do not stretch the glyphs heavily to fit. Check the smallest target viewing size and crop before adding motion.

For a split phrase, keep the completed reading order obvious even when its letters are revealed in another order. A product should connect the two parts, not hide a word. Recompose for vertical delivery instead of assuming a wide master can be center-cropped.

## Give each level a different job

Plan the phrase as **entry → assembly → reading → exit**. These phases may overlap; they are not four equal durations.

| Level | Purpose | Useful treatment |
| --- | --- | --- |
| Phrase / word | Carry the edit's momentum | Decisive directional travel, independent distance per word, shared landing rhythm |
| Letter groups | Add character during arrival | Short, unequal delays, bounded movement or masked reveal, rapid recognition |
| Reading interval | Let the message land | Complete crisp words, quiet continuing drift, minimal deformation |
| Exit | Transfer momentum to the next image | Acceleration toward the cut, matching screen direction or scale where meaningful |

Do not apply one ease-in-out to every property. Position, reveal, scale and opacity serve different purposes. A soft landing with a velocity peak near a cut is often useful; a normalized Gaussian velocity can suit a long pullback, while a short title may need a stronger monotonic ease. Match velocity as the entry tail joins reading drift and as exit acceleration takes over. Avoid rebound unless playfulness specifically calls for it.

Different travel distances need different start times or durations to feel related. Put any scale emphasis close to entry/cut and keep it small during reading. Do not make glyphs rotate or bounce independently merely to add activity. Blur belongs to fast travel, not the settled phrase.

## Replace the automatic reading-order reveal

A left-to-right stagger is one option, not the default for every super. Choose a pattern related to this word and shot:

- **Anchor and satellites:** a distinctive middle letter arrives first, then short groups on either side; punctuation resolves last.
- **Paired edges:** outer letters or syllable groups meet, followed by the interior; useful around a centered product.
- **Counter-direction:** letters assemble opposite the word's travel, then the complete phrase shares the shot's drift.
- **Product-triggered groups:** letters respond to the product crossing their area, a mechanical accent or one musical hit.
- **Whole-word mask:** preserve the word as a single shape when the cut is too short for a letter animation.

Choose a small number of authored, deterministic groups; do not shuffle letters on every frame. Give groups unequal but short delays and, when useful, slightly different travel ranges. A fixed seeded order can work if it looks intentional, but randomness alone is not design. Vary the pattern across the film without making every title a new visual language.

The assembly must happen while the word is actually visible. If it finishes offscreen before the word arrives, the audience sees the same block slide as before. If it finishes too late, there is no reading interval. On very short shots, reduce the assembly or carry the headline across a justified adjacent graphic passage; do not squeeze the phrase into unreadable frames.

## Expose useful refinement

Keep entry/exit duration, reading drift, curve handles, letter delay/spread and letter travel editable when supported. Preserve meaningful defaults and absolute-time seeking. Show a focused normal panel and place detailed curve handles in advanced controls. Do not invent sliders that do not affect the render. Provide independent headline visibility for a clean version while retaining UI and closing identity.

## Review motion as motion

Render a short real-speed proof of the actual words and composition. A slowed replay is diagnostic, never a substitute for real-speed review. If the background is a still render, label it as such and later inspect the complete moving product sequence.

Check entry, partial assembly, fully readable interval, exit and the neighboring cut. Compare both screen position and velocity; a title can have correct endpoints and still feel rigid. Verify:

- Letters become recognizable while visible, and the word completes early enough to read.
- The reveal does not repeat reading order everywhere, and does not flicker on random seeking.
- Product, UI and type remain distinct as all move; no accidental edge collisions or orphaned punctuation.
- Contrast and spacing survive phone-size playback, motion blur and compression.
- The official logo remains accurate and the ending matches the product's position, apparent size and velocity when a match cut is intended.

Keep a clean frame and the compressed motion proof. Passing curve/math tests proves determinism, not good choreography. Reuse approved beauty for typography iterations before committing to another costly 3D render.
