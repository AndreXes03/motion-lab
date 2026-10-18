import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from 'three';
import { createMicroSurfaceMaps } from './materials.js';

// This is a machined object, not the soft inflatable used by the earlier look.
// The separately extruded enamel sits below the chrome's front bevel.
function roundedContour(path,left,bottom,right,top,radius) {
  path.moveTo(left+radius,bottom);
  path.lineTo(right-radius,bottom);path.quadraticCurveTo(right,bottom,right,bottom+radius);
  path.lineTo(right,top-radius);path.quadraticCurveTo(right,top,right-radius,top);
  path.lineTo(left+radius,top);path.quadraticCurveTo(left,top,left,top-radius);
  path.lineTo(left,bottom+radius);path.quadraticCurveTo(left,bottom,left+radius,bottom);
  path.closePath();
}

// A neutral machined frame: the silhouette no longer reproduces a letterform.
function outline() {
  const shape=new T.Shape();
  roundedContour(shape,-1.50,-1.90,1.95,1.90,.32);
  const opening=new T.Path();
  roundedContour(opening,-.425,-.75,.875,.75,.18);
  shape.holes.push(opening);
  return shape;
}

function insetShape(base, outerX, outerY, holeScale) {
  const shape = new T.Shape();
  const outer = base.getPoints(112);
  outer.forEach((p, i) => i ? shape.lineTo(p.x * outerX, p.y * outerY) : shape.moveTo(p.x * outerX, p.y * outerY));
  shape.closePath();
  const hole = new T.Path();
  const points = base.holes[0].getPoints(72);
  const centerX = .225, centerY = 0;
  points.forEach((p, i) => {
    const x = centerX + (p.x - centerX) * holeScale;
    const y = centerY + (p.y - centerY) * holeScale;
    i ? hole.lineTo(x, y) : hole.moveTo(x, y);
  });
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function brushedMap() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#c0c0c0';
  context.fillRect(0, 0, 256, 256);
  let state = 42167;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < 1700; i++) {
    const shade = 135 + Math.floor(random() * 99);
    context.strokeStyle = `rgba(${shade},${shade},${shade},${.08 + random() * .1})`;
    context.lineWidth = .3 + random() * .45;
    const x = random() * 256, y = random() * 256;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 20 + random() * 130, y + (random() - .5) * .7);
    context.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(1.3, 3.1);
  texture.colorSpace = T.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addMesh(parent, name, geometry, material, z = 0) {
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.z = z;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function scaleContour(points, sx, sy, cx = 0, cy = 0) {
  return points.map(p => new T.Vector2(cx + (p.x - cx) * sx, cy + (p.y - cy) * sy));
}

// A band loft creates actual raised chrome lips around both the outer edge
// and the counter. It leaves the central cavity clear for the enamel solid.
function loftBand(parent, name, inner, outer, zInner, zOuter, material) {
  const count = Math.min(inner.length, outer.length) - 1;
  const positions = [];
  const indexes = [];
  for (let i = 0; i < count; i++) {
    positions.push(inner[i].x, inner[i].y, zInner, outer[i].x, outer[i].y, zOuter);
  }
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const a = i * 2, b = a + 1, c = j * 2, d = c + 1;
    const pa = new T.Vector3(...positions.slice(a * 3, a * 3 + 3));
    const pb = new T.Vector3(...positions.slice(b * 3, b * 3 + 3));
    const pc = new T.Vector3(...positions.slice(c * 3, c * 3 + 3));
    const pd = new T.Vector3(...positions.slice(d * 3, d * 3 + 3));
    const front = new T.Vector3().subVectors(pb, pa).cross(new T.Vector3().subVectors(pc, pa)).z >= 0;
    if (front) indexes.push(a, b, c, b, d, c);
    else indexes.push(a, c, b, b, c, d);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indexes);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function printLabel(parent, name, text, x, y, width, height, z, color, font) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(64, Math.round(1024 * height / width));
  const context = canvas.getContext('2d');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.font = font;
  context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * .96);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  const label = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  label.name = name;
  label.position.set(x, y, z);
  label.renderOrder = 2;
  parent.add(label);
}

