param (
    [string[]]$processNames,
    [bool]$clearTemp = $false
)

if ($processNames) {
    foreach ($name in $processNames) {
        Write-Host "Attempting to stop process: $name"
        Stop-Process -Name $name -Force -ErrorAction SilentlyContinue
    }
}

if ($clearTemp) {
    Write-Host "Cleaning system temporary files..."
    $tempPaths = @($env:TEMP, "C:\Windows\Temp")
    foreach ($path in $tempPaths) {
        Remove-Item "$path\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Optimization complete."
