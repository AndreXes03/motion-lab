import {sceneConfig, isNewScene} from '../scene-registry.js';
import {resolveParameters} from '../engine/project-controls.js';
import {createControlManifest} from '../engine/control-catalog.js';
import {createRenderPlan} from '../engine/render-policy.js';
import {normalizeSoundState} from './sound-state.js';
import defaultLook from '../../project/look.json' with {type:'json'};
import savedMotion from '../../project/motion.json' with {type:'json'};
import recommendations from '../../project/render-plans.json' with {type:'json'};

/** Build an example without touching the current workspace, playback or undo stack. */
export function freshSceneSnapshot(scene,{cyclesStandalone=false}={}) {
 const config=sceneConfig(scene), parameters=resolveParameters(scene);
 const temporalSamples=isNewScene(scene)&&['pulse','camera'].includes(scene)?4:1;
 parameters.look??=structuredClone(defaultLook);
 parameters.motion=structuredClone(savedMotion);
 parameters.objectEdits={};
 Object.assign(parameters,normalizeSoundState());
 parameters.renderPolicy=createRenderPlan(recommendations.scenes[scene]??{});
 if(cyclesStandalone)parameters.renderPolicy.cycles.workers=1;
 parameters.studio={values:{},preset:'original',lookOverrides:{},controlManifest:createControlManifest(scene)};
 return {config,parameters,start:0,end:config.duration,temporalSamples,exportSettings:{width:1920,height:1080,fps:30,format:'mp4',bitrateMbps:16,temporalSamples}};
}
