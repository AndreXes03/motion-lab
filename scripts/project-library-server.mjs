import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {readReview,liveFile} from './live-review-store.mjs';
import {libraryState,projectSession,saveActiveProject,createActiveProject,openActiveProject,importLibraryProject,exportLibraryProject,autosaveActiveProject} from './project-library-session.mjs';
import {isManagedProjectPath} from './project-library-store.mjs';

export function projectLibraryMiddleware(root){const token=randomBytes(32).toString('hex');return async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{
  let origin;try{origin=new URL('http://'+req.headers.host);}catch{return send(403,{error:'Invalid host.'});}
  if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||req.headers.origin&&req.headers.origin!==origin.origin)return send(403,{error:'Local same-origin requests only.'});
  if(req.method==='GET'&&(req.url==='/'||req.url===''))return send(200,{token,...await libraryState(root)});
  if(req.method!=='POST'||req.headers.origin!==origin.origin||req.headers['x-framevolve-project']!==token)return send(403,{error:'Reload Studio to reconnect project storage.'});
  const binary=req.url==='/import',limit=binary?100*1024*1024:2*1024*1024;
  if(req.headers['content-type']!==(binary?'application/octet-stream':'application/json'))return send(415,{error:'Unsupported project request.'});
  if(Number(req.headers['content-length'])>limit)return send(413,{error:'Project package exceeds the size limit.'});
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)return send(413,{error:'Project package exceeds the size limit.'});chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  if(binary)return send(200,{record:await importLibraryProject(root,bytes)});
  const body=JSON.parse(bytes.toString('utf8')||'{}');
  if(req.url==='/save')return send(200,{record:await saveActiveProject(root,body)});
  if(req.url==='/new')return send(200,{record:await createActiveProject(root,body)});
  if(req.url==='/open')return send(200,await openActiveProject(root,body));
  if(req.url==='/export'){
   const result=await exportLibraryProject(root,body.id);
   res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="project.framevolve"','Content-Length':result.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(result);
  }
  return send(404,{error:'Unknown project action.'});
 }catch(error){return send(error.status??400,{error:error.message});}
};}

export function projectLibraryPlugin(){let server,root,timer,stopped=false,generation=0,reviewPending=false,lastCheckpoint=null;
 const schedule=()=>{clearTimeout(timer);if(!stopped)timer=setTimeout(flush,800);};
 async function flush(){const state=projectSession(root);if(stopped)return;if(state.working){schedule();return;}const start=generation;
  try{const review=await readReview(root),published=reviewPending&&review.phase==='ready'&&review.checkpoint!==lastCheckpoint;await autosaveActiveProject(root,{snapshot:published?review.snapshot:undefined});if(published){lastCheckpoint=review.checkpoint;reviewPending=false;}if(start===generation)state.pending=false;else schedule();}
  catch(error){state.error='Autosave needs attention: '+error.message;state.pending=false;}
 }
 function changed(file){const relative=path.relative(root,file).split(path.sep).join('/');if(isManagedProjectPath(relative)||file===liveFile(root)){if(file===liveFile(root))reviewPending=true;generation++;projectSession(root).pending=true;schedule();}}
 return {name:'framevolve-project-library',apply:'serve',async configureServer(vite){if(process.env.VITE_PUBLIC_DEMO==='true')return;server=vite;root=server.config.root;lastCheckpoint=(await readReview(root)).checkpoint;server.middlewares.use('/__framevolve_projects',projectLibraryMiddleware(root));server.watcher.add(liveFile(root));for(const event of ['add','change','unlink'])server.watcher.on(event,changed);projectSession(root).pending=true;schedule();},closeBundle(){stopped=true;clearTimeout(timer);if(server)for(const event of ['add','change','unlink'])server.watcher.off(event,changed);}};
}
