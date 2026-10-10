import * as T from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';

const DOME = .76;
const ROUNDING = .55;

function bodyShape() {
  const shape = new T.Shape();
  shape.moveTo(-1.48, -1.55);
  shape.bezierCurveTo(-1.55, -.7, -1.57, 1.3, -1.31, 1.69);
  shape.bezierCurveTo(-1.1, 2.04, -.64, 2.05, -.44, 1.72);
  shape.bezierCurveTo(-.31, 1.51, -.35, 1.08, -.34, .75);
  shape.bezierCurveTo(.2, .98, .79, .9, 1.2, .58);
  shape.bezierCurveTo(1.72, .18, 1.81, -.46, 1.65, -1.15);
  shape.bezierCurveTo(1.47, -1.84, .81, -1.97, .10, -1.95);
  shape.bezierCurveTo(-.62, -1.96, -1.27, -1.91, -1.48, -1.55);
  const opening = new T.Path();
  opening.moveTo(-.31, -.57);
  opening.bezierCurveTo(-.32, -.74, -.10, -.86, .19, -.85);
  opening.bezierCurveTo(.49, -.87, .61, -.73, .60, -.53);
  opening.bezierCurveTo(.60, -.34, .43, -.28, .19, -.30);
  opening.bezierCurveTo(-.08, -.28, -.32, -.39, -.31, -.57);
  shape.holes.push(opening);
  return shape;
}

function closestDistance(x, y, contours) {
  let best = Infinity;
  for (const contour of contours) {
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], b = contour[(i + 1) % contour.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const px = x - (a.x + u * dx), py = y - (a.y + u * dy);
      best = Math.min(best, px * px + py * py);
    }
  }
  return Math.sqrt(best);
}

function makeDistanceField(contours) {
  const nx = 190, ny = 230, minX = -1.75, maxX = 1.95, minY = -2.17, maxY = 2.16;
  let values = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = minX + i * (maxX - minX) / (nx - 1);
    const y = minY + j * (maxY - minY) / (ny - 1);
    values[j * nx + i] = closestDistance(x, y, contours);
  }
  // Smoothing the distance field removes medial-axis ridges that otherwise
  // make the inflated face look like a set of triangular plastic panels.
  const kernel = [1, 4, 6, 4, 1];
  for (let pass = 0; pass < 5; pass++) {
    let next = new Float32Array(values.length);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) sum += kernel[k + 2] * values[j * nx + Math.max(0, Math.min(nx - 1, i + k))];
      next[j * nx + i] = sum / 16;
    }
    values = next;
    next = new Float32Array(values.length);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) sum += kernel[k + 2] * values[Math.max(0, Math.min(ny - 1, j + k)) * nx + i];
      next[j * nx + i] = sum / 16;
    }
    values = next;
  }
  return { nx, ny, minX, maxX, minY, maxY, values };
}

function inflation(x, y, contours) {
  const field = contours.field;
  const gx = Math.max(0, Math.min(field.nx - 1, (x - field.minX) * (field.nx - 1) / (field.maxX - field.minX)));
  const gy = Math.max(0, Math.min(field.ny - 1, (y - field.minY) * (field.ny - 1) / (field.maxY - field.minY)));
  const i = Math.floor(gx), j = Math.floor(gy), a = gx - i, b = gy - j;
  const at = (xx, yy) => field.values[Math.max(0, Math.min(field.ny - 1, yy)) * field.nx + Math.max(0, Math.min(field.nx - 1, xx))];
  const cubic = (p0, p1, p2, p3, t) => p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const row = yy => cubic(at(i - 1, yy), at(i, yy), at(i + 1, yy), at(i + 2, yy), a);
  const distance = cubic(row(j - 1), row(j), row(j + 1), row(j + 2), b);
  const d = Math.max(0, distance - .018);
  return DOME * Math.tanh(d / ROUNDING);
}

function inflatedGeometry(shape, contours) {
  const flat = new T.ShapeGeometry(shape, 48);
  flat.deleteAttribute('normal');
  const dense = new TessellateModifier(.085, 15).modify(flat);
  flat.dispose();
  const source = dense.getAttribute('position');
  const sourceUV = dense.getAttribute('uv');
  const positions = [], uvs = [], normals = [];
  for (let i = 0; i < source.count; i += 3) {
    const vertices = [];
    for (let j = 0; j < 3; j++) {
      const n = i + j;
      const x = source.getX(n), y = source.getY(n);
      const z = inflation(x, y, contours);
      const dx = (inflation(x + .018, y, contours) - inflation(x - .018, y, contours)) / .036;
      const dy = (inflation(x, y + .018, contours) - inflation(x, y - .018, contours)) / .036;
      const normal = new T.Vector3(-dx, -dy, 1).normalize();
      vertices.push({ x, y, u: sourceUV.getX(n), v: sourceUV.getY(n), z, normal });
    }
    for (const v of vertices) {
      positions.push(v.x, v.y, v.z);
      uvs.push(v.u, v.v);
      normals.push(v.normal.x, v.normal.y, v.normal.z);
    }
    for (const v of [vertices[2], vertices[1], vertices[0]]) {
      positions.push(v.x, v.y, -v.z);
      uvs.push(v.u, v.v);
      normals.push(v.normal.x, v.normal.y, -v.normal.z);
    }
  }
  dense.dispose();
  const shell = new T.BufferGeometry();
  shell.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  shell.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  shell.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  shell.computeBoundingBox();
  shell.computeBoundingSphere();
  return shell;
}

