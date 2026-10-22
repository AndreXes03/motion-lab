# Skia Canvas 4.0.0: scoped source and notice audit

Checked 2026-10-22. The application pins npm `skia-canvas` to **4.0.0**;
`package-lock.json` records the npm tarball integrity. This repository does not
vendor or redistribute its downloaded native binary or `node_modules`.

Preserved notices:

- `LICENSE`: exact MIT notice from installed npm package 4.0.0 (Christian Swinehart).
- `Skia-LICENSE`: BSD 3-clause notice from the Skia revision selected by
  `skia-bindings 0.153.3`: https://github.com/rust-skia/skia/blob/m153-0.101.2/LICENSE
- `rust-skia-LICENSE`: Rust binding MIT notice at the crate's recorded source
  commit: https://github.com/rust-skia/rust-skia/blob/b7f043e0b1e2a850e702245de811f01df1f6b0ff/LICENSE
- `simplecss-*`: MIT/Apache alternatives and authors from the actual vendored
  `vendor/simplecss` in https://github.com/samizdatco/skia-canvas/tree/v4.0.0/vendor/simplecss

Source audit records:

- Official v4.0.0 tree SHA: `21b621dc381a95d2c3274db7a0e1169f2feaad02`.
- `Cargo.toml.upstream` and `Cargo.lock.upstream` are unchanged official files from
  https://github.com/samizdatco/skia-canvas/tree/v4.0.0 .
- That lockfile records 328 Rust packages, including `skia-safe 0.153.3`,
  `skia-bindings 0.153.3`, `hayro-interpret 0.7.0`, and vendored `simplecss 0.2.2`.
- The exact crates.io source archive inspected was
  https://static.crates.io/crates/skia-bindings/skia-bindings-0.153.3.crate .
  Its Cargo metadata selects Skia `m153-0.101.2`; its `.cargo_vcs_info.json`
  records commit `b7f043e0b1e2a850e702245de811f01df1f6b0ff` with `dirty: true`.

## Scope and remaining gap

These files preserve verified direct and selected native notices. They are **not
an exhaustive license inventory or redistribution clearance** for the prebuilt
Skia Canvas native module. The npm package does not contain an aggregate native
third-party notice bundle. Its official source tree contains the main MIT
notice and the vendored simplecss notices, but no aggregate bundle covering all
328 locked Rust packages or all Skia vendored codecs, fonts and libraries.
Cargo.lock also includes optional/platform-specific packages; presence alone
cannot prove they are linked into a particular npm native binary.

A binary redistribution package would need the actual build feature manifest,
linked dependency inventory and corresponding notices/source obligations for
that binary. No such binary package is introduced here. Install through the
exact npm lockfile locally; retain upstream notices and do not interpret the
main MIT notice as relicensing Skia or its dependencies.
