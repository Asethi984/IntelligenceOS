<#
.SYNOPSIS
  Rebuild and redeploy IntelligenceOS Docker containers.

.DESCRIPTION
  Rebuilds backend + frontend images, recreates containers, and restarts.
  Use -RebuildDb to also rebuild/replace MongoDB and Redis containers (data preserved
  in named volumes unless -PurgeDb is also passed).

.PARAMETER RebuildDb
  Also recreate the mongodb and redis containers (volumes preserved by default).

.PARAMETER PurgeDb
  DESTRUCTIVE: deletes all MongoDB + Redis data volumes. Use only for full reset.

.PARAMETER NoBuild
  Skip image rebuild  just recreate containers from existing images (fast restart).

.PARAMETER Services
  Comma-separated list of services to target (default: all). e.g. -Services backend,frontend

.EXAMPLE
  .\deploy.ps1                    # Rebuild backend+frontend, recreate all
  .\deploy.ps1 -RebuildDb        # Also recreate DB containers (keeps data)
  .\deploy.ps1 -PurgeDb          # Full reset  deletes all DB data
  .\deploy.ps1 -NoBuild          # Fast restart, no rebuild
  .\deploy.ps1 -Services backend # Only rebuild/redeploy backend
#>
param(
  [switch]$RebuildDb,
  [switch]$PurgeDb,
  [switch]$NoBuild,
  [string]$Services = ""
)

$ErrorActionPreference = "Stop"
Set-Location -Path (Split-Path -Parent $PSCommandPath)

function Write-Step([string]$msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg){ Write-Host "  [!!] $msg" -ForegroundColor Yellow }

# ---- Preflight: .env exists ----
if (-not (Test-Path ".env")) {
  Write-Host "ERROR: .env not found. Run: cp .env.example .env  (then fill in secrets)" -ForegroundColor Red
  exit 1
}

# ---- Determine which services to act on ----
$svcArg = ""
if ($Services) {
  $svcArg = $Services.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

# ---- Destructive: purge DB volumes ----
if ($PurgeDb) {
  Write-Step "DESTRUCTIVE: Purging DB volumes (all data will be lost)"
  $confirm = Read-Host "Type 'DELETE' to confirm"
  if ($confirm -ne "DELETE") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
  }
  docker compose down -v
  Write-Ok "Volumes purged"
}

# ---- Build phase ----
if (-not $NoBuild) {
  Write-Step "Building images (no cache)"
  $buildSvcs = $svcArg
  if (-not $buildSvcs) { $buildSvcs = @("backend", "frontend") }
  docker compose build --no-cache $buildSvcs
  if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; exit 1 }
  Write-Ok "Images built"
} else {
  Write-Step "Skipping build (-NoBuild)"
}

# ---- DB containers ----
if ($RebuildDb -or $PurgeDb) {
  Write-Step "Recreating DB containers (mongodb, redis)"
  $dbSvcs = @("mongodb", "redis")
  docker compose up -d --force-recreate $dbSvcs
  if ($LASTEXITCODE -ne 0) { Write-Host "DB recreate failed" -ForegroundColor Red; exit 1 }
  Write-Ok "DB containers recreated (volumes preserved: $(-not $PurgeDb)"
  # Wait for mongo health
  Write-Host "  Waiting for MongoDB health..."
  $retries = 0
  while ($retries -lt 15) {
    $status = docker compose ps --format json mongodb 2>$null | ConvertFrom-Json | Select-Object -First 1
    if ($status.Health -eq "healthy") { Write-Ok "MongoDB healthy"; break }
    Start-Sleep -Seconds 2
    $retries++
  }
  if ($retries -ge 15) { Write-Warn2 "MongoDB health check timed out (may still be starting)" }
}

# ---- App containers ----
Write-Step "Recreating app containers"
$upSvcs = $svcArg
if (-not $upSvcs) { $upSvcs = @() }  # empty = all
$upArgs = @("up", "-d", "--force-recreate")
if ($upSvcs) { $upArgs += $upSvcs }
docker compose @upArgs
if ($LASTEXITCODE -ne 0) { Write-Host "DEPLOY FAILED" -ForegroundColor Red; exit 1 }
Write-Ok "Containers recreated"

# ---- Verify ----
Write-Step "Status"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# ---- Health probe ----
Write-Step "Health probe (backend)"
Start-Sleep -Seconds 3
try {
  $resp = Invoke-RestMethod -Uri "http://localhost:8001/api/" -TimeoutSec 5 -ErrorAction Stop
  Write-Ok "Backend responding: $($resp.status)"
} catch {
  Write-Warn2 "Backend not ready yet  check: docker compose logs backend"
}

Write-Host ""
Write-Host "Done. Frontend: http://localhost:3000  Backend: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""

