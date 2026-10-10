import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createBrandTexture } from './brand.js';
import { createMicroSurfaceMaps } from './materials.js';

const chromeFinish = createMicroSurfaceMaps({ seed: 0xC470, resolution: 512, repeat: [1.4, 2.4], heightAmplitude: 85, roughnessBase: 205, roughnessAmplitude: 28 });
const steelFinish = createMicroSurfaceMaps({ seed: 0x57EE1, resolution: 512, repeat: [1.2, 2.8], heightAmplitude: 85, roughnessBase: 222, roughnessAmplitude: 28 });
const enamelFinish = createMicroSurfaceMaps({ seed: 0xB1E, resolution: 512, repeat: [2.5, 2.5], heightAmplitude: 85, roughnessBase: 224, roughnessAmplitude: 28 });
const orangeFinish = createMicroSurfaceMaps({ seed: 0x0A6E, resolution: 512, repeat: [2.4, 2.4], heightAmplitude: 85, roughnessBase: 218, roughnessAmplitude: 28 });
const chrome = new T.MeshPhysicalMaterial({ color: '#dce4ec', metalness: 0.98, roughness: 0.2, roughnessMap: chromeFinish.roughnessMap, bumpMap: chromeFinish.bumpMap, bumpScale: 0.00016 });
const steel = new T.MeshPhysicalMaterial({ color: '#687888', metalness: 0.96, roughness: 0.28, roughnessMap: steelFinish.roughnessMap, bumpMap: steelFinish.bumpMap, bumpScale: 0.00018 });
const cobalt = new T.MeshPhysicalMaterial({ color: '#1748d5', metalness: 0.34, roughness: 0.24, roughnessMap: enamelFinish.roughnessMap, bumpMap: enamelFinish.bumpMap, bumpScale: 0.0015, clearcoat: 0.28, clearcoatRoughness: 0.2 });
const blueDark = new T.MeshPhysicalMaterial({ color: '#0b1c48', metalness: 0.72, roughness: 0.27, roughnessMap: enamelFinish.roughnessMap, bumpMap: enamelFinish.bumpMap, bumpScale: 0.00022, clearcoat: 0.12, clearcoatRoughness: 0.24 });
const orange = new T.MeshPhysicalMaterial({ color: '#ff5b18', metalness: 0.38, roughness: 0.24, roughnessMap: orangeFinish.roughnessMap, bumpMap: orangeFinish.bumpMap, bumpScale: 0.00022, clearcoat: 0.16, clearcoatRoughness: 0.22 });
const black = new T.MeshStandardMaterial({ color: '#101a24', metalness: 0.5, roughness: 0.32 });
const glass = new T.MeshPhysicalMaterial({ color: '#79d5ff', metalness: 0.28, roughness: 0.12, transmission: 0.18, thickness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08 });

function mesh(parent, name, geometry, material, position = [0, 0, 0]) {
  const object = new T.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

function cylinderZ(parent, name, radius, depth, material, position, radial = 64) {
  const part = mesh(parent, name, new T.CylinderGeometry(radius, radius, depth, radial), material, position);
  part.rotation.x = Math.PI / 2;
  return part;
}

// A turned edge profile adds a small readable chamfer while keeping the
// cylinder's exact radius and end-to-end depth unchanged.
function beveledCylinderZ(parent, name, radius, depth, material, position, radial = 96) {
  const half = depth / 2;
  const bevel = Math.min(depth * 0.16, radius * 0.1, 0.035);
  const inset = Math.min(bevel * 0.45, radius * 0.04);
  const profile = [
    new T.Vector2(0, -half), new T.Vector2(radius - inset, -half),
    new T.Vector2(radius - bevel * 0.2, -half + bevel * 0.2),
    new T.Vector2(radius, -half + bevel), new T.Vector2(radius, half - bevel),
    new T.Vector2(radius - bevel * 0.2, half - bevel * 0.2),
    new T.Vector2(radius - inset, half), new T.Vector2(0, half)
  ];
  const part = mesh(parent, name, new T.LatheGeometry(profile, radial), material, position);
  part.rotation.x = Math.PI / 2;
  return part;
}

function cylinderAxis(parent, name, start, end, radius, material) {
  const a = new T.Vector3(...start), b = new T.Vector3(...end);
  const axis = b.clone().sub(a);
  const part = mesh(parent, name, new T.CylinderGeometry(radius, radius, axis.length(), 32), material, a.add(b).multiplyScalar(0.5).toArray());
  part.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis.normalize());
  return part;
}

