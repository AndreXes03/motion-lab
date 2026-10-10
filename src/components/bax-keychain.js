import * as T from 'three';
import motion from '../../project/motion.json';
import lookRecipe from '../../project/look.json';
import { sampleTrack } from '../engine/animation.js';

const chrome = new T.MeshStandardMaterial({ color: '#e5ebf1', metalness: 0.98, roughness: 0.16 });
const darkSteel = new T.MeshStandardMaterial({ color: '#89939e', metalness: 0.97, roughness: 0.23 });
const orange = new T.MeshStandardMaterial({ color: '#ff641d', metalness: 0.12, roughness: 0.3 });
const white = new T.MeshStandardMaterial({ color: '#f6f3eb', metalness: 0.04, roughness: 0.3 });
const cobalt = new T.MeshStandardMaterial({ color: '#164bdf', metalness: 0.2, roughness: 0.22 });
const cobaltEdge = new T.MeshStandardMaterial({ color: '#0b2b92', metalness: 0.32, roughness: 0.24 });
const ink = new T.MeshStandardMaterial({ color: '#13223a', metalness: 0.02, roughness: 0.34 });
const enamel = new T.MeshStandardMaterial({ color: '#f5f2e9', metalness: 0.18, roughness: 0.18 });
let brushedTexture;

