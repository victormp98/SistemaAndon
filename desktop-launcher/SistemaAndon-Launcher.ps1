param(
    [ValidateSet("", "Start", "Stop", "Status", "Backup", "Seed")]
    [string]$Action = "",
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Node = Join-Path $Root "runtime\node.exe"
$PidFile = Join-Path $Root "logs\server.pid"
$OutLog = Join-Path $Root "logs\server-output.log"
$ErrorLog = Join-Path $Root "logs\server-error.log"
$EnvFile = Join-Path $Root ".env"
$Port = 3000

function Initialize-Environment {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root "data"), (Join-Path $Root "backups"), (Join-Path $Root "logs") | Out-Null
    if (-not (Test-Path -LiteralPath $Node)) {
        throw "No se encontró el runtime portable en: $Node"
    }
    if (-not (Test-Path -LiteralPath $EnvFile)) {
        $bytes = New-Object byte[] 48
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
        $secret = [Convert]::ToBase64String($bytes)
        @"
HOST=0.0.0.0
PORT=3000
DATABASE_PATH=data/database.sqlite
JWT_SECRET=$secret
JWT_EXPIRES_IN=8h
HTTPS_ENABLED=false
"@ | Set-Content -LiteralPath $EnvFile -Encoding ASCII
    }
    $portLine = Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^PORT=' } | Select-Object -First 1
    if ($portLine) { $script:Port = [int]($portLine -replace '^PORT=', '') }
}

function Get-ServerProcess {
    if (-not (Test-Path -LiteralPath $PidFile)) { return $null }
    $serverPid = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
    if (-not $serverPid) { return $null }
    return Get-Process -Id ([int]$serverPid) -ErrorAction SilentlyContinue
}

function Get-LanAddresses {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
        Select-Object -ExpandProperty IPAddress -Unique
}

function Show-Urls {
    Write-Host ""
    Write-Host "URL local:    http://localhost:$Port" -ForegroundColor Cyan
    foreach ($address in Get-LanAddresses) {
        Write-Host "URL LAN:      http://${address}:$Port" -ForegroundColor Cyan
        Write-Host "Andon LAN:    http://${address}:$Port/andon" -ForegroundColor Cyan
    }
}

function Start-Andon {
    if (Get-ServerProcess) {
        Write-Host "El servidor ya está ejecutándose." -ForegroundColor Yellow
        Show-Urls
        return
    }
    $env:NODE_ENV = "production"
    $process = Start-Process -FilePath $Node `
        -ArgumentList "--env-file-if-exists=.env", "backend/src/index.js" `
        -WorkingDirectory $Root -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $OutLog -RedirectStandardError $ErrorLog
    Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ASCII
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health/runtime" -TimeoutSec 2
            if ($health.ok) {
                Write-Host "Sistema Andon iniciado. SQLite: $($health.database)." -ForegroundColor Green
                Show-Urls
                if (-not $NoBrowser) { Start-Process "http://localhost:$Port" | Out-Null }
                return
            }
        } catch {}
    }
    Write-Host "El servidor no respondió. Revisa logs\server-error.log." -ForegroundColor Red
}

function Stop-Andon {
    $process = Get-ServerProcess
    if (-not $process) {
        Write-Host "El servidor no está ejecutándose." -ForegroundColor Yellow
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        return
    }
    Stop-Process -Id $process.Id
    $process.WaitForExit()
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Servidor detenido." -ForegroundColor Green
}

function Show-Status {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health/runtime" -TimeoutSec 3
        Write-Host "Servidor: ACTIVO | SQLite: $($health.database) | Clientes WebSocket: $($health.websocket_clients) | Uptime: $($health.uptime_seconds)s" -ForegroundColor Green
        Show-Urls
    } catch {
        Write-Host "Servidor: DETENIDO o sin respuesta." -ForegroundColor Yellow
    }
}

function New-Backup {
    Push-Location $Root
    try {
        $result = & $Node "--env-file-if-exists=.env" "backend/src/cli/backup.js"
        if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el respaldo." }
        Write-Host "Respaldo creado: $result" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Initialize-DemoData {
    if (Get-ServerProcess) {
        Write-Host "Detén el servidor antes de cargar los datos TEST." -ForegroundColor Yellow
        return
    }
    Push-Location $Root
    try {
        & $Node "--env-file-if-exists=.env" "backend/src/database/seedDemo.js"
        if ($LASTEXITCODE -ne 0) { throw "No se pudieron cargar los datos TEST." }
    } finally {
        Pop-Location
    }
}

Initialize-Environment
if ($Action) {
    switch ($Action) {
        "Start" { Start-Andon }
        "Stop" { Stop-Andon }
        "Status" { Show-Status }
        "Backup" { New-Backup }
        "Seed" { Initialize-DemoData }
    }
    exit
}
do {
    Write-Host ""
    Write-Host "========================================"
    Write-Host " Sistema Andon - Producto Completo Local/LAN"
    Write-Host "========================================"
    Write-Host "1. Iniciar servidor"
    Write-Host "2. Mostrar estado y URLs"
    Write-Host "3. Abrir sistema"
    Write-Host "4. Crear respaldo manual"
    Write-Host "5. Detener servidor"
    Write-Host "6. Cargar/restablecer datos TEST"
    Write-Host "0. Salir del launcher"
    $choice = Read-Host "Selecciona una opción"
    switch ($choice) {
        "1" { Start-Andon }
        "2" { Show-Status }
        "3" { Start-Process "http://localhost:$Port" | Out-Null }
        "4" { New-Backup }
        "5" { Stop-Andon }
        "6" { Initialize-DemoData }
        "0" { break }
        default { Write-Host "Opción no válida." -ForegroundColor Yellow }
    }
} while ($choice -ne "0")
