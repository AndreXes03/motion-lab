import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, chmod, rm, realpath } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { loadRuntime, revision } from '../runtime.mjs';

const plugin=fileURLToPath(new URL('..',import.meta.url)),repo=path.resolve(plugin,'../..');
const realGit=execFileSync('which',['git'],{encoding:'utf8'}).trim();
const realEnv={...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'};delete realEnv.NODE_TEST_CONTEXT;
const git=(root,...args)=>execFileSync(realGit,args,{cwd:root,encoding:'utf8',env:realEnv}).trim();
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}

async function fixture(t){
  const base=await realpath(await mkdtemp(path.join(os.tmpdir(),'motion-mcp-'))),root=path.join(base,'repo con spazi'),bin=path.join(base,'bin');
  await mkdir(root);await mkdir(bin);await mkdir(path.join(root,'node_modules/vite'),{recursive:true});await mkdir(path.join(root,'project'),{recursive:true});
  await writeFile(path.join(root,'package.json'),' {"name":"motion-lab","type":"module"}');
  await writeFile(path.join(root,'index.html'),'<h1>Mock Studio</h1>');await writeFile(path.join(root,'vite.config.js'),'export default {}');
  await writeFile(path.join(root,'.gitignore'),'node_modules/\n.motion-cache/\n');
  const modules=['scripts/studio-api.mjs','scripts/project-store.mjs','src/engine/control-catalog.js','src/engine/project-controls.js','src/engine/render-policy.js','src/scene-registry.js'];
  for(const module of modules){const target=path.join(root,module);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,`export * from ${JSON.stringify(pathToFileURL(path.join(repo,module)).href)};\n`);}
  await writeFile(path.join(root,'project/render-plans.json'),await readFile(path.join(repo,'project/render-plans.json')));
  await writeFile(path.join(root,'node_modules/vite/package.json'),'{"name":"vite","type":"module","main":"mock.mjs"}');
  await writeFile(path.join(root,'node_modules/vite/mock.mjs'),`
import http from 'node:http';import {randomUUID} from 'node:crypto';import {appendFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';import path from 'node:path';
export async function createServer(options){
 const middlewares=[],versions=new Map(),jobs=new Map(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 const events=path.join(options.root,'.motion-cache/events.jsonl');
 const server=http.createServer((req,res)=>{let i=0;const next=()=>{const f=middlewares[i++];if(f)f(req,res,next);else handle(req,res).catch(e=>{res.statusCode=500;res.end(JSON.stringify({error:e.message}));});};next();});
 const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 async function handle(req,res){const url=new URL(req.url,'http://local'),route=url.pathname.slice('/api/studio'.length);
  if(req.method==='GET'&&route==='')return send(res,200,{versions:[...versions.values()],jobs:[...jobs.values()]});
  if(req.method==='GET'&&route.startsWith('/versions/')){const version=versions.get(route.slice(10));return send(res,version?200:404,version?{snapshot:version}:{error:'missing'});}
  if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);appendFileSync(events,JSON.stringify({route,body})+'\\n');
   if(route==='/versions'){const version={id:randomUUID(),name:body.name,scene:body.parameters.scene,parameters:body.parameters};versions.set(version.id,version);return send(res,201,version);}
   if(route==='/render'){if(existsSync(path.join(options.root,'reject-render'))){const status=Number(readFileSync(path.join(options.root,'reject-render'),'utf8'));if(!status){res.statusCode=409;return res.end('Conflict');}return send(res,status,{error:'unsupported renderer'});}const id=randomUUID(),job={id,scene:body.parameters.scene,kind:body.kind,status:'running',engine:body.parameters.renderPolicy.renderer,settings:body.settings,outputPath:path.join(options.root,'.motion-cache',id+(body.kind==='frame'?'.png':'.mp4'))};jobs.set(id,job);if(existsSync(path.join(options.root,'drop-response'))){req.socket.destroy();return;}return send(res,202,{id});}
  }
  if(req.method==='GET'&&route.startsWith('/jobs/')){const parts=route.split('/'),job=jobs.get(parts[2]);if(!job)return send(res,404,{error:'missing'});
   if(parts[3]==='file'){res.setHeader('Content-Type','image/png');res.end(png);return;}
   if(!existsSync(path.join(options.root,'slow-job')))job.status='completed';return send(res,200,job);
  }
  send(res,404,{error:'unknown'});
 }
 for(const p of options.plugins)p.configureServer?.({middlewares:{use(fn){middlewares.push(fn);}}});
 return{listen(){return new Promise((ok,bad)=>{server.once('error',bad);server.listen(options.server.port,options.server.host,ok);});},close(){return new Promise(ok=>server.close(ok));}};
}
`);
  git(root,'init','-b','main');git(root,'config','user.name','MCP test');git(root,'config','user.email','test@example.invalid');git(root,'add','.');git(root,'commit','-m','fixture');git(root,'remote','add','origin','https://github.com/AndreXes03/motion-lab.git');
  const head=git(root,'rev-parse','HEAD');await writeFile(path.join(base,'remote-sha'),head);
  const fakeGit=path.join(bin,'git');
  await writeFile(fakeGit,`#!${process.execPath}\nconst fs=require('node:fs'),cp=require('node:child_process'),p=require('node:path'),base=process.env.MOTION_MCP_TEST_BASE,args=process.argv.slice(2);fs.appendFileSync(p.join(base,'git-calls'),JSON.stringify(args)+'\\n');if(args[0]==='ls-remote'){if(fs.existsSync(p.join(base,'offline')))process.exit(1);if(fs.existsSync(p.join(base,'delay'))){setTimeout(()=>{},10000);return;}process.stdout.write(fs.readFileSync(p.join(base,'remote-sha'),'utf8').trim()+'\\trefs/heads/main\\n');}else{const r=cp.spawnSync(${JSON.stringify(realGit)},args,{stdio:'inherit'});process.exit(r.status??1);}\n`);await chmod(fakeGit,0o755);
  const env={...realEnv,PATH:bin+path.delimiter+process.env.PATH,MOTION_MCP_TEST_BASE:base};
  const listenPort=await port();let client,transport;
  async function connect(){transport=new StdioClientTransport({command:process.execPath,args:[path.join(plugin,'server.mjs'),'--repo',root,'--port',String(listenPort)],env,stderr:'pipe'});transport.stderr?.on('data',()=>{});client=new Client({name:'test-client',version:'1.0.0'});await client.connect(transport);return client;}
  await connect();
  t.after(async()=>{await client.close();spawnSync(process.execPath,[path.join(plugin,'runtime/launch-studio.mjs'),'stop','--repo',root,'--port',String(listenPort)],{env:realEnv,encoding:'utf8'});await rm(base,{recursive:true,force:true});});
  const calls=async()=>{try{return(await readFile(path.join(base,'git-calls'),'utf8')).trim().split('\n').map(JSON.parse);}catch{return[];}};
  const checks=async()=>(await calls()).filter(args=>args[0]==='ls-remote').length;
  const events=async()=>{try{return(await readFile(path.join(root,'.motion-cache/events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);}catch{return[];}};
  async function call(name,args={}){const before=await checks();const result=await client.callTool({name,arguments:args});assert.equal(await checks(),before+1,'Every call performs a fresh remote check');assert.ok(result.structuredContent.updates.checkedAt);return result;}
  return{base,root,head,call,events,calls,client,connect,close:()=>client.close()};
}

test('official MCP handshake/list/call; update check includes schema errors, unknown tools, dirty/offline/main-only',async t=>{
  const f=await fixture(t),listed=await f.client.listTools();assert.equal(listed.tools.length,6);assert.ok(listed.tools.every(tool=>tool.inputSchema.type==='object'));
  const project=await f.call('get_project',{scene:'procedural'});assert.equal(project.isError,undefined);assert.equal(project.structuredContent.updates.state,'current');assert.ok(project.structuredContent.versionId);
  const bad=await f.call('set_parameters',{scene:'procedural',baseVersionId:'../../file'});assert.equal(bad.isError,true);
  assert.equal((await f.call('unknown_tool')).isError,true);
  await writeFile(path.join(f.root,'unsaved.txt'),'user');assert.equal((await f.call('get_project')).structuredContent.updates.dirty,true);
  await writeFile(path.join(f.base,'remote-sha'),'f'.repeat(40));assert.equal((await f.call('get_project')).structuredContent.updates.state,'available');
  await writeFile(path.join(f.base,'offline'),'offline');assert.equal((await f.call('get_project')).structuredContent.updates.state,'offline');
  assert.equal((await f.call('preview_frame',{requestId:'bad'})).structuredContent.updates.state,'offline');
  await rm(path.join(f.base,'offline'));await writeFile(path.join(f.base,'delay'),'slow');const started=Date.now();const timeout=await f.call('get_project');assert.equal(timeout.structuredContent.updates.state,'offline');assert.ok(Date.now()-started<4500);
  await rm(path.join(f.base,'delay'));git(f.root,'config','remote.origin.url','https://github.com/other/project');const unknown=await f.client.callTool({name:'get_project',arguments:{}});assert.equal(unknown.structuredContent.updates.state,'unknown');
  const commands=await f.calls();assert.equal(commands.some(args=>['fetch','pull','reset','stash','install'].includes(args[0])),false);assert.ok(commands.filter(args=>args[0]==='ls-remote').every(args=>args.at(-1)==='refs/heads/main'));
});

test('real runtime baseline and patch: native versions, immutable base, preservation, invalid input no writes',async t=>{
  const f=await fixture(t),base=(await f.call('get_project',{scene:'procedural'})).structuredContent;
  const changed=await f.call('set_parameters',{scene:'procedural',baseVersionId:base.versionId,revision:base.revision,patches:[{id:'speed',value:1.75}],name:'Agent A'});assert.equal(changed.isError,undefined);
  const next=changed.structuredContent;assert.notEqual(next.versionId,base.versionId);assert.equal(next.parameters.graphics.speed,1.75);assert.deepEqual(next.parameters.look,base.parameters.look);assert.deepEqual(next.parameters.motion,base.parameters.motion);
  assert.deepEqual((await f.call('get_project',{scene:'procedural',versionId:base.versionId})).structuredContent.parameters,base.parameters);
  assert.ok((await f.call('get_project')).structuredContent.versions.some(v=>v.versionId===next.versionId));
  const count=(await f.events()).length;
  for(const bad of [{patches:[{id:'speed',value:999}]},{revision:'0'.repeat(64)},{patches:[{id:'__proto__',value:1}]},{scene:'pop'}])assert.equal((await f.call('set_parameters',{scene:'procedural',baseVersionId:base.versionId,revision:base.revision,patches:[{id:'speed',value:1.1}],...bad})).isError,true);
  assert.equal((await f.events()).length,count);
  const runtime=await loadRuntime(f.root),bax=await runtime.baseline('bax');bax.animation={version:1,enabled:true,groups:{}};
  const {validateStudioParameters}=await import(pathToFileURL(path.join(repo,'scripts/studio-api.mjs')).href);const normalized=await validateStudioParameters(bax);
  const patched=await runtime.patch(normalized,'bax',[{id:'contrast',value:.5}]);assert.deepEqual(patched.motion,normalized.motion);assert.deepEqual(patched.animation,normalized.animation);assert.equal(patched.shell,normalized.shell);assert.notDeepEqual(patched.look.lighting,normalized.look.lighting);
  const original=(await f.call('get_project',{scene:'bax'})).structuredContent;
  const modify=async(base,patches)=>(await f.call('set_parameters',{scene:'bax',baseVersionId:base.versionId,revision:base.revision,patches})).structuredContent;
  const manual=await modify(original,[{id:'key',value:42},{id:'fill',value:.06},{id:'exposure',value:1.7}]);
  const contrastA=manual.parameters.studio.values.contrast;
  const b=await modify(manual,[{id:'contrast',value:.5}]);
  const same=await modify(b,[{id:'contrast',value:.5}]);assert.deepEqual(same.parameters,b.parameters);assert.equal(same.revision,b.revision);
  const a=await modify(b,[{id:'contrast',value:contrastA}]);
  for(const field of ['fill','rim','environment'])assert.ok(Math.abs(a.parameters.look.lighting[field]-manual.parameters.look.lighting[field])<1e-12,field+' must return to the manual baseline');
  assert.equal(a.parameters.look.lighting.key,42);assert.equal(b.parameters.look.lighting.key,42);assert.equal(a.parameters.look.post.exposure,1.7);assert.deepEqual(a.parameters.motion,manual.parameters.motion);assert.deepEqual(a.parameters.sound,manual.parameters.sound);
});

test('preview PNG, native render lifecycle, requestId retry across restart, uncertain submission never resubmitted',async t=>{
  const f=await fixture(t),base=(await f.call('get_project',{scene:'procedural'})).structuredContent,args={scene:'procedural',versionId:base.versionId,revision:base.revision,requestId:'preview-A',time:1};
  const preview=await f.call('preview_frame',args);assert.equal(preview.isError,undefined);assert.equal(preview.structuredContent.job.status,'completed');assert.ok(preview.content.some(c=>c.type==='image'));assert.ok(preview.content.some(c=>c.type==='resource_link'));
  await f.call('preview_frame',args);assert.equal((await f.events()).filter(e=>e.route==='/render').length,1);
  await f.close();await f.connect();await f.call('preview_frame',args);assert.equal((await f.events()).filter(e=>e.route==='/render').length,1);
  await writeFile(path.join(f.root,'slow-job'),'slow');const began=Date.now();const slow=await f.call('preview_frame',{...args,requestId:'slow-preview'});assert.equal(slow.structuredContent.job.status,'running');assert.ok(Date.now()-began<8000);await rm(path.join(f.root,'slow-job'));assert.ok((await f.call('get_job',{requestId:'slow-preview'})).content.some(c=>c.type==='image'));
  await writeFile(path.join(f.root,'slow-job'),'slow');const job=await f.call('render_local',{...args,requestId:'video-A',kind:'export',renderer:'threejs'});assert.equal(job.structuredContent.job.status,'running');
  await rm(path.join(f.root,'slow-job'));const complete=await f.call('get_job',{requestId:'video-A'});assert.equal(complete.structuredContent.job.status,'completed');assert.ok(complete.content.some(c=>c.type==='resource_link'));assert.equal(complete.content.some(c=>c.type==='image'),false);
  await writeFile(path.join(f.root,'drop-response'),'drop');const uncertain={...args,requestId:'uncertain',kind:'preview'};assert.equal((await f.call('render_local',uncertain)).structuredContent.state,'submission_unknown');const renders=(await f.events()).filter(e=>e.route==='/render').length;await f.call('render_local',uncertain);assert.equal((await f.events()).filter(e=>e.route==='/render').length,renders);
  assert.equal((await f.call('render_local',{...uncertain,time:2})).isError,true);
  await rm(path.join(f.root,'drop-response'));
  for(const status of ['400','409','non-json']){
    await writeFile(path.join(f.root,'reject-render'),status);const rejected={...args,requestId:'rejected-'+status,kind:'frame'};
    const rejection=await f.call('render_local',rejected);assert.equal(rejection.isError,true);assert.equal(rejection.structuredContent.state,'rejected');
    const beforeRetry=(await f.events()).length;assert.equal((await f.call('render_local',rejected)).isError,true);assert.equal((await f.events()).length,beforeRetry);
  }
  assert.equal((await f.call('get_job',{requestId:'../../escape'})).isError,true);
  const open=await f.call('open_studio',{scene:'procedural',versionId:base.versionId,open:false});assert.equal(open.structuredContent.opened,false);assert.match(open.structuredContent.note,/manually/);
});

test('configuration generator: absolute snippets only, no overwrite or client config mutation',async t=>{
  const f=await fixture(t),destination=path.join(f.base,'reviewed snippets');
  const before=git(f.root,'status','--porcelain');
  const args=[path.join(plugin,'scripts/configure.mjs'),'--repo',f.root,'--port','4198','--destination',destination];
  const generated=spawnSync(process.execPath,args,{env:realEnv,encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
  const config=JSON.parse(await readFile(path.join(destination,'mcp.json'),'utf8'));assert.equal(config.mcpServers['motion-lab'].type,'stdio');assert.equal(path.isAbsolute(config.mcpServers['motion-lab'].command),true);assert.equal(config.mcpServers['motion-lab'].args.includes(f.root),true);
  assert.match(await readFile(path.join(destination,'codex-command.txt'),'utf8'),/^codex mcp add motion-lab -- /);
  assert.equal(spawnSync(process.execPath,args,{env:realEnv,encoding:'utf8'}).status,1);assert.equal(git(f.root,'status','--porcelain'),before);
  for(const name of ['plugin.json','mcp.json','.codex-plugin/plugin.json','.claude-plugin/plugin.json','.mcp.json'])assert.ok(JSON.parse(await readFile(path.join(plugin,name),'utf8')));
});
