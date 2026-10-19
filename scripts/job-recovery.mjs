export const isActiveJob = job => ['running','queued'].includes(job.status) || job.recoveryActive === true;

export function processMayBeAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try { process.kill(pid,0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

export function recoveryState(job, currentSource) {
  if (!['failed','interrupted'].includes(job.status)) return {canRetry:false,retryReason:null};
  if (job.recoveryActive || processMayBeAlive(job.pid)) return {canRetry:false,retryReason:'The previous render process may still be running. Wait for it to finish before retrying.'};
  if (!job.snapshotAvailable) return {canRetry:false,retryReason:'The original saved render snapshot is missing.'};
  if (!job.sourceHash || job.sourceHash !== currentSource) return {canRetry:false,retryReason:'Project sources changed. Start a new render from the saved recipe; old frames cannot be resumed.'};
  return {canRetry:true,retryReason:null};
}

// A server restart never automatically executes queued or interrupted work.
export function interruptedState(record) {
  if (!['running','queued'].includes(record.status)) return {status:record.status,error:record.error??null};
  return {status:'interrupted',error:record.status==='queued'?'Studio restarted before this saved render started. Retry when ready.':'Studio restarted before this render finished. Retry the saved snapshot when ready.'};
}

export function createMaintenanceLease({now=Date.now,ttl=300000}={}) {
  let lease;
  const current=()=>{if(lease?.expiresAt<=now())lease=null;return lease;};
  return {
    active:()=>Boolean(current()),
    acquire(token,busy) {
      if (typeof token!=='string'||!/^[a-f0-9-]{36}$/.test(token)) throw Object.assign(Error('Invalid maintenance token'),{status:400});
      if (busy || (current()&&lease.token!==token)) throw Object.assign(Error('Studio is busy; update deferred.'),{status:409});
      lease={token,expiresAt:now()+ttl};return {expiresAt:lease.expiresAt};
    },
    release(token) { if(current()?.token===token)lease=null;return {released:!current()}; }
  };
}
