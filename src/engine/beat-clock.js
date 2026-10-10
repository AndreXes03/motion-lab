/** Absolute-time beat clock: seeking never depends on the previous frame. */
export const clamp01 = value => Math.max(0, Math.min(1, value));
export const ease = value => { const p=clamp01(value); return p*p*(3-2*p); };
export function beatClock(time, bpm=120) {
 if (!Number.isFinite(time)||!Number.isFinite(bpm)||bpm<=0) throw Error('Invalid beat clock');
 const beat=Math.max(0,time)*bpm/60, phase=beat-Math.floor(beat);
 return {beat,index:Math.floor(beat),phase,pulse:Math.exp(-phase*9),seconds:60/bpm};
}
export function springIn(time,start,{decay=8,frequency=12}={}) {
 const t=Math.max(0,time-start); return time<start?0:1-Math.exp(-decay*t)*Math.cos(frequency*t);
}
