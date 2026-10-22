#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readSetup,resolveBrowser} from './browser-runtime.mjs';
import {launch,parseArgs} from './launch-studio.mjs';
import {startSetup} from './setup-mac.mjs';
import {updateStudio} from './studio-update.mjs';
const args=process.argv.slice(2),forceSetup=args.includes('--setup');
const options=parseArgs(args.filter(arg=>arg!=='--setup'));
try {
  if(options.action==='start'&&process.env.FRAMEVOLVE_UPDATED_ONCE!=='1'){
    const result=await updateStudio({root:options.root});
    if(['recovery-required','updating'].includes(result.state))throw Error(result.note);
    if(result.state==='updated'){
      // Reload the new launcher/setup modules instead of continuing with old imports.
      const child=spawn(process.execPath,[fileURLToPath(import.meta.url),...args],{stdio:'inherit',env:{...process.env,FRAMEVOLVE_UPDATED_ONCE:'1'}});
      const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
      process.exit(code);
    }
  }
  delete process.env.FRAMEVOLVE_UPDATED_ONCE;
  let configured=false;
  try{configured=Boolean((await readSetup(options.root)).completedAt);if(configured)await resolveBrowser({root:options.root});}catch{}
  if(options.action!=='start'||(configured&&!forceSetup))await launch({...options,update:false});
  else await startSetup({root:options.root});
}catch(error){console.error(`Framevolve: ${error.message}`);process.exitCode=1;}
