import * as T from 'three';

function lattice(seed, x, y, size) {
  x = (x % size + size) % size;
  y = (y % size + size) % size;
  let n = Math.imul(x + seed, 0x45d9f3b) ^ Math.imul(y + seed, 0x27d4eb2d);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n ^= n >>> 16;
  return (n >>> 0) / 2147483647.5 - 1;
}

function valueNoise(seed, x, y, size, grid) {
  const gx = x / size * grid, gy = y / size * grid;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  const fx = gx - ix, fy = gy - iy;
  const smooth = t => t * t * (3 - 2 * t);
  const sx = smooth(fx), sy = smooth(fy);
  const a = lattice(seed, ix, iy, grid) * (1 - sx) + lattice(seed, ix + 1, iy, grid) * sx;
  const b = lattice(seed, ix, iy + 1, grid) * (1 - sx) + lattice(seed, ix + 1, iy + 1, grid) * sx;
  return a * (1 - sy) + b * sy;
}

function makeMap(pixels, size, repeat) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0, p = 0; i < pixels.length; i++, p += 4) {
    const v = pixels[i];
    data[p] = data[p + 1] = data[p + 2] = v;
    data[p + 3] = 255;
  }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat, T.UnsignedByteType);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = T.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Seamless seeded multiscale microfinish for close-up plastics and enamel.
 *  Returns grayscale height and roughness maps; it never changes geometry.
 */
export function createMicroSurfaceMaps({
  seed = 1,
  resolution = 512,
  repeat = [2, 2],
  heightAmplitude = 5,
  roughnessBase = 236,
  roughnessAmplitude = 5
} = {}) {
  const size = Math.max(128, Math.min(1024, Math.round(resolution)));
  const octaveGrids = [3, 12, 48, 192];
  const octaveWeights = [0.45, 0.29, 0.18, 0.08];
  const height = new Uint8Array(size * size);
  const roughness = new Uint8Array(size * size);
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i++) {
    let h = 0, r = 0;
    for (let o = 0; o < octaveGrids.length; o++) {
      const grid = octaveGrids[o], weight = octaveWeights[o];
      h += valueNoise(seed, x, y, size, grid) * weight;
      r += valueNoise(seed ^ 0x5bd1e995, x, y, size, grid) * weight;
    }
    height[i] = Math.max(0, Math.min(255, Math.round(128 + h * heightAmplitude)));
    roughness[i] = Math.max(0, Math.min(255, Math.round(roughnessBase + r * roughnessAmplitude)));
  }
  return {
    bumpMap: makeMap(height, size, repeat),
    roughnessMap: makeMap(roughness, size, repeat)
  };
}