function seededNoise() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  let seed = 0xB0A110;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const low = document.createElement('canvas');
  low.width = low.height = 36;
  const lowContext = low.getContext('2d');
  const lowPixels = lowContext.createImageData(36, 36);
  for (let i = 0; i < lowPixels.data.length; i += 4) {
    const value = 190 + Math.floor(random() * 58);
    lowPixels.data[i] = lowPixels.data[i + 1] = lowPixels.data[i + 2] = value;
    lowPixels.data[i + 3] = 255;
  }
  lowContext.putImageData(lowPixels, 0, 0);
  context.imageSmoothingEnabled = true;
  context.filter = 'blur(7px)';
  context.drawImage(low, -12, -12, 280, 280);
  context.filter = 'none';
  const pixels = context.getImageData(0, 0, 256, 256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const value = Math.max(165, Math.min(245, pixels.data[i] + (seed % 21) - 10));
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  return texture;
}

function surfaceDecal(name, width, height, x, y, contours, paint, nx = 32, ny = 12, lift = .012) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(1024 * height / width);
  const context = canvas.getContext('2d');
  paint(context, canvas.width, canvas.height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  const geometry = new T.PlaneGeometry(width, height, nx, ny);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const px = x + position.getX(i), py = y + position.getY(i);
    position.setXYZ(i, px, py, inflation(px, py, contours) + lift);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  const material = new T.MeshStandardMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, roughness: .65, metalness: 0, side: T.DoubleSide });
  const decal = new T.Mesh(geometry, material);
  decal.name = name;
  decal.renderOrder = 4;
  return decal;
}

function seam(contour, name, material, radius = .024) {
  const points = contour.map(p => new T.Vector3(p.x, p.y, 0));
  const curve = new T.CatmullRomCurve3(points, true, 'centripetal');
  const mesh = new T.Mesh(new T.TubeGeometry(curve, contour.length * 2, radius, 7, true), material);
  mesh.name = name;
  return mesh;
}

