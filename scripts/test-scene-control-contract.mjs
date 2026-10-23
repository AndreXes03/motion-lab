import {supportedScenes as cyclesScenes} from './cycles/options.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sceneIds, sceneRegistry } from '../src/scene-registry.js';
import { resolveParameters, studioProjects } from '../src/engine/project-controls.js';
import { getAnimationGroups } from '../src/engine/animation-groups.js';
import { validateRenderPlan } from '../src/engine/render-policy.js';
import { controlCategories, studyControlDefinitions } from '../src/engine/scene-capabilities.js';
import {
  createControlManifest,
  getControlCatalog,
  resolveControlManifest,
  validateControlManifest
} from '../src/engine/control-catalog.js';
import { validateStudioParameters } from './studio-api.mjs';

const presetDocument = JSON.parse(await readFile(new URL('../project/control-presets.json', import.meta.url), 'utf8'));
assert.equal(presetDocument.version, 1, 'control presets use schema version 1');
assert.ok(presetDocument.scenes && typeof presetDocument.scenes === 'object' && !Array.isArray(presetDocument.scenes));
for (const [scene, categories] of Object.entries(presetDocument.scenes)) {
  assert.ok(sceneIds.includes(scene), `preset overrides only name registered scenes: ${scene}`);
  assert.ok(categories && typeof categories === 'object' && !Array.isArray(categories));
  for (const [category, profiles] of Object.entries(categories)) {
    assert.ok(['lights', 'compositing', 'interpolation'].includes(category), `known preset category: ${scene}/${category}`);
    assert.ok(Array.isArray(profiles) && profiles.length <= 4, `${scene}/${category} has at most four curated variants`);
  }
}
const renderDocument = JSON.parse(await readFile(new URL('../project/render-plans.json', import.meta.url), 'utf8'));
assert.equal(renderDocument.version, 1, 'renderer recommendations use schema version 1');
assert.ok(renderDocument.scenes && typeof renderDocument.scenes === 'object' && !Array.isArray(renderDocument.scenes));
for (const [scene, recommendation] of Object.entries(renderDocument.scenes)) {
  assert.ok(sceneIds.includes(scene), `renderer recommendations only name registered scenes: ${scene}`);
  const plan = validateRenderPlan(recommendation);
  assert.equal(plan.source, 'agent', `${scene} default renderer recommendation is agent-authored`);
  assert.ok(plan.rationale.trim(), `${scene} renderer recommendation has a rationale`);
  if (plan.renderer === 'cycles' || plan.preferredRenderer === 'cycles') assert.ok(cyclesScenes.includes(scene), 'Cycles recommendations require an implemented adapter');
}

const selectionDocument = JSON.parse(await readFile(new URL('../project/control-selections.json', import.meta.url), 'utf8'));
assert.equal(selectionDocument.version, 1, 'control selections use schema version 1');
assert.ok(selectionDocument.scenes && typeof selectionDocument.scenes === 'object' && !Array.isArray(selectionDocument.scenes));
assert.deepEqual(
  Object.keys(selectionDocument.scenes).sort(),
  [...sceneIds].sort(),
  'every registered scene must have an explicit saved UI selection; new scenes fail until a selection is authored'
);

