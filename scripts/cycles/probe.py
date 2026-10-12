import bpy,json
result={'version':bpy.app.version_string,'devices':[]}
try:
 p=bpy.context.preferences.addons['cycles'].preferences
 p.compute_device_type='METAL';p.get_devices()
 result['devices']=[{'name':d.name,'type':d.type} for d in p.devices]
except Exception as e:result['gpuReason']=str(e)
print('MOTION_CYCLES '+json.dumps(result),flush=True)
