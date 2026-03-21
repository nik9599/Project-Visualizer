@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0..
cd /d "%ROOT%\client"

REM Install dependencies if needed
if not exist node_modules (
    echo Installing client dependencies...
    call npm install
)

echo.
echo Starting Vite dev server...
echo Open the printed localhost URL in your browser.
echo.

call npm run dev
pause
