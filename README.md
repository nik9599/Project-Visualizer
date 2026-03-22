# 🚀 Project Visualizer

A **call graph visualizer for React applications** that helps developers understand how components, functions, and dependencies are connected.

Built with a Flask API + React frontend, this tool parses JS/TS/JSX/TSX files using AST analysis and generates an interactive graph.

---

## 🔍 Why this project?

Understanding large React codebases can be difficult — especially when trying to trace function calls and component relationships.

**Project Visualizer solves this by providing a clear visual representation of your code structure.**

---

## ✨ Features

- 📊 Generates **call graphs** of functions and components  
- ⚛️ Supports **React (JS/TS/JSX/TSX)**  
- 🔗 Tracks **function calls and dependencies**  
- 🧠 Uses **AST parsing (accurate, not regex-based)**  
- ⚡ Helps in debugging and understanding complex codebases  

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite)  
- **Backend:** Flask (Python)  
- **Parser:** Babel (Node.js)  
- **Visualization:** Graph rendering (custom / library-based)  

---

## ⚙️ How it works

1. Upload a React file  
2. Flask API sends file to parser  
3. AST is generated using Babel  
4. Function calls & dependencies are extracted  
5. Graph data is returned and visualized in UI  

---

## 🚧 Future Improvements

- Multi-file dependency graph (in progress)  
- Full project scanning  
- Real-time graph updates  
- Performance optimization for large codebases  

---

## ▶️ Quick Start

### One command (recommended)

**Windows:**
```bash
.\scripts\start-all.bat
```

**macOS/Linux:**
```bash
./scripts/start-all.sh
```

This will open **two terminals** automatically:
- **Server**: Flask API at http://localhost:8000
- **Client**: React Dev Server at http://localhost:5173

> **📖 Need more help?**
> - **Windows Users**: See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for detailed setup
> - **All Users**: See [COMMANDS.md](COMMANDS.md) for quick command reference

### Manual setup

#### Prerequisites
- **Node.js** 18+ (for client)
- **Python** 3.8+ (for server)

#### 1. Setup Server (Python)

```bash
# Windows
cd SERVER
python -m venv .venv
.\.venv\Scripts\activate
pip install flask flasgger flask-cors
npm install

# macOS/Linux
cd SERVER
python3 -m venv venv
source venv/bin/activate
pip install flask flasgger flask-cors
npm install
```

#### 2. Setup Client (React)

```bash
cd client
npm install
npm run dev
```

#### 3. Run Server

**Windows:**
```bash
.\scripts\start-server.bat
```

**macOS/Linux:**
```bash
./scripts/start-server.sh
```

Server runs at: http://localhost:8000

---

## 📁 Project Structure

```
Project-Visualizer/
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── SERVER/              # Flask backend
│   ├── main.py
│   ├── Router/          # API routes
│   ├── Services/        # File parsing & analysis
│   └── package.json
├── scripts/             # Startup scripts
│   ├── start-all.bat    # Windows - start both
│   ├── start-all.sh     # Unix - start both
│   ├── start-server.bat # Windows - server only
│   ├── start-server.sh  # Unix - server only
│   ├── start-client.bat # Windows - client only
│   └── start-client.sh  # Unix - client only
└── README.md
```

---

## 🌐 API Endpoints

- **POST** `/upload` - Upload a file and generate call graph

---

## 🎯 Usage

1. Visit http://localhost:5173
2. Click "Upload" and select a React JS/TS file
3. View the interactive call graph
4. Click nodes to view source code

---

## 🐛 Troubleshooting

**Server won't start?**
- Ensure Python virtual environment is activated
- Check: `python --version` (should be 3.8+)
- Reinstall deps: `pip install flask flasgger flask-cors`

**Client won't start?**
- Ensure Node.js is installed: `node --version`
- Delete `node_modules` and `package-lock.json`, then `npm install`

**Port already in use?**
- Change port in `SERVER/main.py` (currently 8000)
- Change port in `client/vite.config.ts` (currently 5173)
