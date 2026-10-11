import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A still-only construction pass on the reused PULSE asset. No film is changed.
export function detailHeadphones(root) {
  const owned = [];
  const material = (options) => {
    const m = new T.MeshStandardMaterial(options);
    m.userData.photoFinish = true;
    owned.push(m);
    return m;
  };
  const porcelain = material({ color: '#dfdccb', roughness: .27, metalness: .06 });
  const rubber = material({ color: '#090c11', roughness: .88 });
  const titanium = material({ color: '#85939c', roughness: .23, metalness: 1 });
  const fabric = material({ color: '#101922', roughness: .95 });
  const mesh = (geometry, m) => { owned.push(geometry); return new T.Mesh(geometry, m); };
  const displaySource=document.createElement('canvas');displaySource.width=96;displaySource.height=40;
  const dc=displaySource.getContext('2d');dc.fillStyle='#01070b';dc.fillRect(0,0,96,40);
  dc.fillStyle='#b6fff0';dc.font='bold 12px monospace';dc.fillText('PULSE',5,14);
  dc.fillStyle='#73b1af';dc.font='6px monospace';dc.fillText('96k / 24bit',5,24);
  dc.fillStyle='#e9b769';for(let i=0;i<22;i++){const h=2+8*Math.pow(Math.sin(i*.53),2);dc.fillRect(5+i*3.7,37-h,2,h);}
  dc.fillStyle='#7affc3';dc.fillRect(81,5,9,4);
  const pixels=dc.getImageData(0,0,96,40).data,screenCanvas=document.createElement('canvas');
  screenCanvas.width=1152;screenCanvas.height=480;const sc=screenCanvas.getContext('2d');sc.fillStyle='#000';sc.fillRect(0,0,1152,480);
  for(let y=0;y<40;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4;for(let channel=0;channel<3;channel++){const rgb=[0,0,0];rgb[channel]=pixels[i+channel];sc.fillStyle=`rgb(${rgb.join(',')})`;sc.fillRect(x*12+channel*4+1,y*12+2,2,8);}}
  const screenMap=new T.CanvasTexture(screenCanvas);screenMap.colorSpace=T.SRGBColorSpace;screenMap.magFilter=T.NearestFilter;owned.push(screenMap);
  const printCanvas=document.createElement('canvas');printCanvas.width=1024;printCanvas.height=512;const pc=printCanvas.getContext('2d');pc.fillStyle='#555';pc.fillRect(0,0,1024,512);pc.save();pc.translate(775,160);pc.rotate(-.38);pc.lineWidth=2;pc.strokeStyle='rgba(185,185,185,.38)';for(let i=0;i<30;i++){pc.beginPath();pc.ellipse(0,0,15+i*3.6,24+i*5.5,0,.15,Math.PI*1.83);pc.stroke();}pc.restore();
  const printMap=new T.CanvasTexture(printCanvas);printMap.colorSpace=T.NoColorSpace;owned.push(printMap);
  const display=material({color:'#101010',emissive:'#ffffff',emissiveMap:screenMap,emissiveIntensity:3.2,roughness:.22,roughnessMap:printMap,metalness:.03});
  // Smooth silhouettes remain smooth in the extreme close-up.
  root.traverse(o=>{if(o.geometry?.type==='TorusGeometry'){const p=o.geometry.parameters;const refined=new T.TorusGeometry(p.radius,p.tube,48,192,p.arc);owned.push(refined);o.geometry=refined;}});
  root.traverse(o=>{if(o.geometry?.type==='CylinderGeometry'){const p=o.geometry.parameters,g=new T.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,192,24,p.openEnded),a=g.attributes.position,n=g.attributes.normal;for(let i=0;i<a.count;i++){if(Math.abs(n.getY(i))>.5)continue;const x=a.getX(i),y=a.getY(i),z=a.getZ(i),theta=Math.atan2(z,x),fade=Math.sin(Math.PI*(y/p.height+.5))**2,relief=.0007*fade*(.65*Math.sin(theta*83+y*99)+.35*Math.sin(theta*31-y*137));a.setXYZ(i,x+n.getX(i)*relief,y,z+n.getZ(i)*relief);}g.computeVertexNormals();owned.push(g);o.geometry=g;}});
  const cups = [];
  root.traverse(o => { if (o.children.some(c => c.geometry?.type === 'CylinderGeometry')) cups.push(o); });
  for (const cup of cups) {
    const side = Math.sign(cup.position.x);
    const thread=material({color:'#494e54',roughness:.92});
    const stitchGeometry=new T.CapsuleGeometry(.0017,.013,3,5);owned.push(stitchGeometry);
    for(const seam of [-.17,.17]){const stitches=new T.InstancedMesh(stitchGeometry,thread,88);const helper=new T.Object3D();for(let i=0;i<88;i++){const a=i/88*Math.PI*2;helper.position.set(seam,Math.cos(a)*.5715,Math.sin(a)*.5715);helper.rotation.set(a,0,Math.PI/2);helper.updateMatrix();stitches.setMatrixAt(i,helper.matrix);}cup.add(stitches);}
    for (const child of cup.children) if (child.geometry?.type === 'CircleGeometry') child.visible = false;
    const shape = new T.Shape();
    for(let i=0;i<=256;i++){const a=i/256*Math.PI*2;const x=Math.cos(a)*.492,y=Math.sin(a)*.492;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
    const windowHole=new T.Path();windowHole.moveTo(-.285,-.14);windowHole.lineTo(-.285,.14);windowHole.lineTo(.285,.14);windowHole.lineTo(.285,-.14);windowHole.closePath();shape.holes.push(windowHole);
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
      const px = x * .047 + (Math.abs(y) % 2) * .0235, py = y * .043;
      if (Math.hypot(px, py) > .433 || (Math.abs(px)<.31&&Math.abs(py)<.17)) continue;
      const hole = new T.Path();
      hole.absarc(px, py, .0115, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const grille = mesh(new T.ExtrudeGeometry(shape, { depth: .012, bevelEnabled: true, bevelSegments:2, bevelSize:.0013, bevelThickness:.001, curveSegments:8 }), porcelain);
    grille.rotation.y = side * Math.PI / 2;
    grille.position.x = side * .286;
    cup.add(grille);
    const module=new T.Group();module.rotation.y=side*Math.PI/2;module.position.x=side*.286;cup.add(module);
    const chassis=mesh(new RoundedBoxGeometry(.584,.294,.024,5,.018),titanium);chassis.position.z=.001;module.add(chassis);
    const seal=mesh(new RoundedBoxGeometry(.550,.260,.012,5,.012),rubber);seal.position.z=.016;module.add(seal);
    const oled=mesh(new T.PlaneGeometry(.518,.216),display);oled.position.z=.023;module.add(oled);

    const backing = mesh(new T.CircleGeometry(.488, 96), fabric);
    backing.rotation.y = side * Math.PI / 2;
    backing.position.x = side * .279;
    cup.add(backing);
    const gasket = mesh(new T.TorusGeometry(.503, .012, 16, 128), rubber);
    gasket.rotation.y = Math.PI / 2;
    gasket.position.x = side * .285;
    cup.add(gasket);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + .2;
      const screw = mesh(new T.CylinderGeometry(.014, .014, .009, 16), titanium);
      screw.rotation.z = Math.PI / 2;
      screw.position.set(side * .305, Math.cos(angle) * .463, Math.sin(angle) * .463);
      cup.add(screw);
      const slot = mesh(new T.BoxGeometry(.001, .003, .017), rubber);
      slot.position.copy(screw.position); slot.position.x += side * .005;
      cup.add(slot);
    }
    const cushion = mesh(new T.TorusGeometry(.409, .075, 32, 128), fabric);
    cushion.rotation.y = Math.PI / 2;
    cushion.position.x = -side * .267;
    cup.add(cushion);
  }
  return () => owned.forEach(resource => resource.dispose());
}
