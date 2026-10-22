export const creativeCriteria = [
 ['benefit','Product and benefit','Can a new viewer explain what the product does?'],
 ['legibility','Legibility','Check actual delivery size, contrast, cropping and text overlap.'],
 ['reading','Reading time','Watch the animated passage; leave enough settled time to read.'],
 ['brand','Brand fidelity','Check supplied logos, colors, UI and claims against the brief.'],
 ['rhythm','Rhythm and hierarchy','Check shot variety, purposeful motion and pauses.'],
 ['ending','Ending and next action','Check the final message and requested action.'],
 ['continuity','Continuity and sound','Watch transitions and listen to the complete cut.']
];
export function text(value,max=2000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Provide nonempty text within '+max+' characters.');return value.trim();}
export function sceneId(value){if(typeof value!=='string'||!/^[-a-z0-9]{1,60}$/.test(value))throw Error('Invalid scene.');return value;}
export function validateBoard(input,{duration=Infinity}={}){
 if(!input||input.version!==1)throw Error('Storyboard version must be 1.');
 const scene=sceneId(input.scene),title=text(input.title,100);
 if(!Array.isArray(input.shots)||input.shots.length<1||input.shots.length>24)throw Error('Use 1–24 named storyboard scenes.');
 const ids=new Set();let previous=-1;
 const shots=input.shots.map(s=>{const id=sceneId(s.id);if(ids.has(id))throw Error('Storyboard ids must be unique.');ids.add(id);
 if(!Number.isFinite(s.time)||s.time<0||s.time>=duration||s.time<previous)throw Error('Storyboard times must be ordered and inside the film.');previous=s.time;
 if(Object.keys(s).some(k=>!['id','name','time','intent','motion'].includes(k)))throw Error('Storyboard previews come from native scenes; external images and alternate recipes are not supported.');
 return {id,name:text(s.name,100),time:s.time,intent:text(s.intent,1000),motion:typeof s.motion==='string'?s.motion.slice(0,1000):''};});
 return {version:1,scene,title,shots};
}
export function normalizeAnchor(input,{duration,fps}){
 const scene=sceneId(input.scene);if(!Number.isFinite(input.time)||input.time<0||input.time>=duration)throw Error('Feedback position is outside the film.');
 if(!Number.isFinite(fps)||fps<=0)throw Error('Invalid frame rate.');const frame=Math.min(Math.ceil(duration*fps)-1,Math.round(input.time*fps));
 if(!input.snapshot?.parameters||input.snapshot.parameters.scene!==scene)throw Error('Feedback must include the settings of the same scene.');
 const snapshot=JSON.parse(JSON.stringify(input.snapshot));if(JSON.stringify(snapshot).length>256000)throw Error('Feedback settings are too large.');
 return {scene,time:frame/fps,frame,fps,snapshot,shotId:input.shotId?sceneId(input.shotId):null,shotName:typeof input.shotName==='string'?input.shotName.slice(0,100):null};
}
export function validateCreativeReview(input){
 if(!input||input.version!==1||!Array.isArray(input.checks)||!input.snapshot?.parameters||input.snapshot.parameters.scene!==input.scene)throw Error('A review needs its scene, recipe and checks.');
 if(!/^[a-f0-9]{64}$/.test(input.sourceRevision))throw Error('Review needs a current source revision.');
 if(input.checks.length!==creativeCriteria.length)throw Error('Review every creative criterion.');
 const seen=new Set(),checks=input.checks.map(c=>{if(!creativeCriteria.some(([id])=>id===c.id)||seen.has(c.id)||!['pass','fix','unverified'].includes(c.status))throw Error('Invalid creative criterion.');seen.add(c.id);return {id:c.id,status:c.status,evidence:text(c.evidence,2000)};});
 return {version:1,scene:sceneId(input.scene),sourceRevision:input.sourceRevision,snapshot:input.snapshot,checks};
}
export function parameterKey(snapshot){
 function sorted(x){if(Array.isArray(x))return x.map(sorted);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).filter(k=>!['studio','inspect','review'].includes(k)).sort().map(k=>[k,sorted(x[k])]));return x;}
 return JSON.stringify(sorted(snapshot?.parameters??{}));
}
