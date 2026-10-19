"""Check actual curve-builder helpers without starting Blender or consuming GPU time."""
import ast
from pathlib import Path
source=Path(__file__).with_name('render.py').read_text()
functions=[n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name in ['track','animate_transform']]
namespace={'tracks':{},'last_matrices':{},'quaternions':{}}
exec(compile(ast.Module(body=functions,type_ignores=[]),str(Path(__file__).with_name('render.py')),'exec'),namespace)
class Owner:
 name='test'
 def as_pointer(self):return 1
owner=Owner()
track=namespace['track']
for path,values in [('location',[1,2,3]),('rotation_quaternion',[1,0,0,0]),('scale',[1,1,1])]:track(owner,path,values,1)
namespace['last_matrices']['test']=(1,2,3)
namespace['animate_transform'](owner,[1,2,3],4)
track(owner,'location',[2,2,3],5)
assert namespace['tracks'][(1,'location')]['points']==[(1,(1,2,3)),(4,(1,2,3)),(5,(2,2,3))]
print('Cycles static-pause animation curve contract passed')
from types import SimpleNamespace
curve_fn=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='create_curve')
exec(compile(ast.Module(body=[curve_fn],type_ignores=[]),'render.py','exec'),namespace)
calls=[]
legacy=SimpleNamespace(fcurves=SimpleNamespace(new=lambda path,index: calls.append(('legacy',path,index))))
modern=SimpleNamespace(fcurve_ensure_for_datablock=lambda owner,path,index: calls.append(('modern',owner,path,index)))
owner=SimpleNamespace(animation_data=SimpleNamespace(action=legacy))
namespace['create_curve'](owner,'location',1)
owner.animation_data.action=modern
namespace['create_curve'](owner,'location',2)
assert calls==[('legacy','location',1),('modern',owner,'location',2)]
print('Cycles F-curve creation supports legacy and current Blender Action API')
