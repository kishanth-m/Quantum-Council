# Quantum Council — One-Click Windows Launcher
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  QUANTUM COUNCIL — Five Minds. One Intelligence." -ForegroundColor Cyan
Write-Host "  Local-First Privacy & Fault-Tolerant Multi-Agent AI" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Error "Python 3.12+ was not found on your system path. Please install Python."
    exit 1
}

# 2. Check virtual environment
if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment in .venv..." -ForegroundColor Yellow
    python -m venv .venv
}

# 3. Check environment file
if (-not (Test-Path ".env")) {
    Write-Host "Creating local .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# 4. Launch backend in background
Write-Host "Starting Quantum Council FastAPI backend on http://127.0.0.1:8000..." -ForegroundColor Green
$backendProc = Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000" -PassThru

# 5. Launch frontend
Write-Host "Starting Quantum Council React frontend..." -ForegroundColor Green
Set-Location frontend
npm run dev

# Cleanup on exit
Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue

