/** Deterministic Canvas2D scene graph. All dynamic values depend on absolute seconds. */
const TYPES = new Set(['group', 'circle', 'rect', 'text', 'path']);
const CLIPS = new Set(['circle', 'rect', 'path']);
const BLENDS = new Set([
  'source-over', 'source-in', 'source-out', 'source-atop',
  'destination-over', 'destination-in', 'destination-out', 'destination-atop',
  'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
  'hue', 'saturation', 'color', 'luminosity'
]);
const TAU = Math.PI * 2;

export const ease = Object.freeze({
  linear: u => u,
  inCubic: u => u * u * u,
  outCubic: u => 1 - (1 - u) ** 3,
  inOutCubic: u => u < .5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2,
  cubic: u => u < .5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2,
  quint: u => u < .5 ? 16 * u ** 5 : 1 - (-2 * u + 2) ** 5 / 2,
  inOutSine: u => -(Math.cos(Math.PI * u) - 1) / 2,
  outExpo: u => u === 1 ? 1 : 1 - 2 ** (-10 * u),
  outBack: u => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2
});

function unit(value) { return Math.max(0, Math.min(1, value)); }

export function progress(t, start, end, easing = 'linear') {
  if (![t, start, end].every(Number.isFinite) || end <= start) throw new Error('progress requires finite t and end > start');
  const fn = typeof easing === 'function' ? easing : ease[easing];
  if (!fn) throw new Error(`Unknown easing: ${easing}`);
  return fn(unit((t - start) / (end - start)));
}

export function stagger(t, index, { start = 0, step = .1, duration = 1, easing = 'outCubic' } = {}) {
  if (!Number.isInteger(index) || index < 0) throw new Error('stagger index must be a nonnegative integer');
  return progress(t, start + index * step, start + index * step + duration, easing);
}

export function oscillate(t, { frequency = 1, amplitude = 1, phase = 0, offset = 0, wave = 'sine' } = {}) {
  if (![t, frequency, amplitude, phase, offset].every(Number.isFinite)) throw new Error('oscillate requires finite numbers');
  const p = t * frequency + phase;
  let value;
  switch (wave) {
    case 'sine': value = Math.sin(TAU * p); break;
    case 'triangle': value = 2 / Math.PI * Math.asin(Math.sin(TAU * p)); break;
    case 'saw': value = 2 * (p - Math.floor(p)) - 1; break;
    case 'square': value = Math.sin(TAU * p) >= 0 ? 1 : -1; break;
    default: throw new Error(`Unknown oscillation wave: ${wave}`);
  }
  return offset + amplitude * value;
}

/** Smooth, seeded 3D value noise in [-1, 1], with no mutable random state. */
export function seededNoise(seed = 1) {
  if (!Number.isFinite(seed)) throw new Error('seed must be finite');
  const s = seed | 0;
  const hash = (x, y, z) => {
    let h = s ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  };
  const smooth = v => v * v * (3 - 2 * v);
  const mix = (a, b, u) => a + (b - a) * u;
  return (x, y = 0, z = 0) => {
    if (![x, y, z].every(Number.isFinite)) throw new Error('noise coordinates must be finite');
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    const plane = zz => mix(
      mix(hash(ix, iy, zz), hash(ix + 1, iy, zz), fx),
      mix(hash(ix, iy + 1, zz), hash(ix + 1, iy + 1, zz), fx), fy);
    return mix(plane(iz), plane(iz + 1), fz) * 2 - 1;
  };
}

export function repeat(count, factory) {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error('repeat count must be an integer from 0 to 10000');
  if (typeof factory !== 'function') throw new Error('repeat requires a factory function');
  return Array.from({ length: count }, (_, index) => factory(index, count)).flat();
}

