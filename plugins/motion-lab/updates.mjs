import { execFile } from 'node:child_process';

function git(root, args, timeout = 500) {
  return new Promise(resolve => execFile('git', args, { cwd: root, timeout, maxBuffer: 1024 * 1024, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS:'0' } }, (error, stdout) => resolve({ code: error ? error.code ?? 'failed' : 0, output: stdout?.trim() ?? '' })));
}

function expectedOrigin(value) {
  try {
    const normalized = value.startsWith('git@github.com:') ? `ssh://git@github.com/${value.slice(15)}` : value;
    const url = new URL(normalized);
    return ['https:', 'ssh:'].includes(url.protocol) && url.hostname === 'github.com' && !url.port && !url.password && !url.search && !url.hash && (url.protocol === 'ssh:' ? url.username === 'git' : !url.username) && url.pathname.replace(/\.git$/, '').toLowerCase() === '/andrexes03/motion-lab';
  } catch { return false; }
}

/** No fetch, cache, mutation, credential inspection, or PR refs. Each call performs its own bounded read. */
export async function checkUpdates(root) {
  const checkedAt = new Date().toISOString();
  const [head, branch, dirty, origin] = await Promise.all([
    git(root, ['rev-parse', '--verify', 'HEAD^{commit}']), git(root, ['branch', '--show-current']),
    git(root, ['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none']), git(root, ['config', '--get-all', 'remote.origin.url']),
  ]);
  const meta = { checkedAt, release: 'main', commit: head.code === 0 ? head.output : null, branch: branch.code === 0 ? branch.output || 'detached' : null, dirty: dirty.code === 0 ? Boolean(dirty.output) : null, remoteCommit: null, available: null, state: 'unknown', originVerified: origin.code === 0 && expectedOrigin(origin.output) };
  if (!meta.originVerified) return { ...meta, note: 'origin must identify AndreXes03/motion-lab on GitHub; remote check not attempted.' };
  const remote = await git(root, ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'], 3000);
  if (remote.code !== 0) return { ...meta, state: 'offline', note: 'Fresh main check unavailable or timed out; local tools remain available.' };
  const sha = remote.output.match(/^([a-f0-9]{40})\s+refs\/heads\/main$/)?.[1];
  if (!sha || !meta.commit) return meta;
  meta.remoteCommit = sha;
  const included = sha === meta.commit || (await git(root, ['merge-base', '--is-ancestor', sha, meta.commit], 250)).code === 0;
  return { ...meta, state: included ? 'current' : 'available', available: !included, note: included ? 'Fresh main is already included in this checkout; PR branches are not releases.' : 'Fresh main differs and is not known to be included. Ancestry may be unavailable without fetching; review manually. Nothing was installed.' };
}
