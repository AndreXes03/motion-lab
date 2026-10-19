import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPreviewFrameCache, previewFrameKey} from '../src/viewer/preview-frame-cache.js';
import {defaultEditorialEdit} from '../src/engine/editorial.js';

// Browser-free component harness: actual callbacks and lifecycle execute; the
// renderer records distinguishable pixels so stale/aliased frames are visible.
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.className = ''; this.value = ''; this.width = 1; this.height = 1; this.pixel = 0; this.classList = {toggle: (name, enabled) => { const set = new Set(this.className.split(' ').filter(Boolean)); if (enabled) set.add(name); else set.delete(name); this.className = [...set].join(' '); }}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) { const found = []; const walk = node => { for (const child of node.children ?? []) { if (selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : child.tagName === selector) found.push(child); walk(child); }}; walk(this); return found; }
  focus() { this.focused = true; }
  remove() { this.removed = true; }
  getContext() { return {drawImage: source => { this.pixel = source.pixel; }}; }
}
globalThis.document = {createElement: tag => new Node(tag)};
globalThis.window = {matchMedia: () => ({matches: false})};
async function browserModule(relative) {
  const url = new URL(relative, import.meta.url);
  const source = (await readFile(url, 'utf8')).replace(/^import ['"].*\.css['"];\n/gm, '').replace(/^import \{icon\} from ['"].*studio-icons\.js['"];$/m, 'const icon = () => \"\";').replace(/from (['"])(\.\.?\/[^'"]+)\1/g, (_, quote, path) => `from ${quote}${new URL(path, url).href}${quote}`);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const {mountStoryboardPanel, createStoryboardThumbnailer} = await browserModule('../src/viewer/storyboard-panel.js');
const {mountPreviewQuality} = await browserModule('../src/viewer/preview-quality.js');
const copy = frame => ({width: frame.width, height: frame.height, pixel: frame.pixel});
const releases = [];
const cache = createPreviewFrameCache({maxEntries: 2, maxBytes: 32, cloneFrame: copy, releaseFrame: frame => releases.push(frame)});
const identity = {scene:'launch',revision:2,time:1,width:2,height:2,quality:'full'};
const key = previewFrameKey(identity);
for (const [property, value] of Object.entries({scene:'pulse',revision:3,time:1.0000000001,width:3,height:3,quality:'fast',review:'clay'})) assert.notEqual(key, previewFrameKey({...identity,[property]:value}));
assert.throws(() => previewFrameKey({...identity, time: NaN}));
const live = {width:2,height:2,pixel:11}; cache.set(key,live); live.pixel = 22;
const first = cache.get(key); assert.equal(first.pixel,11); first.pixel = 44; assert.equal(cache.get(key).pixel,11);
cache.set('b',{width:2,height:2,pixel:2}); cache.get(key); cache.set('c',{width:2,height:2,pixel:3});
assert.equal(cache.has('b'),false); assert.equal(cache.stats.entries,2); assert.equal(cache.stats.bytes,32); assert.equal(releases.length,1);
assert.equal(cache.set('oversize',{width:3,height:3,pixel:0}),false); cache.clear(); assert.equal(cache.stats.bytes,0); cache.dispose(); assert.equal(cache.set('late',live),false);

{
  let parameters = {scene:'launch'}, time = 0, changes = [], content;
  const mount = new Node('div');
  const panel = mountStoryboardPanel({container:mount,getScene:()=>parameters.scene,getParameters:()=>parameters,getTime:()=>time,onChange:edit=>{changes.push(edit);parameters={...parameters,edit};},onSeek:value=>{time=value;},onContentEdit:value=>{content=value;}});
  assert.equal(mount.querySelectorAll('.storyboard-shot').length,5);
  assert.equal(mount.querySelectorAll('canvas').every(canvas=>canvas.hidden),true,'Unrendered cards use honest text labels.');
  const baseline = defaultEditorialEdit('launch');
  const rows = mount.querySelectorAll('.storyboard-shot');
  rows[1].querySelectorAll('.storyboard-order')[0].children[0].onclick();
  assert.equal(parameters.edit.clips[0].id,baseline.clips[1].id); assert.equal(baseline.clips[0].id,'shot-1');
  const duration = mount.querySelector('.storyboard-timing').querySelectorAll('input')[2]; duration.value='7'; duration.onchange();
  assert.equal(parameters.edit.clips[0].duration,7);
  mount.querySelector('.storyboard-content').onclick(); assert.equal(content.index,1); assert.equal(content.clip.id,'shot-2');
  const invalid = mount.querySelector('.storyboard-timing').querySelectorAll('input')[0]; invalid.value='10'; invalid.onchange();
  assert.match(mount.querySelector('.storyboard-status').textContent,/source window/); assert.equal(parameters.edit.clips[0].sourceStart,4);
  mount.querySelector('.storyboard-reset').onclick(); assert.deepEqual(parameters.edit,baseline);
  parameters={scene:'starter'}; panel.refresh(); assert.equal(mount.querySelectorAll('.storyboard-shot').length,1); panel.destroy();
}
{
  let releasePreparation; const frames = [], calls = [], disposed = [];
  const thumbnailer = createStoryboardThumbnailer({createCanvas:()=>new Node('canvas'),cloneFrame:copy,releaseFrame:()=>{},yieldTask:async()=>{},onFrame:(id,frame)=>frames.push([id,frame.pixel]),createRuntime:async({canvas,scene})=>({prepare:async()=>{ if(scene==='launch') await new Promise(resolve=>{releasePreparation=resolve;}); },render:(time,options)=>{assert.equal(options.parameters.edit,undefined);canvas.width=240;canvas.height=135;canvas.pixel=time;calls.push([scene,time]);},dispose:()=>disposed.push(scene)})});
  const old = thumbnailer.request({scene:'launch',parameters:{scene:'launch',edit:defaultEditorialEdit('launch')},shots:[{id:'old',time:2}]});
  for(let i=0;i<6&&!releasePreparation;i++)await Promise.resolve(); assert.equal(typeof releasePreparation,'function');
  const latest = thumbnailer.request({scene:'starter',parameters:{scene:'starter'},shots:[{id:'new',time:3}]});
  releasePreparation(); await old; await latest;
  assert.deepEqual(frames,[['new',3]]);assert.deepEqual(calls,[['starter',3]]);assert.deepEqual(disposed,['launch']);
  await thumbnailer.request({scene:'starter',parameters:{scene:'starter'},shots:[{id:'new',time:3}]}); assert.equal(calls.length,1,'Matching thumbnails reuse pixels.');
  thumbnailer.dispose(); assert.deepEqual(disposed,['launch','starter']); assert.equal(thumbnailer.stats.entries,0);
  await thumbnailer.request({scene:'starter',parameters:{},shots:[]}); assert.equal(calls.length,1);
}
{
  let scene='pulse'; const container=new Node('div'), output={width:1080,height:1920};
  const quality=mountPreviewQuality({container,getScene:()=>scene,getOutputSettings:()=>output});
  assert.equal(quality.getSettings(true).quality,'fast'); assert.equal(quality.getSettings(false).quality,'full');
  assert.equal(quality.getSettings(false).height,Math.round(640*1920/1080));
  for(let i=0;i<5;i++)quality.reportFrame(130); assert.equal(quality.getSettings(false).width,384);
  for(let i=0;i<5;i++)quality.reportFrame(20); assert.equal(quality.getSettings(false).width,640);
  scene='launch';quality.syncScene();assert.equal(quality.getSettings(true).quality,'full');
  quality.setMode('sharp');assert.equal(quality.getSettings(true).quality,'full'); assert.equal(quality.getSettings().width,960);
  quality.setMode('render');assert.deepEqual([quality.getSettings().width,quality.getSettings().height],[1080,1920]);
  assert.equal(output.width,1080,'Preview preferences never alter export dimensions.');
}
console.log('Storyboard/preview: reorder, timing, validation, content hooks, scene reset, real thumbnail reuse, stale suppression, renderer disposal, exact bounded LRU, alias safety and adaptive aspect-aware preview passed.');