function value(input, t, context) { return typeof input === 'function' ? input(t, context) : input; }
function number(input, t, context, fallback, label) {
  const n = value(input ?? fallback, t, context);
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${label} must resolve to a finite number`);
  return n;
}

function validate(nodes) {
  if (!Array.isArray(nodes)) throw new Error('nodes must be an array');
  const ids = new Set();
  const visit = node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('Each node must be an object');
    if (typeof node.id !== 'string' || !node.id.trim()) throw new Error('Every node needs a stable nonempty id');
    if (ids.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
    ids.add(node.id);
    if (!TYPES.has(node.type)) throw new Error(`Unsupported node type on ${node.id}: ${node.type}`);
    if (node.children !== undefined && !Array.isArray(node.children)) throw new Error(`children of ${node.id} must be an array`);
    if (node.clip != null && typeof node.clip !== 'function' && !CLIPS.has(node.clip.type)) {
      throw new Error(`Unsupported clip on ${node.id}`);
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
}

function pathCommands(ctx, commands, t, context, label) {
  if (!Array.isArray(commands)) throw new Error(`${label}.commands must be an array`);
  ctx.beginPath();
  for (const command of commands) {
    if (!Array.isArray(command) || !command.length) throw new Error(`Invalid path command in ${label}`);
    const [op, ...raw] = command;
    const p = raw.map((v, i) => number(v, t, context, undefined, `${label}.${op}[${i}]`));
    switch (op) {
      case 'M': if (p.length !== 2) break; ctx.moveTo(...p); continue;
      case 'L': if (p.length !== 2) break; ctx.lineTo(...p); continue;
      case 'Q': if (p.length !== 4) break; ctx.quadraticCurveTo(...p); continue;
      case 'C': if (p.length !== 6) break; ctx.bezierCurveTo(...p); continue;
      case 'A': if (p.length !== 5) break; ctx.arc(p[0], p[1], p[2], p[3], p[4]); continue;
      case 'Z': if (p.length !== 0) break; ctx.closePath(); continue;
      default: break;
    }
    throw new Error(`Unsupported or malformed path command ${op} in ${label}`);
  }
}

function geometryPath(ctx, shape, t, context, label) {
  switch (shape.type) {
    case 'circle': {
      const radius = number(shape.radius, t, context, undefined, `${label}.radius`);
      if (radius < 0) throw new Error(`${label}.radius must be nonnegative`);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); break;
    }
    case 'rect': {
      const width = number(shape.width, t, context, undefined, `${label}.width`);
      const height = number(shape.height, t, context, undefined, `${label}.height`);
      const radius = number(shape.cornerRadius, t, context, 0, `${label}.cornerRadius`);
      if (width < 0 || height < 0 || radius < 0) throw new Error(`${label} geometry cannot have negative dimensions`);
      ctx.beginPath();
      if (radius && typeof ctx.roundRect === 'function') ctx.roundRect(0, 0, width, height, Math.min(radius, width / 2, height / 2));
      else if (radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.moveTo(r, 0); ctx.lineTo(width - r, 0); ctx.quadraticCurveTo(width, 0, width, r);
        ctx.lineTo(width, height - r); ctx.quadraticCurveTo(width, height, width - r, height);
        ctx.lineTo(r, height); ctx.quadraticCurveTo(0, height, 0, height - r);
        ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
      } else ctx.rect(0, 0, width, height);
      break;
    }
    case 'path': pathCommands(ctx, value(shape.commands, t, context), t, context, label); break;
    default: throw new Error(`Unsupported clip or geometry type: ${shape.type}`);
  }
}

function drawNode(ctx, node, t, context) {
  ctx.save();
  try {
    ctx.translate(number(node.x, t, context, 0, `${node.id}.x`), number(node.y, t, context, 0, `${node.id}.y`));
    ctx.rotate(number(node.rotation, t, context, 0, `${node.id}.rotation`));
    ctx.scale(number(node.scaleX, t, context, 1, `${node.id}.scaleX`), number(node.scaleY, t, context, 1, `${node.id}.scaleY`));
    ctx.globalAlpha *= unit(number(node.opacity, t, context, 1, `${node.id}.opacity`));
    const blend = value(node.blend, t, context);
    if (blend !== undefined) {
      if (!BLENDS.has(blend)) throw new Error(`Unsupported blend mode on ${node.id}: ${blend}`);
      ctx.globalCompositeOperation = blend;
    }
    if (node.dash !== undefined) {
      const dash = value(node.dash, t, context);
      if (!Array.isArray(dash) || dash.some(v => !Number.isFinite(value(v, t, context)) || value(v, t, context) < 0)) throw new Error(`${node.id}.dash must resolve to nonnegative finite segments`);
      ctx.setLineDash(dash.map(v => value(v, t, context)));
    }
    if (node.dashOffset !== undefined) ctx.lineDashOffset = number(node.dashOffset, t, context, 0, `${node.id}.dashOffset`);
    const clip = value(node.clip, t, context);
    if (clip != null) {
      if (!CLIPS.has(clip.type)) throw new Error(`Unsupported clip on ${node.id}`);
      geometryPath(ctx, clip, t, context, `${node.id}.clip`);
      ctx.clip(value(clip.fillRule, t, context) ?? 'nonzero');
    }
    if (node.type === 'text') {
      ctx.font = value(node.font, t, context) ?? '16px sans-serif';
      ctx.textAlign = value(node.align, t, context) ?? 'left';
      ctx.textBaseline = value(node.baseline, t, context) ?? 'alphabetic';
      const text = String(value(node.text, t, context) ?? '');
      const maxWidth = node.maxWidth === undefined ? undefined : number(node.maxWidth, t, context, undefined, `${node.id}.maxWidth`);
      const fill = value(node.fill, t, context);
      const stroke = value(node.stroke, t, context);
      if (fill !== null && (fill !== undefined || stroke == null)) { ctx.fillStyle = fill ?? '#000000'; maxWidth === undefined ? ctx.fillText(text, 0, 0) : ctx.fillText(text, 0, 0, maxWidth); }
      if (stroke != null) { ctx.strokeStyle = stroke; ctx.lineWidth = number(node.lineWidth, t, context, 1, `${node.id}.lineWidth`); maxWidth === undefined ? ctx.strokeText(text, 0, 0) : ctx.strokeText(text, 0, 0, maxWidth); }
    } else if (node.type !== 'group') {
      geometryPath(ctx, node, t, context, node.id);
      const fill = value(node.fill, t, context), stroke = value(node.stroke, t, context);
      if (fill !== null && (fill !== undefined || stroke == null)) { ctx.fillStyle = fill ?? '#000000'; ctx.fill(value(node.fillRule, t, context) ?? 'nonzero'); }
      if (stroke != null) { ctx.strokeStyle = stroke; ctx.lineWidth = number(node.lineWidth, t, context, 1, `${node.id}.lineWidth`); ctx.stroke(); }
    }
    node.children?.forEach(child => drawNode(ctx, child, t, context));
  } finally { ctx.restore(); }
}

/** Draw a frame at an absolute time; no timers, playback state or random sequence. */
export function renderProcedural(ctx, time, { width, height, nodes, seed = 1, clear = true } = {}) {
  if (!ctx || typeof ctx.save !== 'function' || typeof ctx.clearRect !== 'function') throw new Error('renderProcedural requires a Canvas2D context');
  if (!Number.isFinite(time)) throw new Error('time must be finite seconds');
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) throw new Error('width and height must be positive');
  if (typeof clear !== 'boolean') throw new Error('clear must be a boolean');
  validate(nodes);
  const context = Object.freeze({ width, height, seed, noise: seededNoise(seed) });
  ctx.save();
  try {
    // Respect the caller's transform (for example a reduced-resolution preview).
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (clear) ctx.clearRect(0, 0, width, height);
    nodes.forEach(node => drawNode(ctx, node, time, context));
  } finally { ctx.restore(); }
  return { time, width, height, nodeCount: countNodes(nodes), seed, clear };
}

function countNodes(nodes) { return nodes.reduce((count, node) => count + 1 + countNodes(node.children ?? []), 0); }
