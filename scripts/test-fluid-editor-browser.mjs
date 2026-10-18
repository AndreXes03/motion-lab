import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const output=new URL('../outputs/fluidity/',import.meta.url);await mkdir(output,{recursive:true});
const idle=()=>page.evaluate(()=>window.motionPreview.whenIdle());
const state=()=>page.evaluate(()=>window.qaFluid);
async function beginDrag(locator,dx,dy){await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await idle();}
try{
 await page.goto('http://127.0.0.1:4194/?scene=objects&render=1');await page.waitForFunction(()=>window.motionPreview&&window.motion?.ready);await idle();
 await page.evaluate(()=>{const render=window.motion.render;window.motion.render=(time,options)=>{window.qaFluid={time,parameters:structuredClone(options.parameters)};return render(time,options);};});
 await page.locator('#experience-pro').click();await page.locator('#tab-motion').click();await idle();
 const source=page.locator('#motion-native-graph');await page.waitForFunction(()=>document.getElementById('motion-native-graph').dataset.source==='keys');
 await source.locator('[data-native-key="1"]').click();await source.locator('[data-native-key="2"]').click({modifiers:['Shift']});
 assert.equal(await source.locator('[data-native-key][aria-pressed=true]').count(),2);
 const before=await state(),beforeCanvas=await page.locator('#renderCanvas').evaluate(canvas=>canvas.toDataURL());
 await beginDrag(source.locator('[data-native-key="1"]'),24,-16);
 const live=await state(),nativeBefore=before.parameters.motion.tracks['camera.position'],nativeLive=live.parameters.motion.tracks['camera.position'];
 assert.notDeepEqual(nativeLive,nativeBefore,'Source keys must update before pointerup');
 assert.ok(Math.abs((nativeLive[2].t-nativeLive[1].t)-(nativeBefore[2].t-nativeBefore[1].t))<1e-6,'Multi-key source spacing stays fixed');
 assert.deepEqual(nativeLive[1].value.slice(1),nativeBefore[1].value.slice(1),'Other vector axes stay unchanged');
 assert.notEqual(await page.locator('#renderCanvas').evaluate(canvas=>canvas.toDataURL()),beforeCanvas,'Preview pixels update before release');
 await page.mouse.up();await idle();await page.locator('#undo-edit').click();await idle();assert.deepEqual((await state()).parameters.motion,before.parameters.motion,'Whole group gesture undoes once');
 await page.locator('#tab-motion').click();await source.locator('[data-native-key="1"]').click();await source.locator('[data-native-key="2"]').click({modifiers:['Shift']});
 await beginDrag(source.locator('[data-native-key="1"]'),20,-12);await source.press('Escape');await page.mouse.up();await idle();assert.deepEqual((await state()).parameters.motion,before.parameters.motion,'Escape cancels multi-key source gesture');
 // Scrubbing updates both the film and the timeline while the pointer is held.
 await source.scrollIntoViewIfNeeded();const box=await source.boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+12);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+12,{steps:6});await idle();
 const scrub=await state();assert.ok(scrub.time>1&&scrub.time<2.2);assert.equal(Number(await page.locator('#seek').inputValue()),Math.round(scrub.time*30));assert.deepEqual(scrub.parameters.motion,before.parameters.motion,'Scrubbing never edits motion');await page.mouse.up();
 // Native handles preview the segment interior rather than an unchanged endpoint.
 await source.locator('[data-native-key="1"]').click();await page.locator('#motion-source-ease').selectOption('bezier');await page.locator('#motion-source-save').click();await idle();
 await beginDrag(source.locator('[data-native-handle="0"]'),18,-14);const handle=await state();assert.ok(handle.time>.65&&handle.time<1.1,'Handle preview shows the changed segment interior');await page.mouse.up();
 // Retime multiple landmarks together in a function-authored scene.
 await page.locator('#scene').selectOption('pop');await page.locator('#tab-motion').click();await idle();await page.waitForFunction(()=>document.querySelectorAll('#motion-native-graph [data-retime-key]').length>=4);
 await source.locator('[data-retime-key="1"]').click();await source.locator('[data-retime-key="2"]').click({modifiers:['Shift']});assert.equal(await source.locator('[data-retime-key][aria-pressed=true]').count(),2);
 await beginDrag(source.locator('[data-retime-key="1"]'),16,0);const retimed=await state();assert.ok(retimed.parameters.animation.groups.camera.keys.length>=4);assert.ok(Math.abs(retimed.parameters.animation.groups.camera.keys[2].t-retimed.parameters.animation.groups.camera.keys[1].t-.625)<1e-6);await page.mouse.up();await idle();
 await page.locator('#undo-edit').click();await idle();assert.equal((await state()).parameters.animation,undefined,'One undo removes the full first retime gesture');
 // Source/retime box selection and keyboard move never write on selection alone.
 await source.scrollIntoViewIfNeeded();const b=await source.boundingBox();await page.keyboard.down('Shift');await page.mouse.move(b.x+10,b.y+5);await page.mouse.down();await page.mouse.move(b.x+b.width-10,b.y+b.height-5,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');assert.ok(await source.locator('[data-retime-key][aria-pressed=true]').count()>=3);assert.equal((await state()).parameters.animation,undefined);
 await source.press('Shift+ArrowRight');await idle();assert.ok((await state()).parameters.animation);
 await page.screenshot({path:new URL('02-fluid-editor.png',output).pathname});
 // Shared numeric label scrubbing is live, undoable and cancellable.
 await page.locator('#scene').selectOption('objects');await idle();await page.locator('#tab-look').click();const label=page.locator('label[for=control-fov]');const old=Number(await page.locator('#control-fov-number').inputValue());await beginDrag(label,8,0);assert.equal(Number(await page.locator('#control-fov-number').inputValue()),old+8);await page.mouse.up();await page.locator('#undo-edit').click();await idle();assert.equal(Number(await page.locator('#control-fov-number').inputValue()),old);
 await beginDrag(label,9,0);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(Number(await page.locator('#control-fov-number').inputValue()),old);

 // Local clock/parameter curves share the same multi-selection and live transaction.
 await page.locator('#tab-motion').click();await page.locator('#motion-advanced > summary').click();await page.locator('#motion-edit-mode').selectOption('retime');
 const clock=page.locator('#motion-timing-graph');await clock.scrollIntoViewIfNeeded();const cb=await clock.boundingBox();await page.mouse.dblclick(cb.x+cb.width*.5,cb.y+cb.height*.5);await idle();
 await clock.locator('[data-key-time]').nth(0).click();await clock.locator('[data-key-time]').nth(1).click({modifiers:['Shift']});assert.equal(await clock.locator('[data-key-time][aria-pressed=true]').count(),2);
 const clockBefore=structuredClone((await state()).parameters.animation);await beginDrag(clock.locator('[data-key-time]').nth(1),18,-8);const clockLive=(await state()).parameters.animation;
 assert.notDeepEqual(clockLive,clockBefore);await page.mouse.up();await page.locator('#undo-edit').click();await idle();assert.deepEqual((await state()).parameters.animation,clockBefore);
 // Recovery keeps the edited recipe and preview time on an ordinary local reload.
 await page.goto('http://127.0.0.1:4194/?scene=objects');await page.waitForFunction(()=>window.motionPreview);await page.locator('#tab-look').click();await page.locator('#control-fov-number').fill('81');await page.locator('#control-fov-number').press('Tab');
 await page.locator('#seek').evaluate(input=>{input.value=42;input.dispatchEvent(new Event('input',{bubbles:true}));});await idle();await page.reload();await page.waitForFunction(()=>window.motionPreview);await idle();assert.equal(await page.locator('#control-fov-number').inputValue(),'81');assert.equal(Number(await page.locator('#seek').inputValue()),42);
 assert.deepEqual(errors,[]);const report={passed:true,sourceMultiSelection:true,liveBeforeRelease:true,livePixels:true,rigidMultiMove:true,sharedAxesPreserved:true,scrubTimelineSync:true,handlePreviewInsideSegment:true,retimeMultiSelection:true,marquee:true,keyboardMove:true,oneUndoPerGesture:true,escapeCancels:true,numericLabelScrub:true,clockMultiSelection:true,sessionRecovery:true,errors};await writeFile(new URL('fluid-editor-checks.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
