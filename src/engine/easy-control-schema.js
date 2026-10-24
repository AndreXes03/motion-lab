export const easyIconNames=['motion','text','lighting','color','finish','detail','size','depth','character','focus','glow','soft-light','balanced-light','dramatic-light'];
/** Easy choices are authored bundles of existing controls, never guessed slider ranges. */
export function validateEasyControls(input,catalog,selected){
 if(!Array.isArray(input)||input.length<1||input.length>5)throw Error('Easy needs 1–5 outcome controls');
 const defs=new Map(catalog.map(c=>[c.id,c])),ids=new Set(),targets=new Set();
 const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
 return input.map(group=>{
  if(!group||Object.keys(group).some(k=>!['id','label','help','choices','icon','presentation'].includes(k))||!text(group.id,40)||!/^[a-z][a-z0-9-]*$/.test(group.id)||ids.has(group.id)||!text(group.label,40)||!text(group.help,180)||!Array.isArray(group.choices)||group.choices.length<2||group.choices.length>3)throw Error('Invalid Easy control');
  if(group.icon!==undefined&&!easyIconNames.includes(group.icon))throw Error('Invalid Easy icon');
  if(group.presentation!==undefined&&!['choices','slider'].includes(group.presentation))throw Error('Invalid Easy presentation');
  ids.add(group.id);let expected;const choiceIds=new Set();
  const choices=group.choices.map(choice=>{
   if(!choice||Object.keys(choice).some(k=>!['id','label','values','icon'].includes(k))||!text(choice.id,40)||!/^[a-z][a-z0-9-]*$/.test(choice.id)||choiceIds.has(choice.id)||!text(choice.label,24)||!choice.values||Array.isArray(choice.values)||typeof choice.values!=='object')throw Error('Invalid Easy choice');
   if(choice.icon!==undefined&&!easyIconNames.includes(choice.icon))throw Error('Invalid Easy choice icon');
   choiceIds.add(choice.id);const keys=Object.keys(choice.values).sort();if(!keys.length||keys.length>15)throw Error('Easy choices need 1–15 real controls');
   if(expected&&JSON.stringify(keys)!==JSON.stringify(expected))throw Error('Choices must affect the same controls');expected=keys;
   for(const [id,value]of Object.entries(choice.values)){
    const def=defs.get(id);if(!def||!selected.includes(id)||id==='contrast')throw Error('Easy target must be a selected direct control: '+id);
    if(def.type==='range'?(!Number.isFinite(value)||value<def.min||value>def.max):def.type==='toggle'?typeof value!=='boolean':def.type==='color'?!/^#[0-9a-f]{6}$/i.test(value):true)throw Error('Invalid Easy value: '+id);
   }
   return {id:choice.id,label:choice.label.trim(),values:{...choice.values},...(choice.icon?{icon:choice.icon}:{})};
  });
  if(group.presentation==='slider'&&(choices.length!==3||choices.some(c=>Object.entries(c.values).some(([id,v])=>defs.get(id).type!=='range'||typeof v!=='number'))))throw Error('Easy sliders need three numeric anchors');
  if(new Set(choices.map(c=>JSON.stringify(expected.map(id=>c.values[id])))).size!==choices.length)throw Error('Easy choices must produce different results');
  for(const id of expected){if(targets.has(id))throw Error('Easy controls must not compete for '+id);targets.add(id);}
  return {id:group.id,label:group.label.trim(),help:group.help.trim(),choices,...(group.icon?{icon:group.icon}:{}),...(group.presentation?{presentation:group.presentation}:{})};
 });
}
