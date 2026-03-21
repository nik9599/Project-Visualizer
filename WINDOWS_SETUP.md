# Windows Setup Guide for Project Visualizer

## Quick Start (Recommended)

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd Project-Visualizer
```

### 2. Run everything with one command
```bash
.\scripts\start-all.bat
```

This automatically opens two new terminal windows:
- **Window 1**: Flask API Server (http://localhost:8000)
- **Window 2**: React Dev Server (http://localhost:5173)

Wait for both to show they're running, then open your browser to http://localhost:5173

---

## Manual Setup (If Needed)

### Requirements
- **Node.js** 18+ - [Download](https://nodejs.org/)
- **Python** 3.8+ - [Download](https://www.python.org/)

### Step 1: Setup Python Virtual Environment & Server

From the root folder:

```powershell
cd SERVER

# Create virtual environment
python -m venv .venv

# Activate it
.\.venv\Scripts\activate

# Install dependencies
pip install flask flasgger flask-cors

# Install Node dependencies (for Babel parser)
npm install
```

### Step 2: Setup Client

From the root folder:

```powershell
cd client

# Install dependencies
npm install
```

### Step 3: Start the Server

From the root folder:

```powershell
.\scripts\start-server.bat
```

You should see:
```
Starting API at http://localhost:8000
 * Running on http://127.0.0.1:8000
```

### Step 4: Start the Client (New Terminal)

Open a new PowerShell/CMD window at the root folder:

```powershell
.\scripts\start-client.bat
```

---

## Individual Commands

### Start only the API Server
```powershell
.\scripts\start-server.bat
```

### Start only the React Dev Server
```powershell
.\scripts\start-client.bat
```

### Start both (same as above)
```powershell
.\scripts\start-all.bat
```

---

## Troubleshooting

### "Python not found" error
- Make sure Python 3.8+ is installed and in PATH
- Try opening a new terminal after installing Python
- Verify: `python --version`

### Port 8000 or 5173 already in use
- Either close what's using that port
- Or modify the port in:
  - Server: `SERVER/main.py` (change port 8000)
  - Client: `client/vite.config.ts` (change port 5173)

### Virtual environment not activating
- The script should auto-activate, but you can manually activate:
  ```powershell
  .\venv\Scripts\activate  # or use .\.venv\Scripts\activate
  ```

### npm install errors
- Delete `node_modules` folders:
  ```powershell
  Remove-Item -Recurse node_modules
  rm package-lock.json
  npm install
  ```

---

## Accessing the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Upload File**: POST to http://localhost:8000/upload

---

## What These Scripts Do

| Script | Purpose |
|--------|---------|
| `start-all.bat` | Opens 2 terminals: server + client |
| `start-server.bat` | Starts Flask API only |
| `start-client.bat` | Starts React dev server only |

---

## Next Steps

1. Visit http://localhost:5173 in your browser
2. Upload a React JavaScript or TypeScript file
3. View the generated call graph
4. Click nodes to view function details and source code

Enjoy exploring your code! 🚀
