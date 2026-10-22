# Cycles component license sources

The pinned Cycles checkout supplies the Apache-2.0, BSD-3-Clause, MIT and
Zlib texts in `doc/license/`; the installed upstream copies are included in
the component's `license/` folder. The linked OpenColorIO library is
BSD-3-Clause; its notice is included as `BSD-3-Clause-license.txt`. OpenJPH
uses BSD-2-Clause; its notice is in `openjph-BSD-2-Clause.txt`.

The bundled Blender color-management config and LUTs have a separate notice:
Blender's official history added `release/text/ocio-license.txt` at commit
`3237ae2855b6dbfad8ba9e86e6e7add0942403d7`. The current color-data pin omits
that file, so the native build labels its provenance unresolved unless an
official pinned checkout supplies matching bytes. The included file preserves
the Sony Pictures Imageworks notice, which is distinct from OpenColorIO's
library license.
