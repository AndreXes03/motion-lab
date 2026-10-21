import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readReview, liveFile } from './live-review-store.mjs';
export function isLiveSource(root, file) {
  const relative=path.relative(root,file).split(path.sep).join('/');
  return /^(src\/.*\.(js|json|css|glsl)|project\/[^/]+\.json)$/.test(relative);
}
export function liveStudioPlugin() {
  let server, root, timer, stopped=false, working=false, generation=0;
  const pending=new Set(), epoch=randomUUID();
  let review={version:1,phase:'idle',tasks:[],checkpoint:null}, checkpoint=null;
  let state={epoch,revision:0,sourceRevision:0,error:'',label:'Live updates ready',tasks:[],phase:'idle',snapshot:null};
  const schedule=()=>{clearTimeout(timer);if(!stopped)timer=setTimeout(flush,350);};
  async function flush(){
    if(stopped)return;if(working){schedule();return;}working=true;const start=generation;
    try{
      const next=await readReview(root);review=next;
      state={...state,tasks:next.tasks,phase:next.phase,label:next.label??state.label,error:''};
      if(['editing','blocked'].includes(next.phase))return;
      if(!pending.size&&next.checkpoint===checkpoint)return;
      // Transform before releasing a checkpoint. A half-written JS/JSON file leaves the current page intact.
      const files=[...pending];
      for(const file of files){
        const raw=await readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
        if(raw===null)continue;
        if(file.endsWith('.json'))JSON.parse(raw);
        else await server.transformRequest('/'+path.relative(root,file).split(path.sep).join('/'));
      }
      if(start!==generation){schedule();return;}
      const latest=await readReview(root);
      if(latest.updatedAt!==next.updatedAt){schedule();return;}
      for(const file of files)pending.delete(file);
      checkpoint=next.checkpoint;
      state={...state,revision:state.revision+1,sourceRevision:state.sourceRevision+(files.length?1:0),snapshot:next.snapshot??null,phase:'ready',label:next.label??'Scene updated'};
    }catch(error){state.error='Update needs a fix: '+error.message;}
    finally{working=false;}
  }
  function changed(file){if(file===liveFile(root)||isLiveSource(root,file)){generation++;if(isLiveSource(root,file))pending.add(file);schedule();}}
  return {
    name:'framevolve-live-review',apply:'serve',
    async configureServer(vite){
      server=vite;root=server.config.root;
      try{review=await readReview(root);checkpoint=review.checkpoint;state={...state,tasks:review.tasks,phase:review.phase,label:review.label??state.label,snapshot:review.snapshot??null};}catch(error){state.error=error.message;}
      server.watcher.add(liveFile(root));
      server.watcher.on('change',changed);server.watcher.on('add',changed);server.watcher.on('unlink',changed);
      server.middlewares.use('/__framevolve_live',(req,res)=>{
        if(req.method!=='GET'){res.statusCode=405;res.end();return;}
        let host;try{host=new URL('http://'+req.headers.host).hostname;}catch{}
        if(!['localhost','127.0.0.1','[::1]'].includes(host)){res.statusCode=403;res.end();return;}
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.statusCode=403;res.end();return;}
        res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(state));
      });
    },
    hotUpdate(context){if(this.environment.name==='client'&&isLiveSource(root,context.file)){changed(context.file);return [];}},
    closeBundle(){stopped=true;clearTimeout(timer);if(server){for(const event of ['change','add','unlink'])server.watcher.off(event,changed);}}
  };
}
