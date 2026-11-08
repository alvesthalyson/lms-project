<#
.SYNOPSIS
  Sprint 0 without Docker: the same first end-to-end run as scripts/sprint0.sh, on plain Windows.

.DESCRIPTION
  Needs, installed and on PATH: Python 3.12 to 3.14, Node.js 22, PostgreSQL 16 (its "bin" folder is found automatically).
  Run it from the repository root (PowerShell):

      powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1              # setup + tests + builds
      powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1 -Step backend
      powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1 -Step frontend
      powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1 -Step run   # starts both servers
      powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1 -Step demo  # demo accounts + sample loans

  It stops at the first failing step and says which one it was. Details: docs\SPRINT0.md
#>
param(
  [ValidateSet("all", "backend", "frontend", "run", "demo")]
  [string]$Step = "all"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$Venv = Join-Path $BackendDir ".venv"
$VenvPython = Join-Path $Venv "Scripts\python.exe"
$DbName = "lms"
$DbUser = "lms"
$DbPassword = "lms_dev_password"   # development only; the database listens on localhost

$script:Current = "?"

function Write-Step([string]$Text) {
  $script:Current = $Text
  Write-Host ""
  Write-Host "== $Text" -ForegroundColor Yellow
}

# Native commands do not throw in PowerShell: check the exit code ourselves.
function Invoke-Native {
  param([string]$File, [string[]]$Arguments = @())
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "'$File $($Arguments -join ' ')' exited with code $LASTEXITCODE" }
}

function Import-DotEnv([string]$Path) {
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
    $index = $trimmed.IndexOf("=")
    if ($index -lt 1) { continue }
    $name = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim()
    Set-Item -Path "Env:$name" -Value $value
  }
}

function Find-Psql {
  $found = Get-Command psql -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }
  $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
  if ($candidates) { return $candidates[0].FullName }
  throw "psql.exe not found. Install PostgreSQL 16 (https://www.postgresql.org/download/windows/) and run this script again."
}

function Test-Prerequisites {
  Write-Step "0. check Python, Node and PostgreSQL"
  $py = Get-Command python -ErrorAction SilentlyContinue
  if (-not $py) { throw "Python not found. Install Python 3.12 or 3.13 and tick 'Add python.exe to PATH'." }
  $version = (& python -c "import sys; print('%d.%d' % sys.version_info[:2])").Trim()
  Write-Host "Python $version"
  if ($version -notin @("3.12", "3.13", "3.14")) {
    Write-Warning "Python $version is not 3.12-3.14. Some pinned packages may have no prebuilt wheel for it."
  }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { throw "Node.js not found. Install Node.js 22 (LTS) from nodejs.org." }
  $nodeVersion = (& node --version).Trim()
  Write-Host "Node $nodeVersion"
  if (-not $nodeVersion.StartsWith("v22")) { Write-Warning "Node $nodeVersion is not v22; the project targets Node 22." }
  Write-Host "psql: $(Find-Psql)"
}

