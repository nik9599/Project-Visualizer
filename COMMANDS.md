# Quick Commands Reference

## Windows

### Start Everything
```batch
.\scripts\start-all.bat
```

### Start Server Only
```batch
.\scripts\start-server.bat
```

### Start Client Only
```batch
.\scripts\start-client.bat
```

### Manual Virtual Environment Setup
```batch
cd SERVER
python -m venv .venv
.\.venv\Scripts\activate
pip install flask flasgger flask-cors
npm install
```

### Update Dependencies
```batch
# Server (from SERVER folder)
pip install --upgrade flask flasgger flask-cors

# Client (from client folder)
npm install
```

---

## macOS / Linux

### Start Everything
```bash
./scripts/start-all.sh
```

### Start Server Only
```bash
./scripts/start-server.sh
```

### Start Client Only
```bash
./scripts/start-client.sh
```

### Manual Virtual Environment Setup
```bash
cd SERVER
python3 -m venv venv
source venv/bin/activate
pip install flask flasgger flask-cors
npm install
```

### Update Dependencies
```bash
# Server (from SERVER folder)
pip install --upgrade flask flasgger flask-cors

# Client (from client folder)
npm install
```

---

## Git & Repository

### Initial Setup After Clone
```bash
# Windows
.\scripts\start-all.bat

# macOS/Linux
./scripts/start-all.sh
```

### Check Git Status
```bash
git status
```

### Commit Changes
```bash
git add .
git commit -m "Your message"
git push
```

### Clean Ignored Files (before committing)
```bash
git clean -fd
```

---

## Development

### Rebuild Frontend
```batch
cd client
npm run build
```

### Check Python Version
```batch
python --version
```

### Check Node Version
```batch
node --version
npm --version
```

### Kill Port (if needed)
```powershell
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill it (replace PID with actual number)
taskkill /PID <PID> /F
```

---

## API Endpoints

- **Upload File**: `POST http://localhost:8000/upload`
- **API Docs**: `GET http://localhost:8000/docs`

---

## Common Issues

### Port Already in Use
- Server: Modify `SERVER/main.py` port (default 8000)
- Client: Modify `client/vite.config.ts` port (default 5173)

### Virtual Environment Issues
```batch
# Deactivate current (if any)
deactivate

# Remove and recreate
rmdir /s .venv
python -m venv .venv
.\.venv\Scripts\activate
pip install flask flasgger flask-cors
```

### Clear npm Cache
```batch
npm cache clean --force
```
