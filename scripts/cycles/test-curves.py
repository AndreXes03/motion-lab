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
