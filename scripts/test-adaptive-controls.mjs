import assert from 'node:assert/strict';
import {
  createControlManifest,
  getControlCatalog,
  readControlValue,
  validateControlManifest,
  writeControlValue
} from '../src/engine/control-catalog.js';
import {
  easeProgress,
  evaluateParameterAnimation,
  sampleParameterTrack,
  validateParameterAnimation
} from '../src/engine/parameter-animation.js';
import { sampleTrack } from '../src/engine/animation.js';
import { validateStudioParameters } from './studio-api.mjs';

const objectsManifest = createControlManifest('objects', 'all');
const proceduralManifest = createControlManifest('procedural', 'all');
const objectsEssentialManifest = createControlManifest('objects');
assert.deepEqual(validateControlManifest(objectsManifest, 'objects'), objectsManifest);
assert.deepEqual(validateControlManifest(proceduralManifest, 'procedural'), proceduralManifest);
assert.ok(!objectsEssentialManifest.controls.includes('device.root.x'), 'essential visibility omits object transforms');
assert.ok(getControlCatalog('objects').some(control => control.id === 'device.root.x'));
assert.ok(getControlCatalog('procedural').some(control => control.id === 'speed'));
assert.throws(() => createControlManifest('not-a-scene'), /Unknown control scene/);

const objectsTrack = 'device.root.x';
const proceduralTrack = 'speed';
const objectsAnimation = {
  version: 1,
  enabled: true,
  rate: 1,
  tracks: {
    [objectsTrack]: [
      { t: 0, value: -2, ease: 'linear' },
      { t: 2, value: 2, ease: 'hold' },
      { t: 4, value: 4, ease: 'linear' }
    ]
  }
};
const proceduralAnimation = {
  version: 1,
  enabled: true,
  rate: 1,
  tracks: {
    [proceduralTrack]: [
      { t: 1, value: .5, ease: 'linear' },
      { t: 3, value: 2.5, ease: 'linear' }
    ]
  }
};

assert.deepEqual(validateParameterAnimation(objectsAnimation, 'objects').tracks,objectsAnimation.tracks);
assert.deepEqual(validateParameterAnimation(proceduralAnimation, 'procedural').tracks,proceduralAnimation.tracks);

const objectsParameters = { scene: 'objects', objectEdits: { 'device.root': { yaw: 12 } }, animation: objectsAnimation };
const objectsBefore = structuredClone(objectsParameters);
assert.equal(evaluateParameterAnimation(objectsParameters, -1).objectEdits['device.root'].x, -2, 'samples before the first key clamp to the first value');
assert.equal(evaluateParameterAnimation(objectsParameters, 0).objectEdits['device.root'].x, -2);
assert.equal(evaluateParameterAnimation(objectsParameters, 1).objectEdits['device.root'].x, 0, 'linear easing interpolates between keys');
assert.equal(evaluateParameterAnimation(objectsParameters, 2).objectEdits['device.root'].x, 2);
assert.equal(evaluateParameterAnimation(objectsParameters, 3).objectEdits['device.root'].x, 2, 'hold easing retains the value until the next key');
assert.equal(evaluateParameterAnimation(objectsParameters, 4).objectEdits['device.root'].x, 4);
assert.equal(evaluateParameterAnimation(objectsParameters, 99).objectEdits['device.root'].x, 4, 'samples after the last key clamp to the last value');
assert.equal(evaluateParameterAnimation(objectsParameters, 1).objectEdits['device.root'].yaw, 12, 'unanimated values survive');
assert.deepEqual(objectsParameters, objectsBefore, 'evaluation leaves caller-owned parameters unchanged');
assert.deepEqual(evaluateParameterAnimation(objectsParameters, 1).objectEdits['device.root'], { yaw: 12, x: 0 }, 'dotted object IDs remain a single path segment');
assert.equal(evaluateParameterAnimation({ ...objectsParameters, animation: { ...objectsAnimation, rate: 2 } }, 1).objectEdits['device.root'].x, 2, 'rate scales sample time');