function Initialize-Database {
  Write-Step "1. create the PostgreSQL role and database (and install pg_trgm)"
  $psql = Find-Psql
  $secure = Read-Host "Password of the PostgreSQL user 'postgres' (the one you chose when installing PostgreSQL)" -AsSecureString
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  $common = @("-h", "localhost", "-U", "postgres", "-v", "ON_ERROR_STOP=1")

  $hasRole = (& $psql @common -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'")
  if ($LASTEXITCODE -ne 0) { throw "Could not connect to PostgreSQL on localhost:5432 as 'postgres'. Is the service running and the password right?" }
  if (-not $hasRole) { Invoke-Native $psql ($common + @("-c", "CREATE ROLE $DbUser LOGIN PASSWORD '$DbPassword' CREATEDB")) }
  else { Write-Host "role '$DbUser' already exists" }

  $hasDb = (& $psql @common -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'")
  if (-not $hasDb) { Invoke-Native $psql ($common + @("-c", "CREATE DATABASE $DbName OWNER $DbUser")) }
  else { Write-Host "database '$DbName' already exists" }

  # In template1 too, so the throw-away database pytest creates has the extension from the start.
  foreach ($db in @("template1", $DbName)) {
    Invoke-Native $psql ($common + @("-d", $db, "-c", "CREATE EXTENSION IF NOT EXISTS pg_trgm"))
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

function Initialize-BackendEnv {
  Write-Step "2. write backend\.env"
  $target = Join-Path $BackendDir ".env"
  if (Test-Path $target) { Write-Host "backend\.env already exists, keeping it"; return }
  $secret = (& python -c "import secrets; print(secrets.token_urlsafe(50))").Trim()
  $text = (Get-Content (Join-Path $BackendDir ".env.example") -Raw) -replace "DJANGO_SECRET_KEY=.*", "DJANGO_SECRET_KEY=$secret"
  $text += "`r`nPOSTGRES_HOST=localhost`r`nPOSTGRES_PORT=5432`r`nPOSTGRES_DB=$DbName`r`nPOSTGRES_USER=$DbUser`r`nPOSTGRES_PASSWORD=$DbPassword`r`n"
  Set-Content -Path $target -Value $text -Encoding UTF8
}

function Invoke-Backend {
  Initialize-Database
  Initialize-BackendEnv

  Write-Step "3. create the virtual environment and install the backend packages"
  if (-not (Test-Path $VenvPython)) { Invoke-Native "python" @("-m", "venv", $Venv) }
  Invoke-Native $VenvPython @("-m", "pip", "install", "--upgrade", "pip")
  Invoke-Native $VenvPython @("-m", "pip", "install", "-r", (Join-Path $BackendDir "requirements-dev.txt"))

  Import-DotEnv (Join-Path $BackendDir ".env")
  Push-Location $BackendDir
  try {
    # books\migrations\0001_enable_trigram.py already exists. Without app names, makemigrations skips apps that have no
    # migrations folder yet, so every app is named explicitly (this also creates their folders).
    Write-Step "4. generate the migrations";          Invoke-Native $VenvPython @("manage.py", "makemigrations", "core", "users", "books", "loans", "reservations")
    Write-Step "5. apply the migrations";             Invoke-Native $VenvPython @("manage.py", "migrate", "--noinput")
    Write-Step "6. Django system check";              Invoke-Native $VenvPython @("manage.py", "check")
    Write-Step "7. create the default categories";    Invoke-Native $VenvPython @("manage.py", "seed_categories")
    Write-Step "7b. create demo books (so the shelves are not empty)"; Invoke-Native $VenvPython @("manage.py", "seed_demo")
    Write-Step "8. backend tests (pytest)";           Invoke-Native $VenvPython @("-m", "pytest", "-q")
  }
  finally { Pop-Location }
}

function Invoke-Frontend {
  $envFile = Join-Path $FrontendDir ".env"
  if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $FrontendDir ".env.example") $envFile }
  Push-Location $FrontendDir
  try {
    Write-Step "9. install the frontend packages (npm install)"; Invoke-Native "npm" @("install", "--no-audit", "--no-fund")
    Write-Step "10. typecheck";                                  Invoke-Native "npm" @("run", "typecheck")
    Write-Step "11. unit tests (vitest)";                        Invoke-Native "npm" @("test")
    Write-Step "12. production build";                           Invoke-Native "npm" @("run", "build")
  }
  finally { Pop-Location }
}

function Invoke-DemoUsers {
  Write-Step "demo accounts and sample activity (development only)"
  if (-not (Test-Path $VenvPython)) { throw "Run the backend step first: scripts\sprint0.ps1 -Step backend" }
  Import-DotEnv (Join-Path $BackendDir ".env")
  Push-Location $BackendDir
  try { Invoke-Native $VenvPython @("manage.py", "seed_demo_users") } finally { Pop-Location }
}

function Start-Servers {
  Write-Step "start the backend (http://localhost:8000) and the frontend (http://localhost:5173)"
  if (-not (Test-Path $VenvPython)) { throw "Run the backend step first: scripts\sprint0.ps1 -Step backend" }
  $backendCommand = "Set-Location '$BackendDir'; Get-Content .env | Where-Object { `$_ -match '^[A-Za-z_]+=' } | ForEach-Object { `$k,`$v = `$_ -split '=',2; Set-Item -Path ('Env:' + `$k.Trim()) -Value `$v.Trim() }; & '$VenvPython' manage.py runserver 8000"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendDir'; npm run dev"
  Write-Host "Two new windows were opened. Open http://localhost:5173 (API docs: http://localhost:8000/api/docs/)."
}

try {
  switch ($Step) {
    "backend"  { Test-Prerequisites; Invoke-Backend }
    "frontend" { Test-Prerequisites; Invoke-Frontend }
    "run"      { Start-Servers; return }
    "demo"     { Invoke-DemoUsers; return }
    default    { Test-Prerequisites; Invoke-Backend; Invoke-Frontend }
  }
  Write-Host ""
  Write-Host "Done. Start both servers with: powershell -ExecutionPolicy Bypass -File scripts\sprint0.ps1 -Step run" -ForegroundColor Green
  Write-Host "Remember to commit backend\apps\*\migrations\ and frontend\package-lock.json."
}
catch {
  Write-Host ""
  Write-Host "FAILED at step: $script:Current" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
