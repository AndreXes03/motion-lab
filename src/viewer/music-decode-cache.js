/** One decoded song in memory. Concurrent requests keep their own asset ID;
 * completion of an older decode cannot relabel a newer song. */
export function createMusicDecodeCache(decode){
 let cachedId=null,cached=null,pendingId=null,pending=null,revision=0;
 return {
  clear(){revision++;cachedId=cached=pendingId=pending=null;},
  prime(assetId,audio){revision++;cachedId=assetId;cached=audio;pendingId=pending=null;},
  async get(assetId){
   if(cachedId===assetId&&cached)return cached;
   if(pendingId===assetId&&pending)return pending;
   const requested=++revision;
   const task=Promise.resolve().then(()=>decode(assetId));pendingId=assetId;pending=task;
   try{const audio=await task;if(revision===requested){cachedId=assetId;cached=audio;}return audio;}
   finally{if(pending===task){pendingId=pending=null;}}
  }
 };
}
