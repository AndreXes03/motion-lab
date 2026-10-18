from pathlib import Path
import ast

folder = Path(__file__).parent
namespace = {}
exec(compile((folder / 'progressive.py').read_text(), 'progressive.py', 'exec'), namespace)
stages = namespace['preview_stages']
base = dict(progressive=True, command='frame', width=1920, height=1080, samples=64)
assert stages(base) == [dict(stage=1, width=480, height=270, samples=4), dict(stage=2, width=960, height=540, samples=16)]
assert base['width'] == 1920 and base['samples'] == 64
assert stages(dict(base, progressive=False)) == []
assert stages(dict(base, command='export')) == []
assert stages(dict(base, samples=2))[1]['samples'] == 2
assert stages(dict(base, width=64, height=64, samples=1)) == []
assert len(stages(dict(base, width=64, height=64, samples=8))) == 1
for name in ['progressive.py', 'render.py']:
    ast.parse((folder / name).read_text())
print('Progressive Cycles stages: real coarse/refined sizes, bounded samples, exact final settings and export isolation passed.')
