import bpy,json,os,sys
sys.path.insert(0, os.path.dirname(__file__))
from devices import discover_devices, BACKENDS
# Fail the probe when this Blender build has no working Cycles engine.
bpy.context.scene.render.engine = 'CYCLES'
preferences = bpy.context.preferences.addons['cycles'].preferences
devices, errors = discover_devices(preferences)
backend = next((kind for kind in BACKENDS if any(d['type'] == kind for d in devices)), 'CPU')
result = {'version': bpy.app.version_string, 'devices': devices, 'device': backend}
if errors:
    result['backendErrors'] = errors
print('MOTION_CYCLES ' + json.dumps(result), flush=True)
