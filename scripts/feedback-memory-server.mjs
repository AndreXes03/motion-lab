import { randomBytes } from 'node:crypto';
import { readMemory, setMemoryConsent, eraseMemory, setMemoryOutcome, deleteMemoryRecord } from './feedback-memory-store.mjs';
export function feedbackMemoryMiddleware(root){
  const token=randomBytes(32).toString('hex');
  return async(req,res)=>{
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    try{
      let host;try{host=new URL('http://'+req.headers.host);}catch{return send(403,{error:'Invalid host.'});}
      if(!['localhost','127.0.0.1','[::1]'].includes(host.hostname))return send(403,{error:'Local requests only.'});
      if(req.headers.origin&&req.headers.origin!==host.origin)return send(403,{error:'Same-origin requests only.'});
      if(req.method==='GET'&&req.url==='/')return send(200,{...await readMemory(root),token});
      if(req.method!=='POST'||req.headers.origin!==host.origin||req.headers['content-type']!=='application/json'||req.headers['x-framevolve-memory']!==token)return send(403,{error:'Reopen feedback memory to continue.'});
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>64000)return send(413,{error:'Request too large.'});}
      const body=JSON.parse(raw||'{}');let data;
      if(req.url==='/consent')data=await setMemoryConsent(root,body.enabled);
      else if(req.url==='/erase')data=await eraseMemory(root);
      else if(req.url==='/outcome')data=await setMemoryOutcome(root,body);
      else if(req.url==='/delete')data=await deleteMemoryRecord(root,body.id);
      else return send(404,{error:'Unknown memory action.'});
      return send(200,{...data,token});
    }catch(error){return send(400,{error:error.message});}
  };
}
export function feedbackMemoryPlugin(){return {name:'framevolve-feedback-memory',apply:'serve',configureServer(server){
  if(process.env.VITE_PUBLIC_DEMO==='true')return;
  server.middlewares.use('/__framevolve_memory',feedbackMemoryMiddleware(server.config.root));
}};}
