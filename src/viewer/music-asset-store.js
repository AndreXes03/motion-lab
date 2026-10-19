const DB_NAME='framevolve-music-assets',STORE='files',MAX_BYTES=50*1024*1024;

export async function hashMusicBlob(blob){
 if(!(blob instanceof Blob)||!blob.size||blob.size>MAX_BYTES)throw Error('Choose an audio file smaller than 50 MB');
 const cryptoApi=globalThis.crypto;
 if(!cryptoApi?.subtle)throw Error('Secure browser storage is required to import music');
 const hash=await cryptoApi.subtle.digest('SHA-256',await blob.arrayBuffer());
 return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function openMusicDatabase(){
 if(!globalThis.indexedDB)throw Error('Browser storage is unavailable; imported music cannot be saved');
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??new Error('Could not open browser music storage'));
 });
}

async function accessMusicAsset(mode,operation){
 const db=await openMusicDatabase();
 try{return await new Promise((resolve,reject)=>{
  const transaction=db.transaction(STORE,mode),request=operation(transaction.objectStore(STORE));
  let result;
  request.onsuccess=()=>{result=request.result;};
  request.onerror=()=>reject(request.error??new Error('Could not read browser music storage'));
  transaction.oncomplete=()=>resolve(result);
  transaction.onabort=()=>reject(transaction.error??new Error('Browser music storage transaction failed'));
  transaction.onerror=()=>reject(transaction.error??new Error('Browser music storage transaction failed'));
 });}finally{db.close();}
}

export async function saveMusicAsset(blob){
 const assetId=await hashMusicBlob(blob);
 await accessMusicAsset('readwrite',store=>store.put(blob,assetId));
 return assetId;
}
export async function loadMusicAsset(assetId){
 if(typeof assetId!=='string'||!/^[0-9a-f]{64}$/.test(assetId))throw Error('Invalid imported music asset ID');
 return await accessMusicAsset('readonly',store=>store.get(assetId))??null;
}
