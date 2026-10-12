/** Display finishing, once after temporal integration. Defaults are an exact no-op. */
export function applyDisplayGrade(ctx,width,height,{colorContrast=1,colorSaturation=1}={}){
 const contrast=Math.max(.5,Math.min(1.8,Number(colorContrast)||1)),saturation=Math.max(0,Math.min(2.5,Number.isFinite(Number(colorSaturation))?Number(colorSaturation):1));
 if(contrast===1&&saturation===1)return;
 const frame=ctx.getImageData(0,0,width,height),data=frame.data;
 for(let i=0;i<data.length;i+=4){const luma=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];for(let j=0;j<3;j++)data[i+j]=Math.max(0,Math.min(255,(luma+(data[i+j]-luma)*saturation-127.5)*contrast+127.5));}
 ctx.putImageData(frame,0,0);
}