function screw(parent, x, y, z, metal, groove, name) {
  const counterbore = new T.Mesh(new T.TorusGeometry(.043, .006, 8, 32), groove);
  counterbore.name = `${name}.counterbore`;
  counterbore.position.set(x, y, z - .004);
  parent.add(counterbore);
  const head = addMesh(parent, `${name}.head`, new T.CylinderGeometry(.035, .035, .012, 32), metal);
  head.rotation.x = Math.PI / 2;
  head.position.set(x, y, z);
  const socket = addMesh(parent, `${name}.hex-socket`, new T.CylinderGeometry(.017, .017, .002, 6), groove);
  socket.rotation.x = Math.PI / 2;
  socket.rotation.y = .26;
  socket.position.set(x, y, z + .007);
}

function smoothBetween(a, b, t) {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

export function createObjectsEmblem() {
  const group = new T.Group();
  // Stable name for motion tracks and object-isolated inspection.
  group.name = 'objects.emblem';
  group.userData.kind = 'machined-emblem-3d';
  group.userData.details = {
    rim: [.96, .75, .295],
    fastenerTop: [-1.14, 1.51, .255],
    scale: [-1.05, -.15, .251],
    enamel: [.72, -.85, .244],
    hiddenRotor: [1.18, -1.13, .209],
    hinge: [-1.35, 0, .24]
  };

  const base = outline();
  const enamelShape = insetShape(base, .90, .92, 1.18);
  const grain = brushedMap();
  const sideGrain = grain.clone();
  sideGrain.repeat.set(8, 1.5);
  sideGrain.needsUpdate = true;
  const enamelMaps = createMicroSurfaceMaps({ seed: 0xBA501, resolution: 512, repeat: [2.6, 2.6], heightAmplitude: 85, roughnessBase: 235, roughnessAmplitude: 28 });
  const chrome = new T.MeshPhysicalMaterial({
    color: '#e4e9ef', metalness: .82, roughness: .23,
    roughnessMap: grain, bumpMap: grain, bumpScale: .00032,
    clearcoat: .16, clearcoatRoughness: .22,
    emissive: '#43505d', emissiveIntensity: .11
  });
  const sideSteel = new T.MeshPhysicalMaterial({
    color: '#c3d0db', metalness: .76, roughness: .35,
    roughnessMap: sideGrain, bumpMap: sideGrain, bumpScale: .00065,
    emissive: '#586a78', emissiveIntensity: .23
  });
  const satinAluminum = new T.MeshPhysicalMaterial({
    color: '#c8d4dd', metalness: .68, roughness: .43,
    roughnessMap: sideGrain, bumpMap: sideGrain, bumpScale: .00048,
    emissive: '#a5b5c2', emissiveIntensity: .62
  });
  const graphite = new T.MeshStandardMaterial({ color: '#142435', metalness: .8, roughness: .27 });
  const innerNickel = new T.MeshStandardMaterial({
    color: '#7893aa', metalness: .34, roughness: .46,
    roughnessMap: sideGrain, emissive: '#182b3e', emissiveIntensity: .42
  });
  const enamel = new T.MeshPhysicalMaterial({
    color: '#1248d8', metalness: .24, roughness: .22,
    clearcoat: .54, clearcoatRoughness: .23,
    roughnessMap: enamelMaps.roughnessMap, bumpMap: enamelMaps.bumpMap, bumpScale: .0035
  });

  // The full steel back stops below the inlay; no opaque chrome cap covers it.
  const body = addMesh(group, 'objects.body.chrome-machined', new T.ExtrudeGeometry(base, {
    depth: .41, steps: 1, bevelEnabled: true, bevelSegments: 7,
    bevelSize: .055, bevelThickness: .045, curveSegments: 128
  }), [sideSteel, sideSteel], -.26);
  const rawBody=body.geometry;body.geometry=toCreasedNormals(rawBody,Math.PI/7);if(rawBody!==body.geometry)rawBody.dispose();
  body.receiveShadow = false;

  // Raised perimeter: brushed aluminum lands and narrow machined channels.
  const outer = base.getPoints(128);
  const hole = base.holes[0].getPoints(96);
  const bands = [
    { points: outer, cx: 0, cy: 0, start: [1, 1], peak: [.975, .978], nickA: [.966, .970], nickB: [.958, .963], land: [.94, .952], inlay: [.90, .92] },
    { points: hole, cx: .225, cy: 0, start: [1, 1], peak: [1.04, 1.04], nickA: [1.057, 1.057], nickB: [1.073, 1.073], land: [1.10, 1.10], inlay: [1.18, 1.18] }
  ];
  bands.forEach((band, i) => {
    const make = scale => scaleContour(band.points, scale[0], scale[1], band.cx, band.cy);
    loftBand(group, `objects.rim.${i}.shoulder`, make(band.start), make(band.peak), .15, .295, chrome);
    loftBand(group, `objects.rim.${i}.engraved-groove-a`, make(band.peak), make(band.nickA), .295, .284, sideSteel);
    loftBand(group, `objects.rim.${i}.engraved-groove-b`, make(band.nickA), make(band.nickB), .284, .295, chrome);
    loftBand(group, `objects.rim.${i}.land`, make(band.nickB), make(band.land), .295, .295, chrome);
    loftBand(group, `objects.rim.${i}.groove`, make(band.land), make(band.inlay), .295, .244, satinAluminum);
  });

  // The black machined bed becomes visible when the hinged enamel service lid
  // opens. All exposed inner elements remain lower than the closed lid's back.
  const innerBed = addMesh(group, 'objects.service.recess', new T.ExtrudeGeometry(enamelShape, {
    depth: .008, steps: 1, bevelEnabled: false, curveSegments: 12
  }), innerNickel, .196);
  innerBed.receiveShadow = false;
  const insetSteel = new T.MeshStandardMaterial({ color: '#a2b4c4', metalness: .52, roughness: .34, roughnessMap: sideGrain, emissive: '#223343', emissiveIntensity: .25 });
  const orange = new T.MeshPhysicalMaterial({ color: '#e95722', metalness: .16, roughness: .38, clearcoat: .2, emissive: '#742307', emissiveIntensity: .32 });
  for (let i = 0; i < 3; i++) {
    const rail = addMesh(group, `objects.service.guide-rail.${i}`, new RoundedBoxGeometry(.67, .025, .006, 3, .004), insetSteel);
    rail.position.set(.53, -1.10 - i * .16, .208);
  }
  const rotorBack = addMesh(group, 'objects.service.rotor-bearing', new T.CylinderGeometry(.32, .32, .007, 48), sideSteel);
  rotorBack.rotation.x = Math.PI / 2;
  rotorBack.position.set(1.18, -1.13, .203);
  const rotor = addMesh(group, 'objects.service.orange-rotor', new T.CylinderGeometry(.242, .242, .008, 48), orange);
  rotor.rotation.x = Math.PI / 2;
  rotor.position.set(1.18, -1.13, .207);
  const rotorCore = addMesh(group, 'objects.service.rotor-core', new T.CylinderGeometry(.044, .044, .003, 32), graphite);
  rotorCore.rotation.x = Math.PI / 2;
  rotorCore.position.set(1.18, -1.13, .211);
  for (const [name, x, y] of [['top', -1.04, 1.34], ['bottom', 1.27, -1.46]]) {
    const pin = addMesh(group, `objects.service.guide-pin.${name}`, new T.CylinderGeometry(.043, .043, .012, 24), chrome);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, y, .205);
  }
  printLabel(group, 'objects.service.inspection-mark', 'FV  /  SERVICE 01', .225, 1.25, .91, .073, .208, '#9daebc', '600 78px Arial, sans-serif');

  // A captive vertical hinge carries the entire frame-shaped enamel lid. The
  // inverse-positioned content keeps its closed position exactly unchanged.
  const hinge = new T.Group();
  hinge.name = 'objects.cover.hinge';
  hinge.position.set(-1.35, 0, .24);
  group.add(hinge);
  const lid = new T.Group();
  lid.name = 'objects.cover.leaf';
  lid.position.set(1.35, 0, -.24);
  hinge.add(lid);
  for (const [index, y] of [-1.15, -.22, .72].entries()) {
    const barrel = addMesh(group, `objects.hinge.barrel.${index}`, new T.CylinderGeometry(.042, .042, .31, 24), chrome);
    barrel.position.set(-1.43, y, .225);
  }
  const hingePin = addMesh(group, 'objects.hinge.pin', new T.CylinderGeometry(.014, .014, 2.30, 16), graphite);
  hingePin.position.set(-1.43, -.2, .225);

  // The enamel is its own solid lid, recessed below the lip when closed.
  addMesh(lid, 'objects.inlay.cobalt-enamel', new T.ExtrudeGeometry(enamelShape, {
    depth: .020, steps: 1, bevelEnabled: true, bevelSize: .012, bevelThickness: .005, bevelSegments: 4, curveSegments: 64
  }), enamel, .219);

  // Small restrained manufacture cues, all above the recessed enamel face.
  const screwMetal = new T.MeshStandardMaterial({ color: '#aebbc9', metalness: 1, roughness: .23 });
  screw(lid, -1.14, 1.51, .255, screwMetal, graphite, 'objects.fastener.top');
  screw(lid, 1.22, -1.38, .255, screwMetal, graphite, 'objects.fastener.bottom');

  // A real inset gauge strip makes the vertical stem useful in close shots.
  const gaugeMetal = new T.MeshPhysicalMaterial({ color: '#b7cadb', metalness: 1, roughness: .25, roughnessMap: sideGrain });
  const gauge = addMesh(lid, 'objects.gauge.satin-rail', new RoundedBoxGeometry(.023, 1.87, .008, 3, .006), gaugeMetal);
  gauge.position.set(-1.17, -.16, .251);
  const tickMetal = new T.MeshStandardMaterial({ color: '#b7c8d8', metalness: .85, roughness: .3 });
  for (let i = 0; i < 9; i++) {
    const y = .63 - i * .20;
    const tick = addMesh(lid, `objects.gauge.tick.${String(i + 1).padStart(2, '0')}`, new T.BoxGeometry(i % 2 ? .058 : .088, .006, .002), tickMetal);
    tick.position.set(-1.035 + (i % 2 ? -.015 : 0), y, .250);
  }
  const index = new T.Mesh(new T.ShapeGeometry(new T.Shape([
    new T.Vector2(-.965, -.15), new T.Vector2(-.885, -.11), new T.Vector2(-.965, -.07)
  ])), new T.MeshStandardMaterial({ color: '#ee5a1d', metalness: .18, roughness: .31, side: T.DoubleSide }));
  index.name = 'objects.gauge.copper-index';
  index.position.z = .252;
  lid.add(index);
  printLabel(lid, 'objects.serial', '01 / COBALT', -.93, -1.52, .62, .075, .251, '#c7d5f8', '600 86px Arial, sans-serif');

  group.userData.update = (time, { amount = 1 } = {}) => {
    const open = smoothBetween(3.5, 4.6, time);
    const close = smoothBetween(4.92, 5.30, time);
    const state = Math.max(0, open - close) * Math.max(0, Math.min(1.5, amount));
    hinge.position.z = .24 + .078 * state;
    hinge.rotation.y = -.82 * state;
  };
  group.userData.update(0);

  return group;
}
