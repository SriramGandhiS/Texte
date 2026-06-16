@echo off
title KRS Question Paper Tool
cd /d "%~dp0\.."
set PORT=8787
set OLLAMA_MODEL=llama3.1:latest

where node >nul 2>&1
if %errorlevel%==0 (
  set NODE_EXE=node
) else (
  echo Node.js not found. Install from https://nodejs.org/
  pause
  exit /b 1
)

echo.
echo  KRS Question Paper Tool
echo  =======================
echo  1. Open Ollama app first
echo  2. Server: http://127.0.0.1:8787
echo.

start "KRS Paper Tool Server" /min "%NODE_EXE%" "%~dp0..\server\local-server.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8787/"
