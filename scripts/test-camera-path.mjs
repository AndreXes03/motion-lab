import assert from 'node:assert/strict';
import { createCameraPath } from '../src/engine/camera-path.js';

const points = [[0, 0, 0], [1, .5, -2], [4, 2, -3], [7, -1, -7], [10, 0, -9]];
const path = createCameraPath(points, { duration: 8, lookAhead: .65 });
const distances = [];
let previous = path.sample(0);
for (let i = 1; i <= 240; i++) {
  const current = path.sample(i * 8 / 240);
  distances.push(current.position.distanceTo(previous.position));
  previous = current;
}
const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
const maxDeviation = Math.max(...distances.map(distance => Math.abs(distance - average) / average));
assert.ok(maxDeviation < .045, `Arc-length sampling varied ${(maxDeviation * 100).toFixed(2)}%`);
assert.ok(Math.abs(path.speed - path.length / 8) < 1e-12);
assert.deepEqual(path.sample(0).position.toArray(), points[0]);
assert.deepEqual(path.sample(8).position.toArray(), points.at(-1));

const serialize = t => {
  const sample = path.sample(t);
  return [sample.position.toArray(), sample.target.toArray(), sample.tangent.toArray(), sample.length, sample.speed];
};
const before = serialize(3.21);
path.sample(7.5); path.sample(.1); path.sample(8); path.sample(0);
assert.deepEqual(serialize(3.21), before, 'Sample after arbitrary seeks must be identical');
assert.deepEqual(serialize(-5), serialize(0), 'Negative time clamps to start');
assert.deepEqual(serialize(20), serialize(8), 'Time beyond duration clamps to end');
assert.ok(path.sample(8).target.clone().sub(path.sample(8).position).dot(path.sample(8).tangent) > 0);
points[1][0] = 1000;
assert.deepEqual(serialize(3.21), before, 'Source point mutation must not affect the path');

assert.throws(() => createCameraPath([[0, 0, 0]]), /at least two/);
assert.throws(() => createCameraPath([[0, 0, 0], [0, 0, 0]]), /must differ/);
assert.throws(() => createCameraPath([[0, NaN, 0], [1, 0, 0]]), /finite coordinates/);
assert.throws(() => createCameraPath([[0, 0, 0], [1, 0, 0]], { duration: 0 }), /positive seconds/);
assert.throws(() => createCameraPath([[0, 0, 0], [1, 0, 0]], { lookAhead: 0 }), /positive metres/);
assert.throws(() => path.sample(Infinity), /finite seconds/);

console.log(JSON.stringify({ status: 'passed', samples: distances.length, lengthMetres: Number(path.length.toFixed(4)), speedMetresPerSecond: Number(path.speed.toFixed(4)), maxSpeedDeviationPercent: Number((maxDeviation * 100).toFixed(2)), seekStable: true }));