const proceduralParameters = { scene: 'procedural', graphics: { title: 'MOTION', speed: 1 }, animation: proceduralAnimation };
assert.equal(evaluateParameterAnimation(proceduralParameters, 0).graphics.speed, .5, 'procedural tracks clamp to their first key');
assert.equal(evaluateParameterAnimation(proceduralParameters, 2).graphics.speed, 1.5, 'procedural tracks interpolate on their own scene');
assert.equal(evaluateParameterAnimation(proceduralParameters, 3).graphics.speed, 2.5);
assert.equal(evaluateParameterAnimation(proceduralParameters, 2).graphics.title, 'MOTION');
const disabled = { ...proceduralParameters, animation: { ...proceduralAnimation, enabled: false } };
assert.equal(evaluateParameterAnimation(disabled, 2), disabled, 'disabled animation preserves legacy parameter behavior');
assert.equal(evaluateParameterAnimation({ scene: 'procedural', graphics: { speed: 1 } }, 2).graphics.speed, 1, 'missing animation is a no-op');

const objectsDefinition = getControlCatalog('objects').find(control => control.id === objectsTrack);
assert.equal(readControlValue(objectsDefinition, evaluateParameterAnimation(objectsParameters, 1)), 0);
const written = writeControlValue({ scene: 'objects', objectEdits: {} }, objectsDefinition, 1.25);
assert.equal(written.objectEdits['device.root'].x, 1.25);
assert.equal(Object.hasOwn(written.objectEdits, 'device'), false, 'object ID dots are not split into nested keys');

assert.equal(easeProgress(.5, 'linear'), .5);
assert.equal(easeProgress(.5, 'hold'), 0);
assert.equal(sampleParameterTrack([{ t: 0, value: 1, ease: 'linear' }, { t: 2, value: 5 }], 1), 3);
assert.equal(sampleTrack([{ t: 0, value: 0 }, { t: 2, value: 10 }], .5), 1.03515625, 'legacy tracks retain their default smooth easing');
assert.equal(sampleTrack([{ t: 0, value: 0, ease: 'linear' }, { t: 2, value: 10 }], .5), 2.5, 'legacy tracks accept explicit linear easing');
assert.equal(sampleTrack([{ t: 0, value: 0, ease: 'hold' }, { t: 2, value: 10 }], 1), 0, 'legacy tracks accept explicit hold easing');
assert.equal(sampleTrack([{ t: 0, value: 0 }, { t: 2, value: 10 }], 0), 0);
assert.equal(sampleTrack([{ t: 0, value: [0, 0, 0] }, { t: 2, value: [10, 20, 30] }], 1).length, 3);

