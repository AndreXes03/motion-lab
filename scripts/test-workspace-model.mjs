import assert from 'node:assert/strict';
import {sceneIds} from '../src/scene-registry.js';
import {createControlManifest, validateControlManifest} from '../src/engine/control-catalog.js';
import {deriveWorkspaceModel} from '../src/viewer/workspace-model.js';

for (const scene of sceneIds) {
  for (const mode of ['recommended', 'all']) {
    const manifest = createControlManifest(scene, mode);
    const before = structuredClone(manifest);
    const sceneView = deriveWorkspaceModel({scene, manifest, workspace: 'look'});
    const finishView = deriveWorkspaceModel({scene, manifest, workspace: 'compositing'});
    assert.deepEqual([...sceneView.visibleControlIds, ...finishView.visibleControlIds].sort(), [...manifest.controls].sort(), `${scene}/${mode}: workspaces retain every selected control exactly once`);
    assert.deepEqual(manifest, before, `${scene}/${mode}: viewing never mutates a saved manifest`);
    assert.equal(sceneView.workspace, 'scene');
    assert.ok(!sceneView.categories.includes('compositing'));
    assert.deepEqual(finishView.categories, ['compositing']);
  }
}

const manifest = createControlManifest('objects');
const selected = deriveWorkspaceModel({scene: 'objects', manifest, selection: 'device.root'});
assert.ok(selected.visibleControlIds.includes('shell'));
assert.ok(!selected.visibleControlIds.includes('fov'), 'object view hides camera tools');
assert.ok(!selected.visibleControlIds.includes('grain'), 'Scene excludes finishing');
const finish = deriveWorkspaceModel({scene: 'objects', manifest, workspace: 'compositing', selection: 'device.root'});
assert.ok(finish.visibleControlIds.includes('grain'), 'composition-wide finishing is available after selecting an object');
assert.ok(finish.visibleControlIds.includes('colorContrast'));
const staleCategory = deriveWorkspaceModel({scene: 'objects', manifest, workspace: 'compositing', category: 'lights'});
assert.equal(staleCategory.category, 'all');
assert.deepEqual(staleCategory.visibleControlIds, finish.visibleControlIds);
const noSearch = deriveWorkspaceModel({scene: 'objects', manifest, query: 'NO MATCH 9832'});
assert.equal(noSearch.emptyReason, 'search');
assert.ok(noSearch.categories.length, 'search never removes the category navigation');
const camera = deriveWorkspaceModel({scene: 'objects', manifest, selection: 'camera', category: 'lights'});
assert.equal(camera.category, 'all', 'a category hidden by selection cannot trap users in an empty panel');
assert.ok(camera.visibleControlIds.includes('fov'));
assert.equal(deriveWorkspaceModel({scene: 'procedural', selection: 'device.root'}).selection, 'composition', 'scene changes discard invalid selection in the view only');

// Authored layout metadata is authoritative: accent is intentionally grouped
// with Graphics in the procedural manifest despite its catalog Appearance type.
assert.ok(deriveWorkspaceModel({scene: 'procedural', category: 'graphics'}).visibleControlIds.includes('accent'));
const minimal = validateControlManifest({version: 1, scene: 'objects', controls: ['shell'], panels: [{id: 'material', title: 'Material', category: 'appearance', controls: ['shell']}]}, 'objects');
assert.equal(deriveWorkspaceModel({scene: 'objects', manifest: minimal, workspace: 'compositing'}).emptyReason, 'workspace');
assert.equal(deriveWorkspaceModel({scene: 'objects', manifest: minimal, selection: 'camera'}).emptyReason, 'selection');
assert.deepEqual(minimal.controls, ['shell'], 'view filters never expand an authored selection');
console.log('Workspace model passed: all scenes, routing, context, search, custom manifests and immutability.');
