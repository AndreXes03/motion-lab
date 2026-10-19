"""Shared Cycles discovery and selection; never advertise an unprobed GPU."""
BACKENDS = ('METAL', 'OPTIX', 'CUDA', 'HIP', 'ONEAPI')


def discover_devices(preferences):
    devices, errors, seen = [], {}, set()
    for backend in BACKENDS:
        try:
            preferences.compute_device_type = backend
            preferences.get_devices()
            for device in preferences.devices:
                if device.type not in (backend, 'CPU'):
                    continue
                key = (device.type, getattr(device, 'id', device.name))
                if key not in seen:
                    seen.add(key)
                    devices.append({'name': device.name, 'type': device.type})
        except Exception as error:
            errors[backend] = str(error)
    return devices, errors


def select_device(preferences, scene, requested):
    scene.cycles.device = 'CPU'
    if requested == 'cpu':
        return 'CPU', None
    if requested not in ('auto', 'gpu', 'metal'):
        raise ValueError('Unsupported Cycles device: ' + str(requested))
    errors = []
    for backend in (('METAL',) if requested == 'metal' else BACKENDS):
        try:
            preferences.compute_device_type = backend
            preferences.get_devices()
            selected = [device for device in preferences.devices if device.type == backend]
            if not selected:
                continue
            for device in preferences.devices:
                device.use = device.type == backend
            scene.cycles.device = 'GPU'
            return ('Metal' if backend == 'METAL' else backend) + ': ' + ', '.join(device.name for device in selected), None
        except Exception as error:
            errors.append(backend + ': ' + str(error))
    reason = 'No ' + ('Metal' if requested == 'metal' else 'compatible GPU') + ' device is available'
    if requested != 'auto':
        raise RuntimeError(reason)
    return 'CPU', reason + ('. ' + '; '.join(errors) if errors else '')
