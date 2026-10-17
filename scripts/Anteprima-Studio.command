#!/bin/zsh
# Preview this checkout without updating or replacing local changes.
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "${0:A:h}/.."
if [[ ! -x node_modules/.bin/vite ]]; then
  print 'Dipendenze mancanti: esegui npm ci nella cartella Motion Lab.'
  read -r '?Premi Invio per chiudere.'
  exit 1
fi
print 'Studio aggiornato: http://127.0.0.1:4175'
print 'Lascia questa finestra aperta durante la revisione. Ctrl+C per fermare.'
exec ./node_modules/.bin/vite --host 127.0.0.1 --port 4175 --strictPort
