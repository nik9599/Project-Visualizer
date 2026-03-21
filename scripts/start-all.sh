#!/usr/bin/env bash
# One command: open two terminals (macOS Terminal.app) or two windows (Linux gnome-terminal),
# run API in one and Vite (with nvm 22) in the other.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_SH="$ROOT/scripts/start-server.sh"
CLIENT_SH="$ROOT/scripts/start-client.sh"

launch_macos() {
  echo "Opening two Terminal.app windows (server + client)…"
  osascript <<EOF
tell application "Terminal"
    activate
    do script "cd \"${ROOT}\" && exec \"${SERVER_SH}\""
    do script "cd \"${ROOT}\" && exec \"${CLIENT_SH}\""
end tell
EOF
}

launch_linux_gnome() {
  echo "Opening two gnome-terminal windows…"
  gnome-terminal -- bash -c "cd \"${ROOT}\" && exec \"${SERVER_SH}\"; exec bash" &
  gnome-terminal -- bash -c "cd \"${ROOT}\" && exec \"${CLIENT_SH}\"; exec bash" &
}

case "$(uname -s)" in
  Darwin)
    launch_macos
    ;;
  Linux)
    if command -v gnome-terminal &>/dev/null; then
      launch_linux_gnome
    else
      echo "Install gnome-terminal, or run these yourself in two terminals:" >&2
      echo "  1: ${SERVER_SH}" >&2
      echo "  2: ${CLIENT_SH}" >&2
      exit 1
    fi
    ;;
  *)
    echo "Unsupported OS. Run in two terminals:" >&2
    echo "  1: ${SERVER_SH}" >&2
    echo "  2: ${CLIENT_SH}" >&2
    exit 1
    ;;
esac
