@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0..
cd /d "%ROOT%\SERVER"

REM Activate virtual environment
if exist "%ROOT%\.venv\Scripts\activate.bat" (
    call "%ROOT%\.venv\Scripts\activate.bat"
)

REM Install Node dependencies if needed
if not exist node_modules (
    echo Installing SERVER Node deps...
    call npm install
)

REM Start Python server
echo Starting API at http://localhost:8000
call python main.py
pause