for (const scene of sceneIds) {
  const catalog = getControlCatalog(scene);
  const ids = catalog.map(control => control.id);
  assert.ok(catalog.length > 0, `${scene} has a non-empty control catalog`);
  assert.equal(new Set(ids).size, ids.length, `${scene} control IDs are unique`);
  assert.ok(catalog.some(control => control.animatable && control.type === 'range' && Number.isFinite(control.min) && Number.isFinite(control.max) && control.min < control.max), `${scene} has an animatable numeric control`);

  for (const control of catalog) {
    assert.ok(['range', 'color', 'text', 'toggle'].includes(control.type), `${scene}/${control.id} uses a supported widget`);
    assert.ok(Array.isArray(control.path) && control.path.length > 0 && control.path.every(key => typeof key === 'string' && key && !['__proto__', 'prototype', 'constructor'].includes(key)), `${scene}/${control.id} has a safe array path`);
    assert.ok(Object.hasOwn(controlCategories, control.category), `${scene}/${control.id} has a supported category`);
    if (control.type === 'range') assert.ok(Number.isFinite(control.default) && control.default >= control.min && control.default <= control.max && Number.isFinite(control.step) && control.step > 0, `${scene}/${control.id} has valid numeric bounds and defaults`);
  }
  for (const id of ['colorContrast', 'colorSaturation']) {
    const control = catalog.find(control => control.id === id);
    assert.ok(control, `${scene} exposes universal ${id}`);
    assert.equal(control.category, 'compositing');
    assert.equal(control.default, 1, `${scene}/${id} preserves the authored neutral finish`);
    assert.deepEqual(control.path, ['look', 'post', id]);
  }
  const groups = getAnimationGroups(scene);
  assert.ok(groups.length > 0, `${scene} has scene-specific animation groups`);
  assert.equal(new Set(groups.map(group => group.id)).size, groups.length, `${scene} animation group IDs are unique`);
  for (const group of groups) {
    assert.ok(group.label?.trim() && group.description?.trim() && group.windows.length > 0, `${scene}/${group.id} explains its target and shot windows`);
    let previousEnd = 0;
    for (const window of group.windows) {
      assert.ok(window.label?.trim() && Number.isFinite(window.start) && window.start >= previousEnd && window.end > window.start && window.end <= sceneRegistry[scene].duration, `${scene}/${group.id} windows are ordered within film duration`);
      previousEnd = window.end;
    }
  }
  await assert.rejects(() => validateStudioParameters({scene, previewQuality: 'fast'}), /Unsupported parameter: previewQuality/, 'interactive quality must never become a recipe parameter');

  const saved = selectionDocument.scenes[scene];
  assert.ok(Array.isArray(saved.controls) && saved.controls.length > 0, `${scene} has explicitly selected visible controls`);
  assert.ok(typeof saved.rationale === 'string' && saved.rationale.trim().length > 0, `${scene} selection has a reason`);
  const all = createControlManifest(scene, 'all');
  const recommended = createControlManifest(scene);
  assert.ok(recommended.easy?.length>=1&&recommended.easy.length<=5, `${scene} needs 1–5 agent-authored Easy controls`);
  const alias = createControlManifest(scene, 'essential');
  assert.ok(recommended.controls.some(id=>catalog.find(c=>c.id===id)?.animatable), `${scene} chosen tools include a usable animation parameter`);
  assert.deepEqual(recommended.controls, saved.controls, `${scene} default selection follows project/control-selections.json`);
  assert.deepEqual(alias.controls, recommended.controls, `${scene} essential alias preserves the recommended selection`);
  const sceneKind = studioProjects.find(item => item.id === scene)?.kind;
  if (['2d', 'hybrid'].includes(sceneKind)) {
    // The public capability catalog is the agent's editing contract. A new 2D
    // parameter must be discoverable in both modes, even if its panel is closed.
    const missing = ids.filter(id => !recommended.controls.includes(id));
    assert.deepEqual(missing, [], `${scene}: every planned 2D control needs a default panel; missing ${missing.join(', ')}`);
    // This authoring requirement does not restrict a user's custom saved layout.
    const first = recommended.controls[0];
    const custom = validateControlManifest({version: 1, scene, controls: [first]}, scene);
    assert.deepEqual(custom.controls, [first], `${scene}: custom layouts may still hide controls without deleting values or tracks`);
  }
  assert.deepEqual(recommended.rationale, saved.rationale, `${scene} manifest carries the selection rationale`);
  assert.ok(recommended.controls.length > 0 && recommended.controls.every(id => all.controls.includes(id)), `${scene} recommended controls are a non-empty subset of the full catalog`);
  assert.deepEqual(validateControlManifest(recommended, scene), recommended);
  assert.deepEqual(validateControlManifest(all, scene), all);
  assert.deepEqual(resolveControlManifest(undefined, scene), recommended, `${scene} defaults a missing legacy selection to the authored recommendation`);
  assert.deepEqual(resolveControlManifest({version: 1, scene, controls: []}, scene), recommended, `${scene} migrates an empty legacy selection to the authored recommendation`);

  const panelIds = new Set();
  const flattened = [];
  for (const panel of recommended.panels) {
    assert.ok(Object.hasOwn(controlCategories, panel.category), `${scene} panel categories belong to the shared taxonomy`);
    assert.ok(panel.id && panel.title && Array.isArray(panel.controls), `${scene} panels have IDs, titles, and control lists`);
    assert.ok(!panelIds.has(panel.id), `${scene} panel IDs are unique`);
    panelIds.add(panel.id);
    for (const id of panel.controls) {
      assert.ok(recommended.controls.includes(id), `${scene} panel ${panel.id} only displays selected controls`);
      flattened.push(id);
    }
  }
  assert.deepEqual(new Set(flattened), new Set(recommended.controls), `${scene} panels account for every selected control`);

  const sceneDefinitions = studyControlDefinitions[scene] ?? [];
  for (const definition of sceneDefinitions) assert.ok(ids.includes(definition.id), `${scene} catalog includes its scene adapter control ${definition.id}`);
  const values = Object.fromEntries(catalog.filter(control => control.binding === 'value').map(control => [control.valueId, control.default]));
  for (const definition of sceneDefinitions) values[definition.id] = definition.default;
  if (sceneDefinitions.length) {
    const definition = sceneDefinitions[0];
    values[definition.id] = Math.min(definition.max, definition.default + definition.step);
  }
  const resolved = resolveParameters(scene, values, 'original');
  assert.equal(resolved.scene, scene, `${scene} resolves to its selected scene`);
  const project = studioProjects.find(item => item.id === scene);
  const studioValues = Object.fromEntries((project?.controls ?? []).map(control => [control.id, values[control.id] ?? control.default]));
  const normalized = await validateStudioParameters({
    ...resolved,
    studio: { values: studioValues, preset: 'original', controlManifest: recommended }
  });
  assert.equal(normalized.scene, scene, `${scene} survives Studio API validation`);
  assert.deepEqual(normalized.studio.controlManifest.controls, recommended.controls);
  assert.deepEqual(normalized.sceneControls, resolved.sceneControls, `${scene} scene-owned control values survive API validation`);
  const migrated = await validateStudioParameters({
    ...resolved,
    studio: { values: studioValues, preset: 'original', controlManifest: { version: 1, scene, controls: [] } }
  });
  assert.deepEqual(migrated.studio.controlManifest.controls, recommended.controls, `${scene} upgrades saved empty manifests through API validation`);
}

