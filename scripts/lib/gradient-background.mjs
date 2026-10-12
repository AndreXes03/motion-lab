import sharp from 'sharp';

const rgb = value => {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw Error('Gradient colors must be #RRGGBB');
  return [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16));
};

/** Fixed dark asymmetric field. No noise, animation, grading or dependence on the foreground. */
export function navyGradientRgba(width, height, { navy = '#081630', edge = '#010207' } = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096)) throw Error('Gradient dimensions must be integers between 1 and 4096');
  const high = rgb(navy), low = rgb(edge), result = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = height === 1 ? 0.5 : y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = width === 1 ? 0.5 : x / (width - 1);
      const radial = Math.exp(-((u - 0.32) ** 2 / 0.15 + (v - 0.28) ** 2 / 0.21) * 2);
      const weight = Math.min(1, 0.88 * radial + 0.08 * (1 - v));
      const offset = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) result[offset + c] = Math.round(low[c] + (high[c] - low[c]) * weight);
      result[offset + 3] = 255;
    }
  }
  return result;
}

export async function navyGradientPng(width, height, options) {
  return sharp(navyGradientRgba(width, height, options), { raw: { width, height, channels: 4 } }).png().toBuffer();
}
