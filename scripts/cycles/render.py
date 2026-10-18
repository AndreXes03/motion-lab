import bpy,json,time,math,os,base64,sys,hashlib
from mathutils import Matrix
from array import array
HERE=os.environ['MOTION_CYCLES_DIR']
worker=os.environ.get('MOTION_CYCLES_WORKER','0')
metrics_name='metrics.json' if worker=='main' else 'metrics-'+worker+'.json'
start=time.perf_counter()
with open(os.path.join(HERE,'scene.json')) as f:data=json.load(f)
options=data['options']
sys.path.insert(0, os.path.dirname(__file__))
from progressive import preview_stages
def emit(type,**values):print('MOTION_CYCLES '+json.dumps({'type':type,**values}),flush=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=options['samples'];scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.015;scene.cycles.use_denoising=options['denoise'];scene.cycles.max_bounces=options['bounces']
scene.render.resolution_x=options['width'];scene.render.resolution_y=options['height'];scene.render.resolution_percentage=100;scene.render.fps=options['fps'];scene.frame_start=1;scene.frame_end=options['count']
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA' if options.get('background')=='transparent' else 'RGB';scene.render.film_transparent=options.get('background')=='transparent';scene.render.image_settings.color_depth='8';scene.render.use_motion_blur=options['motionBlur'];scene.render.motion_blur_shutter=options['shutter']
scene.render.use_persistent_data=True
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=math.log2(1.05)
device='CPU'
if options['device']!='cpu':
 try:
  p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='METAL';p.get_devices();names=[]
  for d in p.devices:
   d.use=d.type=='METAL'
   if d.use:names.append(d.name)
  if names:scene.cycles.device='GPU';device='Metal: '+', '.join(names)
  elif options['device']=='metal':raise RuntimeError('No Metal device is available')
 except Exception as e:
  if options['device']=='metal':raise
  emit('progress',phase='device',warning=str(e),device='CPU')
def matrix(a):return Matrix([a[i:i+4] for i in range(0,16,4)]).transposed()
images={}
def image(id,role):
    key=(id,role)
    if key in images:return images[key]
    t=data['textures'][id];im=bpy.data.images.new('texture_%s_%s'%key,width=t['width'],height=t['height'],alpha=True,float_buffer=t['float'])
    im.colorspace_settings.name='sRGB' if role=='color' and t['srgb'] else 'Non-Color'
    values=array('f') if t['float'] else array('B');values.frombytes(base64.b64decode(t['base64']));scale=1 if t['float'] else 1/255
    # CanvasTexture is flipped by Three.js on upload; DataTexture is not.
    if t['flipY']:
        stride=t['width']*4;values=[v for y in reversed(range(t['height'])) for v in values[y*stride:(y+1)*stride]]
    im.pixels.foreach_set(array('f',(v*scale for v in values)));im.update();im.pack();images[key]=im
    return im
def texture(nodes,links,id,role):
    t=data['textures'][id];node=nodes.new('ShaderNodeTexImage');node.image=image(id,role);node.extension='EXTEND' if t.get('clamp') else 'REPEAT'
    uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(*t['repeat'],1);mapping.inputs['Location'].default_value=(*t['offset'],0)
    links.new(uv.outputs['UV'],mapping.inputs['Vector']);links.new(mapping.outputs['Vector'],node.inputs['Vector']);return node
def socket(p,old,new=None):return p.inputs.get(old) or p.inputs.get(new or old)
materials=[]
for i,m in enumerate(data['materials']):
    material=bpy.data.materials.new(m['name'] or 'pulse_%d'%i);material.use_nodes=True;n=material.node_tree.nodes;l=material.node_tree.links;p=n.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*m['color'],1);p.inputs['Roughness'].default_value=m['roughness'];p.inputs['Metallic'].default_value=m['metalness']
    socket(p,'Emission','Emission Color').default_value=(*m['emissive'],1);p.inputs['Emission Strength'].default_value=m['emissiveIntensity'];socket(p,'Clearcoat','Coat Weight').default_value=m['clearcoat'];socket(p,'Clearcoat Roughness','Coat Roughness').default_value=m['clearcoatRoughness'];socket(p,'Transmission','Transmission Weight').default_value=m['transmission'];p.inputs['IOR'].default_value=m['ior']
    if m['map'] is not None:
        t=texture(n,l,m['map'],'color');mix=n.new('ShaderNodeMixRGB');mix.name='BaseTint';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*m['color'],1);l.new(t.outputs['Color'],mix.inputs[1]);l.new(mix.outputs[0],p.inputs['Base Color'])
    if m['roughnessMap'] is not None:
        t=texture(n,l,m['roughnessMap'],'data');rgb=n.new('ShaderNodeSeparateRGB');mul=n.new('ShaderNodeMath');mul.name='RoughnessGain';mul.operation='MULTIPLY';mul.inputs[1].default_value=m['roughness'];l.new(t.outputs['Color'],rgb.inputs[0]);l.new(rgb.outputs['G'],mul.inputs[0]);l.new(mul.outputs[0],p.inputs['Roughness'])
    if m['normalMap'] is not None:
        t=texture(n,l,m['normalMap'],'data');normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=m['normalScale'][0];l.new(t.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs[0],p.inputs['Normal'])
    if m['emissiveMap'] is not None:
        t=texture(n,l,m['emissiveMap'],'color');mix=n.new('ShaderNodeMixRGB');mix.name='EmissionTint';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*m['emissive'],1);l.new(t.outputs['Color'],mix.inputs[1]);l.new(mix.outputs[0],socket(p,'Emission','Emission Color'))
    if m['transparent']:
        p.inputs['Alpha'].default_value=m['opacity']
        if m['map'] is not None:l.new(t.outputs['Alpha'] if False else texture(n,l,m['map'],'color').outputs['Alpha'],p.inputs['Alpha'])
    if m['bumpMap'] is not None and m['normalMap'] is None:
        texNode=texture(n,l,m['bumpMap'],'data');bn=n.new('ShaderNodeBump');bn.inputs['Distance'].default_value=m['bumpScale'];l.new(texNode.outputs['Color'],bn.inputs['Height']);l.new(bn.outputs['Normal'],p.inputs['Normal'])
    if m['basic']:
        emission=n.new('ShaderNodeEmission');emission.inputs['Color'].default_value=(*m['color'],1);emission.inputs['Strength'].default_value=1
        if m['map'] is not None:l.new(n.get('BaseTint').outputs[0],emission.inputs['Color'])
        l.new(emission.outputs[0],n.get('Material Output').inputs['Surface'])
    materials.append(material)
