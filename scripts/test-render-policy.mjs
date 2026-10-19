import assert from 'node:assert/strict';
import {createRenderPlan, validateRenderPlan, overrideRenderPlan, resolveRenderPlan, estimateRenderSeconds} from '../src/engine/render-policy.js';

const caps = {threejs: {available: true}, cycles: {available: true, scenes: ['pulse'], device: 'METAL', devices: [{type: 'METAL', name: 'Verified Apple GPU'}], limits: {workers: 2}, measured: {secondsPerFrame: 2, width: 640, height: 480, samples: 64, device: 'METAL'}}};
const context = {scene: 'pulse', capabilities: caps, width: 1280, height: 960, fps: 25, duration: 4};
const standard = createRenderPlan();
assert.deepEqual(validateRenderPlan(standard), standard, 'Normalized plans must revalidate for recipe round trips.');
assert.equal(resolveRenderPlan(undefined, {scene: 'pulse'}).selectedRenderer, 'threejs');
assert.equal(resolveRenderPlan(undefined, {scene: 'pulse'}).runnable, true);

const photoreal = createRenderPlan({intent: 'photoreal', preferredRenderer: 'cycles', rationale: 'Metal and glass benefit from traced reflections.'});
assert.equal(resolveRenderPlan(photoreal, context).selectedRenderer, 'cycles');
assert.equal(resolveRenderPlan(photoreal, context).estimateSeconds, 800);
assert.equal(resolveRenderPlan(photoreal, {scene: 'pulse'}).selectedRenderer, 'threejs', 'Auto fallback requires real local preflight.');
assert.equal(resolveRenderPlan(photoreal, {...context, scene: 'camera'}).selectedRenderer, 'threejs', 'The Pulse converter must never claim other scenes work.');
assert.equal(resolveRenderPlan({...photoreal, budgetSeconds: 60}, context).selectedRenderer, 'threejs');
assert.equal(resolveRenderPlan({...photoreal, budgetSeconds: 900}, context).selectedRenderer, 'cycles');
assert.equal(resolveRenderPlan({...photoreal, budgetSeconds: 900}, {...context, capabilities: {...caps, cycles: {...caps.cycles, measured: undefined}}}).selectedRenderer, 'threejs', 'An unknown estimate cannot satisfy an agent time budget.');
assert.equal(estimateRenderSeconds({...photoreal, cycles: {...photoreal.cycles, device: 'cpu'}}, context), null, 'A GPU benchmark must not estimate CPU work.');

const user = overrideRenderPlan(photoreal, 'threejs');
assert.equal(user.source, 'user');
assert.equal(resolveRenderPlan(user, context).selectedRenderer, 'threejs', 'User engine override wins over the agent preference.');
const unsupported = resolveRenderPlan(overrideRenderPlan(photoreal, 'cycles'), {scene: 'camera', capabilities: caps});
assert.equal(unsupported.selectedRenderer, 'cycles');
assert.equal(unsupported.runnable, false, 'Explicit unsupported renderer blocks export instead of quietly producing different output.');
assert.equal(resolveRenderPlan(overrideRenderPlan(photoreal, 'cycles'), {...context, publicDemo: true}).runnable, false);
assert.equal(resolveRenderPlan(standard, {...context, publicDemo: true}).runnable, false);
assert.equal(resolveRenderPlan({...photoreal, renderer: 'cycles', cycles: {device: 'gpu'}}, {...context, capabilities: {cycles: {...caps.cycles, device: 'CPU', devices: [{type: 'CPU', name: 'CPU'}]}}}).runnable, false);
const cudaCapabilities = {threejs: {available: true}, cycles: {available: true, scenes: ['pulse'], device: 'CUDA', devices: [{type: 'CUDA', name: 'Verified NVIDIA GPU'}], limits: {workers: 2}, measured: {...caps.cycles.measured, device: 'CUDA'}}};
const cudaContext = {...context, capabilities: cudaCapabilities};
assert.equal(resolveRenderPlan({...photoreal, renderer: 'cycles', cycles: {device: 'gpu'}}, cudaContext).runnable, true, 'Generic GPU selection accepts any verified supported GPU backend.');
assert.equal(resolveRenderPlan({...photoreal, renderer: 'cycles', cycles: {device: 'metal'}}, cudaContext).runnable, false, 'Metal selection requires a verified Metal device.');
assert.equal(estimateRenderSeconds({...photoreal, cycles: {device: 'gpu'}}, cudaContext), 800, 'Generic GPU estimates accept a benchmark from a supported GPU backend.');
assert.equal(estimateRenderSeconds({...photoreal, cycles: {device: 'metal'}}, cudaContext), null, 'Metal estimates require a Metal benchmark.');
assert.equal(resolveRenderPlan({...photoreal, renderer: 'cycles', cycles: {device: 'metal'}}, context).runnable, true, 'Metal remains available with a verified Metal device.');

