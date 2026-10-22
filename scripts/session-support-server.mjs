import {creativeState,addFeedback,deleteFeedback} from './creative-store.mjs';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {saveCheckpoint,listCheckpoints,restoreCheckpoint} from './session-checkpoints.mjs';
import {readReview} from './live-review-store.mjs';
import {validateFounderBrief,founderPrompt} from '../src/viewer/founder-brief.js';
import {redactFeedback} from '../src/viewer/feedback-report.js';
export async function supportReport(root,{stage='other',description='',expected=''}={}){
 if(!['setup','brief','preview','revision','export','other'].includes(stage))throw Error('Choose a valid work stage.');
 if(typeof description!=='string'||typeof expected!=='string'||description.length>4000||expected.length>4000)throw Error('Keep the report under 4,000 characters per answer.');
 let revision='unknown',setup={},review={};try{revision=JSON.parse(await readFile(path.join(root,'.framevolve-distribution.json'),'utf8')).revision;}catch{}try{setup=JSON.parse(await readFile(path.join(root,'.motion-cache/setup.json'),'utf8'));}catch{}try{review=await readReview(root);}catch{}
 const states=globalThis[Symbol.for('framevolve.studio-render-states')],jobs=[...(states?.get(root)?.jobs?.values()??[])].filter(j=>j.status==='failed').slice(-3);
 const clean=x=>redactFeedback(String(x??'')).replace(/(?:Bearer\s+|(?:token|password|secret|api[_-]?key)\s*[=:]\s*)\S+/gi,'[credential removed]').slice(0,1500);
 return {format:'framevolve-support-report',version:1,notice:'Review before sharing. No files, website brief, feedback memory, full logs or media are attached. Text filtering is not guaranteed anonymization.',environment:{revision:/^[a-f0-9]{40}$/.test(revision)?revision:'unknown',platform:process.platform,architecture:process.arch,node:process.versions.node,setupComplete:!!setup.completedAt,browser:['chrome','chromium'].includes(setup.browser?.kind)?setup.browser.kind:'unconfigured'},stage,description:clean(description),expected:clean(expected),reviewPhase:review.phase??'unknown',recentRenderErrors:jobs.map(j=>({kind:j.kind,engine:j.engine,error:clean(j.error)}))};
}
export function sessionSupportMiddleware(root){const token=randomBytes(32).toString('hex');return async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{let host;try{host=new URL('http://'+req.headers.host);}catch{return send(403,{error:'Invalid host.'});}if(!['127.0.0.1','localhost','[::1]'].includes(host.hostname)||req.headers.origin&&req.headers.origin!==host.origin)return send(403,{error:'Local same-origin requests only.'});
 if(req.method==='GET'&&req.url.startsWith('/creative?'))return send(200,{token,phase:(await readReview(root)).phase,...await creativeState(root,new URL(req.url,host.origin).searchParams.get('scene'))});
 if(req.method==='GET'&&req.url==='/'){let brief=null;try{brief=validateFounderBrief(JSON.parse(await readFile(path.join(root,'.motion-cache/founder-brief.json'),'utf8')));}catch{}return send(200,{token,brief,checkpoints:await listCheckpoints(root)});}
 if(req.method!=='POST'||req.headers.origin!==host.origin||req.headers['x-framevolve-session']!==token||req.headers['content-type']!=='application/json')return send(403,{error:'Reopen session tools to continue.'});
 let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2*1024*1024)return send(413,{error:'Request too large.'});}const body=JSON.parse(raw||'{}');
 if(req.url==='/feedback')return send(200,await addFeedback(root,body));
 if(req.url==='/feedback-delete')return send(200,await deleteFeedback(root,body.id));
 if(req.url==='/brief'){const brief=validateFounderBrief(body),file=path.join(root,'.motion-cache/founder-brief.json');await mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temporary,JSON.stringify(brief),{mode:0o600});await rename(temporary,file);return send(200,{brief,prompt:founderPrompt(brief)});}
 if(req.url==='/checkpoint'){const record=await saveCheckpoint(root,{label:body.label,snapshot:body.snapshot});return send(200,{id:record.id,label:record.label,createdAt:record.createdAt});}
 if(req.url==='/restore')return send(200,await restoreCheckpoint(root,body.id,{snapshot:body.snapshot}));
 if(req.url==='/report')return send(200,await supportReport(root,body));
 return send(404,{error:'Unknown session action.'});
 }catch(error){return send(400,{error:error.message});}
 };}
export function sessionSupportPlugin(){return {name:'framevolve-session-support',apply:'serve',configureServer(server){if(process.env.VITE_PUBLIC_DEMO!=='true')server.middlewares.use('/__framevolve_session',sessionSupportMiddleware(server.config.root));}};}
