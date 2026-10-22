#!/usr/bin/env node
// Build-machine tooling only. End users receive the complete prebuilt archive.
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access,cp,mkdir,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const INSTALL=path.resolve(ROOT,'../outputs/cycles-native/install');
const lock=JSON.parse(await readFile(path.join(ROOT,'native/cycles/lock.json'),'utf8'));
const args=process.argv.slice(2),index=args.indexOf('--output');
if(index<0||!args[index+1])throw Error('Pass --output with a destination outside the source checkout.');
const output=path.resolve(args[index+1]),archive=output+'.tar.gz';
if(output===ROOT||output.startsWith(ROOT+path.sep))throw Error('Choose an output outside the source checkout.');
if(args.includes('--stable'))throw Error('Publish only after verifying the final archive download and macOS approval; packaging does not certify a stable release.');
for(const file of [output,archive]){try{await access(file);throw Error('Destination already exists: '+file);}catch(error){if(error.code!=='ENOENT')throw error;}}
const provenance=JSON.parse(await readFile(path.join(INSTALL,'color/license-provenance.json'),'utf8'));
if(provenance.notice?.status!=='verified')throw Error('Color-data redistribution provenance is unresolved.');
const oiio=JSON.parse(await readFile(path.join(INSTALL,'oiio-provenance.json'),'utf8'));
if(oiio.status!=='verified'||oiio.codecSymbolGate!=='passed')throw Error('Minimal image library redistribution gate is unresolved.');
for(const file of oiio.files){if(createHash('sha256').update(await readFile(path.join(INSTALL,file.path))).digest('hex')!==file.sha256)throw Error('Image library differs from the verified build: '+file.path);}
const stage=output+'.staging-'+process.pid,app=path.join(stage,'Rendering Cycles.app'),contents=path.join(app,'Contents'),runtime=path.join(contents,'Resources/runtime');
await mkdir(path.join(contents,'MacOS'),{recursive:true});await mkdir(runtime,{recursive:true});
try{
 for(const item of ['framevolve-cycles','lib','source/kernel','source/util','color','license'])await cp(path.join(INSTALL,item),path.join(runtime,item),{recursive:true,dereference:true});
 await cp(path.join(INSTALL,'oiio-provenance.json'),path.join(runtime,'license/oiio-build-provenance.json'));
 await cp(path.join(ROOT,'native/cycles/licenses'),path.join(runtime,'license/Framevolve-Cycles'),{recursive:true});
 await cp(path.join(ROOT,'LICENSE'),path.join(runtime,'license/FRAMEVOLVE-LICENSE.txt'));
 await cp(path.join(ROOT,'licenses/legacy/MIT.txt'),path.join(runtime,'license/FRAMEVOLVE-LEGACY-MIT.txt'));
 await run('/usr/bin/clang',['-fobjc-arc','-fblocks','-framework','Cocoa','-mmacosx-version-min=14.0','-arch','arm64',path.join(ROOT,'native/cycles/authorize.m'),'-o',path.join(contents,'MacOS/Rendering Cycles')]);
 const plist={CFBundleName:'Rendering Cycles',CFBundleDisplayName:'Rendering Cycles',CFBundleExecutable:'Rendering Cycles',CFBundleIdentifier:'com.framevolve.rendering-cycles',CFBundlePackageType:'APPL',CFBundleVersion:'1',CFBundleShortVersionString:lock.version,LSMinimumSystemVersion:'14.0',LSUIElement:true,FramevolveCyclesRevision:lock.revision};
 await run('/usr/bin/python3',['-c','import json,plistlib,sys;plistlib.dump(json.loads(sys.argv[1]),open(sys.argv[2],"wb"))',JSON.stringify(plist),path.join(contents,'Info.plist')]);
 // Ad-hoc integrity signature required for native Apple Silicon code; no Developer ID.
 // The downloader retains quarantine and requires explicit normal macOS authorization.
 await run('/usr/bin/codesign',['--force','--deep','--sign','-',app]);
 await run('/usr/bin/codesign',['--verify','--deep','--strict',app]);
 const files=[];let installedBytes=0;
 async function walk(dir,rel=''){
  for(const ent of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const name=path.posix.join(rel,ent.name),file=path.join(dir,ent.name);
   if(ent.isDirectory())await walk(file,name);
   else if(ent.isFile()){const bytes=await readFile(file);installedBytes+=bytes.length;files.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex')});}
   else throw Error('Archive must not contain symbolic links or special files: '+name);
  }
 }
 await walk(stage);
 await writeFile(path.join(stage,'component.json'),JSON.stringify({schema:1,protocol:lock.protocol,revision:lock.revision,version:lock.version,platform:'darwin-arm64',security:'manual-macos',signed:false,notarized:false,color:lock.color,files},null,2)+'\n');
 await rename(stage,output);
 await run('/usr/bin/python3',['-c',`import gzip,tarfile,sys,os
with open(sys.argv[2],'wb') as raw:
 with gzip.GzipFile(fileobj=raw,mode='wb',mtime=0) as gz:
  with tarfile.open(fileobj=gz,mode='w',format=tarfile.USTAR_FORMAT,dereference=True) as tar:
   for root,dirs,files in os.walk(sys.argv[1]):
    dirs.sort()
    for name in sorted(files):
     full=os.path.join(root,name);info=tar.gettarinfo(full,os.path.relpath(full,sys.argv[1]));info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
     with open(full,'rb') as data:tar.addfile(info,data)
`,output,archive],{maxBuffer:1024*1024});
 const bytes=await readFile(archive);
 const entry={platform:'darwin-arm64',protocol:lock.protocol,revision:lock.revision,version:lock.version,format:'tar.gz',security:'manual-macos',signed:false,notarized:false,channel:'preview',tested:false,validatedScenes:['pulse','loop'],bytes:bytes.length,installedBytes:installedBytes+1024*1024,sha256:createHash('sha256').update(bytes).digest('hex')};
 await writeFile(output+'.release.json',JSON.stringify(entry,null,2)+'\n');
 console.log(JSON.stringify({archive,...entry},null,2));
}catch(error){await rm(stage,{recursive:true,force:true});throw error;}
