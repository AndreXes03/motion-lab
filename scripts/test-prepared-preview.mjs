import assert from 'node:assert/strict';
import {isLoopPreviewCurrent} from '../src/viewer/prepared-preview-state.js';
assert.ok(isLoopPreviewCurrent({scene:'loop'}));
for(const change of [{sceneControls:{paletteHue:35}},{sceneControls:{explodeAmount:.5}},{look:{camera:{distance:.7}}},{look:{camera:{fovScale:1.3}}},{look:{post:{colorContrast:1.2}}},{animation:{groups:{camera:{rate:2}}}},{objectEdits:{product:{x:2}}}])assert.equal(isLoopPreviewCurrent({scene:'loop',...change}),false,'Never show stale prepared pixels after a visible edit');
assert.equal(isLoopPreviewCurrent({scene:'pulse'}),false);
assert.ok(isLoopPreviewCurrent({scene:'loop',sound:{enabled:false},studio:{panel:'motion'}}));
// The prepared movie can mute its existing soundtrack for the legacy generated toggle.
// A custom global mix must use the shared audio engine, including master boost and full mute.
for(const sound of [{master:.4},{master:0},{master:1},{muted:true},{music:.2}])assert.equal(isLoopPreviewCurrent({scene:'loop',sound}),false,'Custom audio uses the shared preview mixer');
assert.equal(isLoopPreviewCurrent({scene:'loop',sound:{master:.8,music:.38,muted:false}}),true,'Authored default mix keeps the prepared movie');
const track={id:'music',enabled:true};
assert.equal(isLoopPreviewCurrent({scene:'loop',audio:{tracks:[track]}}),false,'Imported music cannot play the baked soundtrack');
assert.equal(isLoopPreviewCurrent({scene:'loop',audio:{tracks:[{...track,enabled:false}]}}),true,'Disabled imports do not replace the authored mix');
console.log('Prepared preview: visual invalidation, legacy generated toggle, global master/mute and imported track selection passed');
