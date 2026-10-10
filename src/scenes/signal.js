import * as T from 'three';
import {createDevice} from '../components/device.js';
import {clamp} from '../engine/timeline.js';
import {applyTracks} from '../engine/animation.js';
import motion from '../../project/motion.json';
export function createScene(renderer,config){
 const scene=new T.Scene();
 const bg=document.createElement('canvas');bg.width=32;bg.height=1024;const bc=bg.getContext('2d');const grad=bc.createLinearGradient(0,0,0,1024);grad.addColorStop(0,'#70a6d6');grad.addColorStop(.55,'#d3e3ef');grad.addColorStop(1,'#f5f4ef');bc.fillStyle=grad;bc.fillRect(0,0,32,1024);const bt=new T.CanvasTexture(bg);bt.colorSpace=T.SRGBColorSpace;scene.background=bt;
 // Large photographic softboxes create controlled reflection bands.
 const studio=new T.Scene();studio.background=new T.Color('#020306');
 function softbox(w,h,p,intensity){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color().setScalar(intensity),side:T.DoubleSide}));m.position.set(...p);m.lookAt(0,0,0);studio.add(m)}
 softbox(2,7,[-4,4,3],10);softbox(.5,6,[4,1,-1],8);softbox(6,1,[0,6,-2],7);
 const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.03).texture;scene.environmentIntensity=.45;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
 const camera=new T.PerspectiveCamera(62,16/9,.1,100);const device=createDevice(config);scene.add(device.group);
 const fill=new T.HemisphereLight('#b4d8ff','#000000',.07);scene.add(fill);
 const key=new T.SpotLight('#fff4e4',185,20,.40,.45,2);key.position.set(-2.5,4.3,4.8);key.target.position.set(.7,1.2,.3);scene.add(key,key.target);
 const edge=new T.DirectionalLight('#7dbbff',2.7);edge.position.set(4,1,-4);scene.add(edge);
 const top=new T.DirectionalLight('#ffffff',1.2);top.position.set(-3,6,-2);scene.add(top);

 function update(time,parameters={}){const t=clamp(time,0,config.duration);const look=parameters.look;
 camera.fov=look.camera.fov;camera.updateProjectionMatrix();key.intensity=look.lighting.key;key.color.set(look.lighting.keyColor||'#fff4e4');edge.color.set(look.lighting.rimColor||'#7dbbff');key.position.fromArray(look.lighting.keyPosition||[-2.5,4.3,4.8]);key.target.position.fromArray(look.lighting.keyTarget||[.7,1.2,.3]);key.angle=look.lighting.keyAngle??.4;key.penumbra=look.lighting.keyPenumbra??.45;edge.position.fromArray(look.lighting.rimPosition||[4,1,-4]);fill.intensity=look.lighting.fill;edge.intensity=look.lighting.rim;scene.environmentIntensity=look.lighting.environment;
 device.plastic.roughness=look.surface.shellRoughness;device.plastic.bumpScale=look.surface.grainScale;
 applyTracks(scene,camera,parameters.motion||motion,t,look.motion.amount);
 device.plastic.color.set(parameters.shell||config.palette.shell);device.orange.color.set(parameters.knob||config.palette.knob);device.setDisplay(parameters.display??config.text.display);return t;}

 return {scene,camera,update};
}
