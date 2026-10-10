# Motion Lab: visual delivery protocol

A passing build, metadata check or deterministic seek is technical evidence, not evidence of visual quality.

Before delivering a changed product film:
1. Inspect the supplied reference and state concrete shape, material and lighting targets. Never silently substitute plush for inflatable vinyl or an arbitrary font for a logo.
2. Render isolated clean and clay views with `node scripts/quality.mjs`. Review silhouette, thickness, normals, surface intersections, pivots, decals and texture scale. Fix visible failures before rendering the full film.
3. For mechanical assemblies, confirm the rotation axis and hierarchy; chains must remain attached through motion. Distinguish constrained approximation from a full rigid-body simulation.
4. Render the contact sheet and a video preview. Inspect intermediate fast-travel frames as well as hero frames. Compositing must have an off switch and must not hide defective geometry.
5. Export and verify duration, frame count, dimensions, fps, and seek determinism. Preserve prior versions and report remaining visual limitations without claiming reference equivalence.

Stable configuration: project/look.json, project/motion.json, src/config.js.
Inspection parameters: {"inspect":{"object":"device.root","yaw":20},"review":"clean"}. Modes: beauty, clean, clay, normals.
Do not alter shared files while another agent is rendering a quality gate; coordinate component ownership and announce when a file is stable.

For product-film modeling, impact animation, lens choreography and final delivery, use the repository skill at `.agents/skills/motion-lab-product-film/SKILL.md`. It documents the working renderer and efficient checks without replacing the user's current creative or publication instructions.
