import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, realpath, stat, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { install, mergeClaude, checkNode, SOURCE_COMMIT } from '../installers/macos/install.mjs';
const exec = promisify(execFile), root = fileURLToPath(new URL('..', import.meta.url));
const runReal = async (cmd, args, cwd) => (await exec(cmd, args, { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } })).stdout.trim();
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
async function fixture(t) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'motion-download-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = path.join(base, 'sorgente'), home = path.join(base, 'casa con spazi');
  await mkdir(source); await mkdir(home);
  const files = ['scripts/install-mac-launcher.mjs', 'scripts/launch-studio.mjs', 'plugins/motion-lab/server.mjs', 'plugins/motion-lab/mcp.json', 'plugins/motion-lab/.codex-plugin/plugin.json', 'plugins/motion-lab/plugin.json'];
  for (const file of files) { await mkdir(path.dirname(path.join(source, file)), { recursive: true }); await copyFile(path.join(root, file), path.join(source, file)); }
  await writeFile(path.join(source, 'package.json'), '{"name":"motion-lab","type":"module"}');
  await writeFile(path.join(source, 'index.html'), '<h1>Fixture</h1>');
  await writeFile(path.join(source, 'vite.config.js'), 'export default {}');
  await writeFile(path.join(source, '.gitignore'), 'node_modules/\n');
  await runReal('git', ['init', '-b', 'main'], source);
  await runReal('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'add', '.'], source);
  await runReal('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'], source);
  const sha = await runReal('git', ['rev-parse', 'HEAD'], source), calls = [];
  const deps = { platform: 'darwin', home, codexConfigFile: path.join(home, '.codex/config.toml'), sourceURL: source, sourceCommit: sha, find: async name => name, chromeAvailable: async () => true, claudeAvailable: async () => true };
  deps.run = async (cmd, args, cwd) => {
    calls.push({ cmd, args, cwd });
    if (cmd === 'npm') {
      if (args[0] === '--version') return '11';
      const target = path.join(cwd, cwd.endsWith('plugin') ? 'node_modules/@modelcontextprotocol/sdk' : 'node_modules/vite');
      await mkdir(target, { recursive: true }); await writeFile(path.join(target, 'package.json'), '{}'); return '';
    }
    if (cmd === 'codex') {
      if (args.includes('--help')) return 'supported';
      if (args[1] === 'list') return args.includes('--marketplace') ? '{"plugins":[{"name":"motion-lab","installed":true,"enabled":true}]}' : '{"plugins":[]}';
      return '{}';
    }
    return runReal(cmd, args, cwd);
  };
  const options = variant => ({ variant, destination: path.join(home, 'install ' + variant), applications: path.join(home, 'app ' + variant) });
  return { base, home, source, sha, calls, deps, options };
}
test('Studio installs an exact local Git pin into new destination and creates a real executable app', async t => {
  const f = await fixture(t), options = f.options('studio');
  const result = await install(options, f.deps);
  assert.equal(result.status, 'installed'); assert.equal(result.sourceCommit, f.sha);
  assert.equal(await runReal('git', ['rev-parse', 'HEAD'], result.repository), f.sha);
  const executable = path.join(result.launcher, 'Contents/MacOS/MotionLabLauncher');
  assert.ok((await stat(executable)).mode & 0o111);
  const shell = await readFile(executable, 'utf8'); assert.ok(shell.includes(result.repository)); assert.ok(shell.includes('--port 4198'));
  assert.equal(f.calls.filter(c => c.cmd === 'npm' && c.args[0] === 'ci').length, 1);
  assert.equal(f.calls.some(c => c.cmd === 'codex'), false);
  await assert.rejects(install(options, f.deps), /già esistente/);
  assert.equal(await runReal('git', ['status', '--porcelain'], result.repository), '');
});
test('Claude merges only MCP entry, preserves settings with byte-for-byte backup, rejects bad/existing config', async t => {
  const f = await fixture(t), file = path.join(f.home, 'Library/Application Support/Claude/claude_desktop_config.json');
  await mkdir(path.dirname(file), { recursive: true });
  const original = '{\n "preferences":{"theme":"dark"}, "mcpServers":{"other":{"command":"keep"}}\n}\n';
  await writeFile(file, original);
  const result = await install({ ...f.options('claude'), claudeConfig: file }, f.deps);
  assert.equal(result.status, 'installed'); assert.equal(await readFile(result.configBackup, 'utf8'), original);
  const config = await readJson(file); assert.deepEqual(config.preferences, { theme: 'dark' }); assert.deepEqual(config.mcpServers.other, { command: 'keep' });
  assert.ok(config.mcpServers['motion-lab'].args.includes(result.repository));
  const saved = await readFile(file, 'utf8');
  await assert.rejects(mergeClaude(file, { command: 'different' }), /già motion-lab/);
  assert.equal(await readFile(file, 'utf8'), saved);
  await writeFile(file, '{invalid');
  await assert.rejects(mergeClaude(file, {})); assert.equal(await readFile(file, 'utf8'), '{invalid');
});
test('Codex uses real marketplace schema/official commands after install and backs up config without editing other settings', async t => {
  const f = await fixture(t), config = path.join(f.home, '.codex/config.toml');
  await mkdir(path.dirname(config)); await writeFile(config, 'model = "keep"\n');
  const result = await install(f.options('codex'), f.deps);
  assert.equal(await readFile(config, 'utf8'), 'model = "keep"\n'); assert.equal(await readFile(result.configBackup, 'utf8'), 'model = "keep"\n');
  const market = path.join(path.dirname(result.repository), 'marketplace');
  const manifest = await readJson(path.join(market, '.agents/plugins/marketplace.json'));
  assert.deepEqual(manifest.plugins[0].source, { source: 'local', path: './plugins/motion-lab' });
  const mcp = await readJson(path.join(market, 'plugins/motion-lab/mcp.json'));
  assert.equal(path.isAbsolute(mcp.mcpServers['motion-lab'].command), true);
  assert.ok(mcp.mcpServers['motion-lab'].args.includes(result.repository));
  assert.ok(f.calls.find(c => c.cmd === 'codex' && c.args.join(' ') === 'plugin add motion-lab@motion-lab-beta --json'));
  assert.ok(f.calls.findIndex(c => c.cmd === 'codex' && c.args[1] === 'add' && !c.args.includes('--help')) > f.calls.findIndex(c => c.cmd === process.execPath));
});
test('Failures never report success or touch client config: dependencies, pin mismatch, missing clients/platform/Node, registration error', async t => {
  checkNode('22.12.0'); assert.throws(() => checkNode('22.11.0')); assert.throws(() => checkNode('20.19.0'));
  for (const failure of ['dependencies', 'pin', 'missing-codex', 'missing-claude', 'client']) {
    const f = await fixture(t), originalRun = f.deps.run;
    f.deps.run = async (cmd, args, cwd) => {
      if (failure === 'dependencies' && cmd === 'npm' && args[0] === 'ci') throw Error('fixture npm failure');
      if (failure === 'pin' && args.includes('rev-parse')) return '0'.repeat(40);
      if (failure === 'client' && cmd === 'codex' && args[1] === 'add' && !args.includes('--help')) throw Error('fixture CLI failure');
      return originalRun(cmd, args, cwd);
    };
    if (failure === 'missing-codex') f.deps.find = async name => { if (name === 'codex') throw Error('missing codex'); return name; };
    if (failure === 'missing-claude') f.deps.claudeAvailable = async () => false;
    const variant = failure === 'missing-claude' ? 'claude' : 'codex', options = f.options(variant);
    await assert.rejects(install(options, f.deps));
    if (!failure.startsWith('missing')) assert.equal((await readJson(path.join(options.destination, 'installation.json'))).status, 'failed');
    assert.equal(f.calls.some(c => c.cmd === 'git' && c.args.some(a => ['reset', 'stash', 'pull', 'clean', 'push'].includes(a))), false);
    if (failure !== 'client') assert.equal(f.calls.some(c => c.cmd === 'codex' && c.args[1] === 'add' && !c.args.includes('--help')), false);
  }
  const f = await fixture(t);
  await assert.rejects(install(f.options('studio'), { ...f.deps, platform: 'linux' }), /solo macOS/);
});
test('ZIPs are deterministic, integrity checked, executable, portable and pinned; output manifest matches', async t => {
  const f = await fixture(t), out = path.join(f.base, 'downloads');
  await runReal(process.execPath, [path.join(root, 'scripts/build-mac-downloads.mjs'), '--out', out]);
  const first = new Map(await Promise.all((await readdir(out)).map(async name => [name, await readFile(path.join(out, name))])));
  await runReal(process.execPath, [path.join(root, 'scripts/build-mac-downloads.mjs'), '--out', out]);
  for (const [name, data] of first) assert.deepEqual(await readFile(path.join(out, name)), data);
  const manifest = await readJson(path.join(out, 'manifest.json')); assert.equal(manifest.sourceCommit, SOURCE_COMMIT); assert.equal(manifest.assets.length, 3);
  // Python stdlib verifies ZIP CRC, extraction names, Unix permissions and every payload, independently of the writer.
  const code = "import zipfile,json,pathlib,sys,hashlib\np=pathlib.Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text())\nfor a in m['assets']:\n b=(p/a['file']).read_bytes();assert len(b)<50000;assert hashlib.sha256(b).hexdigest()==a['sha256']\n with zipfile.ZipFile(p/a['file']) as z:\n  assert z.testzip() is None;assert len(z.infolist())==4\n  for i in z.infolist():\n   assert '..' not in pathlib.PurePosixPath(i.filename).parts;assert not i.filename.startswith('/')\n   s=z.read(i).decode();assert '/Users/' not in s and '/workspace/' not in s and 'BEGIN PRIVATE KEY' not in s\n   if i.filename.endswith('.command'): assert (i.external_attr>>16)&0o111\n   if i.filename.endswith('SOURCE.json'): assert json.loads(s)['sourceCommit']==m['sourceCommit']\n";
  await runReal('python3', ['-c', code, out]);
});
