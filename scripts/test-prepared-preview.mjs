import assert from 'node:assert/strict';
import {isLoopPreviewCurrent} from '../src/viewer/prepared-preview-state.js';
assert.ok(isLoopPreviewCurrent({scene:'loop'}));
for(const change of [{sceneControls:{paletteHue:35}},{sceneControls:{explodeAmount:.5}},{look:{camera:{distance:.7}}},{look:{camera:{fovScale:1.3}}},{look:{post:{colorContrast:1.2}}},{animation:{groups:{camera:{rate:2}}}},{objectEdits:{product:{x:2}}}])assert.equal(isLoopPreviewCurrent({scene:'loop',...change}),false,'Never show stale prepared pixels after a visible edit');
assert.equal(isLoopPreviewCurrent({scene:'pulse'}),false);
assert.ok(isLoopPreviewCurrent({scene:'loop',sound:{enabled:false},studio:{panel:'motion'}}));
console.log('Prepared preview invalidation passed');
