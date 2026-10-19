import assert from 'node:assert/strict';
import {
  COMMERCIAL_DURATION, COMMERCIAL_LIMITS, createCommercialBrief,
  validateCommercialBrief, commercialShotPlan, briefToAgentPrompt
} from '../src/engine/commercial-brief.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
const baseline = createCommercialBrief();
assert.equal(baseline.duration, COMMERCIAL_DURATION);
assert.deepEqual(validateCommercialBrief(JSON.parse(JSON.stringify(baseline))), baseline);
const customized = createCommercialBrief({brand: {name: 'Acme', colors: {accent: '#AABBCC'}}, assets: {logo: {name: 'brand.png', src: png}}});
assert.equal(customized.brand.colors.accent, '#aabbcc');
assert.equal(customized.brand.colors.background, baseline.brand.colors.background);
assert.equal(customized.assets.logo.src, png);
customized.copy.features[0] = 'Changed';
assert.equal(createCommercialBrief().copy.features[0], baseline.copy.features[0], 'Default templates must be independent');

const recipe = {parameters: {scene: 'launch', commercial: customized, animation: {version: 1, tracks: {}}}};
const imported = JSON.parse(JSON.stringify(recipe));
assert.deepEqual(validateCommercialBrief(imported.parameters.commercial), customized, 'Embedded assets and editable copy survive recipe round-trip');
const normalized = validateCommercialBrief(customized);
normalized.assets.logo.name = 'different.png';
assert.equal(customized.assets.logo.name, 'brand.png', 'Validation cannot alias caller-owned assets');
assert.equal(createCommercialBrief({brand: {name: '  Acme  '}, copy: {url: ''}}).brand.name, 'Acme');
assert.equal(createCommercialBrief({copy: {url: 'https://example.com/product'}}).copy.url, 'https://example.com/product');

const invalid = [
  [{duration: 30}, /duration/], [{version: 2}, /version/],
  [{brand: {colors: {accent: 'red'}}}, /accent/],
  [{brand: {name: ''}}, /name/], [{brand: {name: 'x'.repeat(33)}}, /name/],
  [{copy: {features: ['one']}}, /three/], [{copy: {features: ['one', '', 'three']}}, /features/],
  [{copy: {headline: 'Line one\nline two'}}, /headline/],
  [{copy: {url: 'javascript:alert(1)'}}, /url/],
  [{copy: {url: 'https://user:pass@example.com'}}, /url/],
  [{assets: {logo: {name: 'remote.png', src: 'https://example.com/image.png'}}}, /embedded/],
  [{assets: {logo: {name: 'logo.svg', src: 'data:image/svg+xml;base64,PHN2Zz4='}}}, /embedded/],
  [{assets: {logo: {name: 'fake.png', src: 'data:image/png;base64,SGVsbG8='}}}, /format/],
  [{assets: {screenshots: Array.from({length: 4}, () => ({name: 'x.png', src: png}))}}, /up to 3/],
  [{assets: {logo: {name: 'logo.png', src: png, remote: true}}}, /unsupported/],
  [{runtimeApiKey: 'not-supported'}, /unsupported/],
  [JSON.parse('{"brand":{"__proto__":{"polluted":true}}}'), /unsupported/],
  [{brand: []}, /object/]
];
for (const [patch, pattern] of invalid) assert.throws(() => createCommercialBrief(patch), pattern);
assert.throws(() => validateCommercialBrief({version: 1}), /required/);
assert.throws(() => validateCommercialBrief({...baseline, copy: {...baseline.copy, features: undefined}}), /three/);
assert.equal({}.polluted, undefined);

const largePng = 'data:image/png;base64,' + 'iVBORw0KGgoA' + 'A'.repeat(Math.ceil(COMMERCIAL_LIMITS.assetData / 8) * 4);
assert.throws(() => createCommercialBrief({assets: {screenshots: [1, 2].map(index => ({name: `${index}.png`, src: largePng}))}}), /total 1.2 MB/);
const shots = commercialShotPlan(baseline);
assert.equal(shots[0].start, 0);
assert.equal(shots.at(-1).end, COMMERCIAL_DURATION);
shots.forEach((shot, index) => {
  assert(shot.end > shot.start);
  if (index) assert.equal(shot.start, shots[index - 1].end, 'Shot windows are contiguous');
});
shots[0].end = 99;
assert.equal(commercialShotPlan()[0].end, 4, 'Shot plans are independent');
const prompt = briefToAgentPrompt(customized);
assert(prompt.includes('Acme') && prompt.includes('brand.png'));
assert(!prompt.includes(png), 'Agent prompt must not duplicate embedded binary assets');
assert(prompt.includes('attach the exported recipe'));
console.log(JSON.stringify({passed: true, checks: ['strict brief validation', 'partial customization', 'portable recipe round-trip', 'asset protocol and budget', 'independent defaults', 'fixed deterministic shot timing', 'agent handoff']}));