function addBolts(parent, name, radius, count, boltRadius, z, material = chrome) {
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    const bolt = cylinderZ(parent, `${name}.bolt-${String(i + 1).padStart(2, '0')}`, boltRadius, 0.055, material, [x, y, z], 16);
    bolt.rotation.z = a;
    mesh(parent, `${name}.socket-${String(i + 1).padStart(2, '0')}`, new T.SphereGeometry(boltRadius * 0.24, 12, 8), black, [x, y, z + 0.032]);
  }
}

function makeScale(parent, name, radius, count, z) {
  const scaleMaterial = new T.MeshStandardMaterial({ color: '#d5dce2', metalness: 0.86, roughness: 0.36 });
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count;
    const major = i % 3 === 0;
    const mark = mesh(parent, `${name}.engraved-index-${i + 1}`, new T.BoxGeometry(major ? 0.018 : 0.009, major ? 0.09 : 0.045, 0.008), scaleMaterial,
      [Math.cos(angle) * radius, Math.sin(angle) * radius, z]);
    mark.rotation.z = angle - Math.PI / 2;
  }
}

function makeOuterGimbal() {
  const pivot = new T.Group();
  pivot.name = 'bax.gyro.outer-gimbal-pivot';
  const hoop = mesh(pivot, 'bax.gyro.outer-machined-hoop', new T.TorusGeometry(1.49, 0.078, 20, 160), chrome);
  hoop.name = 'bax.gyro.outer-machined-hoop';
  const innerBead = mesh(pivot, 'bax.gyro.outer-inner-bead', new T.TorusGeometry(1.36, 0.018, 10, 128), steel, [0, 0, 0.035]);
  makeScale(pivot, 'bax.gyro.outer-scale', 1.405, 64, 0.092);
  addBolts(pivot, 'bax.gyro.outer-fastener', 1.49, 10, 0.055, 0.094);
  // Short radial bridges terminate at the hoop and center on the axle bosses.
  cylinderAxis(pivot, 'bax.gyro.outer-axle-left', [-1.62, 0, 0], [-1.30, 0, 0], 0.105, chrome);
  cylinderAxis(pivot, 'bax.gyro.outer-axle-right', [1.30, 0, 0], [1.62, 0, 0], 0.105, chrome);
  return pivot;
}

function makeInnerGimbal(parent) {
  const pivot = new T.Group();
  pivot.name = 'bax.gyro.inner-gimbal-pivot';
  parent.add(pivot);
  for(const side of [-1,1])cylinderAxis(parent,`bax.gyro.inner-bearing-bridge-${side}`,[side*1.49,0,0],[side*.98,0,0],.07,steel);
  mesh(pivot, 'bax.gyro.inner-enamel-hoop', new T.TorusGeometry(0.98, 0.066, 18, 128), cobalt);
  mesh(pivot, 'bax.gyro.inner-machined-lip', new T.TorusGeometry(0.875, 0.019, 10, 128), chrome, [0, 0, 0.045]);
  makeScale(pivot, 'bax.gyro.inner-index', 0.92, 40, 0.079);
  addBolts(pivot, 'bax.gyro.inner-fastener', 0.98, 8, 0.045, 0.08);
  cylinderAxis(pivot, 'bax.gyro.inner-axle-left', [-1.08, 0, 0], [-0.86, 0, 0], 0.082, chrome);
  cylinderAxis(pivot, 'bax.gyro.inner-axle-right', [0.86, 0, 0], [1.08, 0, 0], 0.082, chrome);

  // An enamel bridge carries the supplied, isolated BAX wordmark inside the hoop.
  mesh(pivot, 'bax.gyro.brand-bridge', new RoundedBoxGeometry(0.70, 0.15, 0.09, 6, 0.04), cobalt, [0, 0.91, 0.015]);
  const texture = createBrandTexture({ color: '#ffffff' });
  const logoWidth = 0.52, logoHeight = logoWidth / texture.userData.aspect;
  mesh(pivot, 'bax.gyro.brand-wordmark', new T.PlaneGeometry(logoWidth, logoHeight),
    new T.MeshStandardMaterial({ color: '#ffffff', map: texture, transparent: true, roughness: 0.42, metalness: 0.04, depthWrite: false }), [0, 0.91, 0.066]);
  return pivot;
}

