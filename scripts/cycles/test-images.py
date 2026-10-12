"""Native Cycles persistent-data regression, using two actual baked PULSE backgrounds.
Blender --background --factory-startup --python scripts/cycles/test-images.py -- BAKE_DIR OUT_DIR
"""
import ast,base64,bpy,hashlib,json,os,sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];source=Path(args[0]);HERE=args[1];worker='regression';os.makedirs(os.path.join(HERE,'baked'),exist_ok=True)
function=next(n for n in ast.parse(Path(__file__).with_name('render.py').read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='png_image')
namespace={'base64':base64,'hashlib':hashlib,'bpy':bpy,'os':os,'HERE':HERE,'worker':worker,'immutable_images':{}}
exec(compile(ast.Module(body=[function],type_ignores=[]),'png_image','exec'),namespace);load=namespace['png_image']
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.use_persistent_data=True;scene.render.resolution_x=64;scene.render.resolution_y=64;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='METAL';p.get_devices();metal=[d for d in p.devices if d.type=='METAL']
for d in p.devices:d.use=d.type=='METAL'
if metal:scene.cycles.device='GPU'
world=bpy.data.worlds.new('world');world.use_nodes=True;scene.world=world;n=world.node_tree.nodes;l=world.node_tree.links;image=n.new('ShaderNodeTexImage');coord=n.new('ShaderNodeTexCoord');l.new(coord.outputs['Window'],image.inputs['Vector']);l.new(image.outputs['Color'],n.get('Background').inputs['Color'])
cam=bpy.data.cameras.new('camera');obj=bpy.data.objects.new('camera',cam);scene.collection.objects.link(obj);scene.camera=obj
records=[]
for sample in [400,554,400]:
 data=json.loads((source/'baked'/('snapshot_%04d.json'%sample)).read_text());im=load(data['background'],'color');image.image=im;scene.render.filepath=os.path.join(HERE,'sample-%d-%d.png'%(sample,len(records)));bpy.ops.render.render(write_still=True);proof=bpy.data.images.load(scene.render.filepath,check_existing=False);pixel=list(proof.pixels[:4]);records.append({'pixel':pixel,'sample':sample,'imagePointer':im.as_pointer(),'imageName':im.name,'file':scene.render.filepath})
assert max(abs(a-b) for a,b in zip(records[0]['pixel'],records[1]['pixel']))>.005
assert records[0]['pixel']==records[2]['pixel']
assert records[0]['imagePointer']!=records[1]['imagePointer']
assert records[0]['imagePointer']==records[2]['imagePointer']
Path(HERE,'regression.json').write_text(json.dumps({'persistentData':True,'device':'Metal' if metal else 'CPU','records':records},indent=2));print('MOTION_CYCLES '+json.dumps({'test':'immutable-background-images','passed':True,'records':records}))
