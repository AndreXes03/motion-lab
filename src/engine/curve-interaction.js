/** Move a selection as one rigid group; never cross an unselected neighbour. */
export function moveCurveSelection(keys, indices, dt, dv = 0, {minTime = 0, maxTime, minValue = -Infinity, maxValue = Infinity, step = 0, anchor = indices[0]} = {}) {
  const selected = new Set(indices), epsilon = 1e-5;
  if (!selected.size) return structuredClone(keys);
  if (step > 0) dt = Math.round((keys[anchor].t + dt) / step) * step - keys[anchor].t;
  let low = -Infinity, high = Infinity, valueLow = -Infinity, valueHigh = Infinity;
  for (const index of selected) {
    const key = keys[index];
    low = Math.max(low, minTime - key.t); high = Math.min(high, maxTime - key.t);
    if (index && !selected.has(index - 1)) low = Math.max(low, keys[index - 1].t + epsilon - key.t);
    if (index < keys.length - 1 && !selected.has(index + 1)) high = Math.min(high, keys[index + 1].t - epsilon - key.t);
    valueLow = Math.max(valueLow, minValue - key.value); valueHigh = Math.min(valueHigh, maxValue - key.value);
  }
  dt = Math.max(low, Math.min(high, dt)); dv = Math.max(valueLow, Math.min(valueHigh, dv));
  const round = n => Number(n.toFixed(6));
  return keys.map((key, index) => selected.has(index) ? {...structuredClone(key), t: round(key.t + dt), value: round(key.value + dv)} : structuredClone(key));
}
