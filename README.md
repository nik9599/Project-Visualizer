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

From the repo root:

```bash
./scripts/start-all.sh
