#!/usr/bin/env python3
"""Convert one baked Three.js PULSE frame to a GLB for the Filament viewer.

This intentionally exports static positions, vertex normals/UVs and approximate
PBR factors only. It omits source textures, Three.js reflection, area lights,
compositing and animation; output is a renderer smoke-test fixture, not a parity
conversion.
"""
import argparse
import json
import math
import struct
from pathlib import Path


def mat_from_column_major(values):
    return [[values[c * 4 + r] for c in range(4)] for r in range(4)]


def multiply(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def column_major(m):
    return [m[r][c] for c in range(4) for r in range(4)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--project-dir', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--snapshot-dir', default='renders/native-production/pulse-0.5-metal.png.cycles')
    args = ap.parse_args()
    project = args.project_dir.resolve()
    source = project / args.snapshot_dir
    scene = json.loads((source / 'scene.json').read_text())
    snap = json.loads((source / 'baked/snapshot_0001.json').read_text())

    # glTF binary payload plus aligned buffer views/accessors.
    blob = bytearray()
    views, accessors = [], []
    def add_accessor(values, component_type, gltf_type, *, target=None, bounds=False):
        while len(blob) % 4:
            blob.append(0)
        offset = len(blob)
        if component_type == 5126:
            blob.extend(struct.pack('<%sf' % len(values), *values))
        elif component_type == 5125:
            blob.extend(struct.pack('<%sI' % len(values), *values))
        else:
            raise ValueError('unsupported accessor component')
        view = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(blob) - offset}
        if target:
            view['target'] = target
        views.append(view)
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[gltf_type]
        count = len(values) // width
        accessor = {'bufferView': len(views) - 1, 'componentType': component_type, 'count': count, 'type': gltf_type}
        if bounds:
            columns = [values[i::width] for i in range(width)]
            accessor['min'] = [min(c) for c in columns]
            accessor['max'] = [max(c) for c in columns]
        accessors.append(accessor)
        return len(accessors) - 1

    materials = []
    for mat in scene['materials']:
        c = mat.get('color') or [0.8, 0.8, 0.8]
        em = mat.get('emissive') or [0, 0, 0]
        m = {'name': mat.get('name') or 'PULSE material', 'pbrMetallicRoughness': {
            'baseColorFactor': [*c[:3], float(mat.get('opacity', 1))],
            'metallicFactor': float(mat.get('metalness', 0)),
            'roughnessFactor': float(mat.get('roughness', 0.5))}}
        if max(em) > 0:
            m['emissiveFactor'] = em[:3]
        if mat.get('transparent'):
            m['alphaMode'] = 'BLEND'
        if mat.get('side') == 2:
            m['doubleSided'] = True
        materials.append(m)

    nodes_by_id = {n['uuid']: n for n in scene['nodes']}
    local = {n['uuid']: mat_from_column_major(n['matrix']) for n in snap['nodes']}
    cache = {}
    def world(uuid):
        if uuid in cache:
            return cache[uuid]
        n = nodes_by_id.get(uuid)
        here = local.get(uuid, mat_from_column_major([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]))
        p = n.get('parent') if n else None
        cache[uuid] = multiply(world(p), here) if p in local else here
        return cache[uuid]

    gltf_meshes, gltf_nodes = [], []
    geometry_cache = {}
    def get_geometry(gid):
        if gid not in geometry_cache:
            geometry_cache[gid] = json.loads((source / f'geometries/{gid}.json').read_text())
        return geometry_cache[gid]

    for visible in snap['visible']:
        obj = scene['objects'][visible['id']]
        gid = visible.get('geometry')
        if gid is None or not obj.get('materials'):
            continue
        geom = get_geometry(gid)
        all_indices = geom.get('index') or list(range(len(geom['position']) // 3))
        groups = geom.get('groups') or [{'start': 0, 'count': len(all_indices), 'materialIndex': 0}]
        primitives = []
        for group in groups:
            slot = min(group.get('materialIndex', 0), len(obj['materials']) - 1)
            indices = all_indices[group['start']:group['start'] + group['count']]
            if not indices:
                continue
            attrs = {'POSITION': add_accessor(geom['position'], 5126, 'VEC3', target=34962, bounds=True)}
            if geom.get('normal'):
                attrs['NORMAL'] = add_accessor(geom['normal'], 5126, 'VEC3', target=34962)
            if geom.get('uv'):
                attrs['TEXCOORD_0'] = add_accessor(geom['uv'], 5126, 'VEC2', target=34962)
            primitives.append({'attributes': attrs, 'indices': add_accessor(indices, 5125, 'SCALAR', target=34963), 'material': obj['materials'][slot]})
        if not primitives:
            continue
        mesh_idx = len(gltf_meshes)
        gltf_meshes.append({'name': obj.get('name') or 'PULSE mesh', 'primitives': primitives})
        local_visible = mat_from_column_major(visible['matrix'])
        transform = multiply(world(obj['parent']), local_visible) if obj.get('parent') else local_visible
        gltf_nodes.append({'name': obj.get('name') or 'PULSE object', 'mesh': mesh_idx, 'matrix': column_major(transform)})

    cam = snap['camera']
    camera_idx = 0
    gltf_cameras = [{'type': 'perspective', 'perspective': {
        'yfov': math.radians(cam['fov']), 'znear': cam['near'], 'zfar': cam['far']}}]
    gltf_nodes.append({'name': 'PULSE 0.5s camera', 'camera': camera_idx, 'matrix': cam['matrix']})
    gltf = {'asset': {'version': '2.0', 'generator': 'Framevolve Filament feasibility spike'},
            'scene': 0, 'scenes': [{'nodes': list(range(len(gltf_nodes)))}],
            'nodes': gltf_nodes, 'meshes': gltf_meshes, 'materials': materials,
            'cameras': gltf_cameras, 'buffers': [{'byteLength': 0}],
            'bufferViews': views, 'accessors': accessors}
    # Use a data URI to keep the fixture self-contained.
    import base64
    gltf['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(blob).decode('ascii')
    gltf['buffers'][0]['byteLength'] = len(blob)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(gltf, separators=(',', ':')))
    print(json.dumps({'timeSeconds': snap['time'], 'meshes': len(gltf_meshes),
                      'primitives': sum(len(m['primitives']) for m in gltf_meshes),
                      'materials': len(materials), 'bufferBytes': len(blob),
                      'output': str(args.out)}))


if __name__ == '__main__':
    main()