export function createBaxPlush() {
  const group = new T.Group();
  group.name = 'bax.plush';
  group.userData.kind = 'inflatable-3d';
  const shape = bodyShape();
  const contours = [shape.getPoints(56), ...shape.holes.map(hole => hole.getPoints(56))];
  contours.field = makeDistanceField(contours);
  const mottle = seededNoise();
  const colorMottle = mottle.clone();
  colorMottle.colorSpace = T.SRGBColorSpace;
  colorMottle.needsUpdate = true;
  const shell = new T.MeshPhysicalMaterial({
    color: '#3556f9', map: colorMottle,
    metalness: 0, roughness: .88, roughnessMap: mottle,
    clearcoat: .035, clearcoatRoughness: .88,
    sheen: .16, sheenColor: '#718bff', sheenRoughness: .95,
    bumpMap: mottle, bumpScale: .014,
    side: T.DoubleSide
  });
  const body = new T.Mesh(inflatedGeometry(shape, contours), shell);
  body.name = 'bax.body';
  body.castShadow = true;
  body.receiveShadow = false;
  group.add(body);
  const weldMaterial = new T.MeshPhysicalMaterial({ color: '#314ce3', metalness: 0, roughness: .78 });
  group.add(seam(contours[0], 'bax.seam.outer', weldMaterial));
  group.add(seam(contours[1], 'bax.seam.inner', weldMaterial, .018));
  const wrinkleMaterial = new T.MeshStandardMaterial({ color: '#2444c8', roughness: .92 });
  for (let i = 0; i < 13; i++) {
    const x = -1.30 + i * .175;
    const y = -1.78 + .025 * Math.sin(i * 2.3);
    const points = [
      new T.Vector3(x, y, inflation(x, y, contours) + .009),
      new T.Vector3(x + .015, y + .055, inflation(x + .015, y + .055, contours) + .009),
      new T.Vector3(x + .035 + .018 * Math.sin(i), y + .12 + .04 * Math.sin(i * 1.8), inflation(x + .035, y + .12, contours) + .009)
    ];
    const wrinkle = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 8, .0045, 4, false), wrinkleMaterial);
    wrinkle.name = `bax.wrinkle.${i}`;
    group.add(wrinkle);
  }

  // A small capped inflation valve sits on the underside, behind the print.
  const valveMaterial = new T.MeshPhysicalMaterial({ color: '#1b349e', roughness: .4, clearcoat: .25 });
  const valve = new T.Mesh(new T.CylinderGeometry(.085, .09, .11, 20), valveMaterial);
  valve.name = 'bax.valve';
  valve.position.set(-1.06, -1.97, -.09);
  group.add(valve);
  const valveLip = new T.Mesh(new T.TorusGeometry(.088, .012, 6, 24), weldMaterial);
  valveLip.name = 'bax.valve.lip';
  valveLip.position.set(-1.06, -2.025, -.09);
  valveLip.rotation.x = Math.PI / 2;
  group.add(valveLip);

  group.add(surfaceDecal('bax.patch.smile', .72, .72, -.97, 1.33, contours, (ctx, w, h) => {
    const silver = ctx.createLinearGradient(0, 0, w, h);
    silver.addColorStop(0, '#ffffff'); silver.addColorStop(.3, '#aebcc6'); silver.addColorStop(.55, '#f6f8f4'); silver.addColorStop(1, '#8b9ba5');
    ctx.fillStyle = silver; ctx.strokeStyle = '#182f8c'; ctx.lineWidth = 20;
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * .43, h * .42, -.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#15233c';
    ctx.beginPath(); ctx.ellipse(w * .42, h * .39, 22, 47, -.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * .59, h * .37, 20, 44, -.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * .52, h * .47, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * .29, h * .59); ctx.quadraticCurveTo(w * .54, h * .82, w * .76, h * .55);
    ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.strokeStyle = '#17243e'; ctx.stroke();
  }, 28, 28, .046));
  group.add(surfaceDecal('bax.brand', 1.74, .44, .42, .48, contours, (ctx, w, h) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'italic 900 165px "Arial Rounded MT Bold", Arial, sans-serif';
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#f8faff'; ctx.lineWidth = 25;
    ctx.strokeText('baxstudio', w / 2, h / 2 + 7, w * .92);
    ctx.fillStyle = '#183cbf'; ctx.fillText('baxstudio', w / 2, h / 2 + 7, w * .92);
  }, 48, 12));
  group.add(surfaceDecal('bax.patch.orbit', .52, .53, -1.00, -.49, contours, (ctx, w, h) => {
    ctx.strokeStyle = '#fff2fa'; ctx.lineWidth = 42;
    ctx.beginPath(); ctx.ellipse(w * .5, h * .5, w * .33, h * .15, -.62, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#f5a8d9'; ctx.lineWidth = 24;
    ctx.beginPath(); ctx.ellipse(w * .5, h * .5, w * .17, h * .35, .50, 0, Math.PI * 2); ctx.stroke();
  }, 32, 12, .038));
  group.add(surfaceDecal('bax.patch.star', .43, .43, -1.03, -1.40, contours, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2); ctx.rotate(-.18); ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 ? w * .15 : w * .38;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = '#111a32'; ctx.fill(); ctx.strokeStyle = '#f6f6ec'; ctx.lineWidth = 33; ctx.stroke();
  }, 32, 12, .038));
  group.add(surfaceDecal('bax.patch.globe', .69, .69, .49, -1.41, contours, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = w * .42;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#d8e4e1'; ctx.fill();
    ctx.lineWidth = 23; ctx.strokeStyle = '#162743'; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 10, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = '#243b51'; ctx.lineWidth = 16;
    for (const s of [-.5, 0, .5]) {
      ctx.beginPath(); ctx.ellipse(cx + s * r, cy, r * (.55 - Math.abs(s) * .3), r * 1.15, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const y of [-.43, .05, .43]) {
      ctx.beginPath(); ctx.ellipse(cx, cy + y * r, r * 1.13, r * .20, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }, 28, 28));

  group.add(surfaceDecal('bax.patch.sparkle', .40, .26, .99, -.99, contours, (ctx, w, h) => {
    ctx.fillStyle = '#f0f3ef';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * .43, h * .40, .25, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2745ba'; ctx.lineWidth = 18; ctx.stroke();
    ctx.fillStyle = '#2e4fe0'; ctx.beginPath();
    ctx.moveTo(w * .5, h * .18); ctx.quadraticCurveTo(w * .54, h * .5, w * .78, h * .50);
    ctx.quadraticCurveTo(w * .54, h * .55, w * .5, h * .83);
    ctx.quadraticCurveTo(w * .47, h * .55, w * .22, h * .5);
    ctx.quadraticCurveTo(w * .47, h * .46, w * .5, h * .18); ctx.fill();
  }));

  const chromeEdge = new T.MeshPhysicalMaterial({ color: '#f0f2f2', metalness: .6, roughness: .27, clearcoat: .3 });
  const chromeFace = new T.MeshPhysicalMaterial({ color: '#7e8c98', metalness: .8, roughness: .39 });
  const sideBadge = new T.Mesh(new T.SphereGeometry(1, 32, 20), chromeEdge);
  sideBadge.name = 'bax.patch.side-oval.rim';
  sideBadge.position.set(1.63, -1.10, -.02);
  sideBadge.scale.set(.072, .37, .27);
  group.add(sideBadge);
  const sideInset = new T.Mesh(new T.SphereGeometry(1, 32, 20), chromeFace);
  sideInset.name = 'bax.patch.side-oval';
  sideInset.position.set(1.686, -1.10, -.02);
  sideInset.scale.set(.040, .32, .22);
  group.add(sideInset);

  group.userData.bounds = { min: [-1.6, -2.1, -.78], max: [1.81, 2.05, .78], front: '+Z' };
  return group;
}
