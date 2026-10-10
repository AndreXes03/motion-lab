import {ease} from './beat-clock.js';
/** A 2D camera over a whole composition, not over individual graphics.
 * Positions are the point of interest in design pixels. Absolute-time interpolation
 * makes arbitrary seeks and temporal supersampling reproduce the same shot.
 */
export function sampleGraphicCamera(time,shots){
 if(!Number.isFinite(time)||!Array.isArray(shots)||!shots.length)throw Error('Invalid graphic camera');
 let a=shots[0],b=a;for(let i=1;i<shots.length;i++){b=shots[i];if(time<=b.time)break;a=b;}
 const p=a===b||b.time===a.time?0:ease((time-a.time)/(b.time-a.time));
 const result={};for(const [key,fallback]of Object.entries({x:960,y:540,zoom:1,roll:0}))result[key]=(a[key]??fallback)+((b[key]??fallback)-(a[key]??fallback))*p;
 return result;
}
export function applyGraphicCamera(ctx,pose,{width=1920,height=1080}={}){ctx.translate(width/2,height/2);ctx.rotate(pose.roll);ctx.scale(pose.zoom,pose.zoom);ctx.translate(-pose.x,-pose.y);}
