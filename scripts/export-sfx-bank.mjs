import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {soundDefaults,soundKits,renderSound,encodeWav} from '../src/engine/sound-design.js';
const dir=path.resolve(process.argv[2]||'renders/sound-design/sfx');await mkdir(dir,{recursive:true});const assets=[];
for(const [module,kits]of Object.entries(soundKits))for(const [index,kind]of kits.entries()){
 const duration=module==='camera'?1.1:module==='objects'?.8:.65;
 const settings={...soundDefaults,music:0,camera:.7,objects:.7,accents:.7};
 const plan={duration,rate:60,bpm:112,phase:0,settings,curves:{camera:[]},events:[{module,kind,time:.05,duration:duration-.15,gain:.6,pitch:1,pan:0,source:'audition'}]};
 const render=renderSound(plan);const filename=module+'-'+kind+'.wav';await writeFile(path.join(dir,filename),encodeWav(render.channels));assets.push({filename,module,kind,duration,origin:'Motion Lab procedural synthesis',seed:settings.seed});
}
await writeFile(path.join(dir,'manifest.json'),JSON.stringify({count:assets.length,sampleRate:48000,channels:2,assets},null,2));console.log(JSON.stringify({output:dir,count:assets.length}));
