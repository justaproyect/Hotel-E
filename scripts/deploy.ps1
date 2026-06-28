# Script de despliegue para Render
Write-Host "=== HERMES AGENT - Build & Deploy ===" -ForegroundColor Cyan

# 1. Instalar dependencias
Write-Host "[1/4] Instalando dependencias..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "Error en npm install" -ForegroundColor Red; exit 1 }

# 2. Compilar TypeScript
Write-Host "[2/4] Compilando TypeScript..." -ForegroundColor Yellow
npx tsc
if ($LASTEXITCODE -ne 0) { Write-Host "Error en compilación" -ForegroundColor Red; exit 1 }

# 3. Ofuscar código
Write-Host "[3/4] Ofuscando código..." -ForegroundColor Yellow
node scripts/obfuscate.js
if ($LASTEXITCODE -ne 0) { Write-Host "Error en ofuscación" -ForegroundColor Red; exit 1 }

# 4. Limpiar source maps y declaraciones
Write-Host "[4/4] Limpiando archivos sensibles..." -ForegroundColor Yellow
Get-ChildItem -Path "dist" -Recurse -Include "*.d.ts", "*.d.ts.map", "*.js.map" | Remove-Item -Force

Write-Host "=== BUILD COMPLETADO ===" -ForegroundColor Green
Write-Host "El código ofuscado está en ./dist/" -ForegroundColor Cyan
