"""Backend-selection behavior with fake Blender preferences, no GPU required."""
from types import SimpleNamespace
from devices import discover_devices, select_device


class Preferences:
    def __init__(self, available):
        self.available = available
        self.devices = []
        self.compute_device_type = None

    def get_devices(self):
        if self.compute_device_type not in self.available:
            raise TypeError('Backend not built')
        self.devices = [SimpleNamespace(name='CPU', type='CPU', id='cpu', use=True)] + [
            SimpleNamespace(name=name, type=self.compute_device_type, id=name, use=False)
            for name in self.available[self.compute_device_type]
        ]


def scene():
    return SimpleNamespace(cycles=SimpleNamespace(device='CPU'))


prefs = Preferences({'OPTIX': ['NVIDIA'], 'CUDA': ['NVIDIA']})
devices, errors = discover_devices(prefs)
assert [d['type'] for d in devices] == ['CPU', 'OPTIX', 'CUDA']
assert 'METAL' in errors
s = scene()
name, warning = select_device(prefs, s, 'gpu')
assert name == 'OPTIX: NVIDIA' and s.cycles.device == 'GPU' and warning is None
assert all(d.use == (d.type == 'OPTIX') for d in prefs.devices)
try:
    select_device(prefs, scene(), 'metal')
    raise AssertionError('Explicit Metal may not use another GPU')
except RuntimeError:
    pass
prefs = Preferences({'METAL': ['Apple GPU']})
assert select_device(prefs, scene(), 'auto')[0] == 'Metal: Apple GPU'
s = scene()
assert select_device(prefs, s, 'cpu') == ('CPU', None) and s.cycles.device == 'CPU'
prefs = Preferences({'CUDA': []})
assert select_device(prefs, scene(), 'auto')[0] == 'CPU'
try:
    select_device(prefs, scene(), 'gpu')
    raise AssertionError('Explicit GPU may not silently use CPU')
except RuntimeError:
    pass
print('Cycles backend discovery, explicit-device enforcement and Auto CPU fallback passed')