function addMesh(parent, geometry, material, name, position = [0, 0, 0]) {
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tube(parent, curve, radius, material, name, segments = 96) {
  return addMesh(parent, new T.TubeGeometry(curve, segments, radius, 12, false), material, name);
}

function lineBetween(parent, start, end, radius, material, name, radialSegments = 20) {
  const a = new T.Vector3(...start);
  const b = new T.Vector3(...end);
  const axis = new T.Vector3().subVectors(b, a);
  const mesh = addMesh(parent, new T.CylinderGeometry(radius, radius, axis.length(), radialSegments), material, name, a.clone().add(b).multiplyScalar(0.5).toArray());
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

function ringCurve(cx, cy, radius, z, turns = 1, zRise = 0) {
  const points = [];
  const count = 240 * turns;
  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const angle = u * turns * Math.PI * 2;
    points.push(new T.Vector3(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, z + u * zRise));
  }
  return new T.CatmullRomCurve3(points, false, 'centripetal');
}

function roundedRect(width, height, radius) {
  const s = new T.Shape();
  const l = -width / 2, r = width / 2, b = -height, t = 0, q = radius;
  s.moveTo(l + q, b);
  s.lineTo(r - q, b); s.quadraticCurveTo(r, b, r, b + q);
  s.lineTo(r, t - q); s.quadraticCurveTo(r, t, r - q, t);
  s.lineTo(l + q, t); s.quadraticCurveTo(l, t, l, t - q);
  s.lineTo(l, b + q); s.quadraticCurveTo(l, b, l + q, b);
  return s;
}

function makeLabelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#101d33';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 168px Arial, sans-serif';
  ctx.fillText('BAX', 256, 405);
  ctx.font = '700 86px Arial, sans-serif';
  ctx.fillText('STUDIO', 256, 590);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function setupBrushedMetal(renderer) {
  if (!brushedTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(0, 0, 512, 512);
    // Seeded, low-contrast horizontal grain reads as fine machining, not graphic scratches.
    let seed = 72841;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 2100; i++) {
      const y = Math.floor(random() * 512);
      const x = Math.floor(random() * 512);
      const length = 8 + random() * 160;
      const shade = 148 + Math.floor(random() * 76);
      ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.025 + random() * 0.06})`;
      ctx.lineWidth = 0.35 + random() * 0.45;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y + (random() - 0.5) * 0.45); ctx.stroke();
    }
    brushedTexture = new T.CanvasTexture(canvas);
    brushedTexture.wrapS = brushedTexture.wrapT = T.RepeatWrapping;
    brushedTexture.repeat.set(1, 3);
    brushedTexture.colorSpace = T.NoColorSpace;
    brushedTexture.needsUpdate = true;
  }
  for (const material of [chrome, darkSteel]) {
    material.roughnessMap = brushedTexture;
    material.bumpMap = brushedTexture;
    material.bumpScale = 0.00035;
    material.needsUpdate = true;
  }
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  brushedTexture.anisotropy = Math.min(8, maxAnisotropy);
}

function addInterlockedLinks(parent, delta, count, name) {
  const axisAngle = Math.atan2(delta.y, delta.x) - Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const center = delta.clone().multiplyScalar(t);
    // Alternate each oval out of the image plane, so adjacent rings pass through each other.
    const link = addMesh(parent, new T.TorusGeometry(0.052, 0.013, 12, 32), chrome, `bax.chain.link-${name}-${i + 1}`, [center.x, center.y, center.z + (i % 2 ? -0.018 : 0.018)]);
    link.scale.set(0.84, 1.62, 1);
    link.rotation.set(i % 2 ? -0.88 : 0.88, 0, axisAngle);
  }
}

function addJumpRing(parent, name, position, tilt = 0) {
  const ring = addMesh(parent, new T.TorusGeometry(0.069, 0.014, 12, 40), chrome, name, position);
  ring.scale.set(0.86, 1.27, 1);
  ring.rotation.x = tilt;
  return ring;
}

function makeTag() {
  const group = new T.Group();
  group.name = 'bax.charm.tag';
  group.userData.attachPoint = new T.Vector3(0, -0.075, 0.075);
  group.userData.pendulumCenter = new T.Vector3(0, -0.70, 0);
  group.userData.collisionRadius = 0.35;
  group.userData.depthHalf = 0.105;
  group.userData.mass = 0.018;
  const shellShape = roundedRect(0.72, 1.4, 0.12);
  const tagHole = new T.Path();
  tagHole.absellipse(0, -0.075, 0.068, 0.068, 0, Math.PI * 2, true, 0);
  shellShape.holes.push(tagHole);
  const body = new T.ExtrudeGeometry(shellShape, { depth: 0.12, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 12 });
  addMesh(group, body, orange, 'bax.tag.orange-shell');

  const face = new T.ExtrudeGeometry(roundedRect(0.54, 1.08, 0.06), { depth: 0.025, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.012, bevelThickness: 0.012, curveSegments: 12 });
  addMesh(group, face, white, 'bax.tag.white-face', [0, -0.16, 0.125]);
  const label = addMesh(group, new T.PlaneGeometry(0.50, 1.00), new T.MeshBasicMaterial({ map: makeLabelTexture(), transparent: true, toneMapped: false, depthWrite: false }), 'bax.tag.bax-studio-label', [0, -0.70, 0.17]);
  label.renderOrder = 2;

  addMesh(group, new T.TorusGeometry(0.055, 0.014, 10, 36), chrome, 'bax.tag.eyelet', [0, -0.075, 0.075]);
  addMesh(group, new T.TorusGeometry(0.033, 0.008, 8, 28), darkSteel, 'bax.tag.eyelet-inner-lip', [0, -0.075, 0.092]);
  return group;
}

function makeBCharm() {
  const group = new T.Group();
  group.name = 'bax.charm.b';
  group.userData.attachPoint = new T.Vector3(-0.02, -0.045, 0.145);
  group.userData.pendulumCenter = new T.Vector3(0.05, -0.56, 0);
  group.userData.collisionRadius = 0.37;
  group.userData.depthHalf = 0.10;
  group.userData.mass = 0.012;
  const shape = new T.Shape();
  shape.moveTo(-0.31, -1.06);
  shape.lineTo(-0.31, -0.06);
  shape.lineTo(-0.035, -0.06);
  shape.bezierCurveTo(0.34, -0.06, 0.39, -0.41, 0.07, -0.52);
  shape.bezierCurveTo(0.51, -0.62, 0.43, -1.06, 0.025, -1.06);
  shape.closePath();
  const upperCounter = new T.Path();
  upperCounter.absellipse(0.055, -0.30, 0.105, 0.115, 0, Math.PI * 2, true, 0);
  const lowerCounter = new T.Path();
  lowerCounter.absellipse(0.065, -0.80, 0.13, 0.145, 0, Math.PI * 2, true, 0);
  shape.holes.push(upperCounter, lowerCounter);
  const geometry = new T.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.035, bevelThickness: 0.03, curveSegments: 18 });
  addMesh(group, geometry, cobalt, 'bax.b.cobalt-volume');
  const base = new T.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false, curveSegments: 18 });
  addMesh(group, base, cobaltEdge, 'bax.b.edge-inlay', [0, 0, -0.015]);
  addMesh(group, new T.TorusGeometry(0.052, 0.012, 10, 32), chrome, 'bax.b.attach-eyelet', [-0.02, -0.045, 0.145]);
  return group;
}

function makeSmileCharm() {
  const group = new T.Group();
  group.name = 'bax.charm.smile';
  group.userData.attachPoint = new T.Vector3(0, -0.075, 0.09);
  group.userData.pendulumCenter = new T.Vector3(0, -0.51, 0);
  group.userData.collisionRadius = 0.34;
  group.userData.depthHalf = 0.10;
  group.userData.mass = 0.014;
  const metalDisc = addMesh(group, new T.CylinderGeometry(0.405, 0.405, 0.11, 64, 1), chrome, 'bax.smile.metal-disc', [0, -0.51, 0]);
  metalDisc.rotation.x = Math.PI / 2;
  const face = addMesh(group, new T.CylinderGeometry(0.365, 0.365, 0.055, 64, 1), enamel, 'bax.smile.enamel-inset', [0, -0.51, 0.064]);
  face.rotation.x = Math.PI / 2;
  addMesh(group, new T.TorusGeometry(0.388, 0.026, 12, 64), chrome, 'bax.smile.chrome-rim', [0, -0.51, 0.104]);
  addMesh(group, new T.TorusGeometry(0.058, 0.012, 10, 32), chrome, 'bax.smile.attach-eyelet', [0, -0.075, 0.09]);
  const eyeGeo = new T.SphereGeometry(0.034, 16, 12);
  addMesh(group, eyeGeo, ink, 'bax.smile.eye-left', [-0.12, -0.45, 0.11]);
  addMesh(group, eyeGeo, ink, 'bax.smile.eye-right', [0.12, -0.45, 0.11]);
  const mouth = new T.Shape();
  mouth.moveTo(-0.14, -0.58);
  mouth.quadraticCurveTo(0, -0.78, 0.14, -0.58);
  const mouthCurve = new T.CatmullRomCurve3(mouth.getPoints(20).map(p => new T.Vector3(p.x, p.y, 0.11)));
  tube(group, mouthCurve, 0.022, ink, 'bax.smile.curved-mouth', 32);
  return group;
}

function hangCharm(root, name, startPoint, endPoint, charmGroup, charmLength) {
  const pivot = new T.Group();
  pivot.name = `bax.pivot.${name}`;
  pivot.position.set(...startPoint);
  root.add(pivot);

  const end = new T.Vector3(...endPoint);
  const delta = end.clone().sub(new T.Vector3(...startPoint));
  const length = Math.max(0.25, delta.length() + charmLength * 0.5);
  const count = Math.max(1, Math.ceil(delta.length() / 0.10) - 1);
  const angle = Math.atan2(delta.y, delta.x) - Math.PI / 2;

  const startRing = addJumpRing(pivot, `bax.chain.split-jump-${name}`, [0, 0, 0], Math.PI / 2);
  startRing.rotation.z = angle;
  addInterlockedLinks(pivot, delta, count, name);

  const eyeletPoint = delta.clone().add(charmGroup.userData.attachPoint);
  const endRing = addJumpRing(pivot, `bax.chain.charm-jump-${name}`, eyeletPoint.toArray(), Math.PI / 2);
  endRing.rotation.z = angle;
  charmGroup.position.copy(delta);
  pivot.add(charmGroup);

  return {
    name,
    pivot,
    delta,
    center: charmGroup.userData.pendulumCenter,
    radius: charmGroup.userData.collisionRadius,
    depthHalf: charmGroup.userData.depthHalf,
    mass: charmGroup.userData.mass,
    length,
    restOffset: Math.atan2(delta.x + charmGroup.userData.pendulumCenter.x, -(delta.y + charmGroup.userData.pendulumCenter.y)),
    angle: 0,
    velocity: 0
  };
}

function pendulumCenter(item) {
  const x = item.delta.x + item.center.x;
  const y = item.delta.y + item.center.y;
  const c = Math.cos(item.angle), s = Math.sin(item.angle);
  return { x: item.pivot.position.x + x * c - y * s, y: item.pivot.position.y + x * s + y * c, z: item.pivot.position.z + item.delta.z + item.center.z };
}

function resolveCharmCollisions(items, supportRate) {
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    const ca = pendulumCenter(a), cb = pendulumCenter(b);
    let nx = cb.x - ca.x, ny = cb.y - ca.y;
    const distance = Math.hypot(nx, ny);
    const depthDistance = Math.abs(cb.z - ca.z);
    // These are thin physical charms. A visible 2D overlap is allowed when their
    // actual front-to-back separation clears both bodies' half-thicknesses.
    if (depthDistance >= a.depthHalf + b.depthHalf) continue;
    const radiusA = Math.sqrt(Math.max(0, a.radius * a.radius - depthDistance * depthDistance * 0.25));
    const radiusB = Math.sqrt(Math.max(0, b.radius * b.radius - depthDistance * depthDistance * 0.25));
    const overlap = radiusA + radiusB - distance;
    if (overlap <= 0) continue;
    if (distance < 1e-8) { nx = 1; ny = 0; } else { nx /= distance; ny /= distance; }

    // Correct penetration by rotating each constrained pendulum along its available tangent.
    const ax = a.delta.x + a.center.x, ay = a.delta.y + a.center.y;
    const bx = b.delta.x + b.center.x, by = b.delta.y + b.center.y;
    const arx = ax * Math.cos(a.angle) - ay * Math.sin(a.angle);
    const ary = ax * Math.sin(a.angle) + ay * Math.cos(a.angle);
    const brx = bx * Math.cos(b.angle) - by * Math.sin(b.angle);
    const bry = bx * Math.sin(b.angle) + by * Math.cos(b.angle);
    const atx = -ary, aty = arx, btx = -bry, bty = brx;
    const an = atx * nx + aty * ny, bn = btx * nx + bty * ny;
    const denom = an * an + bn * bn;
    if (denom > 1e-8) {
      a.angle -= overlap * an / denom;
      b.angle += overlap * bn / denom;
    }

    // Inelastic contact impulse uses each charm's mass and pivot moment of inertia.
    const vaX = atx * (a.velocity + supportRate), vaY = aty * (a.velocity + supportRate);
    const vbX = btx * (b.velocity + supportRate), vbY = bty * (b.velocity + supportRate);
    const closingSpeed = (vbX - vaX) * nx + (vbY - vaY) * ny;
    if (closingSpeed < 0) {
      const armCrossA = arx * ny - ary * nx;
      const armCrossB = brx * ny - bry * nx;
      const inertiaA = a.mass * a.length * a.length;
      const inertiaB = b.mass * b.length * b.length;
      // Both endpoints are constrained at fixed pivots; only rotational inertia contributes.
      const inverseMass = armCrossA * armCrossA / inertiaA + armCrossB * armCrossB / inertiaB;
      if (inverseMass < 1e-8) continue;
      const impulse = -(1.0 + 0.12) * closingSpeed / inverseMass;
      a.velocity -= impulse * armCrossA / inertiaA;
      b.velocity += impulse * armCrossB / inertiaB;
    }
  }
}

function makePendulumSimulation(items, supportRollAt, fixedHz = 240, damping = 0.48) {
  const dt = 1 / fixedHz;
  const snapshots = [{ angles: items.map(item => item.angle), velocities: items.map(item => item.velocity) }];
  let simulatedSteps = 0;
  const ensureStep = lastStep => {
    while (simulatedSteps < lastStep) {
      const time = simulatedSteps * dt;
      const supportRoll = supportRollAt(time);
      const supportRate = (supportRollAt(time + dt) - supportRollAt(time - dt)) / (2 * dt);
      const supportAcceleration = (supportRollAt(time + dt) - 2 * supportRoll + supportRollAt(time - dt)) / (dt * dt);
      for (const item of items) {
        // COM offset and animated keychain roll set the true gravity equilibrium.
        const gravityAngle = item.angle + item.restOffset + supportRoll;
        const acceleration = -(9.81 / item.length) * Math.sin(gravityAngle) - damping * item.velocity - supportAcceleration;
        item.velocity += acceleration * dt;
        item.angle += item.velocity * dt;
      }
      resolveCharmCollisions(items, supportRate);
      simulatedSteps++;
      snapshots.push({ angles: items.map(item => item.angle), velocities: items.map(item => item.velocity) });
    }
  };
  return time => {
    const frame = Math.max(0, Number(time) || 0) * fixedHz;
    const lower = Math.floor(frame);
    const fraction = frame - lower;
    ensureStep(lower + 1);
    const a = snapshots[lower], b = snapshots[lower + 1];
    for (let i = 0; i < items.length; i++) items[i].pivot.rotation.z = a.angles[i] + (b.angles[i] - a.angles[i]) * fraction;
  };
}

function makeCarabiner(root) {
  // A pear-shaped spine ends at the gate hinge and latch; the straight gate closes the lower opening.
  const points = [
    [-0.34, 0.52, 0.13], [-0.49, 0.87, 0.13], [-0.48, 1.33, 0.13],
    [-0.31, 1.73, 0.13], [-0.04, 2.03, 0.13], [0.20, 2.08, 0.13],
    [0.40, 1.88, 0.13], [0.45, 1.52, 0.13], [0.36, 1.13, 0.13], [0.24, 0.70, 0.13]
  ].map(point => new T.Vector3(...point));
  const spine = new T.CatmullRomCurve3(points, false, 'centripetal');
  tube(root, spine, 0.074, chrome, 'bax.carabiner.pear-spine', 240);

  const gateStart = points[0];
  const gateEnd = points.at(-1);
  const gateAxis = new T.Vector3().subVectors(gateEnd, gateStart);
  lineBetween(root, gateStart.toArray(), gateEnd.toArray(), 0.054, chrome, 'bax.carabiner.straight-gate', 24);

  // Hinge pin and rounded latch socket bridge the gate to the spine ends.
  const hinge = addMesh(root, new T.CylinderGeometry(0.088, 0.088, 0.15, 32), chrome, 'bax.carabiner.gate-hinge', gateStart.toArray());
  hinge.rotation.z = Math.PI / 2;
  const latch = addMesh(root, new T.CylinderGeometry(0.076, 0.076, 0.15, 32), chrome, 'bax.carabiner.gate-latch', gateEnd.toArray());
  latch.rotation.z = Math.PI / 2;

  // Threaded lock sleeve is visibly seated around the straight bar.
  const sleeveStart = gateStart.clone().addScaledVector(gateAxis, 0.38);
  const sleeveEnd = gateStart.clone().addScaledVector(gateAxis, 0.72);
  lineBetween(root, sleeveStart.toArray(), sleeveEnd.toArray(), 0.073, chrome, 'bax.carabiner.screw-sleeve', 32);
  const axis = gateAxis.clone().normalize();
  for (let i = 0; i < 7; i++) {
    const t = (i + 1) / 8;
    const position = sleeveStart.clone().lerp(sleeveEnd, t);
    const rib = addMesh(root, new T.TorusGeometry(0.068, 0.007, 10, 28), darkSteel, `bax.carabiner.thread-rib-${i + 1}`, position.toArray());
    rib.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), axis);
  }
}

export function createBaxKeychain(renderer = null) {
  const root = new T.Group();
  root.name = 'bax.keychain';
  setupBrushedMetal(renderer);
  makeCarabiner(root);

  // Two close wire turns form one split ring, with staggered endpoints like a real wound split-ring.
  tube(root, ringCurve(0, 0.30, 0.43, 0.035, 2, 0.026), 0.019, chrome, 'bax.split-ring.double-coil', 480);

  const pendulums = [
    hangCharm(root, 'tag', [-0.16, -0.035, 0.046], [-0.48, -0.25, -0.23], makeTag(), 1.4),
    hangCharm(root, 'b', [0, -0.13, 0.046], [0.02, -0.25, 0.12], makeBCharm(), 1.06),
    hangCharm(root, 'smile', [0.16, -0.035, 0.046], [0.48, -0.25, 0.40], makeSmileCharm(), 0.9)
  ];

  // Fixed-step constrained pendulums are precomputed lazily, so arbitrary timeline seeks
  // return the same result. Gravity, damping, link length, charm mass, and contact impulses
  // determine motion; no independent sine offsets are applied to unattached charm groups.
  let simulationSignature = '';
  let simulate = null;
  root.userData.update = (time, options = {}) => {
    const activeMotion = options.motion ?? motion;
    const amount = options.amount ?? lookRecipe.motion?.amount ?? 1;
    const rotationKeys = activeMotion.tracks?.['bax.keychain.rotation'];
    // Rebuild the deterministic fixed-step history when an agent edits the motion
    // recipe or amount. This keeps random-access renders in sync with live parameters.
    const nextSignature = JSON.stringify([rotationKeys ?? null, amount]);
    if (nextSignature !== simulationSignature) {
      simulationSignature = nextSignature;
      for (const item of pendulums) {
        item.angle = 0;
        item.velocity = 0;
        item.pivot.rotation.z = 0;
      }
      const rollAt = t => rotationKeys ? sampleTrack(rotationKeys, t, amount)[2] : 0;
      simulate = makePendulumSimulation(pendulums, rollAt);
    }
    simulate(time);
  };

  return root;
}
