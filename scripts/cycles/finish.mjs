/** Same 8-bit display grade as src/engine/display-grade.js; alpha stays untouched. */
export function gradePixels(data,{colorContrast=1,colorSaturation=1}={},channels=4){
 const contrast=Math.max(.5,Math.min(1.8,Number(colorContrast)||1)),saturation=Math.max(0,Math.min(2.5,Number.isFinite(Number(colorSaturation))?Number(colorSaturation):1));
 if(contrast===1&&saturation===1)return data;
 const pixels=new Uint8ClampedArray(data.buffer,data.byteOffset,data.byteLength);
 for(let i=0;i<pixels.length;i+=channels){const luma=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];for(let j=0;j<3;j++)pixels[i+j]=Math.max(0,Math.min(255,(luma+(pixels[i+j]-luma)*saturation-127.5)*contrast+127.5));}
 return data;
}
