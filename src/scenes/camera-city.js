import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
/** Perimeter extension in the existing city's local coordinates. The drone corridor is left empty. */
export function buildCityExtension(parent,env){
 const root=new T.Group();root.name='city.perimeter';parent.add(root);const resources=new Set(),vehicles=[];
 const mat=(opts)=>{const m=new T.MeshPhysicalMaterial({...opts,envMap:env});resources.add(m);return m;};
 const asphalt=mat({color:'#10141c',roughness:.64,metalness:.08}),curb=mat({color:'#4b5058',roughness:.48,metalness:.35}),base=mat({color:'#0b1019',roughness:.36,metalness:.56});
 const skins=['#392d42','#656c78','#65676f','#596238'].map((color,i)=>mat({color,metalness:[.35,.8,.7,.75][i],roughness:.3,clearcoat:.3}));
 const trim=mat({color:'#202733',metalness:.75,roughness:.27}),glass=mat({color:'#122434',metalness:.3,roughness:.19,clearcoat:.7});
 const lamps=['#d8ff24','#95cfdf','#c08099'].map(color=>{const m=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.24,roughness:.45});resources.add(m);return m;});
 const mesh=(g,m,p=root)=>{resources.add(g);const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;p.add(o);return o;};
 const box=(w,h,d,r,m,p=root)=>mesh(new RoundedBoxGeometry(w,h,d,3,r),m,p);
 box(30,.16,44,.12,base).position.set(0,-.29,-10);
 // Connected north/south arterials and cross streets, narrow enough to preserve the tower blocks.
 for(const x of [0,-9,9]){box(x===0?2.45:1.35,.027,39,.01,asphalt).position.set(x,-.07,-7.5);for(const side of [-1,1])box(.075,.06,39,.015,curb).position.set(x+side*(x===0?1.28:.72),-.04,-7.5);}
 for(const z of [-25,-17.8,-11.4,-3.8,9]){box(20,.028,1.2,.01,asphalt).position.set(0,-.065,z);for(const side of [-1,1])box(20,.045,.07,.01,curb).position.set(0,-.045,z+side*.64);}
 const stripe=new T.MeshBasicMaterial({color:'#c1b9a7'});resources.add(stripe);
 for(let z=-24;z<9;z+=1.3)for(const x of [0,-9,9]){const o=mesh(new T.PlaneGeometry(.035,.46),stripe);o.rotation.x=-Math.PI/2;o.position.set(x,-.047,z);}
 // Crosswalks flank the junction, never run beneath a building footprint.
 for(const z of [-11.4,-3.8])for(const side of [-1,1])for(let k=0;k<7;k++){const o=mesh(new T.PlaneGeometry(.19,.5),stripe);o.rotation.x=-Math.PI/2;o.position.set((k-3)*.31,-.045,z+side*.91);}
 const windowGeo=new T.PlaneGeometry(.2,.27);resources.add(windowGeo);
 const coords=[];for(const z of [-13.6,-20.2,-22.4])for(const x of [-12.1,-6.1,-3.3,3.3,6.1,12.1])coords.push([x,z]);
 const buildings=[],windowMatrices=[[],[],[],[]];
 coords.forEach(([x,z],i)=>{
  const g=new T.Group();g.name=`city.perimeter.block.${i}`;g.position.set(x,0,z);root.add(g);const h=4.5+(i*7%9)*.42,w=1.65+(i%3)*.25,d=1.75+(i%2)*.27;buildings.push(g);
  const body=box(w,h,d,.13,skins[i%4],g);body.position.y=h/2;box(w+.1,.19,d+.1,.04,trim,g).position.y=h+.1;
  if(i%3===0){box(w*.67,.55,d*.72,.09,skins[(i+1)%4],g).position.y=h+.46;}
  for(const face of [0,1,2,3]){const depth=face%2?w:d,width=face%2?d:w,cols=3,rows=Math.floor((h-.7)/.61),angle=face*Math.PI/2;
   const dummy=new T.Object3D();for(let rr=0;rr<rows;rr++)for(let cc=0;cc<cols;cc++){dummy.position.set((cc-1)*width*.25,.62+rr*.61,depth/2+.014).applyAxisAngle(new T.Vector3(0,1,0),angle).add(g.position);dummy.rotation.set(0,angle,0);dummy.updateMatrix();windowMatrices[(rr*3+cc*7+i)%13<3?1+i%3:0].push(dummy.matrix.clone());}
  }
  for(const side of [-1,1])box(.035,h,.035,.008,curb,g).position.set(side*(w/2-.03),h/2,d/2+.02);
  const ac=box(.42,.24,.45,.035,curb,g);ac.position.set(.2,h+.24,-.2);
 });
 for(let i=0;i<4;i++){const windows=new T.InstancedMesh(windowGeo,i===0?glass:lamps[i-1],windowMatrices[i].length);windowMatrices[i].forEach((m,j)=>windows.setMatrixAt(j,m));windows.instanceMatrix.needsUpdate=true;windows.name='city.facades.batch.'+i;root.add(windows);}
 const tire=mat({color:'#090b10',roughness:.9,metalness:0}),metal=mat({color:'#9ca4ad',roughness:.3,metalness:.8});
 const carPaint=['#c4d24c','#567787','#979b98','#6e4d64'].map(color=>mat({color,roughness:.25,metalness:.35,clearcoat:.8}));
 const head=new T.MeshBasicMaterial({color:'#edeee5'}),tail=new T.MeshBasicMaterial({color:'#ae4936'});resources.add(head);resources.add(tail);
 function route(x0,x1,z0,z1){return new T.CatmullRomCurve3([[x0,z0],[x0,z1-.45],[x0+.3,z1],[x1-.3,z1],[x1,z1-.45],[x1,z0+.45],[x1-.3,z0],[x0+.3,z0]].map(([x,z])=>new T.Vector3(x,-.09,z)),true,'catmullrom',.2);}
 const routes=[route(-.55,.55,-24.7,8.7),route(-8.68,8.68,-17.4,-4.2),route(-9.27,9.27,-24.7,8.7)];
 for(let i=0;i<18;i++){
  const g=new T.Group();g.name=`city.traffic.${i}`;root.add(g);const length=i%7===0?.95:.64,width=.3,height=.13;
  box(width,height,length,.055,carPaint[i%4],g).position.y=.13;box(width*.8,.12,length*.48,.05,glass,g).position.set(0,.24,-.035);
  const wheels=[];for(const x of [-width*.48,width*.48])for(const z of [-length*.31,length*.31]){const pivot=new T.Group();pivot.position.set(x,.1,z);g.add(pivot);const o=mesh(new T.CylinderGeometry(.065,.065,.05,12),tire,pivot);o.rotation.z=Math.PI/2;const hub=mesh(new T.CylinderGeometry(.028,.028,.052,10),metal,pivot);hub.rotation.z=Math.PI/2;wheels.push(pivot);}
  for(const side of [-1,1]){box(.065,.025,.018,.007,head,g).position.set(side*.092,.165,length*.5+.005);box(.057,.021,.018,.006,tail,g).position.set(side*.092,.165,-length*.5-.005);}
  const curve=routes[i%3];vehicles.push({group:g,wheels,curve,phase:i*.071,speed:.013+(i%4)*.0018,length:curve.getLength()});
 }
 function update(t){for(const car of vehicles){const u=(car.phase+t*car.speed)%1,p=car.curve.getPointAt(u),v=car.curve.getTangentAt(u);car.group.position.copy(p);car.group.rotation.y=Math.atan2(v.x,v.z);for(const wheel of car.wheels)wheel.rotation.x=t*car.speed*car.length/.065;}}
 update(0);
 return {root,buildings,vehicles,update,dispose(){root.removeFromParent();for(const r of resources)r.dispose();}};
}
