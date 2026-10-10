import * as T from 'three';

function pointVector(point, index) {
  const components = Array.isArray(point) ? point : point && typeof point === 'object' ? [point.x, point.y, point.z] : null;
  if (!components || components.length !== 3 || components.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`Camera path point ${index} must contain three finite coordinates`);
  }
  return new T.Vector3(...components);
}

/**
 * Build a reusable path in metres. Time is absolute seconds; sampling is
 * stateless and Catmull-Rom arc-length reparameterisation gives even travel.
 */
export function createCameraPath(points, { lookAhead = .7, duration = 10 } = {}) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('Camera path needs at least two points');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Camera path duration must be positive seconds');
  if (!Number.isFinite(lookAhead) || lookAhead <= 0) throw new Error('Camera path lookAhead must be positive metres');
  const vectors = points.map(pointVector);
  for (let index = 1; index < vectors.length; index++) {
    if (vectors[index].distanceToSquared(vectors[index - 1]) < 1e-12) {
      throw new Error(`Camera path points ${index - 1} and ${index} must differ`);
    }
  }
  const curve = new T.CatmullRomCurve3(vectors, false, 'centripetal');
  curve.arcLengthDivisions = Math.max(2048, vectors.length * 256);
  const length = curve.getLength();
  if (!Number.isFinite(length) || length <= 0) throw new Error('Camera path has no length');
  const speed = length / duration;
  const fallback = vectors[vectors.length - 1].clone().sub(vectors[vectors.length - 2]).normalize();

  function sample(time) {
    if (!Number.isFinite(time)) throw new Error('Camera path sample time must be finite seconds');
    const u = Math.max(0, Math.min(1, time / duration));
    const position = u === 0 ? vectors[0].clone() : u === 1 ? vectors[vectors.length - 1].clone() : curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    if (tangent.lengthSq() < 1e-12) tangent.copy(fallback);
    tangent.normalize();
    const aheadU = Math.min(1, u + lookAhead / length);
    const target = curve.getPointAt(aheadU);
    if (aheadU === 1) target.addScaledVector(tangent, Math.max(0, (u + lookAhead / length - 1) * length));
    // At exactly the end, extrapolation still creates a valid look direction.
    if (target.distanceToSquared(position) < 1e-12) target.copy(position).addScaledVector(tangent, lookAhead);
    return { position, target, tangent, length, speed };
  }

  return Object.freeze({ duration, lookAhead, length, speed, sample });
}
