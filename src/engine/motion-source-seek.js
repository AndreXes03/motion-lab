import {sampleAnimationGroupTime} from './animation-groups.js';

/** Find a film timestamp for an authored source timestamp inside a visible shot.
 * Group curves can reverse or hold. Each key interval is monotone (all supported
 * easings are monotone), but the complete curve need not be. Solve every interval
 * through the renderer's clock mapper and choose the solution nearest the playhead.
 * Discontinuous hold/cut boundaries are evaluated separately, never interpolated.
 */
export function findAnimationGroupOutputTime(parameters, groupId, sourceTime, {start, end, referenceTime = start} = {}) {
  if (![sourceTime, start, end, referenceTime].every(Number.isFinite) || end < start) throw new Error('Invalid source seek interval');
  const tolerance = 1e-7, map = time => sampleAnimationGroupTime(parameters, groupId, time);
  const clamp = time => Math.max(start, Math.min(end, time));
  const candidates = [];
  const accept = time => {
    if (time >= start && time <= end && Math.abs(map(time) - sourceTime) <= tolerance) candidates.push(time);
  };
  const animation = parameters?.animation, group = animation?.enabled !== false ? animation?.groups?.[groupId] : null;
  const boundaries = [start, end];
  if (group) {
    const rate = group.rate ?? 1;
    boundaries.push(group.start, group.end, group.start + (group.end - group.start) / rate);
    for (const key of group.keys) boundaries.push(group.start + key.t / rate);
  }
  const knots = [...new Set(boundaries.filter(time => time >= start && time <= end))].sort((a, b) => a - b);
  accept(clamp(referenceTime)); accept(sourceTime);
  for (const time of knots) accept(time);
  for (let index = 0; index < knots.length - 1; index++) {
    const a = knots[index], b = knots[index + 1];
    // Exclude exact boundaries: hold segments and the end of an override can jump.
    const inset = Math.min((b - a) / 4, Math.max(1e-12, (b - a) * 1e-10));
    let lo = a + inset, hi = b - inset;
    const left = map(lo), right = map(hi);
    if (sourceTime < Math.min(left, right) - tolerance || sourceTime > Math.max(left, right) + tolerance) continue;
    if (Math.abs(right - left) <= tolerance) { accept(Math.max(lo, Math.min(hi, referenceTime))); continue; }
    const ascending = right > left;
    for (let iteration = 0; iteration < 64; iteration++) {
      const middle = (lo + hi) / 2, value = map(middle);
      if ((value < sourceTime) === ascending) lo = middle; else hi = middle;
    }
    accept((lo + hi) / 2);
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => Math.abs(a - referenceTime) - Math.abs(b - referenceTime) || a - b);
  return candidates[0];
}
