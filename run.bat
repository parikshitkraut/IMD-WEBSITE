@echo off
title IMD Nagpur Weather Desktop Launcher
echo ==========================================
echo Starting IMD Nagpur Weather Desktop App...
echo ==========================================

:: Enter backend and start server
cd backend
if not exist node_modules (
    echo [1/2] Installing backend dependencies (node_modules)...
    call npm install
) else (
    echo [1/2] Backend dependencies already installed.
)
start "IMD Weather Backend" cmd /k "npm start"

:: Return and enter frontend
cd ../frontend
if not exist node_modules (
    echo [2/2] Installing frontend dependencies (node_modules)...
    call npm install
) else (
    echo [2/2] Frontend dependencies already installed.
)
start "IMD Weather Frontend" cmd /k "npm run dev"

echo ==========================================
echo Launcher is opening the site...
echo If it does not open, please go to: http://localhost:5173
echo ==========================================
timeout /t 5 >nul
start http://localhost:5173
exit
