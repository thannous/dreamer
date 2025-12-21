param(
  [string]$Junction = 'C:\src\dreamer',
  [switch]$SkipMetro
)

function Get-JunctionTarget {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return $null
  }

  $item = Get-Item -Force $Path
  if ($item.LinkType -ne 'Junction') {
    return $null
  }

  if ($item.Target) {
    return $item.Target
  }

  if ($item.LinkTarget) {
    return $item.LinkTarget
  }

  return $null
}

$projectRoot = Get-JunctionTarget -Path $Junction
if (-not $projectRoot) {
  Write-Error "Junction not found or invalid: $Junction"
  Write-Error "Create it first: New-Item -ItemType Junction -Path C:\src\dreamer -Target C:\Users\maxime\Documents\saas\Noctalia\dreamer"
  exit 1
}

if (-not $SkipMetro) {
  $metroCommand = "cd `"$projectRoot`"; npx expo start --clear"
  Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", $metroCommand -WorkingDirectory $projectRoot
  Start-Sleep -Seconds 2
}

Set-Location $Junction
npx expo run:android --no-bundler
