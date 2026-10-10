// The lens follows a shallow elliptical dolly without stopping at waypoints.
// replayEditTime supplies the deliberately sharp accelerations at each edit.
export function replayCameraPose(t){
 const a=.86*t-1.05;
 return {position:[1.05*Math.sin(a),.25*Math.sin(a*1.65+.4),7.16+.62*Math.cos(a)],
 target:[.08*Math.sin(a+.3),.025*Math.cos(a*1.2),0],roll:.025*Math.sin(a+.5)};
}
