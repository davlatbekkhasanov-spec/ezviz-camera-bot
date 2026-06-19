# Sklad serverga yangi kod + begona alert yoqish (bir marta yoki yangilashda).
# Ishga tushirish: powershell -File scripts\deploy-to-sklad-server.ps1

$ErrorActionPreference = "Stop"
$Server = "desktop-server"
$RemoteRoot = "C:\sklad-server\ezviz-camera-bot"
$LocalRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (Test-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "lib")) {
  $LocalRoot = Split-Path $PSScriptRoot -Parent
}

Write-Host "=== QORA KO'Z — serverga deploy ===" -ForegroundColor Cyan
Write-Host "Local:  $LocalRoot"
Write-Host "Remote: ${Server}:$RemoteRoot"

$files = @(
  "start.mjs",
  "index.mjs",
  "lib\stranger-alert.mjs",
  "lib\cloud-watch.mjs",
  "lib\telegram-bot.mjs",
  "event-api\schema.sql"
)

foreach ($f in $files) {
  $src = Join-Path $LocalRoot $f
  if (-not (Test-Path $src)) { throw "Topilmadi: $src" }
  $dst = "$RemoteRoot/$($f -replace '\\','/')"
  Write-Host "  -> $f"
  scp -q $src "${Server}:$dst"
}

$envPatch = @"
if not exist `"$RemoteRoot\.env`" echo .env topilmadi & exit /b 1
findstr /I /C:`"STRANGER_ALERT_ENABLED`" `"$RemoteRoot\.env`" >nul || echo STRANGER_ALERT_ENABLED=1>>`"$RemoteRoot\.env`"
findstr /I /C:`"CLOUD_WATCH_ENABLED`" `"$RemoteRoot\.env`" >nul || echo CLOUD_WATCH_ENABLED=1>>`"$RemoteRoot\.env`"
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
start `"`" /MIN cmd /c `"$RemoteRoot\..\server-run.bat`"
curl -s http://127.0.0.1:8080/health
"@

ssh $Server "cmd /c `"$($envPatch -replace '"','\"')`""
Write-Host "TAYYOR — Telegramda /status yuboring." -ForegroundColor Green
