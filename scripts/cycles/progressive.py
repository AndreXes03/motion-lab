"""Real intermediate Cycles passes; final settings are never modified here."""
def preview_stages(options):
    if not options.get('progressive') or options['command'] != 'frame':
        return []
    width, height, samples = options['width'], options['height'], options['samples']
    stages, seen = [], {(width, height, samples)}
    for fraction, budget in ((.25, 4), (.5, 16)):
        # Preserve aspect ratio, including the smallest supported output sizes.
        scale = min(1, max(fraction, 64 / min(width, height)))
        candidate = (round(width * scale), round(height * scale), min(samples, budget))
        if candidate in seen:
            continue
        seen.add(candidate)
        stages.append({'stage': len(stages) + 1, 'width': candidate[0], 'height': candidate[1], 'samples': candidate[2]})
    return stages
