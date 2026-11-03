# scripts/run_dev.ps1
# Development startup script for Quantum Council.
# Run from the project root: .\scripts\run_dev.ps1

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython  = Join-Path $projectRoot ".venv\Scripts\python.exe"
$backendDir  = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  QUANTUM COUNCIL — Development Server" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ── Check Ollama ──────────────────────────────────────────────────────────────
Write-Host "[1/3] Checking Ollama..." -ForegroundColor Yellow
$ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (Test-Path $ollamaPath) {
    Write-Host "  Ollama found. Starting service if not running..." -ForegroundColor Green
    Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
} else {
    Write-Host "  WARNING: Ollama not found. Local LLM calls will fail." -ForegroundColor Red
}

# ── Start backend ─────────────────────────────────────────────────────────────
Write-Host "[2/3] Starting FastAPI backend on http://127.0.0.1:8000 ..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath $venvPython -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $backendDir `
    -PassThru `
    -WindowStyle Normal

Write-Host "  Backend PID: $($backendProcess.Id)" -ForegroundColor Green
Start-Sleep -Seconds 2

# ── Start frontend ────────────────────────────────────────────────────────────
Write-Host "[3/3] Starting React frontend on http://localhost:5173 ..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
    -WorkingDirectory $frontendDir `
    -PassThru `
    -WindowStyle Normal

Write-Host "  Frontend PID: $($frontendProcess.Id)" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Backend  : http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  API Docs : http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all processes." -ForegroundColor Gray

try {
    Wait-Process -Id $backendProcess.Id
} finally {
    Write-Host "Stopping processes..." -ForegroundColor Yellow
    Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue
}

