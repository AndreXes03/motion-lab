# Experimental standalone Cycles component

This builds the optional macOS arm64 Cycles preview component for the main
Framevolve app, without Blender or `bpy`. The renderer is distributed as a
prebuilt archive and installed from the app. It uses normal manual macOS
approval with Gatekeeper and quarantine preserved; Developer ID and notarization
are not required for this preview channel. The main app stays a single app,
with a nested authorization helper and no additional Desktop icon. The tested
preview scope is PULSE and LOOP; additional scenes need separate validation.

## Pinned inputs

`native/cycles/lock.json` records the Cycles source commit, precompiled library
submodule commit, OpenColorIO built-in config identity and SHA-256, CMake
version and Ninja version.
The working copies and build products live beside this repository in
`../outputs/cycles-native/`; generated native files do not enter the source
checkout. The build refuses mismatched Git revisions and tool versions.

Developer prerequisite: Git LFS must be available for the official binary libraries. End users never run these build commands.

Prepare the source checkouts at those exact locked commits. For a new setup,
fetch Cycles and its locked library submodule:

```sh
mkdir -p ../outputs/cycles-native
git clone --filter=blob:none https://projects.blender.org/blender/cycles.git ../outputs/cycles-native/source
git -C ../outputs/cycles-native/source checkout --detach a456b761034dda42c32eef9f4aae0fa5a5c9f604
git -C ../outputs/cycles-native/source -c submodule.lib/macos_arm64.update=checkout submodule update --init lib/macos_arm64
git -C ../outputs/cycles-native/source/lib/macos_arm64 lfs pull
git -C ../outputs/cycles-native/source/lib/macos_arm64 checkout --detach 5a140a8ccc8c070221b1b06e2c6f89f136c5758d

```

Color management is a checked-in serialization of OpenColorIO 2.5.0's built-in
`cg-config-v2.2.0_aces-v1.3_ocio-v2.4`. It contains no external LUT or
`FileTransform` dependency. The matching upstream BSD-3-Clause copyright notice
and hashes are recorded in `native/cycles/color/license-provenance.json` and
`native/cycles/licenses/sources.json`. The build verifies their hashes against
the lock before copying them into the component. No Blender color-data checkout
is needed.

The standalone host uses input `Linear Rec.709 (sRGB)`, display `sRGB - Display`,
and view `ACES 1.0 - SDR Video` without an extra Look. This intentionally differs
from the Blender Filmic / Medium High Contrast baseline: contrast, exposure
appearance and saturated highlights require visual review. The old Filmic data
is excluded because a matching permissive redistribution notice was not
established. The historical Sony notice alone does not establish that grant.

Provide CMake 3.31.10 and Ninja 1.13.0 at
`../outputs/cycles-native/tooling/bin/cmake` and
`../outputs/cycles-native/tooling/bin/ninja`. These are isolated tools; the
script does not install packages, change shell configuration or update a
system-wide tool.

## Build and package

From the repository root, run:

```sh
node native/cycles/build.mjs
node native/cycles/package.mjs --output ../outputs/cycles-native/framevolve-cycles-0.1.0-preview.1
```

The build configures a Release arm64 target with Metal, Embree, OpenImageDenoise
and pugixml enabled. OpenVDB, OSL, OpenSubdiv, USD, Alembic, GUI, Hydra, logging
and parallel device-kernel builds are explicitly disabled. The host target is
the custom `framevolve-cycles` executable; packaging copies that executable,
installed shared libraries, kernel and utility headers, color data and license
notices. It omits the upstream stock `cycles` executable and never bundles
Blender or Python.

The build appends the native host CMake target and applies one anchored reader patch to the pinned upstream
`src/app/cycles_xml.cpp`: the generic node reader is also called on a light's
object before reading the light node. This carries object motion and visibility
through the native XML reader. The script refuses to patch if the expected
single source site is absent or ambiguous, and validates the exact change when
it is already present. All other source changes cause review to fail; do not
reuse a patched source tree for a different Cycles revision.

After the Cycles install, `build.mjs` runs `build-oiio.mjs` to replace the
codec-heavy upstream OpenImageIO library with a same-version minimal build.
Only PNG, HDR, PNM/PFM and OpenEXR are enabled. The pinned source tarballs and
TIFF tag header are checksum-verified; TIFF tag declarations support EXIF
metadata, while the TIFF codec and linkage stay disabled. The minimized build
also disables HEIF, JPEG, OpenJPEG, WebP and other optional dependencies.
A binary symbol gate rejects those codecs, removes absolute library load paths,
and records library hashes in `install/oiio-provenance.json`. Only the two
OpenImageIO libraries are replaced. This step runs after every upstream install
so the broad prebuilt library cannot silently return to a release.

`package.mjs` assembles a nested `Rendering Cycles.app` authorization helper and
runtime, checks ad-hoc code integrity, and writes `component.json` with payload
SHA-256 hashes. It emits a `.tar.gz` archive and `.release.json` metadata for the
preview catalog (`security: manual-macos`, no Developer ID or notarization).
Ad-hoc integrity signatures do not claim verified publisher identity.
Existing output/archive paths are rejected; choose a fresh versioned output.
There is no overwrite option. `--stable` is rejected because package assembly
alone does not verify the final hosted download or macOS approval path.

Before publishing a preview, verify the actual archive download checksum,
clean installation and normal macOS approval, CPU/Metal availability and actual
PULSE/LOOP output. Record the observed result; build success alone does not prove
that the hosted release or visual output has been checked.

## Notices and scope

Cycles' default source license is Apache-2.0, with BSD-3-Clause, MIT and Zlib
licensed portions marked by upstream SPDX notices. The executable's observed
dynamic library set includes OpenImageIO, Embree, OpenColorIO, OpenEXR/Imath,
OpenImageDenoise, oneTBB and OpenJPH. The build also links pugixml and Zstandard
statically; Apple's system zlib and system frameworks remain platform
dependencies. The package carries the corresponding Apache-2.0, BSD-3-Clause,
MIT, Zlib and BSD-2-Clause license texts from the pinned Cycles dependency set.
The lock's precompiled library bundle is from Blender's upstream library
repository; `deps.md`, the CMake cache and `otool -L` output are the provenance
records for versions and linkage.

The self-contained ACES config and the OpenColorIO built-in transforms use
OpenColorIO's BSD-3-Clause license, with the actual upstream copyright notice.
Per-project upstream notices accompany the general Cycles license texts. The
notice source URLs, pinned versions and SHA-256 hashes are in
`native/cycles/licenses/sources.json`; the build verifies and copies every file.

Blender source contains GPL-licensed build scripts, but those build-time files
are not copied into this component. The package remains subject to Framevolve's
root license for its host adapter and to each third-party component's own
notice. See `THIRD_PARTY.md` and the packaged `license/` directory.
