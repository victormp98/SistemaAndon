param(
    [string]$NodeRuntime = "C:\nvm4w\nodejs\node.exe"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReleaseRoot = Join-Path $Root "release"
$Target = Join-Path $ReleaseRoot "SistemaAndon"
$Zip = Join-Path $Root "SistemaAndon-Producto-Final.zip"

if (-not (Test-Path -LiteralPath $NodeRuntime)) {
    throw "No se encontró node.exe en $NodeRuntime"
}

$resolvedRelease = [System.IO.Path]::GetFullPath($ReleaseRoot)
if (-not $resolvedRelease.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "La carpeta de release calculada está fuera del proyecto."
}

& (Join-Path (Split-Path $NodeRuntime) "npm.cmd") run build
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación del frontend." }

if (Test-Path -LiteralPath $ReleaseRoot) {
    Remove-Item -LiteralPath $ReleaseRoot -Recurse -Force
}
if (Test-Path -LiteralPath $Zip) {
    Remove-Item -LiteralPath $Zip -Force
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Target "runtime"), (Join-Path $Target "data"), (Join-Path $Target "backups"), (Join-Path $Target "logs") | Out-Null

Copy-Item -LiteralPath $NodeRuntime -Destination (Join-Path $Target "runtime\node.exe")
Copy-Item -LiteralPath (Join-Path $Root "backend") -Destination $Target -Recurse
Remove-Item -LiteralPath (Join-Path $Target "backend\test") -Recurse -Force -ErrorAction SilentlyContinue
& (Join-Path (Split-Path $NodeRuntime) "npm.cmd") prune --omit=dev --prefix (Join-Path $Target "backend")
if ($LASTEXITCODE -ne 0) { throw "No se pudieron preparar dependencias productivas." }
New-Item -ItemType Directory -Force -Path (Join-Path $Target "frontend\dist") | Out-Null
Copy-Item -Path (Join-Path $Root "frontend\dist\*") -Destination (Join-Path $Target "frontend\dist") -Recurse
Copy-Item -LiteralPath (Join-Path $Root "desktop-launcher") -Destination $Target -Recurse
Copy-Item -LiteralPath (Join-Path $Root "docs") -Destination $Target -Recurse
Copy-Item -LiteralPath (Join-Path $Root "config.json") -Destination $Target
Copy-Item -LiteralPath (Join-Path $Root ".env.example") -Destination $Target
Copy-Item -LiteralPath (Join-Path $Root "LEEME_PRIMERO.txt") -Destination $Target
Copy-Item -LiteralPath (Join-Path $Root "README.md") -Destination $Target
Copy-Item -LiteralPath (Join-Path $Root "DOCUMENTACION_SISTEMA_ANDON.md") -Destination $Target

Remove-Item -LiteralPath (Join-Path $Target "backend\node_modules\.cache") -Recurse -Force -ErrorAction SilentlyContinue
Compress-Archive -LiteralPath $Target -DestinationPath $Zip -CompressionLevel Optimal

Write-Host "Release creado en: $Target"
Write-Host "ZIP creado en: $Zip"
