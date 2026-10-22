import {Canvas} from 'skia-canvas';
// CPU-only allocation: no WebGL, GPU device or browser process.
export function createNativeCanvas(width=1,height=1){const canvas=new Canvas(width,height);canvas.gpu=false;return canvas;}
