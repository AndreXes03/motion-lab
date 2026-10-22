# Experimental standalone Cycles component

This produces the optional `framevolve-cycles` renderer for macOS arm64. It
uses the upstream Cycles renderer without Blender or `bpy`. The component is
experimental and cannot be treated as a stable downloadable release until the
host release has passed the repository's release checks and received a valid
Developer ID signature and notarization ticket.

## Pinned inputs

`native/cycles/lock.json` records the Cycles source commit, Blender color-data
commit, precompiled library submodule commit, CMake version and Ninja version.
The working copies and build products live beside this repository in
`../outputs/cycles-native/`; generated native files do not enter the source
checkout. The build refuses mismatched Git revisions and tool versions.

Developer prerequisite: Git LFS must be available for the official binary libraries. End users never run these build commands.

Prepare the source checkouts at those exact locked commits. For a new setup,
use sparse checkouts for the large Blender repository and fetch its color data:

```sh
mkdir -p ../outputs/cycles-native
git clone --filter=blob:none https://projects.blender.org/blender/cycles.git ../outputs/cycles-native/source
git -C ../outputs/cycles-native/source checkout --detach a456b761034dda42c32eef9f4aae0fa5a5c9f604
git -C ../outputs/cycles-native/source -c submodule.lib/macos_arm64.update=checkout submodule update --init lib/macos_arm64
git -C ../outputs/cycles-native/source/lib/macos_arm64 lfs pull
git -C ../outputs/cycles-native/source/lib/macos_arm64 checkout --detach 5a140a8ccc8c070221b1b06e2c6f89f136c5758d

git clone --filter=blob:none --no-checkout https://github.com/blender/blender.git ../outputs/cycles-native/color-source
git -C ../outputs/cycles-native/color-source checkout --detach 32f5fdce0a0a571a39198edf8d7b5d719bf59f2c
git -C ../outputs/cycles-native/color-source sparse-checkout init --no-cone
printf '%s\n' '/release/datafiles/colormanagement/' > ../outputs/cycles-native/color-source/.git/info/sparse-checkout
git -C ../outputs/cycles-native/color-source read-tree -mu HEAD
```

The current locked color-data commit does not contain the `ocio-license.txt`
notice referenced by the configuration data. A historical Blender copy of
that notice is retained under `native/cycles/licenses/` with its source commit,
but that alone does not establish the current color data's redistribution
terms. The native build may still complete and records the unresolved state;
packaging fails closed until the color-data pin itself provides a verifiable
notice or the provenance is otherwise resolved and reviewed.

Provide CMake 3.31.10 and Ninja 1.13.0 at
`../outputs/cycles-native/tooling/bin/cmake` and
`../outputs/cycles-native/tooling/bin/ninja`. These are isolated tools; the
script does not install packages, change shell configuration or update a
system-wide tool.

## Build and package

From the repository root, run:

```sh
node native/cycles/build.mjs
node native/cycles/package.mjs --output ../outputs/cycles-native/framevolve-cycles-dev
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

`package.mjs` writes an explicit component manifest with each payload file's
SHA-256. It labels the output `experimental`, `signed: false`, `notarized:
false` and `stable: false`. It refuses to replace an existing output unless
`--force` is supplied. `--stable` always fails until the final host installer
release flow can verify actual test results, a valid Developer ID signature,
Gatekeeper assessment and a stapled notarization ticket. A local render or an
assembled component folder is not that release evidence.

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

The bundled Blender color configuration and LUTs have a separate Sony Pictures
Imageworks notice historically stored at Blender's official
`release/text/ocio-license.txt` path. This notice is different from
OpenColorIO's BSD-3-Clause library license. The current color-data commit omits
that notice, so package assembly remains blocked pending provenance review.

Blender source contains GPL-licensed build scripts, but those build-time files
are not copied into this component. The package remains subject to Framevolve's
root license for its host adapter and to each third-party component's own
notice. See `THIRD_PARTY.md` and the packaged `license/` directory.
