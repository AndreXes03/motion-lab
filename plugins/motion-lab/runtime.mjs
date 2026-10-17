import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const revision = parameters => createHash('sha256').update(stable(parameters)).digest('hex');

function changedLeaves(target, before, after) {
  for (const [key, value] of Object.entries(after)) {
    if (stable(before?.[key]) === stable(value)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) { target[key] ??= {}; changedLeaves(target[key], before?.[key], value); }
    else target[key] = structuredClone(value);
  }
}

export async function loadRuntime(root) {
  const load = relative => import(pathToFileURL(path.join(root, relative)).href);
  const [api, catalog, projects, store, scenes, policy] = await Promise.all([
    load('scripts/studio-api.mjs'), load('src/engine/control-catalog.js'), load('src/engine/project-controls.js'), load('scripts/project-store.mjs'), load('src/scene-registry.js'), load('src/engine/render-policy.js'),
  ]);
  for (const [module, names] of [[api,['validateStudioParameters','validateRenderSettings']], [catalog,['getControlCatalog','readControlValue','writeControlValue']], [projects,['resolveParameters']], [store,['readProject']], [policy,['validateRenderPlan','overrideRenderPlan']]]) for (const name of names) if (typeof module[name] !== 'function') throw Error(`Repository runtime lacks ${name}; restart after updating compatible source. Shared files were not changed.`);
  const project = scene => { const p = projects.studioProjects.find(p => p.id === scene); if (!p) throw Error('Unknown scene.'); return p; };
  return {
    scenes: scenes.sceneIds.map(id => ({ id, ...scenes.sceneRegistry[id] })), config: scenes.sceneConfig,
    catalog: scene => catalog.getControlCatalog(scene), validateSettings: api.validateRenderSettings,
    async baseline(scene) {
      const p = project(scene), values = { ...Object.fromEntries(p.controls.map(c => [c.id,c.default])), ...p.presets.find(p=>p.id==='original')?.values };
      const look = await store.readProject('look');
      const plans = JSON.parse(await readFile(path.join(root, 'project/render-plans.json'), 'utf8'));
      const parameters = projects.resolveParameters(scene, values, 'original', look);
      parameters.look ??= look; parameters.motion = await store.readProject('motion'); parameters.objectEdits = {};
      parameters.sound = {}; // Native validation fills the same sound defaults used by the Viewer.
      if (scene === 'bax') parameters.review = 'beauty';
      parameters.renderPolicy = policy.validateRenderPlan(plans.scenes?.[scene]);
      parameters.studio = { values, preset:'original', lookOverrides:{}, controlManifest:catalog.createControlManifest(scene) };
      return api.validateStudioParameters(parameters);
    },
    async patch(base, scene, patches) {
      if (base.scene !== scene) throw Error('scene does not match baseVersionId.');
      const next = structuredClone(base), definitions = new Map(catalog.getControlCatalog(scene).map(c => [c.id,c]));
      const p = project(scene);
      next.studio ??= { values:Object.fromEntries(p.controls.map(c => [c.id,c.default])), preset:'original', lookOverrides:{} };
      next.studio.values ??= {}; next.studio.lookOverrides ??= {};
      const seen = new Set();
      for (const patch of patches) {
        const def = definitions.get(patch.id); if (!def || seen.has(patch.id)) throw Error('Unknown or duplicate catalog control: ' + patch.id); seen.add(patch.id);
        if (def.id === 'contrast') {
          if (typeof patch.value !== 'number' || patch.value < def.min || patch.value > def.max) throw Error('Invalid contrast value.');
          const before = projects.resolveParameters(scene, next.studio.values, next.studio.preset, next.look);
          next.studio.values[def.valueId] = patch.value;
          const after = projects.resolveParameters(scene, next.studio.values, next.studio.preset, next.look);
          changedLeaves(next.look, before.look, after.look);
        } else {
          catalog.writeControlValue(next, def, patch.value);
          if (def.binding === 'value') next.studio.values[def.valueId] = patch.value;
        }
      }
      changedLeaves(next.studio.lookOverrides, base.look, next.look);
      return api.validateStudioParameters(next);
    },
    renderParameters(parameters, renderer) {
      const result = structuredClone(parameters);
      if (renderer) result.renderPolicy = policy.overrideRenderPlan(policy.validateRenderPlan(result.renderPolicy), renderer);
      return api.validateStudioParameters(result);
    },
    values(scene, parameters) { return catalog.getControlCatalog(scene).map(def => ({ ...def, value:def.binding === 'value' ? parameters.studio?.values?.[def.valueId] ?? catalog.readControlValue(def,parameters) : catalog.readControlValue(def,parameters) })); },
  };
}
