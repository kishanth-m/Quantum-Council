#!/usr/bin/env bash
# Quantum Council — One-Click Linux/macOS Launcher
set -e

echo -e "\033[36m==========================================================\033[0m"
echo -e "\033[36m  QUANTUM COUNCIL — Five Minds. One Intelligence.\033[0m"
echo -e "\033[36m  Local-First Privacy & Fault-Tolerant Multi-Agent AI\033[0m"
echo -e "\033[36m==========================================================\033[0m"

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is required but not installed. Aborting."
    exit 1
fi

# 2. Virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment in .venv..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r backend/requirements.txt || true
else
    source .venv/bin/activate
fi

# 3. Environment configuration
if [ ! -f ".env" ]; then
    echo "Initializing .env from .env.example..."
    cp .env.example .env
fi

# 4. Start backend
echo "Starting backend on http://127.0.0.1:8000..."
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

# 5. Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev

