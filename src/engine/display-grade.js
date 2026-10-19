/** Display finishing, once after temporal integration. Defaults are an exact no-op. */
export function applyDisplayGrade(ctx,width,height,{colorContrast=1,colorSaturation=1}={}){
 const contrast=Math.max(.5,Math.min(1.8,Number(colorContrast)||1)),saturation=Math.max(0,Math.min(2.5,Number.isFinite(Number(colorSaturation))?Number(colorSaturation):1));
 if(contrast===1&&saturation===1)return;
 const frame=ctx.getImageData(0,0,width,height),data=frame.data;
 // ImageData is Uint8ClampedArray: assignment already performs the exact clamp
 // and round-to-even conversion. Keep the RGB math/order, without a nested loop.
 for(let i=0;i<data.length;i+=4){
  const r=data[i],g=data[i+1],b=data[i+2],luma=.2126*r+.7152*g+.0722*b;
  data[i]=(luma+(r-luma)*saturation-127.5)*contrast+127.5;
  data[i+1]=(luma+(g-luma)*saturation-127.5)*contrast+127.5;
  data[i+2]=(luma+(b-luma)*saturation-127.5)*contrast+127.5;
 }
 ctx.putImageData(frame,0,0);
}
