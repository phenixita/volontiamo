param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSCommandPath
$apiProject = Join-Path $repoRoot 'src\volontiamo.api\volontiamo.api.csproj'
$mobileDir = Join-Path $repoRoot 'src\volontiamo.mobile\volontiamo'
$webDir = Join-Path $repoRoot 'src\volontiamo.web\volontiamo'

function Assert-PathExists {
    param(
        [string]$Path,
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description non trovato: $Path"
    }
}

function Get-PowerShellExecutable {
    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwsh) {
        return $pwsh.Source
    }

    $windowsPowerShell = Get-Command powershell -ErrorAction SilentlyContinue
    if ($windowsPowerShell) {
        return $windowsPowerShell.Source
    }

    throw 'Nessuna shell PowerShell disponibile.'
}

function Test-CommandLineContainsAll {
    param(
        [AllowNull()][string]$CommandLine,
        [string[]]$Parts
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }

    foreach ($part in $Parts) {
        if ($CommandLine.IndexOf($part, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
            return $false
        }
    }

    return $true
}

function Stop-ProcessTree {
    param(
        [string]$Name,
        [string[]]$CommandLineParts
    )

    $processes = @(Get-CimInstance Win32_Process)
    $matches = @($processes | Where-Object { Test-CommandLineContainsAll -CommandLine $_.CommandLine -Parts $CommandLineParts })

    if ($matches.Count -eq 0) {
        Write-Host "Nessun processo $Name gia' avviato trovato."
        return
    }

    $processesByParentId = @{}
    foreach ($process in $processes) {
        if (-not $processesByParentId.ContainsKey($process.ParentProcessId)) {
            $processesByParentId[$process.ParentProcessId] = New-Object System.Collections.Generic.List[object]
        }

        $processesByParentId[$process.ParentProcessId].Add($process)
    }

    $processesToStopById = @{}
    $pending = New-Object System.Collections.Generic.Queue[object]
    foreach ($match in $matches) {
        $pending.Enqueue($match)
    }

    while ($pending.Count -gt 0) {
        $process = $pending.Dequeue()
        if ($processesToStopById.ContainsKey($process.ProcessId)) {
            continue
        }

        $processesToStopById[$process.ProcessId] = $process

        if ($processesByParentId.ContainsKey($process.ProcessId)) {
            foreach ($childProcess in $processesByParentId[$process.ProcessId]) {
                $pending.Enqueue($childProcess)
            }
        }
    }

    $processesToStop = @($processesToStopById.Values | Sort-Object ProcessId -Descending)

    if ($DryRun) {
        Write-Host "[DRY-RUN] Arresto $Name"
        foreach ($process in $processesToStop) {
            Write-Host "  PID $($process.ProcessId): $($process.Name)"
        }
        return
    }

    foreach ($process in $processesToStop) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
        }
        catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
            if ($_.Exception.Message -notmatch 'Cannot find a process') {
                throw
            }
        }
    }

    Write-Host "Arrestato $Name"
}

function Start-AppProcess {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command,
        [string]$PowerShellExecutable
    )

    $wrappedCommand = "Set-Location -LiteralPath '$WorkingDirectory'; $Command"

    if ($DryRun) {
        Write-Host "[DRY-RUN] $Name"
        Write-Host "  Dir: $WorkingDirectory"
        Write-Host "  Cmd: $Command"
        return
    }

    Start-Process -FilePath $PowerShellExecutable -WorkingDirectory $WorkingDirectory -ArgumentList @(
        '-NoExit',
        '-Command',
        $wrappedCommand
    ) | Out-Null

    Write-Host "Avviato $Name"
}

Assert-PathExists -Path $apiProject -Description 'Progetto API'
Assert-PathExists -Path $mobileDir -Description 'Directory mobile'
Assert-PathExists -Path $webDir -Description 'Directory web'

$powerShellExecutable = Get-PowerShellExecutable

$env:ASPNETCORE_ENVIRONMENT="Development"

Stop-ProcessTree -Name 'API' -CommandLineParts @('dotnet run --project', $apiProject)
Stop-ProcessTree -Name 'Mobile' -CommandLineParts @($mobileDir, 'npm start')
Stop-ProcessTree -Name 'Web' -CommandLineParts @($webDir, 'npm run dev')

Start-AppProcess -Name 'API' -WorkingDirectory $repoRoot -Command "dotnet run --project `"$apiProject`"" -PowerShellExecutable $powerShellExecutable
Start-AppProcess -Name 'Mobile' -WorkingDirectory $mobileDir -Command 'npm start' -PowerShellExecutable $powerShellExecutable
Start-AppProcess -Name 'Web' -WorkingDirectory $webDir -Command 'npm run dev' -PowerShellExecutable $powerShellExecutable

if ($DryRun) {
    Write-Host 'Dry run completato.'
}
else {
    Write-Host 'Tutti i processi sono stati avviati in finestre separate.'
}