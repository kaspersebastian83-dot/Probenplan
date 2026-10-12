$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$runtimeNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$runtimePnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
if (Get-Command node -ErrorAction SilentlyContinue) { $nodePath = (Get-Command node).Source }
elseif (Test-Path -LiteralPath $runtimeNode) { $nodePath = $runtimeNode }
else { throw 'Bitte zuerst Node.js 22 oder neuer installieren.' }
$env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
if (-not (Test-Path -LiteralPath 'node_modules\vite')) {
  if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { & npm.cmd install }
  elseif (Test-Path -LiteralPath $runtimePnpm) { & $runtimePnpm install }
  else { throw 'Kein Paketmanager gefunden. Bitte Node.js mit npm installieren.' }
  if ($LASTEXITCODE -ne 0) { throw 'Installation fehlgeschlagen.' }
}
& $nodePath node_modules/typescript/bin/tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript-Pruefung fehlgeschlagen.' }
& $nodePath node_modules/vite/bin/vite.js build
if ($LASTEXITCODE -ne 0) { throw 'Build fehlgeschlagen.' }
& $nodePath scripts/build-sw.mjs
if ($LASTEXITCODE -ne 0) { throw 'Offline-Build fehlgeschlagen.' }
Write-Host 'Probenplan: http://localhost:4173 (dieses Fenster offen lassen)'
& $nodePath node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort
