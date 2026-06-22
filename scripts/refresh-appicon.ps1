# Regenera icon.ico a partir de build/appicon.png (Wails não atualiza se icon.ico já existir).
# Uso: .\scripts\refresh-appicon.ps1
# Feche o Rebeka antes de rodar.

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$appicon = Join-Path $root "build\appicon.png"
$logo = Join-Path $root "frontend\src\assets\images\logo.png"
$iconIco = Join-Path $root "build\windows\icon.ico"
$wails = Join-Path $env:USERPROFILE "go\bin\wails.exe"

if (Test-Path $logo) {
  Copy-Item $logo $appicon -Force
  Write-Host "appicon.png atualizado a partir de logo.png"
}

if (Test-Path $iconIco) {
  Remove-Item $iconIco -Force
  Write-Host "icon.ico removido (será recriado no build)"
}

Get-ChildItem $root -Filter "*.syso" -ErrorAction SilentlyContinue | Remove-Item -Force

if (-not (Test-Path $wails)) {
  Write-Warning "wails CLI não encontrado em $wails"
  exit 1
}

Push-Location $root
& $wails build
Pop-Location

Write-Host "Concluído. Execute build\bin\rebeka.exe ou reinicie wails dev."
