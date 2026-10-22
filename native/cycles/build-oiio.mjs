#!/usr/bin/env node
// Minimize the same-version OpenImageIO dependency to explicitly permitted formats.
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access,cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const WORK=path.resolve(ROOT,'../outputs/cycles-native');
const BASE=path.join(WORK,'oiio-minimal');
const LIBS=path.join(WORK,'source/lib/macos_arm64');
const INSTALL=path.join(WORK,'install');
const LOCK=JSON.parse(await readFile(path.join(ROOT,'native/cycles/lock.json'),'utf8'));
const PIN=LOCK.minimalOpenImageIO;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function run(bin,args){const r=await exec(bin,args,{maxBuffer:16*1024*1024});return r.stdout+r.stderr;}
async function exists(p){try{await access(p);return true;}catch{return false;}}
async function download(url,file,sha){
  if(!await exists(file)) await run('curl',['-fL','--retry','2',url,'-o',file]);
  if(digest(await readFile(file))!==sha)throw new Error(`Pinned source checksum mismatch: ${file}`);
}
await mkdir(BASE,{recursive:true});
await download(PIN.source, path.join(BASE,'source.tar.gz'),PIN.sourceSha256);
await download(PIN.robinMap.source,path.join(BASE,'robin-map.tar.gz'),PIN.robinMap.sha256);
const source=path.join(BASE,`OpenImageIO-${PIN.version}`);
if(!await exists(source)) await run('tar',['-xzf',path.join(BASE,'source.tar.gz'),'-C',BASE]);
const robin=path.join(BASE,`robin-map-${PIN.robinMap.version}`);
if(!await exists(robin)) await run('tar',['-xzf',path.join(BASE,'robin-map.tar.gz'),'-C',BASE]);
await mkdir(path.join(BASE,'tiff-headers'),{recursive:true});
await download(PIN.tiffHeader.source,path.join(BASE,'tiff-headers/tiff.h'),PIN.tiffHeader.sha256);
await writeFile(path.join(BASE,'tiff-headers/tiffconf.h'),'/* EXIF tag declarations only; no libtiff codec or linkage. */\n#pragma once\n#include <stdint.h>\n');
await mkdir(path.join(BASE,'openjph-config'),{recursive:true});
await writeFile(path.join(BASE,'openjph-config/openjphConfig.cmake'),`set(openjph_FOUND TRUE)\nif(NOT TARGET openjph)\nadd_library(openjph SHARED IMPORTED)\nset_target_properties(openjph PROPERTIES IMPORTED_LOCATION "${path.join(LIBS,'openjph/lib/libopenjph.dylib')}")\nendif()\n`);
const options=[
  '-DCMAKE_BUILD_TYPE=Release','-DCMAKE_OSX_ARCHITECTURES=arm64','-DCMAKE_OSX_DEPLOYMENT_TARGET=14.0',
  `-DCMAKE_MAKE_PROGRAM=${path.join(WORK,'tooling/bin/ninja')}`,`-DCMAKE_INSTALL_PREFIX=${path.join(BASE,'install')}`,
  `-DCMAKE_PREFIX_PATH=${['openexr','imath','opencolorio','fmt','png','tbb'].map(p=>path.join(LIBS,p)).join(';')}`,
  `-DROBINMAP_INCLUDE_DIR=${path.join(robin,'include')}`,`-Dopenjph_DIR=${path.join(BASE,'openjph-config')}`,
  `-DCMAKE_CXX_FLAGS=-I${path.join(BASE,'tiff-headers')}`,
  '-DBUILD_SHARED_LIBS=ON','-DOIIO_BUILD_TOOLS=OFF','-DOIIO_BUILD_TESTS=OFF','-DBUILD_TESTING=OFF','-DBUILD_DOCS=OFF','-DINSTALL_DOCS=OFF','-DINSTALL_FONTS=OFF',
  '-DUSE_PYTHON=OFF','-DUSE_QT=OFF','-DEMBEDPLUGINS=ON','-DOpenImageIO_BUILD_MISSING_DEPS=OFF','-DOIIO_BUILD_MISSING_DEPS=OFF',
];
for(const name of await readdir(path.join(source,'src'))){
  if(name.endsWith('.imageio')){const format=name.split('.')[0];options.push(`-DENABLE_${format}=${PIN.formats.includes(format)?'ON':'OFF'}`);}
}
for(const dep of PIN.disabledDependencies)options.push(`-DUSE_${dep}=OFF`);
const cmake=path.join(WORK,'tooling/bin/cmake');
await writeFile(path.join(BASE,'configure.log'),await run(cmake,['-S',source,'-B',path.join(BASE,'build'),'-G','Ninja',...options]));
await writeFile(path.join(BASE,'build.log'),await run(path.join(WORK,'tooling/bin/ninja'),['-C',path.join(BASE,'build'),'-j','6','OpenImageIO','OpenImageIO_Util']));
// Replace just OIIO: never copy the broad upstream codec-enabled dependency.
for(const name of await readdir(path.join(INSTALL,'lib'))){if(/^libOpenImageIO(?:_Util)?(?:\.[\d.]+)?\.dylib$/.test(name))await rm(path.join(INSTALL,'lib',name));}
const files=[];
for(const name of ['libOpenImageIO','libOpenImageIO_Util']){
  const target=path.join(INSTALL,'lib',`${name}.dylib`);
  await cp(path.join(BASE,'build/lib',`${name}.dylib`),target,{dereference:true});
  await run('install_name_tool',['-id',`@rpath/${name}.dylib`,target]);
  const linked=await run('otool',['-L',target]);
  for(const line of linked.split('\n').slice(1)){
    const dep=line.trim().split(' (')[0];
    if(dep.startsWith('/usr/lib/')||dep.startsWith('/System/Library/'))continue;
    const normalized=path.basename(dep).replace(/^(libOpenImageIO(?:_Util)?)\.[\d.]+\.dylib$/,'$1.dylib');
    if(dep!==`@rpath/${normalized}`)await run('install_name_tool',['-change',dep,`@rpath/${normalized}`,target]);
  }
  const load=await run('otool',['-l',target]);
  for(const match of load.matchAll(/cmd LC_RPATH\s+cmdsize \d+\s+path (.*?) \(offset/g)){
    if(match[1].startsWith('/'))await run('install_name_tool',['-delete_rpath',match[1],target]);
  }
  const symbols=await run('nm',['-g',target]);
  if(/_(?:heif_|aom_|de265_|x265_|dav1d_|WebP|TIFFOpen|jpeg_Create|opj_create)/.test(symbols))throw new Error(`Forbidden codec symbols in ${name}`);
  await run('codesign',['--force','--sign','-',target]);
  files.push({path:`lib/${name}.dylib`,sha256:digest(await readFile(target))});
}
await writeFile(path.join(INSTALL,'oiio-provenance.json'),JSON.stringify({status:'verified',version:PIN.version,source:PIN.source,sourceSha256:PIN.sourceSha256,formats:PIN.formats,disabledDependencies:PIN.disabledDependencies,codecSymbolGate:'passed',files},null,2)+'\n');
console.log(`Installed minimal OpenImageIO ${PIN.version}: ${PIN.formats.join(', ')}; forbidden-codec symbol gate passed.`);