assert.throws(() => validateParameterAnimation(objectsAnimation, 'procedural'), /Control cannot be animated/);
assert.throws(() => validateParameterAnimation(objectsAnimation, 'missing-scene'), /Unknown control scene/);
assert.throws(() => evaluateParameterAnimation({ scene: 'missing-scene', animation: objectsAnimation }, 0), /Unknown animation scene/);
assert.throws(() => validateParameterAnimation({ ...proceduralAnimation, tracks: { unknown: [{ t: 0, value: 1 }] } }, 'procedural'), /Control cannot be animated/);
assert.throws(() => validateParameterAnimation({ ...objectsAnimation, tracks: { [objectsTrack]: [{ t: 0, value: 0 }, { t: 0, value: 1 }] } }, 'objects'), /times must increase/);
assert.throws(() => validateParameterAnimation({ ...objectsAnimation, tracks: { [objectsTrack]: [{ t: 0, value: 0 }, { t: 11, value: 1 }] } }, 'objects'), /scene duration/);
assert.throws(() => validateParameterAnimation({ ...objectsAnimation, tracks: { [objectsTrack]: [{ t: 0, value: 6 }] } }, 'objects'), /outside control bounds/);
assert.throws(() => validateParameterAnimation({ ...objectsAnimation, rate: 3 }, 'objects'), /rate/);
assert.throws(() => validateParameterAnimation({ ...objectsAnimation, tracks: { [objectsTrack]: [{ t: 0, value: Number.NaN }] } }, 'objects'), /finite|bounds/);
assert.throws(() => evaluateParameterAnimation(objectsParameters, Number.NaN), /finite/);
assert.throws(() => validateControlManifest({ ...objectsManifest, controls: [...objectsManifest.controls, objectsTrack] }, 'objects'), /Duplicate manifest control/);
assert.throws(() => validateControlManifest({ ...objectsManifest, scene: 'procedural' }, 'objects'), /does not match/);
const polluted = JSON.parse('{"version":1,"enabled":true,"rate":1,"tracks":{"__proto__":[]}}');
assert.throws(() => validateParameterAnimation(polluted, 'objects'), /Unsafe control key/);
assert.throws(() => validateParameterAnimation(Object.assign(Object.create({ inherited: true }), objectsAnimation), 'objects'), /plain objects/);

const objectsNormalized = await validateStudioParameters({
  scene: 'objects',
  animation: objectsAnimation,
  studio: { values: { energy: 1 }, preset: 'original', controlManifest: objectsManifest }
});
assert.deepEqual(objectsNormalized.animation, validateParameterAnimation(objectsAnimation,'objects'));
assert.deepEqual(objectsNormalized.studio.controlManifest, objectsManifest);
const hiddenTrackNormalized = await validateStudioParameters({
  scene: 'objects',
  animation: objectsAnimation,
  studio: { values: { energy: 1 }, preset: 'original', controlManifest: objectsEssentialManifest }
});
assert.deepEqual(hiddenTrackNormalized.animation, validateParameterAnimation(objectsAnimation,'objects'), 'changing visible controls does not discard an existing transform track');
assert.equal(evaluateParameterAnimation({ ...hiddenTrackNormalized, objectEdits: {} }, 1).objectEdits['device.root'].x, 0);
const proceduralNormalized = await validateStudioParameters({
  scene: 'procedural',
  animation: proceduralAnimation,
  studio: { values: { speed: 1 }, preset: 'original', controlManifest: proceduralManifest }
});
assert.deepEqual(proceduralNormalized.animation, validateParameterAnimation(proceduralAnimation,'procedural'));
assert.deepEqual(proceduralNormalized.studio.controlManifest, proceduralManifest);
const starterManifest = createControlManifest('starter', 'all');
const starterNormalized = await validateStudioParameters({
  scene: 'starter',
  animation: { version: 1, enabled: true, rate: 1, tracks: { fov: [{ t: 0, value: 65 }] } },
  product: { fov: 70, fisheye: .12, keyStrength: 1.2, fill: .15, accent: '#d7f56b', shell: '#d2d3c8' },
  studio: { values: {}, preset: 'original', controlManifest: starterManifest }
});
assert.equal(starterNormalized.scene, 'starter');
assert.deepEqual(starterNormalized.product, { fov: 70, fisheye: .12, keyStrength: 1.2, fill: .15, accent: '#d7f56b', shell: '#d2d3c8' });
assert.deepEqual(starterNormalized.studio.controlManifest, starterManifest);
await assert.rejects(() => validateStudioParameters({
  scene: 'objects', animation: objectsAnimation,
  studio: { values: {}, preset: 'original', controlManifest: { ...objectsManifest, controls: [...objectsManifest.controls, objectsTrack] } }
}), /Duplicate manifest control/);

console.log(JSON.stringify({ type: 'test-result', controlCatalog: 'passed', parameterAnimation: 'passed', studioRoundTrip: 'passed', scenes: ['objects', 'procedural', 'starter'] }));
