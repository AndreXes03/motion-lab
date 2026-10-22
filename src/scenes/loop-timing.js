// Editorial timing shared by Studio and native export. The extra half second
// belongs only to the final reading hold; every earlier music accent stays put.
export const loopDuration=22.5;
export const loopWaveStart=4.8;
export const loopCuts=[0,90,119,144,159,231,259,288,316,372,399,428,456,470,513,540,568,618,675].map(f=>f/30);
