#!/bin/bash
# Finder può avere un PATH diverso dal Terminale.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/share/mise/shims:$HOME/.asdf/shims:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" --no-use
  nvm use default --silent
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Serve Node.js >=22.12. Installalo o attivalo nel Terminale, poi riprova.'
  result=1
elif node scripts/aggiorna-motion-lab.mjs; then
  result=0
else
  result=$?
fi
if [ -t 0 ]; then
  printf '\nPremi Invio per chiudere… '
  read -r _
fi
exit "$result"
