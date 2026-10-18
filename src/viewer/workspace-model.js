import {getControlCatalog, resolveControlManifest} from '../engine/control-catalog.js';
import {controlCategories} from '../engine/scene-capabilities.js';

/** A workspace is a view of the saved manifest, never a new parameter document. */
export function workspaceForCategory(category) {
  return category === 'compositing' ? 'compositing' : 'scene';
}

export function matchesControlContext(control, selection = 'composition', workspace = 'scene') {
  // Image finishing acts on the output, even when an object was selected in Scene.
  return workspace === 'compositing' || selection === 'composition'
    || (control.contexts ?? ['composition']).includes(selection);
}

/**
 * Derive catalog visibility without modifying the manifest, parameter values or tracks.
 * `look` is the legacy Scene tab ID. Panel category/order/title comes from the
 * manifest, including cases where authors deliberately regroup individual controls.
 * Categories follow workspace + selection, but not search, so an empty search
 * cannot remove the user's way back. An unavailable category falls back to All.
 */
export function deriveWorkspaceModel({scene, manifest, selection = 'composition', workspace = 'scene', category = 'all', query = ''}) {
  const activeWorkspace = workspace === 'look' ? 'scene' : workspace;
  if (!['scene', 'compositing'].includes(activeWorkspace)) throw new Error(`Unknown controls workspace: ${workspace}`);
  const catalog = getControlCatalog(scene);
  const saved = resolveControlManifest(manifest, scene);
  const definitions = new Map(catalog.map(control => [control.id, control]));
  const availableContexts = [...new Set(['composition', ...catalog.flatMap(control => control.contexts ?? ['composition'])])];
  const activeSelection = availableContexts.includes(selection) ? selection : 'composition';
  const search = String(query).trim().toLowerCase();
  const scopedPanels = saved.panels
    .filter(panel => workspaceForCategory(panel.category) === activeWorkspace)
    .map(panel => ({...panel, controls: panel.controls.filter(id => matchesControlContext(definitions.get(id), activeSelection, activeWorkspace))}))
    .filter(panel => panel.controls.length);
  const categories = [...new Set(scopedPanels.map(panel => panel.category))];
  const activeCategory = categories.includes(category) ? category : 'all';
  const panels = scopedPanels.map(panel => ({
    ...panel,
    controls: panel.controls.filter(id => {
      const control = definitions.get(id);
      return (activeCategory === 'all' || panel.category === activeCategory)
        && `${control.label} ${panel.title} ${panel.category} ${control.help ?? ''}`.toLowerCase().includes(search);
    })
  })).filter(panel => panel.controls.length);
  const visibleControlIds = panels.flatMap(panel => panel.controls);
  const workspaceControlIds = saved.panels.filter(panel => workspaceForCategory(panel.category) === activeWorkspace).flatMap(panel => panel.controls);
  return {
    workspace: activeWorkspace,
    selection: activeSelection,
    category: activeCategory,
    categories,
    categoryOptions: categories.map(id => ({id, label: controlCategories[id]})),
    panels,
    visibleControlIds,
    workspaceControlIds,
    availableContexts,
    counts: {visible: visibleControlIds.length, workspace: workspaceControlIds.length, selected: saved.controls.length, available: catalog.length},
    emptyReason: visibleControlIds.length ? null : !workspaceControlIds.length ? 'workspace' : !scopedPanels.length ? 'selection' : 'search'
  };
}
