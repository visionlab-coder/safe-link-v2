$ErrorActionPreference = "SilentlyContinue"

Write-Host "=== [Vibe Optimizer: System Diagnostics] ===" -ForegroundColor Cyan

# 1. Memory and CPU
$totalMem = [math]::round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1MB, 2)
$freeMem = [math]::round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
$usedMem = $totalMem - $freeMem
$percent = [math]::round(($usedMem / $totalMem) * 100, 1)

Write-Host "`n[Hardware Status]" -ForegroundColor Yellow
Write-Host "Memory: $usedMem GB / $totalMem GB ($percent % Used)"
Write-Host "Free Memory: $freeMem GB"

# 2. Disk Space
$cDrive = Get-CimInstance Win32_LogicalDisk | Where-Object DeviceID -eq "C:"
if ($cDrive) {
    $cTotal = [math]::round($cDrive.Size / 1GB, 2)
    $cFree = [math]::round($cDrive.FreeSpace / 1GB, 2)
    Write-Host "C: Drive: $cFree GB free of $cTotal GB"
}

# 3. Cache Sizes
Write-Host "`n[Development Caches]" -ForegroundColor Yellow

$npmCacheBase = "$env:LOCALAPPDATA\npm-cache"
if (Test-Path $npmCacheBase) {
    $npmSize = (Get-ChildItem -Path $npmCacheBase -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "NPM Cache: $([math]::round($npmSize, 2)) MB"
}
else { Write-Host "NPM Cache: Not found" }

$yarnCacheBase = "$env:LOCALAPPDATA\Yarn\Cache\v6"
if (Test-Path $yarnCacheBase) {
    $yarnSize = (Get-ChildItem -Path $yarnCacheBase -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "Yarn Cache: $([math]::round($yarnSize, 2)) MB"
}
else { Write-Host "Yarn Cache: Not found" }

$tempSize = (Get-ChildItem -Path $env:TEMP -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Windows Temp: $([math]::round($tempSize, 2)) MB"

# 4. Top Processes
Write-Host "`n[Top 10 Memory Consuming Processes]" -ForegroundColor Yellow
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, `
@{Name = 'Memory(MB)'; Expression = { [math]::round($_.WorkingSet64 / 1MB, 1) } } | `
    Format-Table -AutoSize

Write-Host "============================================`n" -ForegroundColor Cyan
