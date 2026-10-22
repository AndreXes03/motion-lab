// Scene texture canvases use an explicit platform factory; browser previews keep DOM canvases.
let factory=null;
export function setSceneCanvasFactory(next){const previous=factory;factory=next;return()=>{factory=previous;};}
export function createSceneCanvas(){if(factory)return factory();if(typeof document!=="undefined")return document.createElement('canvas');throw Error('Scene canvas factory is required outside the browser');}
