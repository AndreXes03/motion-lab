import {sampleParameterTrack} from './parameter-animation.js';
import {sampleAnimationGroupTime} from './animation-groups.js';

/** Observed channels are linear samples, not new authored easing/keyframes. */
export function sampleSourceChannel(track, time) {
  const samples = track.source === 'samples' ? (track.samples?.length ? track.samples : track.keys).map(key => ({...key, ease: 'linear'})) : track.keys;
  return sampleParameterTrack(samples, time);
}

/** Preview the existing motion through the exact runtime clock. No new easing. */
export function sourceCurvePoints(track, {start, end, animation, groupId, count = 192}) {
  return Array.from({length: count + 1}, (_, index) => {
    const t = start + (end - start) * index / count;
    // The right endpoint belongs to the following shot at runtime. Draw the
    // left limit here so a clip boundary cannot invent a line across a cut.
    const clockTime = index === count ? Math.max(start, end - 1e-9) : t;
    const sourceTime = animation ? sampleAnimationGroupTime({animation}, groupId, clockTime) : clockTime;
    return {t, value: sampleSourceChannel(track, sourceTime)};
  });
}

/** Identity timing landmarks originate at the real source keys. */
export function sourceTimingKeys(track, {start, end}) {
  const span = end - start;
  const times = track.source === 'keys'
    ? track.keys.map(key => key.t).filter(t => t > start && t < end)
    : [start + span * .25, start + span * .5, start + span * .75];
  return [...new Set([start, ...times, end])].sort((a, b) => a - b).map(t => ({t: t - start, value: (t - start) / span, ease: 'linear'}));
}
