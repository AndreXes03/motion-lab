import assert from 'node:assert/strict';
import {normalizeCyclesOptions,parseCyclesArgs} from './options.mjs';
import {buildCyclesCommand,getCyclesCapabilities} from './studio.mjs';
const o=normalizeCyclesOptions({command:'export',out:'/tmp/test.mp4',width:1440,height:1920,fps:30,duration:1,device:'gpu',workers:2},{parameters:{scene:'pulse',sceneControls:{keyLight:1.5},animation:{groups:{mechanisms:{rate:.5}}}}});
assert.equal(o.count,30);assert.equal(o.device,'metal');assert.equal(o.parameters.sceneControls.keyLight,1.5);assert.equal(o.parameters.animation.groups.mechanisms.rate,.5);
assert.throws(()=>normalizeCyclesOptions({scene:'camera'}),/PULSE only/);
assert.throws(()=>normalizeCyclesOptions({command:'export',width:101}),/even/);
assert.throws(()=>normalizeCyclesOptions({samples:0}),/samples/);
assert.throws(()=>normalizeCyclesOptions({workers:3}),/workers/);
assert.throws(()=>normalizeCyclesOptions({denoise:'maybe'}),/on or off/);
assert.throws(()=>parseCyclesArgs(['frame','--out','/tmp/frame.png','--unknown','yes']),/Unknown/);
assert.equal(normalizeCyclesOptions({command:'frame',out:'/tmp/frame.png',time:13.9}).count,1);
const command=buildCyclesCommand({kind:'frame',snapshotPath:'/tmp/project.json',outputPath:'/tmp/frame.png',settings:{cyclesSamples:64,denoise:false,device:'metal'}});
assert.equal(command.args[1],'frame');assert.deepEqual(command.args.slice(-6),['--samples','64','--device','metal','--denoise','off']);
const missing=await getCyclesCapabilities({blenderPath:'/nonexistent/motion-lab-blender'});assert.equal(missing.available,false);assert.match(missing.reason,/unavailable/);
console.log('Cycles options, parameter preservation, limits and Studio command contract passed');
const transparent=normalizeCyclesOptions({command:'frame',out:'/tmp/transparent.png',background:'transparent'});assert.equal(transparent.background,'transparent');
assert.throws(()=>normalizeCyclesOptions({command:'export',out:'/tmp/transparent.mp4',background:'transparent'}),/cannot retain alpha/);
const pass=normalizeCyclesOptions({command:'export',out:'/tmp/pass.json',background:'transparent','sequence-only':'on',finish:'raw',duration:1});assert.equal(pass.sequenceOnly,true);assert.equal(pass.finish,'raw');
const {gradePixels}=await import('./finish.mjs');
const {applyDisplayGrade}=await import('../../src/engine/display-grade.js');
for(const grade of [{colorContrast:1,colorSaturation:1},{colorContrast:1.4,colorSaturation:0},{colorContrast:.5,colorSaturation:2.5}]){
 const input=new Uint8ClampedArray([24,80,240,31,255,1,64,127]);const expected=new Uint8ClampedArray(input);applyDisplayGrade({getImageData:()=>({data:expected}),putImageData:()=>{}},2,1,grade);const actual=Buffer.from(input);gradePixels(actual,grade);assert.deepEqual([...actual],[...expected]);assert.equal(actual[3],31);assert.equal(actual[7],127);
}
console.log('Transparent pass guards and exact shared display grade passed');
