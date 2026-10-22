#!/usr/bin/env node
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access,cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execFileAsync=promisify(execFile);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const WORK=path.resolve(ROOT,'../outputs/cycles-native');
const LOCK=JSON.parse(await readFile(path.join(ROOT,'native/cycles/lock.json'),'utf8'));
const SOURCE=path.join(WORK,'source');
const BUILD=path.join(WORK,'build');
const INSTALL=path.join(WORK,'install');
const TOOLBIN=path.join(WORK,'tooling/bin');
const HOST=path.join(ROOT,'native/cycles/host.cmake');
const DRIVER=path.join(ROOT,'native/cycles/framevolve.cpp');
const patches=[
  {
    file:'src/app/CMakeLists.txt',
    anchor:'  install(\n    TARGETS cycles_precompute\n    DESTINATION ${app_install_dir})\nendif()\n',
    replacement:'  install(\n    TARGETS cycles_precompute\n    DESTINATION ${app_install_dir})\nendif()\n\n# Framevolve direct API host\ninclude("${FRAMEVOLVE_HOST_CMAKE}")\n',
  },
  {
    file:'src/app/cycles_xml.cpp',
    anchor:'  object->set_geometry(light);\n\n  xml_read_node(state, light, node);',
    replacement:'  object->set_geometry(light);\n\n  // Framevolve: transfer explicit light object motion through Cycles node sockets.\n  xml_read_node(state, object, node);\n  xml_read_node(state, light, node);',
  },
];

async function run(program,args,opts={}){
  try{
    const result=await execFileAsync(program,args,{maxBuffer:16*1024*1024,...opts});
    if(result.stdout.trim()) process.stdout.write(result.stdout);
    if(result.stderr.trim()) process.stderr.write(result.stderr);
    return result.stdout+result.stderr;
  }catch(error){
    if(error.stdout) process.stderr.write(error.stdout);
    if(error.stderr) process.stderr.write(error.stderr);
    throw new Error(`${program} ${args.join(' ')} failed with exit code ${error.code}`);
  }
}
async function assertExists(file,label){try{await access(file);}catch{throw new Error(`${label} missing: ${file}`);}}
async function gitHead(dir){return (await run('git',['-C',dir,'rev-parse','HEAD'])).trim().split('\n').at(-1);}
async function version(program,args,expected,label){
  const actual=await run(program,args);
  if(!actual.includes(expected)) throw new Error(`${label} must be ${expected}; got ${actual.trim()}`);
}

if(process.platform!=='darwin'||process.arch!=='arm64') throw new Error('This pinned build script currently supports macOS arm64 only.');
for(const [file,label] of [[path.join(SOURCE,'.git'),'Cycles source checkout'],[path.join(SOURCE,'lib/macos_arm64/.git'),'Cycles precompiled library checkout'],[path.join(TOOLBIN,'cmake'),'pinned CMake'],[path.join(TOOLBIN,'ninja'),'pinned Ninja']]) await assertExists(file,label);
const revisions=[
  ['Cycles source',SOURCE,LOCK.revision],
  ['Cycles libraries',path.join(SOURCE,'lib/macos_arm64'),LOCK.libraries['darwin-arm64']],
];
for(const [label,dir,expected] of revisions){const actual=await gitHead(dir);if(actual!==expected)throw new Error(`${label} revision mismatch: expected ${expected}, got ${actual}`);}
await version(path.join(TOOLBIN,'cmake'),['--version'],`cmake version ${LOCK.cmake}`,'CMake');
await version(path.join(TOOLBIN,'ninja'),['--version'],LOCK.ninja,'Ninja');

// Apply only the two exact host-integration patches to pristine pinned source.
for(const patch of patches){
  const file=path.join(SOURCE,patch.file);
  const upstream=(await execFileAsync('git',['-C',SOURCE,'show',`HEAD:${patch.file}`])).stdout;
  const matches=upstream.split(patch.anchor).length-1;
  if(matches!==1) throw new Error(`Expected one pinned patch site in ${patch.file}; found ${matches}`);
  const expected=upstream.replace(patch.anchor,patch.replacement);
  const current=await readFile(file,'utf8');
  if(current===upstream) await writeFile(file,expected);
  else if(current!==expected) throw new Error(`Unexpected edits in pinned source file ${patch.file}; inspect and restore it before building.`);
}
const changed=(await run('git',['-C',SOURCE,'diff','--ignore-submodules=all','--name-only','HEAD'])).trim().split('\n').filter(Boolean).sort();
const expectedChanged=patches.map(p=>p.file).sort();
if(JSON.stringify(changed)!==JSON.stringify(expectedChanged)) throw new Error(`Unexpected tracked source modifications: ${changed.join(', ')||'(none)'}`);

