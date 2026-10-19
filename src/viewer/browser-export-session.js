// Keep recorder lifecycle independent of the rendering runtime so failure and
// cleanup behavior can be exercised without a browser or GPU.
export function createBrowserRecorderSession(recorder,{maxBytes=256*1024*1024}={}) {
 const chunks=[];
 let byteLength=0,error=null,stopped=false,resolveFailure,resolveStopped;
 const failureListeners=new Set();
 const failure=new Promise(resolve=>{resolveFailure=resolve;});
 const stoppedPromise=new Promise(resolve=>{resolveStopped=resolve;});
 const fail=cause=>{
  if(error)return;
  error=cause instanceof Error?cause:new Error('Browser video recording failed');
  resolveFailure(error);
  for(const listener of failureListeners)listener(error);
  if(recorder.state!=='inactive')try{recorder.stop();}catch{/* The encoder may already be stopping. */}
 };
 recorder.ondataavailable=event=>{
  if(!event.data?.size||error)return;
  byteLength+=event.data.size;
  if(byteLength>maxBytes){fail(new Error('Browser recording exceeded the 256 MB memory limit'));return;}
  chunks.push(event.data);
 };
 recorder.onerror=event=>fail(event.error || new Error('Browser video recording failed'));
 recorder.onstop=()=>{stopped=true;resolveStopped();};
 return {
  chunks,failure,get error(){return error;},get byteLength(){return byteLength;},
  onFailure(listener){if(error){listener(error);return ()=>{};}failureListeners.add(listener);return ()=>failureListeners.delete(listener);},
  stop(){if(recorder.state!=='inactive')recorder.stop();},
  async waitForStop(timeoutMs=30000,signal){
   if(signal?.aborted)throw new DOMException('Video export cancelled','AbortError');
   if(error)throw error;
   if(stopped)return;
   let timer,abort;
   try{
    await Promise.race([stoppedPromise,failure.then(cause=>{throw cause;}),new Promise((_,reject)=>{
     timer=setTimeout(()=>reject(new Error('Browser video recorder did not finish stopping')),timeoutMs);
     abort=()=>reject(new DOMException('Video export cancelled','AbortError'));
     signal?.addEventListener('abort',abort,{once:true});
    })]);
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  },
  dispose(){failureListeners.clear();recorder.ondataavailable=recorder.onerror=recorder.onstop=null;}
 };
}
