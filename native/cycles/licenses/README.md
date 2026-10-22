# Cycles component license sources

Cycles is Apache-2.0 by default; its SPDX-marked BSD-3-Clause, MIT and Zlib
portions retain the source notices in the packaged kernel and utility headers.
The upstream general texts from `doc/license/` accompany them.

The dynamically installed libraries are OpenImageIO, OpenColorIO, OpenEXR,
Imath, Embree, OpenImageDenoise, oneTBB and OpenJPH. The host also links pugixml
and Zstandard. `sources.json` records the official upstream release/version,
source URL and SHA-256 for each per-project LICENSE and third-party notice.
These files retain the actual copyright holders, including notices for
third-party code incorporated in upstream projects. The build checks every
recorded hash before copying notices into `license/`.

The public package uses the minimized OpenImageIO build with PNG, HDR, PNM/PFM
and OpenEXR only. It excludes libheif and its codecs. TIFF declarations are used
only for EXIF tag metadata; no TIFF codec is compiled or linked.

## Color management

`../color/config.ocio` is serialized from the OpenColorIO 2.5.0 built-in
`cg-config-v2.2.0_aces-v1.3_ocio-v2.4`, licensed BSD-3-Clause with Copyright
Contributors to the OpenColorIO Project. The accompanying official license
is `OpenColorIO-LICENSE`; exact provenance and checksums are in
`../color/license-provenance.json`. It has no external LUT file dependency.

Standalone input is linear Rec.709; output is ACES 1.3 SDR for an sRGB display.
This is a deliberate visual change from Blender Filmic / Medium High Contrast.
The previous Blender config/LUTs and historical Sony notice are not distributed.
The old Sony notice alone did not establish current Filmic redistribution rights.
