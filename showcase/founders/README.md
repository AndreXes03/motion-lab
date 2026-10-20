# Founder landing variant

Published independently at `/motion-lab/founders/`. The original landing remains at `/motion-lab/`.

This static page retains Framevolve's charcoal, lime, orbit mark and restrained glass treatment, with messaging for bootstrapped startup founders. Four large editorial illustrations explain assets → brief → first cut → refinement. They are not product screenshots. The final illustration has a working color example. The actual Easy workspace capture and brief builder are available in expandable panels, with detailed availability information in the FAQ.

The founder workflow in PR #15 remains a preview at publication: the public demo does not expose it. Avoid implying that a founder asset upload automatically creates the authored 3D showcase films, that this page generates videos, or that there is bundled AI inference. Update the status copy and CTA destinations only after the actual release is verified.

The brief form builds text locally. It has no backend, analytics, file upload or persistence. The film dialog uses native controls, Escape dismissal and focus return. Hero playback respects reduced motion, data saving, visibility and explicit pause.

The brief now points the coding agent to the bundled commercial skill and founder discovery. Optional audience, visible proof, existing assets and placement fields improve direction without expanding the required form. `brief.js` builds plain text and preserves explicit answers; `node scripts/test-founder-brief.mjs` checks complete, sparse and literal-markup inputs. The skill-guided conversation is available in the downloaded repository; the separate in-app founder setup below remains a preview.

The refined hero frames the real film as a launch reel. Three keyboard-accessible direction tabs (launch, feature, homepage) update an explicitly illustrative product scene and can seed the brief's mood and call to action without replacing user-written fields. The final lime CTA uses layered brand/product illustrations with reduced-motion support.

Preview via an HTTP server at `showcase/founders/` from the repository root, or copy this folder to `_site/founders` alongside the existing published assets. `founders.js` resolves both paths. GitHub Pages assembles the static directory; no Sites dependency is used.

## GPT Sites mirror

The matching Site is `https://framevolve-for-founders.andreasalvo.chatgpt.site`. Its separate source checkout owns its hosting identity and deployment. Copy the HTML, both stylesheets, `founders.js`, `brief.js` and film catalog together; preserve identical design and behavior. Set `<meta name="framevolve-base" content="https://andrexes03.github.io/motion-lab/">` in the mirrored HTML so videos, branding, license and Studio links use the existing public GitHub assets. Update the mirror's canonical and `og:url` metadata to the Site origin and make fallback asset URLs absolute. LOOP media is served from GitHub on both surfaces.

## Approved film order

The user approved publishing `V11/01_Principale_Electro.mp4` on 2026-10-20. LOOP is the featured film; the gallery order is LOOP, PULSE, CAMERA, DOT. The full film is a byte-identical copy of that approved 22-second 1080p export, with the first Electro soundtrack. A separate silent 720p preview reduces autoplay transfer, and the poster is extracted at 19.8 seconds. The same catalog drives the hero and gallery on both surfaces.

The original landing is unchanged. `demo/render-manifest.json` records source hash and export metadata; check hero first-frame playback, repeat playback, full-film audio availability and mobile gallery layout after deployment.

The second section compares the familiar describe / see / refine pattern with Base44, using original app and film illustrations. It is a workflow analogy, not an integration or a claim that the upcoming founder flow is available. The existing availability details remain visible.
