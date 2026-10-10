---
name: motion-lab-product-film
description: Build and refine tactile product films in this Three.js Motion Lab repository, from model construction and impact choreography to verified web and social exports.
---

# Motion Lab product films

Work in the existing renderer. Preserve the user's selected objects, palette, edit and publication scope. Use `src/engine/studio-baseline.js`, `studio-lookdev.js` and `composite.js`; read [3D look development](../../../docs/3d-lookdev.md) for their current interfaces. Never promise path-traced or reference-equivalent quality from this raster pipeline.

## Spend effort where it shows

Identify a small set of visible weaknesses before editing. Compare the same frame and framing before/after. More polygons, samples or bloom cannot repair a poor silhouette or unconvincing construction.

- Make the object understandable in layers: load-bearing chassis, housing, gasket, control, optic/display, connectors. Give each a plausible thickness, edge treatment and assembly path.
- Add components that survive the final shot size. A visible recessed connector, open speaker basket or curved lens cell is more useful than hundreds of invisible screws. Use instancing for repeated parts.
- Match surface response to function: matte molded ABS, rubber seals, satin plastic, brushed metal, ceramic, clear optics. Set texture frequency in object scale. Small normal-map relief is not displacement; use geometry for silhouette changes and real openings.
- Shape glossy reflections with lighting and environment cards. Keep broad faces partly dark; check neutral rubber separately from colored rims. Avoid solving unreadable metal by increasing bloom globally.

## Choreograph the shot, not isolated sliders

Use wide camera travel and close foreground parallax when the framing calls for energy. A fisheye pass bends the frame but does not replace a real camera move. Apply `fisheye`, `edgeSoftness`, restrained chromatic aberration and vignette selectively; preserve the optical center and graphic overlays. Check all intermediate close-passage frames for intersections and cropped subjects.

Place the velocity peak at the cut or collision. Match outgoing/incoming screen direction and scale; avoid stopping both shots at the edit. Prefer an accelerating power/exponential approach for a hit, followed by a short damped recoil. Keep spring overshoot on the allowed side of a contact constraint. Coupled parts share a motion phase. Reset transforms from authored values at every sampled time so arbitrary seeking remains deterministic.

Measure the whole moving assembly for clearances, including hidden support parts. If motion is constrained animation, describe it as such. Keep floors in penumbra or use `shadowGroundMaterial`; do not expose an arbitrary finite slab. Decorative particles need a clear purpose and depth hierarchy; omit them when they obscure the hero mechanism.

## Efficient review and delivery

1. Render a few same-time clean/clay and beauty frames, then a short 540p clip around the change. `scripts/quality.mjs --scene camera` or `pulse` covers important macro/assembly poses. Inspect fast intermediate frames, not only endpoints.
2. Freeze a source snapshot before a long export. `--quality premium` is 1080p/48 samples; `--quality supersampled` is 1440p/48 samples for a clean downsample to 1080p. Both support matching-frame resume. See the [iteration workflow](../../../docs/3d-lookdev.md#shorter-iteration-loop). Higher temporal sampling smooths motion blur; shutter angle sets its length.
3. Render with `--sound off` when preserving an existing mix. Mux the explicitly selected soundtrack without altering picture color. Stock music is separately licensed: keep standalone source tracks out of Git. Start music-led mixes with only a few short contact cues well below the music; do not fill every cut with a whoosh. Review the SFX stem separately, then in the mix. Loudness measurements do not establish good sound design.
4. Use `scripts/export-social.mjs --video master.mp4 --out x.mp4 --target x` for a compatible H.264/AAC delivery, or `--target web` for a higher-quality website copy. This is an encode, not an improvement to scene geometry. Keep the larger master.
5. Validate frame count, duration, audio, resolution, complete decode and arbitrary seek. Inspect the final compressed picture. Technical validation is distinct from creative approval; follow the user's current publication authorization, do not invent a new approval step.
6. `scripts/prepare-demo.mjs` can validate and install PULSE/CAMERA master files with posters, hashes and backups. It does not upload. Preserve unrelated films and keep public source free of private reference material.

A useful handoff states what changed visibly, which export was inspected, any remaining limitation, and which destinations were actually updated. Do not describe a queued job or a preview as a finished master.
