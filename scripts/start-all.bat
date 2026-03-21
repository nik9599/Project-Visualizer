@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0..

echo Opening two terminals (server + client)...
echo.

start "Project-Visualizer Server" cmd /k cd /d "%ROOT%" ^& .\scripts\start-server.bat
start "Project-Visualizer Client" cmd /k cd /d "%ROOT%" ^& .\scripts\start-client.bat

echo.
echo Both terminals opened!
echo Server: http://localhost:8000
echo Client: http://localhost:5173
