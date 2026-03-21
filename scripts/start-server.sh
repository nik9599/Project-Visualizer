#!/usr/bin/env bash
# Flask API + call-graph parser (port 8000). Run in its own terminal.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/SERVER"

if [[ -f venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source venv/bin/activate
fi

if [[ ! -d node_modules ]]; then
  echo "Installing SERVER Node deps (Babel parser)…"
  npm install
fi

PY="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
if [[ -z "$PY" ]]; then
  echo "Error: python3 not found. Install Python 3 and Flask deps in SERVER/venv." >&2
  exit 1
fi

echo "Starting API at http://0.0.0.0:8000  (upload: POST /upload)"
exec "$PY" main.py
