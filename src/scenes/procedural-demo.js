import { renderProcedural, progress, oscillate, seededNoise, repeat } from '../engine/procedural.js';
import graphicsRecipe from '../../project/graphics.json';

const W = 1920;
const H = 1080;
const BLUE = graphicsRecipe.palette.blue;
const CREAM = graphicsRecipe.palette.cream;
const INK = graphicsRecipe.palette.ink;
const DEFAULTS = graphicsRecipe.defaults;
const BEATS = graphicsRecipe.timing.beats;
const WIPES = graphicsRecipe.timing.wipes;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const smoothActive = (t, start, end, fade = 0.24) => progress(t, start, start + fade, 'inOutCubic') * (1 - progress(t, end - fade, end, 'inOutCubic'));
const n = (id, type, props = {}) => ({ id: `demo.${id}`, type, ...props });

function buildNodes(t, graphics, width, height) {
  const title = String(graphics.title ?? DEFAULTS.title).trim().slice(0, 22) || DEFAULTS.title;
  const accent = /^#[0-9a-f]{6}$/i.test(graphics.accent ?? '') ? graphics.accent : DEFAULTS.accent;
  const densityValue = Number(graphics.density ?? DEFAULTS.density);
  const speedValue = Number(graphics.speed ?? DEFAULTS.speed);
  const density = Math.round(clamp(Number.isFinite(densityValue) ? densityValue : DEFAULTS.density, 4, 18));
  const speed = clamp(Number.isFinite(speedValue) ? speedValue : DEFAULTS.speed, 0.25, 2.5);
  const noise = seededNoise(graphicsRecipe.seed);
  const nodes = [];
  const push = node => nodes.push(node);
  // Speed affects only continuous motion; beat and wipe timings stay fixed.
  const p = (time, a, b) => progress(time, a, b, 'outCubic');

  // Beat 1 — electric blue field, kinetic grid, and oversized MOTION title.
  push(n('beat1.background', 'rect', { x: 0, y: 0, width, height, fill: BLUE }));
  push(n('beat1.grid-rules', 'path', {
    commands: Array.from({ length: 9 }, (_, i) => [['M', 112 + i * 212, 0], ['L', 112 + i * 212, height]]).flat(),
    stroke: '#8ea9ff', lineWidth: 1.3, opacity: 0.3
  }));
  for (const i of repeat(6 * density, i => i)) {
    const row = Math.floor(i / density), col = i % density;
    const x = 135 + col * (1640 / Math.max(1, density - 1));
    const y = 140 + row * 154;
    const index = row * density + col;
    const pop = progress(t, 0.05 + index * 0.012, 0.45 + index * 0.012, 'outCubic');
    const pulse = oscillate(t, { frequency: 0.24, amplitude: 0.12, phase: index * 0.21, offset: 0.88, wave: 'sine' });
    push(n(`beat1.dot-${row}-${col}`, 'circle', {
      x: x + noise(col, row, 1) * 12, y: y + noise(row, col, 2) * 8,
      radius: (7 + (index % 4) * 2) * pop * pulse,
      fill: index % 9 === 0 ? accent : CREAM, opacity: 0.34 + 0.45 * pop
    }));
  }
  push(n('beat1.orbit-a', 'circle', { x: 1520, y: 320, radius: 188, stroke: CREAM, lineWidth: 2, opacity: 0.72, scaleX: 1.22, scaleY: 0.67, rotation: t * speed * 0.26 }));
  push(n('beat1.orbit-b', 'circle', { x: 1520, y: 320, radius: 238, stroke: accent, lineWidth: 3, opacity: 0.85, scaleX: 0.76, scaleY: 1.14, rotation: -t * speed * 0.19 }));
  push(n('beat1.orbit-core', 'circle', { x: 1520, y: 320, radius: 28, fill: accent, scaleX: 1 + 0.12 * Math.sin(t * speed * 3), scaleY: 1 + 0.12 * Math.sin(t * speed * 3) }));
  push(n('beat1.kicker', 'text', { x: 126, y: 142, text: 'MOTION STUDY  /  01', font: '700 24px Arial, sans-serif', fill: CREAM, align: 'left', baseline: 'middle', opacity: 0.92 }));
  push(n('beat1.echo', 'text', { x: 960, y: 620, text: title, font: '900 238px Arial Black, Arial, sans-serif', fill: accent, align: 'center', baseline: 'middle', maxWidth: 1630, opacity: 0.30, rotation: -0.035 }));
  push(n('beat1.title', 'text', { x: 960, y: 584, text: title, font: '900 238px Arial Black, Arial, sans-serif', fill: CREAM, align: 'center', baseline: 'middle', maxWidth: 1630, scaleX: 0.94 + 0.06 * p(t, 0.12, 0.56), opacity: smoothActive(t, BEATS.one[0], BEATS.one[1], 0.2) }));
  push(n('beat1.footer', 'text', { x: 126, y: 956, text: 'TYPE / RHYTHM / REPEAT', font: '700 20px Arial, sans-serif', fill: CREAM, align: 'left', baseline: 'middle', opacity: 0.86 }));
  push(n('beat1.counter', 'text', { x: 1790, y: 956, text: '00—03', font: '700 22px Arial, sans-serif', fill: CREAM, align: 'right', baseline: 'middle', opacity: 0.86 }));

  // Wipe reveals the warm paper-colored second chapter.
  push(n('beat2.background', 'rect', { x: 0, y: 0, width, height, fill: CREAM }));
  push(n('beat2.grid', 'path', {
    commands: Array.from({ length: 13 }, (_, i) => [['M', 0, 88 + i * 76], ['L', width, 88 + i * 76]]).flat(),
    stroke: '#22304b', lineWidth: 1, opacity: 0.12 * smoothActive(t, BEATS.two[0], BEATS.two[1], 0.12)
  }));
  push(n('beat2.kicker', 'text', { x: 126, y: 142, text: 'MOTION / BY CODE', font: '700 24px Arial, sans-serif', fill: BLUE, align: 'left', baseline: 'middle', opacity: smoothActive(t, BEATS.two[0], BEATS.two[1], 0.1) }));
  push(n('beat2.by', 'text', { x: 102, y: 420, text: 'BY', font: '900 250px Arial Black, Arial, sans-serif', fill: BLUE, align: 'left', baseline: 'middle', opacity: smoothActive(t, BEATS.two[0], BEATS.two[1], 0.12), scaleX: 0.88 + 0.12 * p(t, 3.20, 3.68) }));
  push(n('beat2.code', 'text', { x: 106, y: 690, text: 'CODE', font: '900 250px Arial Black, Arial, sans-serif', fill: INK, align: 'left', baseline: 'middle', maxWidth: 950, opacity: smoothActive(t, BEATS.two[0], BEATS.two[1], 0.12), scaleX: 0.88 + 0.12 * p(t, 3.28, 3.76) }));
  push(n('beat2.arc-outer', 'circle', { x: 1422, y: 525, radius: 284, stroke: BLUE, lineWidth: 4, scaleX: 0.86, scaleY: 1.02, rotation: t * speed * 0.25, opacity: smoothActive(t, BEATS.two[0], BEATS.two[1], 0.15) }));
  push(n('beat2.arc-inner', 'circle', { x: 1422, y: 525, radius: 194, stroke: INK, lineWidth: 2, scaleX: 1.25, scaleY: 0.72, rotation: -t * speed * 0.4, opacity: smoothActive(t, BEATS.two[0], BEATS.two[1], 0.15) }));
  for (const i of repeat(density, i => i)) {
    const angle = (Math.PI * 2 * i) / density + t * speed * 0.23;
    push(n(`beat2.orbit-dot-${i}`, 'circle', { x: 1422 + Math.cos(angle) * 284, y: 525 + Math.sin(angle) * 284, radius: i % 3 === 0 ? 14 : 8, fill: i % 4 === 0 ? accent : BLUE, opacity: smoothActive(t, BEATS.two[0], BEATS.two[1], 0.15) }));
  }
  push(n('beat2.note', 'text', { x: 108, y: 920, text: 'LINES BECOME LETTERS. LETTERS BECOME MOTION.', font: '700 22px Arial, sans-serif', fill: INK, align: 'left', baseline: 'middle', opacity: smoothActive(t, BEATS.two[0], BEATS.two[1], 0.15) }));

  // A horizontal orange shutter wipes into the final graphic lockup.
  push(n('beat3.background', 'rect', { x: 0, y: 0, width, height, fill: accent }));
  push(n('beat3.ring', 'circle', { x: 960, y: 518, radius: 360, stroke: BLUE, lineWidth: 3, scaleX: 1.38, scaleY: 0.43, rotation: 0.035 * Math.sin(t * speed), opacity: 0.55 * smoothActive(t, BEATS.three[0], BEATS.three[1], 0.12) }));
  push(n('beat3.title', 'text', { x: 960, y: 518, text: 'BAX STUDIO', font: '900 190px Arial Black, Arial, sans-serif', fill: CREAM, align: 'center', baseline: 'middle', maxWidth: 1700, opacity: smoothActive(t, 6.80, 8.96, 0.14), scaleX: 0.90 + 0.10 * p(t, 6.75, 7.18) }));
  for (const i of repeat(density, i => i)) {
    const w = 22 + (i % 3) * 10;
    push(n(`beat3.bar-${i}`, 'rect', { x: 148 + i * (1624 / Math.max(1, density - 1)), y: 828, width: w, height: 6 + (i % 4) * 3, fill: i % 3 === 0 ? CREAM : BLUE, opacity: 0.86 * smoothActive(t, BEATS.three[0], BEATS.three[1], 0.16), scaleY: 0.9 + 0.15 * Math.sin(t * speed * 2 + i * 0.7) }));
  }
  push(n('beat3.label', 'text', { x: 126, y: 940, text: 'DESIGNED TO MOVE.', font: '700 23px Arial, sans-serif', fill: CREAM, align: 'left', baseline: 'middle', opacity: smoothActive(t, BEATS.three[0], BEATS.three[1], 0.1) }));
  push(n('beat3.index', 'text', { x: 1794, y: 940, text: '03 / 03', font: '700 23px Arial, sans-serif', fill: BLUE, align: 'right', baseline: 'middle', opacity: smoothActive(t, BEATS.three[0], BEATS.three[1], 0.1) }));

  // Final blue wipe resolves into a quiet, readable lockup and held end frame.
  push(n('final.background', 'rect', { x: 0, y: 0, width, height, fill: BLUE }));
  const finalOpacity = progress(t, BEATS.final[0], 9.18, 'outCubic');
  push(n('final.topline', 'text', { x: 132, y: 170, text: `${title}   /   BY CODE`, font: '700 23px Arial, sans-serif', fill: CREAM, align: 'left', baseline: 'middle', opacity: finalOpacity }));
  push(n('final.title', 'text', { x: 960, y: 542, text: 'BAX STUDIO', font: '900 190px Arial Black, Arial, sans-serif', fill: CREAM, align: 'center', baseline: 'middle', maxWidth: 1700, scaleX: 0.96 + 0.04 * finalOpacity, opacity: finalOpacity }));
  push(n('final.accent-rule', 'rect', { x: 132, y: 706, width: 1656, height: 5, fill: accent, scaleX: finalOpacity }));
  push(n('final.footer', 'text', { x: 132, y: 780, text: 'MOTION, MADE BY CODE.', font: '700 25px Arial, sans-serif', fill: CREAM, align: 'left', baseline: 'middle', opacity: finalOpacity }));
  push(n('final.corner', 'text', { x: 1788, y: 940, text: 'BAX STUDIO  /  2026', font: '700 19px Arial, sans-serif', fill: CREAM, align: 'right', baseline: 'middle', opacity: finalOpacity }));
  const chapter = (id, prefix, clip) => ({
    id: `demo.${id}`, type: 'group', x: 0, y: 0, opacity: 1, ...(clip ? { clip } : {}),
    children: nodes.filter(node => node.id.startsWith(`demo.${prefix}`))
  });
  nodes.splice(0, nodes.length,
    chapter('chapter-one', 'beat1.', null),
    chapter('chapter-two', 'beat2.', { type: 'rect', x: 0, y: 0, width: (time) => W * progress(time, ...WIPES.one, 'inOutCubic'), height: H }),
    chapter('chapter-three', 'beat3.', { type: 'rect', x: 0, y: 0, width: (time) => W * progress(time, ...WIPES.two, 'inOutCubic'), height: H }),
    chapter('chapter-final', 'final.', { type: 'rect', x: 0, y: 0, width: (time) => W * progress(time, ...WIPES.final, 'inOutCubic'), height: H })
  );
  return nodes;
}

export function createProceduralDemo(config) {
  const nodes = [];
  function render(ctx, time, parameters = {}) {
    const graphics = parameters.graphics ?? {};
    const width = W, height = H;
    nodes.splice(0, nodes.length, ...buildNodes(Number(time) || 0, graphics, width, height));
    renderProcedural(ctx, Number(time) || 0, { width, height, nodes, seed: graphicsRecipe.seed });
  }
  return {
    render,
    nodes,
    config: { duration: config?.duration ?? 10, width: W, height: H, palette: { blue: BLUE, cream: CREAM, accent: DEFAULTS.accent }, graphics: DEFAULTS }
  };
}
