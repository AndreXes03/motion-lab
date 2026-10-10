import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
// Loudspeaker construction follows the original rig rather than adding new motion.
export function addSpeakerHardware(rig,materials,ledFrame){
 // Replace the solid rear cap with an actual open basket mouth. All original
 // mesh objects survive, so the approved visibility and diaphragm motion stay.
 const housing=rig.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===1.6);
 if(housing){const old=housing.geometry;housing.geometry=new T.CylinderGeometry(1.6,1.6,.38,128,1,true);old.dispose();housing.name='speaker.open-cast-mounting-band';}
 const surround=rig.children.find(o=>o.geometry?.type==='TorusGeometry'&&o.geometry.parameters.radius===1.27);
 if(surround){const profile=[];for(let i=0;i<=64;i++){const u=i/64;profile.push(new T.Vector2(1.18+.17*u,-.012-.018*u+.117*Math.sin(Math.PI*u)));}const old=surround.geometry;surround.geometry=new T.LatheGeometry(profile,192).rotateX(Math.PI/2);old.dispose();surround.name='speaker.moulded-rubber-half-roll';}
 const diaphragm=rig.children.find(o=>o.geometry?.type==='LatheGeometry'&&o.geometry.parameters.points?.length===101);
 if(diaphragm){const profile=[];for(let i=0;i<=160;i++){const u=i/160,r=.29+u;const corrugation=.006*Math.sin(Math.PI*14*u)*Math.min(1,u*3);profile.push(new T.Vector2(r,.59-.43*u+.018*u*(1-u)+corrugation));}const old=diaphragm.geometry;diaphragm.geometry=new T.LatheGeometry(profile.reverse(),192);old.dispose();diaphragm.name='speaker.pressed-paper-diaphragm';}
 const {black,silver,orange}=materials;const group=new T.Group();group.name='speaker.basket-and-terminal-assembly';rig.add(group);
 const copper=new T.MeshStandardMaterial({color:'#b46e39',metalness:.85,roughness:.3}),rubber=black.clone();rubber.color.set('#121314');rubber.roughness=.9;
 const matrix=new T.Matrix4(),quat=new T.Quaternion(),scale=new T.Vector3(1,1,1);
 function batch(parent,name,geo,mat,poses){const o=new T.InstancedMesh(geo,mat,poses.length);o.name=name;poses.forEach((p,i)=>{quat.setFromEuler(new T.Euler(...(p.r??[0,0,0])));o.setMatrixAt(i,matrix.compose(new T.Vector3(...p.p),quat,new T.Vector3(...(p.s??[1,1,1]))));});o.castShadow=o.receiveShadow=true;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();parent.add(o);return o;}
 function mesh(geo,mat,p,r=[0,0,0],parent=group){const o=new T.Mesh(geo,mat);o.position.set(...p);o.rotation.set(...r);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 const circle=(n,r,z,offset=0)=>Array.from({length:n},(_,i)=>{const a=i/n*2*Math.PI+offset;return{p:[Math.sin(a)*r,Math.cos(a)*r,z],r:[0,0,-a]};});
 // Real suspension and basket: space between struts remains open.
 for(const [r,z] of [[1.48,-.40],[.76,-.90]])mesh(new T.TorusGeometry(r,.035,8,96),silver,[0,0,z]);
 const struts=[];for(let i=0;i<12;i++){const a=i/12*2*Math.PI,p=new T.Vector3(Math.sin(a)*1.48,Math.cos(a)*1.48,-.42),q=new T.Vector3(Math.sin(a)*.75,Math.cos(a)*.75,-.88),delta=q.clone().sub(p);const g=new T.Mesh(new RoundedBoxGeometry(.12,delta.length(),.09,2,.02),black);g.position.copy(p.add(q).multiplyScalar(.5));g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());group.add(g);}
 mesh(new T.LatheGeometry([new T.Vector2(.17,-.11),new T.Vector2(.73,-.11),new T.Vector2(.73,.11),new T.Vector2(.17,.11),new T.Vector2(.17,-.11)],96),rubber,[0,0,-.94],[Math.PI/2,0,0]);
 mesh(new T.LatheGeometry([new T.Vector2(.17,-.035),new T.Vector2(.67,-.035),new T.Vector2(.67,.035),new T.Vector2(.17,.035),new T.Vector2(.17,-.035)],96),silver,[0,0,-1.085],[Math.PI/2,0,0]);
 // Fabric spider bridges the coil to the basket, with concentric physical folds.
 const spiderProfile=[];for(let i=0;i<=72;i++){const u=i/72;spiderProfile.push(new T.Vector2(.56+.69*u,-.62+.028*Math.sin(u*Math.PI*12)));}
 const spiderMat=new T.MeshStandardMaterial({color:'#80633c',roughness:.93,metalness:0,side:T.DoubleSide});
 mesh(new T.LatheGeometry(spiderProfile,128),spiderMat,[0,0,0],[Math.PI/2,0,0]);
 // Vented pole piece avoids a sealed black puck at the rear of the motor.
 const motorRing=new T.Shape();motorRing.absarc(0,0,.60,0,Math.PI*2,false);const bore=new T.Path();bore.absarc(0,0,.16,0,Math.PI*2,true);motorRing.holes.push(bore);
 mesh(new T.ExtrudeGeometry(motorRing,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:2,curveSegments:64}),silver,[0,0,-1.16]);
 mesh(new T.CylinderGeometry(.155,.155,.22,48,1,true),rubber,[0,0,-1.07],[Math.PI/2,0,0]);
 batch(group,'speaker.voice-coil-windings',new T.TorusGeometry(.55,.01,6,64),copper,Array.from({length:14},(_,i)=>({p:[0,0,-.60-i*.018]})));
 batch(group,'speaker.front-washers',new T.TorusGeometry(.085,.017,8,24),black,circle(8,1.43,.233));
 batch(group,'speaker.fastener-recess',new T.BoxGeometry(.059,.016,.006),rubber,circle(8,1.43,.245));
 // The bolted connector block and paired terminals are visible during the turn.
 mesh(new RoundedBoxGeometry(.38,.28,.13,3,.035),rubber,[1.29,-.56,-.54]);
 for(const [dy,col] of [[-.07,'#bd5135'],[.07,'#25272a']]){const terminal=new T.MeshStandardMaterial({color:col,metalness:.15,roughness:.6});mesh(new T.CylinderGeometry(.049,.049,.18,20),terminal,[1.36,-.56+dy,-.65],[Math.PI/2,0,0]);mesh(new T.TorusGeometry(.05,.012,6,20),silver,[1.36,-.56+dy,-.74]);const points=[[1.35,-.56+dy,-.72],[1.13,-.72+dy,-.84],[.76,-.56+dy,-.74],[.57,-.38+dy,-.63]].map(p=>new T.Vector3(...p));mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.012,6,false),copper,[0,0,0]);}
 const holes=circle(24,1.565,-.135,Math.PI/24);batch(group,'speaker.basket-vent-insets',new RoundedBoxGeometry(.06,.13,.015,2,.009),rubber,holes);
 // LED enclosure details remain attached to its own transform.
 const displayBolts=[];for(const x of[-1.40,1.40])for(const y of[-1.31,1.31])displayBolts.push({p:[x,y,.341],r:[Math.PI/2,0,0]});
 batch(ledFrame,'display.captive-screws',new T.CylinderGeometry(.045,.045,.018,6),silver,displayBolts);
 batch(ledFrame,'display.lower-vents',new RoundedBoxGeometry(.065,.018,.02,2,.004),rubber,Array.from({length:12},(_,i)=>({p:[-.55+i*.1,-1.46,.274]})));
 // Distinct hardware roles on the same object: elastomer seal, anodised rails,
 // and a visible folded rear heat spreader rather than another coloured slab.
 const anodized=new T.MeshStandardMaterial({color:'#737f83',metalness:.82,roughness:.34});
 batch(ledFrame,'display.extruded-side-ribs',new RoundedBoxGeometry(.055,2.24,.11,3,.012),anodized,[-1,1].flatMap(side=>Array.from({length:3},(_,i)=>({p:[side*(1.52+i*.027),0,-.05-i*.040]}))));
 batch(ledFrame,'display.gasket-reveal',new RoundedBoxGeometry(.035,2.69,.024,3,.009),rubber,[-1,1].map(side=>({p:[side*1.51,0,.341]})));
 const rearPlate=new T.Mesh(new RoundedBoxGeometry(2.68,2.49,.024,5,.12),anodized);rearPlate.position.z=-.177;ledFrame.add(rearPlate);
 batch(ledFrame,'display.rear-folded-heat-fins',new RoundedBoxGeometry(.065,1.88,.085,3,.010),rubber,Array.from({length:16},(_,i)=>({p:[-1.05+i*.14,0,-.222]})));
 return group;
}
