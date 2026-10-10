// Explicit presets keep expensive final sampling out of interactive previews.
export const renderQuality=Object.freeze({
 preview:Object.freeze({width:960,height:540,'temporal-samples':1,'bitrate-mbps':10}),
 lookdev:Object.freeze({width:2560,height:1440,'temporal-samples':1,'bitrate-mbps':28}),
 final:Object.freeze({width:1920,height:1080,'temporal-samples':24,'bitrate-mbps':28}),
 premium:Object.freeze({width:1920,height:1080,'temporal-samples':48,'bitrate-mbps':40,resume:'on'}),
 supersampled:Object.freeze({width:2560,height:1440,'temporal-samples':48,'bitrate-mbps':80,resume:'on'})
});
export function applyRenderQuality(options){
 if(!options.quality)return options;
 const preset=renderQuality[options.quality];if(!preset)throw Error('--quality must be preview, lookdev, final, premium or supersampled');
 return {...preset,...options};
}
