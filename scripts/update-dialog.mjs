import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function confirmUpdate({revision,files}={}){
 if(process.platform!=='darwin')return false;
 const message='A new Framevolve version is available'+(revision?' ('+revision.slice(0,8)+')':'')+'. Update now?'+(files?' '+files+' distribution files will change.':'')+' Your local work is checked before replacement. Choose Later to use the installed version.';
 try{const {stdout}=await exec('/usr/bin/osascript',['-e','on run argv\nset result to display dialog (item 1 of argv) with title "Framevolve update" buttons {"Later", "Update"} default button "Update" cancel button "Later"\nreturn button returned of result\nend run',message]);return stdout.trim()==='Update';}catch{return false;}
}
export async function notifyUpdate(message){
 console.error('Framevolve: '+message);
 if(process.platform==='darwin')try{await exec('/usr/bin/osascript',['-e','on run argv\ndisplay dialog (item 1 of argv) with title "Framevolve update" buttons {"OK"} default button "OK"\nend run',message]);}catch{}
}
