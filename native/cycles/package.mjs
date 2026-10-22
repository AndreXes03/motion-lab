#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {access,cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const WORK=path.resolve(ROOT,'../outputs/cycles-native');
const INSTALL=path.join(WORK,'install');
const LOCK=JSON.parse(await readFile(path.join(ROOT,'native/cycles/lock.json'),'utf8'));
const args=process.argv.slice(2);
const option=(name)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const outputArg=option('--output');
const force=args.includes('--force');
if(args.includes('--stable')) throw new Error('Stable packaging is disabled: this script creates an unsigned component directory. A stable release needs a verified Developer ID signature, a stapled notarization ticket and a passing release test record for the final host installer.');
if(args.some(a=>a==='--output'&&!args[args.indexOf(a)+1])) throw new Error('--output requires a destination path.');
const output=outputArg?path.resolve(outputArg):undefined;
if(!output) throw new Error('Pass --output with an absolute or relative destination path. This script does not choose or overwrite a package location.');
if(output===ROOT||output.startsWith(ROOT+path.sep)) throw new Error('Choose an output destination outside the source checkout.');
try{await access(path.join(INSTALL,'framevolve-cycles'));}catch{throw new Error(`Missing native build at ${INSTALL}; run node native/cycles/build.mjs first.`);}
const colorProvenancePath=path.join(INSTALL,'color/license-provenance.json');
let colorProvenance;
try{colorProvenance=JSON.parse(await readFile(colorProvenancePath,'utf8'));}catch{throw new Error('Color-management redistribution is blocked: build did not record a verified upstream ocio-license.txt notice.');}
if(colorProvenance.notice?.status!=='verified') throw new Error(`Color-management redistribution is blocked: ${colorProvenance.notice?.reason??'upstream license provenance is unresolved.'}`);

const stage=output+'.staging-'+process.pid;
const required=[
  'framevolve-cycles','lib','source/kernel','source/util','color','license',
];
for(const item of required)try{await access(path.join(INSTALL,item));}catch{throw new Error(`Required installed Cycles resource is missing: ${item}`);}
try{await access(output);if(!force)throw new Error(`Destination exists; pass --force to replace it: ${output}`);await rm(output,{recursive:true,force:true});}catch(e){if(e.code!=='ENOENT')throw e;}
await rm(stage,{recursive:true,force:true});
await mkdir(stage,{recursive:true,dereference:true});
try{
  for(const item of required) await cp(path.join(INSTALL,item),path.join(stage,item),{recursive:true,dereference:true});
  const dataLicense=path.join(ROOT,'native/cycles/licenses/ocio-license.txt');
  const openJphLicense=path.join(ROOT,'native/cycles/licenses/openjph-BSD-2-Clause.txt');
  await cp(dataLicense,path.join(stage,'license/ocio-license.txt'));
  await cp(openJphLicense,path.join(stage,'license/openjph-BSD-2-Clause.txt'));
  await cp(path.join(ROOT,'native/cycles/licenses/README.md'),path.join(stage,'license/FRAMEVOLVE-NOTICES.md'));
  await cp(path.join(ROOT,'LICENSE'),path.join(stage,'license/FRAMEVOLVE-LICENSE.txt'));
  await cp(path.join(ROOT,'licenses/legacy/MIT.txt'),path.join(stage,'license/FRAMEVOLVE-LEGACY-MIT.txt'));
  const files=[];
  async function walk(dir,rel=''){
    for(const ent of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const file=path.join(dir,ent.name),name=path.posix.join(rel,ent.name);
      if(ent.isDirectory()) await walk(file,name);
      else if(ent.isFile()) files.push({path:name,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
    }
  }
  await walk(stage);
  const manifest={
    schema:1,status:'experimental',platform:'darwin-arm64',version:LOCK.version,protocol:LOCK.protocol,
    cyclesRevision:LOCK.revision,libraryRevision:LOCK.libraries['darwin-arm64'],colorRevision:LOCK.colorRevision,
    executable:'framevolve-cycles',colorConfig:'color/config.ocio',files,
    release:{signed:false,notarized:false,stable:false},
  };
  await writeFile(path.join(stage,'component.json'),JSON.stringify(manifest,null,2)+'\n');
  await import('node:fs/promises').then(({rename})=>rename(stage,output));
  console.log(`Experimental Cycles component assembled at ${output}`);
}catch(error){await rm(stage,{recursive:true,force:true});throw error;}
