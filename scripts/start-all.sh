#!/usr/bin/env bash
# One command: open two terminals to run API and Vite dev server.
# Works on macOS, Linux, and Windows (Git Bash/MSYS2).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_SH="$ROOT/scripts/start-server.sh"
CLIENT_SH="$ROOT/scripts/start-client.sh"
OS_TYPE="$(uname -s)"

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

launch_windows() {
  echo "Opening two cmd windows (server + client)…"
  cmd /c start "Project-Visualizer Server" cmd /k "${ROOT}/scripts/start-server.bat"
  cmd /c start "Project-Visualizer Client" cmd /k "${ROOT}/scripts/start-client.bat"
}

case "$OS_TYPE" in
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
  MINGW*|MSYS*)
    # Windows (Git Bash or MSYS2)
    launch_windows
    ;;
  *)
    echo "Unsupported OS. Run in two terminals:" >&2
    echo "  1: ${SERVER_SH}" >&2
    echo "  2: ${CLIENT_SH}" >&2
    exit 1
    ;;
esac
