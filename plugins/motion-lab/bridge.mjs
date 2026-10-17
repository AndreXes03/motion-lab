import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { launch } from './runtime/launch-studio.mjs';
import { revision, stable } from './runtime.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const MAX_JSON = 2 * 1024 * 1024, MAX_IMAGE = 2 * 1024 * 1024;

async function limitedBody(response, max) {
  if (Number(response.headers.get('content-length')) > max) throw Error('Response exceeds size limit.');
  const reader = response.body.getReader(); let bytes = 0; const chunks = [];
  try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > max) throw Error('Response exceeds size limit.'); chunks.push(Buffer.from(part.value)); } }
  finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

export class Bridge {
  constructor(root, port, runtime) {
    this.root = root; this.port = port; this.runtime = runtime;
    this.base = `http://127.0.0.1:${port}`; this.cache = path.join(root,'.motion-cache/mcp-plugin/requests');
  }
  async ensure() { await launch({ root:this.root, port:this.port, action:'start', open:false }); }
  async api(route, body) {
    const response = await fetch(this.base + '/api/studio' + route, { ...(body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {}), redirect:'error', signal:AbortSignal.timeout(8000) });
    if (!response.ok) {
      let detail='request failed';
      try { detail=JSON.parse((await limitedBody(response,MAX_JSON)).toString('utf8')).error??detail; } catch { /* HTTP status still proves rejection even if its body is unavailable. */ }
      const error=Error(`Studio API ${response.status}: ${String(detail).slice(0,400)}`);error.status=response.status;throw error;
    }
    return JSON.parse((await limitedBody(response,MAX_JSON)).toString('utf8'));
  }
  async version(id, scene, expectedRevision) {
    if (!UUID.test(id)) throw Error('Invalid versionId.');
    const result = (await this.api('/versions/' + id)).snapshot;
    const parameters = result?.parameters ?? result?.snapshot?.parameters;
    if (!parameters || parameters.scene !== scene || result.id !== id) throw Error('Version or scene mismatch.');
    const rev = revision(parameters);
    if (expectedRevision && rev !== expectedRevision) throw Error('Revision conflict: read this exact version again before changing or rendering it.');
    return { versionId:id, revision:rev, name:result.name, scene, parameters };
  }
  async save(scene, name, parameters) {
    if(Buffer.byteLength(JSON.stringify(parameters))>96*1024)throw Error('Snapshot exceeds the v1 96 KiB version limit. Use Studio directly for larger recipes.');
    const saved = await this.api('/versions', { name, parameters });
    if (!UUID.test(saved.id) || saved.scene !== scene || !saved.parameters) throw Error('Unexpected version response.');
    return { versionId:saved.id, revision:revision(saved.parameters), name:saved.name, scene, parameters:saved.parameters };
  }
  async project(args) {
    await this.ensure();
    const state = await this.api('');
    const result = { scenes:this.runtime.scenes, versions:(state.versions??[]).slice(0,80).map(v => ({ versionId:v.id, scene:v.scene, name:v.name, createdAt:v.createdAt })), jobs:(state.jobs??[]).slice(0,30).map(j => ({ jobId:j.id,status:j.status,scene:j.scene,kind:j.kind })), browserBridge:'Unsaved browser state is not read. Save a named version in Studio, then pass its versionId. New versions require manual selection in Versions; no live UI sync.' };
    if (!args.scene) return result;
    const snapshot = args.versionId ? await this.version(args.versionId,args.scene) : await this.save(args.scene, `MCP Original · ${args.scene}`, await this.runtime.baseline(args.scene));
    return { ...result, ...snapshot, catalog:this.runtime.values(args.scene,snapshot.parameters) };
  }
  async set(args) {
    await this.ensure();
    const base = await this.version(args.baseVersionId,args.scene,args.revision);
    const parameters = await this.runtime.patch(base.parameters,args.scene,args.patches);
    return { ...await this.save(args.scene,args.name??`MCP ${args.scene} · parameters`,parameters), baseVersionId:base.versionId, baseRevision:base.revision, immutableBase:true };
  }
  file(requestId) { return path.join(this.cache, hash(requestId)+'.json'); }
  async record(requestId) {
    const data = JSON.parse(await readFile(this.file(requestId),'utf8'));
    if (data.requestId !== requestId) throw Error('Request record mismatch.'); return data;
  }
  async persist(record) {
    const file=this.file(record.requestId), temporary=file+`.${process.pid}.tmp`;
    await writeFile(temporary,JSON.stringify(record)+'\n',{mode:0o600});await rename(temporary,file);
  }
  async submit(args, preview = false) {
    await this.ensure();
    const snapshot=await this.version(args.versionId,args.scene,args.revision);
    const kind=preview?'frame':args.kind;
    const renderer=preview?'threejs':args.renderer;
    const parameters=await this.runtime.renderParameters(snapshot.parameters,renderer);
    const settings=this.runtime.validateSettings(kind,preview?{width:384,height:216,fps:30,temporalSamples:1}:{width:384,height:240,fps:24,temporalSamples:1,...(kind==='frame'?{}:{format:'mp4',bitrateMbps:4}),...args.settings});
    const body={kind,time:args.time??0,parameters,settings};
    const duration=this.runtime.config(args.scene).duration;
    if (body.time>duration) throw Error('time exceeds scene duration.');
    const fingerprint=hash(stable({versionId:snapshot.versionId,revision:snapshot.revision,body}));
    const record={requestId:args.requestId,fingerprint,versionId:snapshot.versionId,revision:snapshot.revision,scene:args.scene,kind,state:'submitting',createdAt:new Date().toISOString()};
    await mkdir(this.cache,{recursive:true});
    let existing;
    try { await writeFile(this.file(args.requestId),JSON.stringify(record)+'\n',{flag:'wx',mode:0o600}); }
    catch(error) { if(error.code!=='EEXIST')throw error;existing=await this.record(args.requestId); }
    if(existing){
      if(existing.fingerprint!==fingerprint)throw Error('requestId already used with different input. Use a new requestId for a new render.');
      return this.result(existing);
    }
    try {
      const response=await this.api('/render',body);
      if(!UUID.test(response.id))throw Error('Unexpected job response.');
      record.jobId=response.id;record.state='accepted';await this.persist(record);
    }catch(error){
      record.state=error.status>=400&&error.status<500?'rejected':'submission_unknown';record.note=String(error.message).slice(0,500);await this.persist(record);
      // Never automatically resubmit an uncertain request, even across a server restart.
      return {isError:record.state==='rejected',data:{...record,note:'No retry was sent. Inspect Studio jobs before using another requestId. '+record.note},content:[]};
    }
    if(preview){
      const until=Date.now()+6500;
      while(Date.now()<until){const result=await this.result(record);if(result.data.job?.status!=='running'&&result.data.job?.status!=='queued')return result;await delay(250);}
    }
    return this.result(record);
  }
  async result(record) {
    if(!record.jobId)return{isError:record.state==='rejected',data:{...record,note:record.note??'Submission may still be in progress or its response was lost. Inspect Studio jobs; this request will not be resent.'},content:[]};
    if(!UUID.test(record.jobId))throw Error('Invalid recorded job.');
    const job=await this.api('/jobs/'+record.jobId);
    if(job.id!==record.jobId||job.scene!==record.scene)throw Error('Job identity mismatch.');
    const data={requestId:record.requestId,versionId:record.versionId,revision:record.revision,scene:record.scene,job:{id:job.id,status:job.status,kind:job.kind,engine:job.engine,progress:job.progress,error:job.error,settings:job.settings,outputPath:job.outputPath}};
    const content=[];
    if(job.status==='completed'&&typeof job.outputPath==='string'&&path.isAbsolute(job.outputPath)){
      content.push({type:'resource_link',uri:pathToFileURL(job.outputPath).href,name:path.basename(job.outputPath),mimeType:job.kind==='frame'?'image/png':job.extension==='.webm'?'video/webm':job.extension==='.mov'?'video/quicktime':'video/mp4'});
      if(job.kind==='frame'){
        try{
          const response=await fetch(this.base+'/api/studio/jobs/'+record.jobId+'/file',{redirect:'error',signal:AbortSignal.timeout(3000)});
          if(!response.ok||!response.headers.get('content-type')?.startsWith('image/png'))throw Error('PNG not available.');
          const image=await limitedBody(response,MAX_IMAGE);
          if(image.length<24||image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||image.readUInt32BE(16)>1024||image.readUInt32BE(20)>1024)throw Error('Image dimensions exceed inline limit.');
          content.push({type:'image',mimeType:'image/png',data:image.toString('base64')});
        }catch{data.inlineImage='Not embedded (size, dimensions or availability). Original output path is unchanged.';}
      }
    }
    return {data,content};
  }
  async job(args) {await this.ensure();return this.result(await this.record(args.requestId));}
}
