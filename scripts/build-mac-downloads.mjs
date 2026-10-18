#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_COMMIT, SOURCE_DEPTH, SOURCE_URL, VARIANTS } from '../installers/macos/install.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out' || !path.isAbsolute(args[1]))) throw Error('Uso: node scripts/build-mac-downloads.mjs [--out /cartella/assoluta]');
const output = args[1] || path.join(root, 'outputs/downloads');
const crc32 = data => {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
};
// Small deterministic ZIP archives with Unix executable bits; no external ZIP tool/dependency.
function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const { name, body, mode = 0o100644 } of entries) {
    const filename = Buffer.from(name), data = Buffer.from(body), packed = deflateRawSync(data), crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, packed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x314, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(8, 10); directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(packed.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE((mode << 16) >>> 0, 38); directory.writeUInt32LE(offset, 42);
    central.push(directory, filename); offset += header.length + filename.length + packed.length;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}
await mkdir(output, { recursive: true });
const installer = await readFile(path.join(root, 'installers/macos/install.mjs'));
const readme = await readFile(path.join(root, 'installers/macos/LEGGIMI.txt'));
const assets = [];
for (const variant of VARIANTS) {
  const folder = 'Motion Lab ' + variant + ' macOS beta/';
  const shell = '#!/bin/sh\nPATH="/opt/homebrew/bin:/usr/local/bin:$PATH"\nexport PATH\ncd "$(dirname "$0")" || exit 1\nif ! command -v node >/dev/null 2>&1; then\n  echo "Serve Node.js >=22.12 da nodejs.org. Nessuna installazione eseguita."\n  printf "Premi Invio per chiudere. "; read -r answer; exit 1\nfi\nnode "./install.mjs" --variant ' + variant + ' "$@"\nresult=$?\nprintf "\\nPremi Invio per chiudere. "; read -r answer\nexit "$result"\n';
  const archive = zip([
    { name: folder + 'Installa Motion Lab.command', body: shell, mode: 0o100755 },
    { name: folder + 'install.mjs', body: installer },
    { name: folder + 'LEGGIMI.txt', body: readme },
    { name: folder + 'SOURCE.json', body: JSON.stringify({ schemaVersion: 1, variant, repository: SOURCE_URL, sourceCommit: SOURCE_COMMIT, sourceDepth: SOURCE_DEPTH, node: '>=22.12', platform: 'macOS', standalone: false }, null, 2) + '\n' },
  ]);
  const file = 'motion-lab-' + variant + '-macos-beta.zip';
  await writeFile(path.join(output, file), archive);
  assets.push({ file, variant, bytes: archive.length, sha256: createHash('sha256').update(archive).digest('hex'), sourceCommit: SOURCE_COMMIT });
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ schemaVersion: 1, sourceCommit: SOURCE_COMMIT, sourceDepth: SOURCE_DEPTH, assets }, null, 2) + '\n');
await writeFile(path.join(output, 'SHA256SUMS'), assets.map(a => a.sha256 + '  ' + a.file).join('\n') + '\n');
console.log('Download creati in ' + output + '\n' + assets.map(a => a.file + ': ' + a.bytes + ' bytes').join('\n'));
