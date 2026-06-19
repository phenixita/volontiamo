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

Start-AppProcess -Name 'API' -WorkingDirectory $repoRoot -Command "dotnet run --project `"$apiProject`"" -PowerShellExecutable $powerShellExecutable
Start-AppProcess -Name 'Mobile' -WorkingDirectory $mobileDir -Command 'npm start' -PowerShellExecutable $powerShellExecutable
Start-AppProcess -Name 'Web' -WorkingDirectory $webDir -Command 'npm run dev' -PowerShellExecutable $powerShellExecutable

if ($DryRun) {
    Write-Host 'Dry run completato.'
}
else {
    Write-Host 'Tutti i processi sono stati avviati in finestre separate.'
}