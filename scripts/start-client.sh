#!/usr/bin/env bash
# Vite + React dev server. Run in its own terminal (separate from the API).
# Uses Node 22 via nvm when available (matches Vite’s engine expectations).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/client"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  if nvm use 22 2>/dev/null; then
    echo "Using Node $(node -v) (nvm 22)"
  else
    echo "Warning: nvm could not switch to Node 22; continuing with current node: $(command -v node 2>/dev/null || echo none)" >&2
  fi
fi

if [[ ! -d node_modules ]]; then
  echo "Installing client dependencies…"
  npm install
fi

echo "Starting Vite dev server (open the printed localhost URL in your browser)…"
exec npm run dev