const objectsManifest = createControlManifest('objects');
assert.throws(() => validateControlManifest({ ...objectsManifest, controls: [...objectsManifest.controls, objectsManifest.controls[0]] }, 'objects'), /Duplicate manifest control/);
const duplicatePanel = structuredClone(objectsManifest);
duplicatePanel.panels[1].id = duplicatePanel.panels[0].id;
assert.throws(() => validateControlManifest(duplicatePanel, 'objects'), /duplicate panel id/);
const duplicatedPanelControl = structuredClone(objectsManifest);
duplicatedPanelControl.panels[1].controls.push(duplicatedPanelControl.panels[0].controls[0]);
assert.throws(() => validateControlManifest(duplicatedPanelControl, 'objects'), /selected controls exactly once/);
const omittedPanelControl = structuredClone(objectsManifest);
omittedPanelControl.panels.at(-1).controls.pop();
assert.throws(() => validateControlManifest(omittedPanelControl, 'objects'), /Every selected control needs a panel/);
const unselectedPanelControl = structuredClone(objectsManifest);
unselectedPanelControl.panels[0].controls.push('device.root.x');
assert.throws(() => validateControlManifest(unselectedPanelControl, 'objects'), /selected controls exactly once/);
const invalidPanelCategory = structuredClone(objectsManifest);
invalidPanelCategory.panels[0].category = 'misc';
assert.throws(() => validateControlManifest(invalidPanelCategory, 'objects'), /Invalid panel metadata/);

for (const [scene, definitions] of Object.entries(studyControlDefinitions)) {
  assert.ok(sceneIds.includes(scene), `scene capability metadata only names registered scenes: ${scene}`);
  assert.ok(definitions.length > 0, `${scene} has scene-owned controls`);
  assert.equal(new Set(definitions.map(control => control.id)).size, definitions.length, `${scene} scene-owned control IDs are unique`);
}

console.log(JSON.stringify({ type: 'test-result', sceneControlContract: 'passed', scenes: sceneIds.length, selections: Object.keys(selectionDocument.scenes).length, controls: sceneIds.reduce((total, scene) => total + getControlCatalog(scene).length, 0), groups: 'registered', presets: 'bounded', rendererRecommendations: 'validated' }));
