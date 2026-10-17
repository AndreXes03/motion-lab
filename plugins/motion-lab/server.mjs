#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { checkUpdates } from './updates.mjs';
import { loadRuntime } from './runtime.mjs';
import { Bridge } from './bridge.mjs';
import { validateRepo } from './runtime/launch-studio.mjs';

// Repository and launcher diagnostics must never enter the stdio protocol stream.
for(const method of ['log','info','debug','dir','table'])console[method]=(...args)=>console.error(...args);
const args=process.argv.slice(2);let root,port=4198;
for(let i=0;i<args.length;i++){if(args[i]==='--repo')root=args[++i];else if(args[i]==='--port')port=Number(args[++i]);else throw Error('Usage: server.mjs --repo /absolute/motion-lab [--port 4198]');}
if(!root||!path.isAbsolute(root)||!Number.isInteger(port)||port<1024||port>65535)throw Error('An absolute --repo and a port from 1024 to 65535 are required.');
root=await validateRepo(await realpath(root));
let bridgePromise;
const bridge=()=>bridgePromise??=loadRuntime(root).then(runtime=>new Bridge(root,port,runtime));
const scene=z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),id=z.string().uuid(),rev=z.string().regex(/^[a-f0-9]{64}$/),requestId=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
const versionFields={scene,versionId:id,revision:rev};
const schemas={
  get_project:z.object({scene:scene.optional(),versionId:id.optional()}).strict().refine(x=>!x.versionId||x.scene,'scene required with versionId'),
  set_parameters:z.object({scene,baseVersionId:id,revision:rev,patches:z.array(z.object({id:z.string().min(1).max(100),value:z.union([z.number().finite(),z.boolean(),z.string().max(80)])}).strict()).min(1).max(30),name:z.string().min(1).max(80).optional()}).strict(),
  preview_frame:z.object({...versionFields,requestId,time:z.number().min(0).max(3600).default(0)}).strict(),
  render_local:z.object({...versionFields,requestId,kind:z.enum(['frame','preview','export']),time:z.number().min(0).max(3600).default(0),renderer:z.enum(['auto','threejs','cycles','mixed']).optional(),settings:z.object({width:z.number().int().min(2).max(1920).optional(),height:z.number().int().min(2).max(1080).optional(),fps:z.union([24,25,30,50,60].map(z.literal)).optional(),temporalSamples:z.number().int().min(1).max(64).optional(),format:z.enum(['mp4','webm','prores']).optional(),bitrateMbps:z.number().min(2).max(200).optional()}).strict().optional()}).strict(),
  get_job:z.object({requestId}).strict(),
  open_studio:z.object({scene,versionId:id.optional(),open:z.boolean().default(true)}).strict(),
};
const descriptions={
  get_project:'List scenes and native saved versions. With scene and no versionId, save an immutable Original baseline and return its exact versionId, revision, parameters and real control catalog. Unsaved browser state is not read.',
  set_parameters:'Save a NEW native named version by patching catalog IDs on an explicit immutable baseVersionId/revision. Does not overwrite project files or the browser. Select the new version manually in Studio Versions.',
  preview_frame:'Submit a small real Three.js frame from an explicit version. Inline PNG if ready within about 7 seconds; otherwise poll get_job. requestId prevents duplicate renders. No browser opens.',
  render_local:'Submit a native local frame/preview/export job. Uses saved render policy unless renderer is explicit; native API enforces support and queue. Cycles needs local Blender and supported scenes. Native video jobs use the full authored duration. Never retry uncertain jobs with a new ID before checking Studio.',
  get_job:'Read a plugin request/job. Return a real inline PNG when small and ready, or the original local output file link for completed renders. Does not start another render.',
  open_studio:'Explicitly open the local Studio browser on macOS, or return its address with open:false. Versions pane requires manual selection of the named version; no unsaved browser edits are overwritten.',
};
const server=new Server({name:'motion-lab',version:'0.1.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:Object.entries(schemas).map(([name,schema])=>({name,description:descriptions[name],inputSchema:z.toJSONSchema(schema),annotations:{readOnlyHint:name==='get_job',destructiveHint:false,openWorldHint:true}}))}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
  const updates=await checkUpdates(root); // Deliberately BEFORE all tool/input validation, including unknown tools.
  try{
    const name=request.params.name,schema=Object.hasOwn(schemas,name)?schemas[name]:null;if(!schema)throw Error('Unknown tool.');
    const input=schema.parse(request.params.arguments??{});
    const b=await bridge();let result;
    if(name==='get_project')result={data:await b.project(input)};
    else if(name==='set_parameters')result={data:await b.set(input)};
    else if(name==='preview_frame'||name==='render_local')result=await b.submit(input,name==='preview_frame');
    else if(name==='get_job')result=await b.job(input);
    else{
      await b.ensure();const version=input.versionId?await b.version(input.versionId,input.scene):null;
      if(!b.runtime.scenes.some(s=>s.id===input.scene))throw Error('Unknown scene.');
      const url=b.base+'/?scene='+encodeURIComponent(input.scene)+'&panel=versions';
      if(input.open){if(process.platform!=='darwin')throw Error('Browser opening requires macOS. Use open:false for tests.');const opened=spawnSync('/usr/bin/open',[url]);if(opened.error||opened.status!==0)throw Error('Browser could not be opened.');}
      result={data:{url,opened:input.open,versionId:version?.versionId,name:version?.name,note:'Choose the named version manually in Versions. This URL does not load a version or overwrite unsaved edits.'}};
    }
    const data={updates,...result.data};const json=JSON.stringify(data);
    if(Buffer.byteLength(json)>128*1024)throw Error('Tool JSON exceeds 128 KiB; request one scene/version or inspect native files.');
    return{...(result.isError?{isError:true}:{}),content:[{type:'text',text:json},...(result.content??[])],structuredContent:data};
  }catch(error){
    const data={updates,error:String(error.message).slice(0,1500)};
    return{isError:true,content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
  }
});
await server.connect(new StdioServerTransport());