function makeRotor(parent) {
  const rotor = new T.Group();
  rotor.name = 'bax.gyro.rotor';
  parent.add(rotor);

  // Deep cobalt hub, orange annular flywheel, and visible radial vanes make the
  // spinning axis legible in a still frame as well as in motion.
  beveledCylinderZ(rotor, 'bax.gyro.cobalt-housing', 0.49, 0.48, cobalt, [0, 0, 0]);
  cylinderZ(rotor, 'bax.gyro.rear-collar', 0.55, 0.105, steel, [0, 0, -0.27]);
  mesh(rotor, 'bax.gyro.front-bezel', new T.TorusGeometry(0.46, 0.055, 16, 96), chrome, [0, 0, 0.265]);

  beveledCylinderZ(rotor, 'bax.gyro.flywheel-core', 0.69, 0.12, blueDark, [0, 0, 0.34]);
  mesh(rotor, 'bax.gyro.orange-flywheel-rim', new T.TorusGeometry(0.635, 0.082, 18, 128), orange, [0, 0, 0.42]);
  mesh(rotor, 'bax.gyro.orange-inner-race', new T.TorusGeometry(0.48, 0.024, 12, 96), orange, [0, 0, 0.43]);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const vane = mesh(rotor, `bax.gyro.flywheel-vane-${i + 1}`, new RoundedBoxGeometry(0.14, 0.31, 0.065, 4, 0.025), orange,
      [Math.cos(angle) * 0.555, Math.sin(angle) * 0.555, 0.40]);
    vane.rotation.z = angle + Math.PI / 2;
  }
  addBolts(rotor, 'bax.gyro.flywheel-rivet', 0.57, 8, 0.028, 0.493, chrome);

  cylinderZ(rotor, 'bax.gyro.lens-seat', 0.365, 0.12, chrome, [0, 0, 0.49]);
  const lens = mesh(rotor, 'bax.gyro.central-optic', new T.SphereGeometry(0.30, 64, 48), glass, [0, 0, 0.56]);
  lens.scale.z = 0.48;
  mesh(rotor, 'bax.gyro.optic-aperture', new T.TorusGeometry(0.205, 0.018, 12, 64), cobalt, [0, 0, 0.695]);
  cylinderZ(rotor, 'bax.gyro.optic-center', 0.065, 0.018, blueDark, [0, 0, 0.70], 48);
  return rotor;
}

export function createBaxKinetic() {
  const root = new T.Group();
  root.name = 'bax.kinetic';

  const center = new T.Group();
  center.name = 'bax.gyro.center';
  root.add(center);

  const outer = makeOuterGimbal();
  center.add(outer);
  const inner = makeInnerGimbal(outer);
  const rotor = makeRotor(inner);
  for(const side of [-1,1])cylinderAxis(inner,`bax.gyro.motor-support-${side}`,[side*.92,0,-.16],[0,0,-.16],.045,steel);
  cylinderZ(inner,'bax.gyro.motor-bearing',.19,.18,steel,[0,0,-.1]);

  // External hinge stacks sit precisely on the outer hoop's X axis and connect
  // the two moving ring assemblies through visible, aligned pivot hardware.
  for (const side of [-1, 1]) {
    const x = side * 1.49;
    cylinderAxis(outer, `bax.gyro.external-pivot-${side < 0 ? 'left' : 'right'}`, [x - 0.11, 0, 0], [x + 0.11, 0, 0], 0.11, chrome);
    cylinderZ(outer, `bax.gyro.external-cap-${side < 0 ? 'left' : 'right'}`, 0.14, 0.10, steel, [x, 0, 0.10], 48);
    cylinderZ(outer, `bax.gyro.external-cap-screw-${side < 0 ? 'left' : 'right'}`, 0.05, 0.025, chrome, [x, 0, 0.16], 24);
  }

  root.userData.update = (time,{amount=1}={}) => {
    const t = (Number.isFinite(Number(time)) ? Number(time) : 0)*amount;
    outer.rotation.x = 0.32 * Math.sin(t * 0.92);
    outer.rotation.z = 0;
    inner.rotation.x = 0.88 * Math.sin(t * 1.35 + 0.65);
    inner.rotation.y = 0;inner.rotation.z = 0;
    rotor.rotation.z = t * 3.8 + .22 * Math.sin(t * 3.2);
  };
  root.userData.bounds = { width: 3.3, height: 3.3, depth: 1.35 };
  return root;
}
