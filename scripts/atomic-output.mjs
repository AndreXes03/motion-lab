import {mkdir, mkdtemp, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

// Stage beside the destination so rename stays atomic on the same filesystem.
// A failed encoder must never truncate an earlier successful delivery.
export async function withAtomicOutput(target, produce) {
  await mkdir(path.dirname(target), {recursive:true});
  const temporary = await mkdtemp(path.join(path.dirname(target), '.motion-output-'));
  const staged = path.join(temporary, path.basename(target));
  try {
    await produce(staged);
    await rename(staged, target);
  } finally {
    await rm(temporary, {recursive:true, force:true});
  }
}

export const writeAtomicOutput = (target, data) => withAtomicOutput(target, staged => writeFile(staged, data));
