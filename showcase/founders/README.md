# Founder landing variant

Published independently at `/motion-lab/founders/`. The original landing remains at `/motion-lab/`.

This static page retains Framevolve's charcoal, lime, orbit mark and restrained glass treatment, with messaging for bootstrapped startup founders. Four large editorial illustrations explain assets → brief → first cut → refinement. They are not product screenshots. The final illustration has a working color example. The actual Easy workspace capture and brief builder are available in expandable panels, with detailed availability information in the FAQ.

The founder workflow in PR #15 remains a preview at publication: the public demo does not expose it. Avoid implying that a founder asset upload automatically creates the authored 3D showcase films, that this page generates videos, or that there is bundled AI inference. Update the status copy and CTA destinations only after the actual release is verified.

The brief form builds text locally. It has no backend, analytics, file upload or persistence. The film dialog uses native controls, Escape dismissal and focus return. Hero playback respects reduced motion, data saving, visibility and explicit pause.

Preview via an HTTP server at `showcase/founders/` from the repository root, or copy this folder to `_site/founders` alongside the existing published assets. `founders.js` resolves both paths. GitHub Pages assembles the static directory; no Sites dependency is used.

## Film order and LOOP release gate

The user has requested **LOOP first, PULSE second** once LOOP is perfected, and explicitly instructed us not to upload LOOP now. `films.js` records that order but gates LOOP as `awaiting-user-approval`, with no media paths. Only published entries with complete file, preview and poster metadata may appear or load. Until the user approves a finished LOOP export, PULSE remains featured, followed by CAMERA and DOT. Do not upload a draft or use unfinished LOOP material.

After explicit approval, add and verify the finished media, populate LOOP's metadata and set its status to `published`. The hero and gallery then derive the intended order from the same catalog: LOOP leads, PULSE becomes the first supporting film. Also update the static hero fallback and social preview metadata in `index.html` to the approved LOOP poster. Inspect the public hero's first frame, playback and loop transition after deployment.
