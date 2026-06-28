Write-Host "=== HERMES AGENT - Prueba Local ===" -ForegroundColor Cyan

# Crear .env si no existe
if (-not (Test-Path "C:\Hotel\.env")) {
  @"
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/hermes
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-test-secret-123
JWT_EXPIRES_IN=7d
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
"@ | Set-Content "C:\Hotel\.env"
  Write-Host "[OK] .env creado" -ForegroundColor Green
}

# Compilar TypeScript
Write-Host "[1/3] Compilando TypeScript..." -ForegroundColor Yellow
cd C:\Hotel
npx tsc 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Compilación falló" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Compilación exitosa" -ForegroundColor Green

# Iniciar servidor en background
Write-Host "[2/3] Iniciando servidor Hermes..." -ForegroundColor Yellow
$process = Start-Process -FilePath "node" -ArgumentList "dist\index.js" -NoNewWindow -PassThru -RedirectStandardOutput "C:\Hotel\hermes.log" -RedirectStandardError "C:\Hotel\hermes_err.log"

# Esperar a que inicie
Start-Sleep -Seconds 3

# Verificar que está corriendo
$running = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "[OK] Servidor Hermes corriendo en http://localhost:3000" -ForegroundColor Green

  # Pruebas
  Write-Host "[3/3] Probando endpoints..." -ForegroundColor Yellow

  # Health check
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
    if ($health.status -eq "ok") {
      Write-Host "[PASS] /health -> OK (v$($health.version))" -ForegroundColor Green
    } else {
      Write-Host "[WARN] /health -> $($health | ConvertTo-Json)" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "[WARN] /health no disponible (BD no conectada)" -ForegroundColor Yellow
  }

  # Admin panel
  try {
    $html = Invoke-WebRequest -Uri "http://localhost:3000/" -TimeoutSec 5
    if ($html.Content -match "Hermes Agent") {
      Write-Host "[PASS] / -> Admin Panel cargado correctamente" -ForegroundColor Green
    }
  } catch {
    Write-Host "[WARN] Admin panel no disponible" -ForegroundColor Yellow
  }

  # Agent status
  try {
    $status = Invoke-RestMethod -Uri "http://localhost:3000/api/agent/status" -TimeoutSec 5
    Write-Host "[PASS] /api/agent/status -> Agent: $($status.agent), Ollama: $($status.ollama)" -ForegroundColor Green
  } catch {
    Write-Host "[WARN] /api/agent/status no disponible" -ForegroundColor Yellow
  }

  Write-Host "`n=== PRUEBAS COMPLETADAS ===" -ForegroundColor Cyan
  Write-Host "Servidor activo en: http://localhost:3000" -ForegroundColor Green
  Write-Host "Logs: C:\Hotel\hermes.log" -ForegroundColor Gray
  Write-Host "Para detener: Stop-Process -Id $($process.Id)" -ForegroundColor Yellow
} else {
  Write-Host "[ERROR] El servidor no pudo iniciar. Revisa hermes_err.log" -ForegroundColor Red
  Get-Content "C:\Hotel\hermes_err.log" -Tail 10
}
