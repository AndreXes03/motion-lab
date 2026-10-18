import assert from 'node:assert/strict';
import {findAnimationGroupOutputTime as inverse} from '../src/engine/motion-source-seek.js';
import {sampleAnimationGroupTime as forward} from '../src/engine/animation-groups.js';

const make = (keys, rate = 1, start = 2, end = 6) => ({animation: {version: 1, enabled: true, groups: {camera: {start, end, rate, keys}}}});
const domain = {start: 2, end: 6, referenceTime: 2};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
assert.equal(inverse({}, 'camera', 3, domain), 3);
assert.equal(inverse({}, 'camera', 7, domain), null, 'Seek cannot leave the current shot');
for (const ease of ['linear', 'smooth', 'in', 'out', 'inOut', 'bezier']) for (const rate of [.5, 1, 2]) {
  const parameters = make([{t: 0, value: 0, ease, ...(ease === 'bezier' ? {bezier: [.2, .1, .7, .9]} : {})}, {t: 4, value: 1, ease: 'linear'}], rate);
  const snapshot = JSON.stringify(parameters);
  for (const filmTime of [2.1, 2.8, 3.3]) {
    const source = forward(parameters, 'camera', filmTime), result = inverse(parameters, 'camera', source, domain);
    assert.notEqual(result, null); close(result, filmTime); close(forward(parameters, 'camera', result), source);
  }
  assert.equal(JSON.stringify(parameters), snapshot, 'Inversion is read only');
}
const reverse = make([{t: 0, value: 0, ease: 'linear'}, {t: 2, value: 1, ease: 'linear'}, {t: 4, value: 0, ease: 'linear'}]);
close(inverse(reverse, 'camera', 4, {...domain, referenceTime: 2.9}), 3);
close(inverse(reverse, 'camera', 4, {...domain, referenceTime: 5.1}), 5);
const threeMatches = make([{t: 0, value: 0, ease: 'smooth'}, {t: 1, value: 1, ease: 'smooth'}, {t: 2, value: 0, ease: 'smooth'}, {t: 4, value: 1, ease: 'linear'}]);
close(inverse(threeMatches, 'camera', 4, {...domain, referenceTime: 2.4}), 2.5);
close(inverse(threeMatches, 'camera', 4, {...domain, referenceTime: 3.7}), 3.5);
close(inverse(threeMatches, 'camera', 4, {...domain, referenceTime: 5.5}), 5);
const held = make([{t: 0, value: 0, ease: 'hold'}, {t: 4, value: 1, ease: 'linear'}]);
assert.equal(inverse(held, 'camera', 4, domain), null, 'A hold jump does not pass through intermediate source times');
assert.equal(inverse(held, 'camera', 2, {...domain, referenceTime: 4.5}), 4.5, 'On a plateau preserve the current film time');
assert.equal(inverse(held, 'camera', 6, domain), 6, 'The exact hold endpoint is independently reachable');
const slow = make([{t: 0, value: 0, ease: 'linear'}, {t: 4, value: 1, ease: 'linear'}], .5);
assert.equal(inverse(slow, 'camera', 5, domain), null, 'Slow playback may never reach the selected source key inside this shot');
const fast = make([{t: 0, value: 0, ease: 'linear'}, {t: 4, value: 1, ease: 'linear'}], 2);
assert.equal(inverse(fast, 'camera', 6, {...domain, referenceTime: 5.5}), 5.5, 'Rate saturation is a reachable plateau');
const disabled = structuredClone(reverse); disabled.animation.enabled = false;
assert.equal(inverse(disabled, 'camera', 4, domain), 4);
const jumping = make([{t: 0, value: .25, ease: 'hold'}, {t: 4, value: .25, ease: 'linear'}]);
assert.equal(inverse(jumping, 'camera', 4, {start: 0, end: 8, referenceTime: 5}), null, 'Override boundary jumps cannot produce false roots');
assert.equal(inverse(jumping, 'camera', 7, {start: 0, end: 8, referenceTime: 5}), 7, 'Outside the override the film clock is unchanged');
console.log(JSON.stringify({passed: true, easings: 6, rates: 3, nearestBranch: true, holdsAndDiscontinuities: true, unreachableSourceRejected: true, immutable: true}));
