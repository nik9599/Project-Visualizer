# ProjectVisulizar

Call-graph visualizer: Flask API parses JS/TS/JSX/TSX uploads; React client shows the graph.

## One command (recommended on macOS)

From the repo root:

```bash
./scripts/start-all.sh
```

or:

```bash
npm start
```

This opens **two Terminal.app windows**: Flask on **:8000**, Vite on **:5173**. The client script runs **`nvm use 22`** before `npm run dev` when [nvm](https://github.com/nvm-sh/nvm) is installed.

**Linux:** if `gnome-terminal` is available, two windows are opened the same way; otherwise the script prints the two commands to run manually.

---

## Run manually (two terminals)

**1 — API (Flask, port 8000)**

```bash
./scripts/start-server.sh
```

**2 — Web UI (Vite, uses Node 22 via nvm when present)**

```bash
./scripts/start-client.sh
```

Then open the URL Vite prints (usually **http://localhost:5173**). The app calls **http://localhost:8000**.

### npm shortcuts (repo root)

| Command        | What it does                                      |
|----------------|---------------------------------------------------|
| `npm start`    | Same as `./scripts/start-all.sh` (two terminals)  |
| `npm run server` | API only                                        |
| `npm run client` | Vite only (runs `nvm use 22` first if nvm exists) |

### First-time setup

- **SERVER:** Python venv under `SERVER/venv`. Node deps in `SERVER/` for `parser.js` (`npm install` there — the start script runs this if missing).
- **client:** `npm install` in `client/` if `node_modules` is missing.
- **Node 22:** install with `nvm install 22` if you use nvm.
