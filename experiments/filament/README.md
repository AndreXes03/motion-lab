# Filament spike

This folder contains the bounded native smoke test for Framevolve. The official Filament v1.78.1 macOS release was checksum-verified and its viewer/libraries were confirmed arm64. A static PULSE 0.5 s geometry snapshot rendered with the Metal backend on Apple M4 Max.

The run took 2.21 seconds including startup, parsing and three frames; process maximum RSS was 953,024,512 bytes. The screenshot was 70×270 despite a 480×270 request, and the converter omits scene textures, area/environment lighting, reflection, compositing, typography and motion. This is a smoke test, not picture fidelity or a per-frame performance benchmark.

[Full feasibility findings](../../docs/FILAMENT_FEASIBILITY.md) · [PULSE frame converter](convert_pulse_frame.py)
