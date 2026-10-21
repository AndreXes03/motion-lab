#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
fail() { printf '\nFramevolve setup: %s\n' "$1"; printf 'Press Return to close.'; read -r _; exit 1; }
[ "$(uname -s)" = Darwin ] || fail 'This setup is for macOS. See docs/MAC_SETUP.md.'
export PATH="$PWD/.motion-cache/runtime/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
node_ok() { command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)' 2>/dev/null && command -v npm >/dev/null; }
if ! node_ok; then
  /usr/bin/osascript -e 'display dialog "Framevolve needs Node.js to run locally. Install a private copy in this Framevolve folder? No administrator password is needed." with title "Set up Framevolve" buttons {"Cancel", "Install"} default button "Install"' >/dev/null || exit 0
  case "$(uname -m)" in arm64) arch=arm64;; x86_64) arch=x64;; *) fail 'Unsupported Mac processor.';; esac
  mkdir -p .motion-cache
  task_tmp=$(mktemp -d "$PWD/.motion-cache/node-download.XXXXXX")
  trap 'rm -rf "$task_tmp"' EXIT
  base=https://nodejs.org/dist/latest-v24.x
  printf 'Downloading the official Node.js runtime…\n'
  curl --proto '=https' --tlsv1.2 -fL --retry 2 --connect-timeout 20 --max-time 300 "$base/SHASUMS256.txt" -o "$task_tmp/SHASUMS256.txt" || fail 'Node.js download failed. Check your connection and reopen setup.'
  archive=$(awk -v arch="$arch" '$2 ~ ("^node-v24\\.[0-9]+\\.[0-9]+-darwin-" arch "\\.tar\\.gz$") {print $2}' "$task_tmp/SHASUMS256.txt")
  [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-darwin-(arm64|x64)\.tar\.gz$ ]] || fail 'Could not identify the official Node.js archive.'
  curl --proto '=https' --tlsv1.2 -fL --retry 2 --connect-timeout 20 --max-time 600 "$base/$archive" -o "$task_tmp/$archive" || fail 'Node.js download failed. Reopen setup to retry.'
  (cd "$task_tmp"; awk -v file="$archive" '$2==file' SHASUMS256.txt | shasum -a 256 -c -) || fail 'Node.js checksum verification failed. Reopen setup to retry.'
  mkdir "$task_tmp/runtime"
  tar -xzf "$task_tmp/$archive" -C "$task_tmp/runtime" --strip-components=1 || fail 'Could not unpack Node.js.'
  # Preserve a previous incomplete runtime instead of overwriting files in use.
  if [ -e .motion-cache/runtime ]; then mv .motion-cache/runtime ".motion-cache/runtime-backup-$(date +%s)"; fi
  mv "$task_tmp/runtime" .motion-cache/runtime
  node_ok || fail 'This runtime cannot run on this Mac. See https://nodejs.org/en/download.'
fi
printf 'Opening Framevolve setup… Keep this window open until setup finishes.\n'
node scripts/setup-mac.mjs || fail 'Setup stopped. Reopen this file to try again.'
