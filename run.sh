#!/bin/bash

# IMD Nagpur Weather Desktop Launcher for macOS / Linux
echo "=========================================="
echo "Starting IMD Nagpur Weather Desktop App..."
echo "=========================================="

# Find parent directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Backend setup
cd backend
if [ ! -d "node_modules" ]; then
    echo "[1/2] Installing backend dependencies..."
    npm install
else
    echo "[1/2] Backend dependencies already installed."
fi
npm start &
BACKEND_PID=$!

# Frontend setup
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "[2/2] Installing frontend dependencies..."
    npm install
else
    echo "[2/2] Frontend dependencies already installed."
fi
npm run dev &
FRONTEND_PID=$!

echo "=========================================="
echo "App is running! Opening browser in 5s..."
echo "URL: http://localhost:5173"
echo "Press Ctrl+C in this terminal to stop the app."
echo "=========================================="

sleep 5
open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null

# Clean up processes on exit
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM EXIT
wait
