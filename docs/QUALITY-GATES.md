# Visual checks

Generate material and clay views of the three objects:

```sh
node scripts/quality.mjs --out renders/quality-board.png
```

The command produces a six-frame board, individual PNGs and a JSON manifest using isolated object views. Successful rendering does not establish visual approval.

1. **Shape and detail:** inspect silhouettes, thickness, bevels, seams, rings and attachment points. Check inflated volume and seams on balloon components, real keychain connections, and the dial's travel within its collar.
2. **Normals and intersections:** inspect clay and `review: 'normals'` views for reversed faces, missing surfaces, intersections and broken shadows. Repeat at another angle.
3. **Materials:** check close-up texture scale, plastic/metal/film differences, UV continuity and reflections. Grain and highlights should retain detail.
4. **Movement:** watch a continuous preview for pivots, inertia, constraints, contacts, oscillations and stops. Still frames cannot validate fluidity or physics.
5. **Compositing:** review the full frame in motion at final resolution. Check hierarchy, overlaps, shadows, contrast, readability and edge cropping. Compare bloom and motion blur on and off.
6. **Delivery:** verify deterministic seeking and video metadata, then watch the exported file. Record render completion, visual review and user approval separately.

Fix geometry and materials before rendering the full film. For motion issues, render a short preview of the affected section first.
