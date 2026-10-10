// Local, seek-deterministic impact envelopes. Values never reverse an exploded
// component through its assembled seat; front glass and seal use the same phase.
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => { const q=clamp(v); return q*q*(3-2*q); };
export const pulseImpactCues = Object.freeze({landing:4.45,release:7.52,lock:9.62});

export function landingLift(time) {
  if(time < 4.25 || time >= 4.71) return 0;
  if(time <= pulseImpactCues.landing) {
    const q=clamp((time-4.25)/.20);
    return .28*(1-Math.pow(q,5.5));
  }
  const dt=time-pulseImpactCues.landing;
  return .058*Math.exp(-19*dt)*Math.abs(Math.sin(36*dt))*(1-smooth((dt-.16)/.10));
}

export function explodedImpact(time,index=0,kind='shell') {
  // Rear rails clear first, then the carrier; glass and seal stay rigidly paired.
  const delay={support:0,back:.010,cable:.016,shell:.022,front:.030}[kind]??0;
  const tileDelay=[.024,.012,0,.016,.032][index]??0;
  const start=pulseImpactCues.release+delay+tileDelay;
  const q=clamp((time-start)/.19);
  const opening=1-Math.pow(1-q,4);
  if(time<9.36) return opening;
  if(time<=pulseImpactCues.lock) return 1-Math.pow(clamp((time-9.36)/.26),6);
  const dt=time-pulseImpactCues.lock;
  if(dt>=.30) return 0;
  // A small outward recoil leaves every layer on its own side of the seat.
  return .055*Math.exp(-17*dt)*Math.abs(Math.sin(35*dt))*(1-smooth((dt-.20)/.10));
}