const mixed = createRenderPlan({renderer: 'mixed', composite: {enabled: true, planFile: 'project/pulse-composite.json'}, layers: [{id: 'product', renderer: 'cycles', role: 'beauty'}, {id: 'graphics', renderer: 'threejs', role: 'overlay', opacity: .7}], shots: [{id: 'hero', start: 0, end: 4, renderer: 'cycles'}]});
assert.equal(resolveRenderPlan(mixed, context).runnable, false, 'Metadata alone never enables a mixed export.');
assert.equal(resolveRenderPlan(mixed, {...context, capabilities: {...caps, mixed: {available: true, scenes: ['pulse']}}}).runnable, true);
const overridden = resolveRenderPlan(overrideRenderPlan(mixed, 'threejs'), context);
assert.deepEqual(overridden.layers.map(layer => layer.renderer), ['threejs', 'threejs']);
assert.equal(overridden.shots[0].renderer, 'threejs');
assert.equal(resolveRenderPlan(mixed, {...context, publicDemo: true}).runnable, false);

const mixedAudio = validateRenderPlan({...mixed, composite: {...mixed.composite, audioFile: 'renders/sound/pulse.wav', audioOffset: 1.25}});
assert.equal(mixedAudio.composite.audioFile, 'renders/sound/pulse.wav');
assert.equal(mixedAudio.composite.audioOffset, 1.25);
assert.deepEqual(validateRenderPlan(mixedAudio), mixedAudio, 'Prepared audio metadata must round trip with renderer recipes.');
assert.equal(standard.composite.audioFile, null);
assert.equal(standard.composite.audioOffset, 0);
for (const extension of ['wav', 'mp3', 'm4a', 'aac', 'mp4', 'mov', 'webm']) assert.equal(validateRenderPlan({composite: {audioFile: `sound/approved.${extension}`}}).composite.audioOffset, 0);

for (const invalid of [
  {renderer: 'octane'}, {version: 2}, {cycles: {samples: 0}}, {cycles: {workers: 3}},
  {cycles: {samples: '64'}}, {cycles: {command: 'echo unsafe'}}, {composite: {planFile: '../outside.json'}},
  {composite: {planFile: '/tmp/p.json'}},
  {composite: {audioFile: '../outside.wav'}}, {composite: {audioFile: '/tmp/source.wav'}},
  {composite: {audioFile: 'audio//source.wav'}}, {composite: {audioFile: 'audio/./source.wav'}},
  {composite: {audioFile: 'audio/source.exe'}}, {composite: {audioFile: 'audio/$(secret).wav'}},
  {composite: {audioFile: 'https://example.com/source.mp3'}}, {composite: {audioFile: 'audio/source.wav', audioOffset: 7201}},
  {composite: {audioFile: 'audio/source.wav', audioOffset: -1}}, {composite: {audioFile: 'audio/source.wav', audioOffset: '1'}},
  {composite: {audioFile: 'audio/source.wav', audioOffset: Infinity}}, {composite: {audioOffset: 1}}, {composite: {enabled: 'yes'}}, {layers: [{id: 'a', opacity: 2}]},
  {shots: [{id: 'a', start: 4, end: 3}]}, {shots: [{id: 'a', start: 0, end: 1}, {id: 'a', start: 1, end: 2}]},
  {layers: [{id: 'a'}, {id: 'a'}]}, {source: 'system'}, JSON.parse('{"__proto__":{"polluted":true}}'),
  {cycles: JSON.parse('{"constructor":"bad"}')}, {composite: {planFile: 'project//plan.json'}}
]) assert.throws(() => validateRenderPlan(invalid));
assert.equal({}.polluted, undefined);
console.log('Render policy: recipe round trips, measured estimates, user overrides, local capability gates, mixed plan readiness, prepared audio metadata and unsafe-input checks passed.');
