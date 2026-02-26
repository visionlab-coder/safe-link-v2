
$totalMem = [math]::round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1MB, 2)
$freeMem = [math]::round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
$usedMem = $totalMem - $freeMem
$percent = [math]::round(($usedMem / $totalMem) * 100, 1)

Write-Host "--- [System Memory Status] ---"
Write-Host "Total: $totalMem GB"
Write-Host "Used:  $usedMem GB ($percent %)"
Write-Host "Free:  $freeMem GB"
Write-Host ""

Write-Host "--- [Top 12 Memory Consuming Processes] ---"
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 Name, `
    @{Name='Memory(MB)';Expression={[math]::round($_.WorkingSet64 / 1MB, 1)}}, `
    @{Name='CPU(%)';Expression={[math]::round($_.CPU, 1)}} | `
    Format-Table -AutoSize

Write-Host "--- [Non-Responsive Processes] ---"
$nonRes = Get-Process | Where-Object { $_.Responding -eq $false }
if ($nonRes) { $nonRes | Select-Object Name, Id } else { Write-Host "None" }
