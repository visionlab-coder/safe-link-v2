param (
    [switch]$AllCache,
    [switch]$NpmCache,
    [switch]$YarnCache,
    [switch]$PnpmCache,
    [switch]$WindowsTemp,
    [switch]$DnsCache,
    [switch]$KillZombies,
    [switch]$WhatIf
)

$whatIfArg = if ($WhatIf) { " (WhatIf Mode - No actual deletion)" } else { "" }
Write-Host "=== [Vibe Optimizer: System Cleanup]$whatIfArg ===" -ForegroundColor Cyan

if (-not ($AllCache -or $NpmCache -or $YarnCache -or $PnpmCache -or $WindowsTemp -or $DnsCache -or $KillZombies)) {
    Write-Host "No cleanup options specified. Use -AllCache to clean everything, or specific switches." -ForegroundColor Red
    Write-Host "Available options: -AllCache, -NpmCache, -YarnCache, -PnpmCache, -WindowsTemp, -DnsCache, -KillZombies" -ForegroundColor Gray
    Write-Host "Example: .\cleanup.ps1 -WindowsTemp -NpmCache" -ForegroundColor Gray
    exit
}

if ($AllCache) {
    $NpmCache = $true
    $YarnCache = $true
    $PnpmCache = $true
    $WindowsTemp = $true
    $DnsCache = $true
}

function Remove-PathSafe {
    param($Path)
    if (Test-Path $Path) {
        if ($WhatIf) {
            Write-Host "[WhatIf] Would remove items in: $Path" -ForegroundColor DarkGray
        }
        else {
            Write-Host "Cleaning: $Path" -ForegroundColor Green
            Remove-Item -Path "$Path\*" -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Run-CommandSafe {
    param($CmdBlock, $Desc)
    if ($WhatIf) {
        Write-Host "[WhatIf] Would run: $Desc" -ForegroundColor DarkGray
    }
    else {
        Write-Host "Running: $Desc" -ForegroundColor Green
        & $CmdBlock
    }
}

# 1. Windows Temp
if ($WindowsTemp) {
    Write-Host "`n[*] Cleaning Windows Temp Files..." -ForegroundColor Yellow
    Remove-PathSafe -Path $env:TEMP
}

# 2. Package Manager Caches
if ($NpmCache) {
    Write-Host "`n[*] Cleaning NPM Cache..." -ForegroundColor Yellow
    Run-CommandSafe -CmdBlock { npm cache clean --force 2>$null } -Desc "npm cache clean --force"
}

if ($YarnCache) {
    Write-Host "`n[*] Cleaning Yarn Cache..." -ForegroundColor Yellow
    Run-CommandSafe -CmdBlock { yarn cache clean 2>$null } -Desc "yarn cache clean"
}

if ($PnpmCache) {
    Write-Host "`n[*] Cleaning Pnpm Cache..." -ForegroundColor Yellow
    Run-CommandSafe -CmdBlock { pnpm store prune 2>$null } -Desc "pnpm store prune"
}

# 3. DNS Cache
if ($DnsCache) {
    Write-Host "`n[*] Flushing DNS Cache..." -ForegroundColor Yellow
    Run-CommandSafe -CmdBlock { ipconfig /flushdns | Out-Null } -Desc "ipconfig /flushdns"
}

# 4. Zombie Processes (node, python, java)
if ($KillZombies) {
    Write-Host "`n[*] Checking for common zombie dev processes..." -ForegroundColor Yellow
    $devProcesses = @("node", "python", "java")
    foreach ($procName in $devProcesses) {
        $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
        if ($procs) {
            foreach ($p in $procs) {
                if ($WhatIf) {
                    Write-Host "[WhatIf] Would stop process: $($p.Name) (ID: $($p.Id))" -ForegroundColor DarkGray
                }
                else {
                    Write-Host "Stopping process: $($p.Name) (ID: $($p.Id))" -ForegroundColor Green
                    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}

Write-Host "`n=== [Cleanup Complete] ===" -ForegroundColor Cyan
if ($WhatIf) {
    Write-Host "Run without -WhatIf to perform actual cleanup." -ForegroundColor Yellow
}