mesh_cache={}
def load_geometry(id,material_ids):
    key=(id,tuple(material_ids))
    if key in mesh_cache:return mesh_cache[key]
    with open(os.path.join(HERE,'geometries',str(id)+'.json')) as f:o=json.load(f)
    g=bpy.data.meshes.new('geometry_%d'%id);pos=o['position'];verts=[pos[j:j+3] for j in range(0,len(pos),3)];idx=o['index'] if o['index'] else list(range(len(verts)));g.from_pydata(verts,[],[idx[j:j+3] for j in range(0,len(idx),3)]);g.update()
    for mid in material_ids:g.materials.append(materials[mid])
    for group in o['groups']:
        for p in g.polygons[group['start']//3:(group['start']+group['count'])//3]:p.material_index=min(group['materialIndex'],len(material_ids)-1)
    if o['uv']:
        uv=g.uv_layers.new(name='UVMap');coords=array('f')
        for loop in g.loops:coords.extend(o['uv'][loop.vertex_index*2:loop.vertex_index*2+2])
        uv.data.foreach_set('uv',coords)
    for p in g.polygons:p.use_smooth=True
    if o['normal']:
        if hasattr(g,'use_auto_smooth'):g.use_auto_smooth=True
        ns=o['normal'];g.normals_split_custom_set_from_vertices([ns[j:j+3] for j in range(0,len(ns),3)])
    mesh_cache[key]=g;return g
groups={}
for node in data['nodes']:
    group=bpy.data.objects.new('node_'+node['uuid'],None);scene.collection.objects.link(group);group.rotation_mode='QUATERNION';groups[node['uuid']]=group
for node in data['nodes']:
    if node['parent'] in groups:groups[node['uuid']].parent=groups[node['parent']]
objects={};omitted=[];instance_materials={}
for id,o in enumerate(data['objects']):
    # Screen-space reflector and painted contact-shadow layers have no native shader parity.
    if any(data['materials'][m]['type']=='ShaderMaterial' or (data['materials'][m]['basic'] and data['materials'][m]['transparent']) for m in o['materials']):omitted.append(id);continue
    obj=bpy.data.objects.new(o['name'],load_geometry(o['geometry'],o['materials']));scene.collection.objects.link(obj);obj.rotation_mode='QUATERNION';obj.parent=groups[o['parent']];obj.hide_render=True;objects[id]=obj
    if o.get('instanceColor') is not None:
        color=o['instanceColor']
        for slot,mid in enumerate(o['materials']):
            key=(mid,tuple(round(v,6) for v in color))
            if key not in instance_materials:
                material=materials[mid].copy();p=material.node_tree.nodes.get('Principled BSDF');base=data['materials'][mid]
                p.inputs['Base Color'].default_value=(*(base['color'][i]*color[i] for i in range(3)),1)
                socket(p,'Emission','Emission Color').default_value=(*(base['emissive'][i]*color[i] for i in range(3)),1)
                instance_materials[key]=material
            obj.material_slots[slot].link='OBJECT';obj.material_slots[slot].material=instance_materials[key]
        if o['name']=='individual LED epoxy lenses':obj.visible_shadow=False
instance_by_mid={}
for (mid,color),material in instance_materials.items():instance_by_mid.setdefault(mid,[]).append((color,material))
cam=bpy.data.cameras.new('PULSE camera');cam.sensor_fit='VERTICAL';cam.sensor_height=24;cam.clip_start=.1;cam.clip_end=100
camera=bpy.data.objects.new('PULSE camera',cam);scene.collection.objects.link(camera);camera.rotation_mode='QUATERNION';scene.camera=camera
lights={}
tracks={};quaternions={};last_matrices={}
def track(owner,path,values,frame):
    values=tuple(values);key=(owner.as_pointer(),path)
    if key not in tracks:tracks[key]={'owner':owner,'path':path,'points':[(frame,values)],'lastFrame':frame,'lastValue':values};return
    t=tracks[key]
    if values!=t['lastValue']:
        if t['lastFrame']!=t['points'][-1][0]:t['points'].append((t['lastFrame'],t['lastValue']))
        t['points'].append((frame,values));t['lastValue']=values
    t['lastFrame']=frame
def animate_transform(obj,values,frame):
    key=tuple(values)
    if last_matrices.get(obj.name)==key:
        # Keep the most recent hold time so the next motion key does not interpolate across a static pause.
        for prop in ['location','rotation_quaternion','scale']:
            t=tracks.get((obj.as_pointer(),prop))
            if t:t['lastFrame']=frame
        return
    last_matrices[obj.name]=key
    loc,q,scale=matrix(values).decompose();previous=quaternions.get(obj.name)
    if previous is not None and previous.dot(q)<0:q.negate()
    quaternions[obj.name]=q
    for prop,value in [('location',loc),('rotation_quaternion',q),('scale',scale)]:track(obj,prop,value,frame)
world=bpy.data.worlds.new('PULSE studio');world.use_nodes=True;scene.world=world;nodes=world.node_tree.nodes;nodes.clear();links=world.node_tree.links
out=nodes.new('ShaderNodeOutputWorld');mix=nodes.new('ShaderNodeMixShader');ray=nodes.new('ShaderNodeLightPath');links.new(ray.outputs['Is Camera Ray'],mix.inputs[0]);links.new(mix.outputs[0],out.inputs[0])
env=nodes.new('ShaderNodeTexEnvironment');coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping');mapping.inputs['Rotation'].default_value=(math.pi/2,0,0);links.new(coord.outputs['Generated'],mapping.inputs['Vector']);links.new(mapping.outputs[0],env.inputs['Vector']);env_bg=nodes.new('ShaderNodeBackground');links.new(env.outputs[0],env_bg.inputs['Color']);links.new(env_bg.outputs[0],mix.inputs[1])
bgtex=nodes.new('ShaderNodeTexImage');bgtex.extension='EXTEND';links.new(coord.outputs['Window'],bgtex.inputs['Vector']);bgshader=nodes.new('ShaderNodeBackground');links.new(bgtex.outputs['Color'],bgshader.inputs[0]);links.new(bgshader.outputs[0],mix.inputs[2])
previous=set();previous_lights=set();snapshots=[]
for obj in objects.values():track(obj,'hide_render',[1],.5)
for sample in range(data['report']['snapshotCount']):
    with open(os.path.join(HERE,'baked','snapshot_%04d.json'%sample)) as f:s=json.load(f)
    snapshots.append({'camera':s['camera'],'environment':s['environment'],'environmentIntensity':s['environmentIntensity'],'geometry':{o['id']:o['geometry'] for o in s['visible']},'background':s['background'],'dynamics':s['dynamics'],'exposure':s['exposure']})
    frame=s['frame'];visible={o['id'] for o in s['visible']} & objects.keys()
    for id in visible ^ previous:
        track(objects[id],'hide_render',[int(id not in visible)],frame)
    previous=visible
    for o in s['visible']:
        if o['id'] in objects:animate_transform(objects[o['id']],o['matrix'],frame)
    for node in s['nodes']:animate_transform(groups[node['uuid']],node['matrix'],frame)
    animate_transform(camera,s['camera']['matrix'],frame);track(cam,'clip_start',[s['camera']['near']],frame);track(cam,'clip_end',[s['camera']['far']],frame);track(cam,'lens',[12/math.tan(math.radians(s['camera']['fov'])/2)],frame)
    for m in s['materials']:
        p=materials[m['id']].node_tree.nodes.get('Principled BSDF');owner=materials[m['id']].node_tree
        for key,name in [('roughness','Roughness'),('metalness','Metallic'),('emissiveIntensity','Emission Strength')]:track(owner,p.inputs[name].path_from_id('default_value'),[m[key]],frame)
        base_tint=owner.nodes.get('BaseTint');roughness_gain=owner.nodes.get('RoughnessGain');emission_tint=owner.nodes.get('EmissionTint')
        track(owner,(base_tint.inputs[2] if base_tint else p.inputs['Base Color']).path_from_id('default_value'),[*m['color'],1],frame)
        if roughness_gain:track(owner,roughness_gain.inputs[1].path_from_id('default_value'),[m['roughness']],frame)
        track(owner,(emission_tint.inputs[2] if emission_tint else socket(p,'Emission','Emission Color')).path_from_id('default_value'),[*m['emissive'],1],frame)
        for color,material in instance_by_mid.get(m['id'],[]):
            ip=material.node_tree.nodes.get('Principled BSDF');track(material.node_tree,ip.inputs['Emission Strength'].path_from_id('default_value'),[m['emissiveIntensity']],frame)
            track(material.node_tree,socket(ip,'Emission','Emission Color').path_from_id('default_value'),[*[m['emissive'][i]*color[i] for i in range(3)],1],frame)
            track(material.node_tree,ip.inputs['Base Color'].path_from_id('default_value'),[*[m['color'][i]*color[i] for i in range(3)],1],frame)
    visible_lights={light['uuid'] for light in s['lights']}
    for key in previous_lights-visible_lights:
        if key in lights:track(lights[key],'hide_render',[1],frame)
    for light in s['lights']:
        key=light['uuid'];type={'RectAreaLight':'AREA','PointLight':'POINT','DirectionalLight':'SUN'}.get(light['type'])
        if not type:continue
        if key not in lights:
            ld=bpy.data.lights.new(key,type);obj=bpy.data.objects.new(key,ld);scene.collection.objects.link(obj);obj.rotation_mode='QUATERNION';lights[key]=obj
            if type=='AREA':ld.shape='RECTANGLE';ld.size=light['width'];ld.size_y=light['height']
            if type=='POINT':ld.shadow_soft_size=.04
        obj=lights[key];track(obj,'hide_render',[0],frame);ld=obj.data;track(ld,'color',light['color'],frame);track(ld,'energy',[light['intensity']*(light['width']*light['height']*math.pi if type=='AREA' else 4*math.pi if type=='POINT' else 1)],frame);animate_transform(obj,light['matrix'],frame)
    previous_lights=visible_lights
    if sample%120==0:emit('progress',phase='importing',sample=sample,totalSamples=data['report']['snapshotCount'])
emit('progress',phase='animation',tracks=len(tracks))
for t in tracks.values():
    owner=t['owner'];points=t['points'];path=t['path']
    if len(points)==1:
        value=points[0][1];value=value if len(value)>1 else value[0]
        if '.' in path:
            head,attr=path.rsplit('.',1);setattr(owner.path_resolve(head),attr,value)
        else:setattr(owner,path,value)
        continue
    owner.animation_data_create()
    if not owner.animation_data.action:owner.animation_data.action=bpy.data.actions.new(owner.name+' animation')
    for channel in range(len(points[0][1])):
        fc=owner.animation_data.action.fcurves.new(path,index=channel);fc.keyframe_points.add(len(points))
        co=array('f',(v for frame,values in points for v in (frame,values[channel])));fc.keyframe_points.foreach_set('co',co)
        for k in fc.keyframe_points:k.interpolation='CONSTANT' if path=='hide_render' else 'LINEAR'
        fc.update()
tracks.clear()
setup=time.perf_counter()-start
immutable_images={}
def png_image(raw,role='color'):
    content=base64.b64decode(raw.split(',')[1]);digest=hashlib.sha256(content).hexdigest();key=(digest,role)
    if key in immutable_images:return immutable_images[key]
    # A new datablock and node pointer invalidate Cycles persistent GPU texture data.
    # Never mutate pixels, replace a file under the same path or use Image.reload().
    filename=os.path.join(HERE,'baked','image-'+digest+'.png')
    if not os.path.exists(filename):
        temporary=filename+'.'+worker+'.tmp'
        with open(temporary,'wb') as f:f.write(content)
        os.replace(temporary,filename)
    im=bpy.data.images.load(filename,check_existing=False);im.name='immutable_'+digest+'_'+role
    im.colorspace_settings.name='sRGB' if role=='color' else 'Non-Color'
    immutable_images[key]=im;return im
# Keep stable bindings to every texture node, including instance material clones.
# Comparing against the original pointer every frame would only update the first frame.
dynamic_nodes={}
for key,original in images.items():
    dynamic_nodes[key]=[node for material in bpy.data.materials if material.use_nodes for node in material.node_tree.nodes if node.type=='TEX_IMAGE' and node.image==original]
def prepare(frame):
    s=snapshots[1 if options['command']=='frame' else (frame-1)*2];scene.frame_set(frame);scene.view_settings.exposure=math.log2(max(.001,s['exposure']))
    for id,gid in s['geometry'].items():
        if id in objects:objects[id].data=load_geometry(gid,data['objects'][id]['materials'])
    env.image=image(s['environment'],'data') if s['environment'] is not None else None;env_bg.inputs['Strength'].default_value=s['environmentIntensity']
    bgtex.image=png_image(s['background'],'color')
    for d in s['dynamics']:
        for role in ['color','data']:
            nodes=dynamic_nodes.get((d['id'],role),[])
            if nodes:
                im=png_image(d['png'],role)
                for node in nodes:node.image=im
    absolute_time=options['time'] if options['command']=='frame' else options['start']+(frame-1)/options['fps']
    scene.render.use_motion_blur=options['motionBlur'] and all(abs(absolute_time-cut)>options['shutter']/options['fps'] for cut in data['report']['cuts'])
records=[]
selected=json.loads(os.environ['MOTION_CYCLES_FRAMES'])
emit('progress',phase='rendering',setupSeconds=setup,device=device,meshes=len(objects),omittedShaderLayers=omitted)
for frame in selected:
    prepare(frame);filename=os.path.join(HERE,'frames','frame-%06d.png'%frame)
    for stage in preview_stages(options):
        scene.render.resolution_x=stage['width'];scene.render.resolution_y=stage['height'];scene.cycles.samples=stage['samples']
        preview=os.path.join(HERE,'preview-raw-%d.png'%stage['stage'])
        scene.render.filepath=preview+'.part.png'
        emit('progress',phase='refining',stage=stage['stage'],percent=20+(stage['stage']-1)*20)
        bpy.ops.render.render(write_still=True);os.replace(scene.render.filepath,preview)
        emit('preview',phase='refining',path=preview,device=device,**stage)
    scene.render.resolution_x=options['width'];scene.render.resolution_y=options['height'];scene.cycles.samples=options['samples']
    if options.get('progressive'):emit('progress',phase='final',percent=65)
    scene.render.filepath=filename+'.part.png'
    begin=time.perf_counter();bpy.ops.render.render(write_still=True);seconds=time.perf_counter()-begin;os.replace(scene.render.filepath,filename);records.append({'frame':frame,'seconds':seconds})
    report={'device':device,'blender':bpy.app.version_string,'worker':worker,'setupSeconds':setup,'renders':records,'omittedShaderLayers':omitted}
    with open(os.path.join(HERE,metrics_name),'w') as f:json.dump(report,f,indent=2)
    emit('frame',frame=frame,total=options['count'],seconds=seconds,path=filename,device=device)
emit('progress',phase='worker-complete',worker=worker)
