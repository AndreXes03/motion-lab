/** Exact preview identity. Time is deliberately not rounded to frame buckets. */
export function previewFrameKey({scene, revision, time, width, height, quality = 'full', review = 'beauty'} = {}) {
  if (typeof scene !== 'string' || !scene || !['string','number'].includes(typeof revision) || !Number.isFinite(time) || !Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1 || typeof quality !== 'string' || typeof review !== 'string') {
    throw new TypeError('A preview key requires scene, recipe revision, exact time, dimensions and quality.');
  }
  if (typeof revision === 'number' && !Number.isFinite(revision)) throw new TypeError('Preview revision must be finite.');
  return JSON.stringify([scene, revision, Object.is(time, -0) ? '-0' : time, width, height, quality, review]);
}

function copyCanvas(source) {
  if (!source || !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height) || source.width < 1 || source.height < 1) throw new TypeError('Preview frames must have positive integer dimensions.');
  const target = document.createElement('canvas');
  target.width = source.width; target.height = source.height;
  const context = target.getContext('2d');
  if (!context) throw new Error('Preview frame copying is unavailable.');
  context.drawImage(source, 0, 0);
  return target;
}
const releaseCanvas = frame => { if (frame?.getContext) { frame.width = 1; frame.height = 1; } else frame?.close?.(); };

/**
 * Bounded LRU of independent frame snapshots. Both writes and reads copy pixels:
 * rendering into the live canvas or drawing into a returned frame cannot corrupt
 * another cache entry. A caller may retain a returned frame across eviction.
 */
export function createPreviewFrameCache({maxEntries = 48, maxBytes = 48 * 1024 * 1024, cloneFrame = copyCanvas, releaseFrame = releaseCanvas} = {}) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 0 || !Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('Preview cache limits must be nonnegative safe integers.');
  const frames = new Map();
  let bytes = 0, hits = 0, misses = 0, disposed = false;
  function remove(key) {
    const entry = frames.get(key);
    if (!entry) return;
    frames.delete(key); bytes -= entry.bytes; releaseFrame(entry.frame);
  }
  function clear() { for (const key of [...frames.keys()]) remove(key); }
  return {
    get(key) {
      if (disposed || !frames.has(key)) { misses++; return null; }
      const entry = frames.get(key);
      // Clone before changing LRU order, so a failed copy does not count as a hit.
      const frame = cloneFrame(entry.frame);
      frames.delete(key); frames.set(key, entry); hits++;
      return frame;
    },
    has: key => !disposed && frames.has(key),
    set(key, frame, {bytes: frameBytes = frame?.width * frame?.height * 4} = {}) {
      if (disposed) return false;
      if (typeof key !== 'string' || !Number.isSafeInteger(frameBytes) || frameBytes < 1) throw new TypeError('Preview entries need a string key and a positive safe byte size.');
      if (!maxEntries || frameBytes > maxBytes) { remove(key); return false; }
      const snapshot = cloneFrame(frame);
      remove(key);
      frames.set(key, {frame: snapshot, bytes: frameBytes}); bytes += frameBytes;
      while (frames.size > maxEntries || bytes > maxBytes) remove(frames.keys().next().value);
      return true;
    },
    clear,
    dispose() { clear(); disposed = true; },
    get stats() { return {entries: frames.size, bytes, hits, misses, maxEntries, maxBytes}; }
  };
}
