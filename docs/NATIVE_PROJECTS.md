# Native project documents (version 1)

The local project document is a renderer-independent edit record. It contains scene adapters, referenced assets, editable elements, absolute-time animation, audio tracks, and chosen controls. A scene adapter is explicitly `legacy-recipe` or `native-elements`. Importing a schema 2 recipe keeps the full recipe snapshot and its parameters in `legacy-recipe`; it does not rewrite `project/*.json`, convert its scene code, or claim every scene is editable as elements. Control selections reference IDs from the existing scene catalog, so a saved project does not invent control ranges.

Documents are saved as `.motion-cache/projects/ID.json` with revision numbers. `create` starts at revision 1. Every update sends `expectedRevision` and a document whose revision is one higher. Conflicts return 409. The storage path accepts only simple project IDs and rejects symlinked storage or files. Keep imported assets in the existing `project/` area and reference them from the document with an asset URI. The document does not copy media.

The native element layer describes text, camera, material, transform, and other element metadata. `evaluateNativeProject(project, sceneId, time)` samples native numeric animation at absolute seconds and returns a deterministic state. It returns the legacy adapter unchanged for existing renderer paths. For the procedural scene, `evaluateProjectSceneGraph(project, sceneId, time)` delegates to the existing `createProductionScene(parameters).evaluate(time)` native 2D graph; the API offers this through `graph: true`. Native element state is not yet compiled into a renderable scene graph, and the Studio project editor is not wired to this document API. PULSE and LOOP retain their existing native scene preparation and renderer adapters; project migration alone does not change their rendering path.

Local CLI examples:

```sh
node scripts/native-project.mjs migrate demo/procedural-techno.project.json my_film
node scripts/native-project.mjs show my_film
node scripts/native-project.mjs evaluate my_film scene_1 2.5
node scripts/native-project.mjs update my_film draft.json 1
```

The localhost Studio API provides `GET /api/studio/projects`, `POST /api/studio/projects`, `GET /api/studio/projects/:id`, `PUT /api/studio/projects/:id`, `POST /api/studio/projects/migrate`, and `POST /api/studio/projects/:id/evaluate`. An agent can use the CLI or this local API directly. The browser is useful for visual review, but it is not required for document operations. MCP clients can call the same local commands through a controlled local tool wrapper; no external service or model call is involved.

For API updates, send `{ "expectedRevision": 1, "project": { ...document with revision 2... } }`. Migration sends `{ "id": "my_film", "recipe": { ...schema 2 recipe... } }`.
