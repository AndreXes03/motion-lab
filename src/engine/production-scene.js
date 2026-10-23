import {appDemoNodes} from '../scenes/app-demo.js';
import {createProceduralDemo,proceduralTempo} from '../scenes/procedural-demo.js';
import {evaluateParameterAnimation} from './parameter-animation.js';
import {sampleProceduralMotion} from './sound-procedural.js';
import {sceneConfig} from '../scene-registry.js';

/** First production adapter. Legacy recipes remain intact; unsupported scenes are explicit. */
export const native2DScenes = Object.freeze(['procedural','appdemo']);
export function createProductionScene(parameters={}) {
  const scene=parameters.scene;
  if(!native2DScenes.includes(scene))throw Error(`No native 2D adapter for ${scene}. This scene still requires its legacy renderer.`);
  const config=sceneConfig(scene,parameters),graphics=scene==='appdemo'?{config:{seed:1},nodesAt:appDemoNodes}:createProceduralDemo(config);
  const source=structuredClone(parameters);
  return {
    config,
    evaluate(time) {
      if(!Number.isFinite(time))throw Error('Scene time must be finite');
      const t=Math.max(0,Math.min(config.duration,time));
      const sampled=evaluateParameterAnimation(source,t);
      return {version:1,kind:'framevolve.evaluated-2d',scene,time:t,width:1920,height:1080,seed:graphics.config.seed,nodes:graphics.nodesAt(t,sampled),parameters:sampled};
    },
    sampleMotion(rate=60) {
      if(!Number.isInteger(rate)||rate<1||rate>240)throw Error('Motion sampling rate must be 1..240');
      return {...sampleProceduralMotion(t=>graphics.nodesAt(t,evaluateParameterAnimation(source,t)),{duration:config.duration,rate,width:1920,height:1080,seed:graphics.config.seed}),musicBpm:scene==='appdemo'?100:proceduralTempo(source)};
    }
  };
}
