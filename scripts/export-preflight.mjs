import {mkdir,open,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
// Probe the actual filesystem, not an optimistic permissions bit check.
export async function verifyExportDestination(directory){
 let file,handle;try{await mkdir(directory,{recursive:true});file=path.join(directory,'.framevolve-write-check-'+randomUUID());handle=await open(file,'wx');await handle.write('Framevolve');await handle.close();handle=null;}
 catch(error){throw Error('Export cannot write to its destination ('+error.code+'). Choose a writable folder or restore permission before exporting.');}
 finally{await handle?.close();if(file)await rm(file,{force:true}).catch(()=>{});}
}
