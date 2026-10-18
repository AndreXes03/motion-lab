/** Gains are always relative to the authored surface, never the previous frame. */
export const pulseControlGain=(controls,key,min,max)=>Number.isFinite(controls?.[key])?Math.max(min,Math.min(max,controls[key])):1;

export function createPulseSurfaceControls({shells=[],metals=[]}) {
  const capture=materials=>[...new Set(materials)].map(material=>({material,roughness:material.roughness}));
  const shellDefaults=capture(shells),metalDefaults=capture(metals);
  return function applySurfaceControls(controls) {
    for(const [entries,gain] of [
      [shellDefaults,pulseControlGain(controls,'shellRoughness',.25,2)],
      [metalDefaults,pulseControlGain(controls,'metalRoughness',.25,3)]
    ]) for(const {material,roughness} of entries)material.roughness=Math.max(0,Math.min(1,roughness*gain));
  };
}