const cmake=path.join(TOOLBIN,'cmake');
const common=[
  `-DCMAKE_BUILD_TYPE=Release`,
  `-DCMAKE_OSX_ARCHITECTURES=arm64`,
  `-DCMAKE_OSX_DEPLOYMENT_TARGET=14.0`,
  `-DCMAKE_MAKE_PROGRAM=${path.join(TOOLBIN,'ninja')}`,
  `-DCMAKE_INSTALL_PREFIX=${INSTALL}`,
  `-DWITH_LIBS_PRECOMPILED=ON`,
  `-DWITH_CYCLES_DEVICE_METAL=ON`,
  `-DWITH_CYCLES_EMBREE=ON`,
  `-DWITH_CYCLES_OPENIMAGEDENOISE=ON`,
  `-DWITH_CYCLES_PUGIXML=ON`,
  `-DWITH_CYCLES_OPENVDB=OFF`,
  `-DWITH_CYCLES_OSL=OFF`,
  `-DWITH_CYCLES_OPENSUBDIV=OFF`,
  `-DWITH_CYCLES_USD=OFF`,
  `-DWITH_CYCLES_ALEMBIC=OFF`,
  `-DWITH_CYCLES_STANDALONE_GUI=OFF`,
  `-DWITH_CYCLES_HYDRA_RENDER_DELEGATE=OFF`,
  `-DWITH_CYCLES_LOGGING=OFF`,
  `-DWITH_CYCLES_NANOVDB=OFF`,
  `-DWITH_CYCLES_PARALLEL_DEVICE_KERNEL_BUILD=OFF`,
  `-DWITH_CYCLES_NATIVE_ONLY=OFF`,
  `-DWITH_STRICT_BUILD_OPTIONS=ON`,
  `-DFRAMEVOLVE_HOST_CMAKE=${HOST}`,
  `-DFRAMEVOLVE_HOST_SOURCE=${DRIVER}`,
];
await run(cmake,['-S',SOURCE,'-B',BUILD,'-G','Ninja',...common]);
await run(path.join(TOOLBIN,'ninja'),['-C',BUILD,'-j','6','framevolve-cycles']);
await run(cmake,['--install',BUILD]);
await run(process.execPath,[path.join(ROOT,'native/cycles/build-oiio.mjs')]);
await rm(path.join(INSTALL,'color'),{recursive:true,force:true});
await rm(path.join(INSTALL,'license/ocio-license.txt'),{force:true});
await mkdir(path.join(INSTALL,'color'),{recursive:true});
const colorRoot=path.join(ROOT,'native/cycles/color');
const configBytes=await readFile(path.join(colorRoot,'config.ocio'));
const noticeBytes=await readFile(path.join(ROOT,'native/cycles/licenses/OpenColorIO-LICENSE'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha256(configBytes)!==LOCK.colorConfigSha256||sha256(noticeBytes)!==LOCK.colorLicenseSha256) throw new Error('Color config or official notice hash differs from the pinned lock.');
if(configBytes.toString().includes('!<FileTransform>')) throw new Error('Self-contained color config must not reference external LUT files.');
const colorProvenance=JSON.parse(await readFile(path.join(colorRoot,'license-provenance.json'),'utf8'));
if(colorProvenance.configSha256!==LOCK.colorConfigSha256||colorProvenance.notice?.sha256!==LOCK.colorLicenseSha256||colorProvenance.notice?.status!=='verified') throw new Error('Color provenance differs from the pinned lock.');
await cp(colorRoot,path.join(INSTALL,'color'),{recursive:true,force:true});
const noticeSources=JSON.parse(await readFile(path.join(ROOT,'native/cycles/licenses/sources.json'),'utf8'));
for(const notice of noticeSources){
  const source=path.join(ROOT,'native/cycles/licenses',notice.file);
  if(sha256(await readFile(source))!==notice.sha256) throw new Error(`Official dependency notice hash mismatch: ${notice.file}`);
  await cp(source,path.join(INSTALL,'license',notice.file));
}
await cp(path.join(ROOT,'native/cycles/licenses/sources.json'),path.join(INSTALL,'license/notice-sources.json'));
await cp(path.join(ROOT,'native/cycles/licenses/README.md'),path.join(INSTALL,'license/FRAMEVOLVE-NOTICES.md'));
await cp(path.join(ROOT,'native/cycles/licenses/openjph-BSD-2-Clause.txt'),path.join(INSTALL,'license/openjph-BSD-2-Clause.txt'));
await assertExists(path.join(INSTALL,'framevolve-cycles'),'built executable');
await assertExists(path.join(INSTALL,'color/config.ocio'),'pinned color config');
console.log(`Built pinned Cycles ${LOCK.revision} for macOS arm64 at ${INSTALL}`);
