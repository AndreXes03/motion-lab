import studio from '../../project/studio.json' with { type: 'json' };
import defaultLook from '../../project/look.json' with { type: 'json' };

/** Persisted UI schema. Controls target public render parameters, not mesh internals. */
export const studioProjects = studio.projects;

function merge(target, patch) {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = merge(target[key] && typeof target[key] === 'object' ? target[key] : {}, value);
    } else target[key] = value;
  }
  return target;
}

function limit(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function color(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

/** Resolve one scene's preset and explicit control overrides into runtime parameters. */
export function resolveParameters(scene, values = {}, presetId = 'original', baseLook = defaultLook) {
  const project = studioProjects.find(item => item.id === scene);
  if (!project) throw new Error(`Unknown studio scene: ${scene}`);
  const preset = project.presets.find(item => item.id === presetId);
  if (!preset) throw new Error(`Unknown preset for ${scene}: ${presetId}`);
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Control values must be an object');
  const controls = Object.fromEntries(project.controls.map(control => [control.id, control.default]));
  Object.assign(controls, preset.values ?? {}, values);

  if (scene === 'procedural') return {
    scene,
    graphics: {
      title: String(controls.title ?? 'MOTION').trim().slice(0, 22) || 'MOTION',
      accent: color(controls.accent, '#ff5a24'),
      density: Math.round(limit(controls.density, 4, 18, 10)),
      speed: limit(controls.speed, .25, 2.5, 1)
    }
  };

  const look = merge(structuredClone(baseLook ?? defaultLook), preset.look);
  const contrast = limit(controls.contrast, 0, 1, preset.values?.contrast ?? .85);
  const delta = contrast - (preset.values?.contrast ?? .85);
  if(delta!==0){look.lighting.fill = limit(look.lighting.fill * Math.exp(-2.2 * delta), .005, .25, .015);
  look.lighting.rim = limit(look.lighting.rim + 2 * delta, 0, 6, 4.8);
  look.lighting.environment = limit(look.lighting.environment - .27 * delta, .25, 1, .5);
  }
  const parameters = {
    scene,
    look,
    shell: color(controls.shell, '#173bd5'),
    knob: color(controls.knob, '#f34a13'),
    objectMotion: limit(controls.energy, 0, 1.8, preset.values?.energy ?? 1)
  };
  const display = String(controls.display ?? '').trim().slice(0, 12);
  if (display) parameters.display = display;
  return parameters;
}
