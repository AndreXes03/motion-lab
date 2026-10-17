#!/usr/bin/env node
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let repo, destination, port=4198;
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  const key=args[i],value=args[++i];
  if(key==='--repo')repo=value;else if(key==='--destination')destination=value;else if(key==='--port')port=Number(value);else throw Error('Use --repo /absolute/repo --destination /absolute/new-snippets [--port 4198].');
}
if(!repo||!path.isAbsolute(repo)||!destination||!path.isAbsolute(destination)||!Number.isInteger(port)||port<1024||port>65535)throw Error('Absolute --repo and --destination required; valid port 1024–65535.');
repo=await realpath(repo);
if(JSON.parse(await readFile(path.join(repo,'package.json'),'utf8')).name!=='motion-lab')throw Error('Not a Motion Lab checkout.');
try{await access(destination);throw Error('Destination already exists. Choose a new directory; no existing config is overwritten.');}catch(error){if(error.code!=='ENOENT')throw error;}
const server=await realpath(fileURLToPath(new URL('../server.mjs',import.meta.url)));
const command=await realpath(process.execPath),serverArgs=[server,'--repo',repo,'--port',String(port)];
const config={mcpServers:{'motion-lab':{type:'stdio',command,args:serverArgs}}};
await mkdir(destination,{recursive:true});
await writeFile(path.join(destination,'mcp.json'),JSON.stringify(config,null,2)+'\n');
await writeFile(path.join(destination,'claude-desktop.json'),JSON.stringify({mcpServers:{'motion-lab':{command,args:serverArgs}}},null,2)+'\n');
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
await writeFile(path.join(destination,'codex-command.txt'),'codex mcp add motion-lab -- '+[command,...serverArgs].map(quote).join(' ')+'\n');
await writeFile(path.join(destination,'claude-code-command.txt'),'claude mcp add --transport stdio motion-lab -- '+[command,...serverArgs].map(quote).join(' ')+'\n');
console.log(`Snippets generated in ${destination}. Review and merge manually; no client, marketplace or Linux Home configuration was changed.`);
