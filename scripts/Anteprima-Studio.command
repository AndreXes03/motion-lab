#!/bin/zsh
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "${0:A:h}/.."
exec node scripts/launch-studio.mjs --repo "$PWD" --port 4175
