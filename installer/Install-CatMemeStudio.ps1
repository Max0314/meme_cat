$ErrorActionPreference = "Stop"

$source = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$target = Join-Path $env:LOCALAPPDATA "Programs\Cat Meme Studio"
$exeName = "Cat Meme Studio.exe"
$sourceExe = Join-Path $source $exeName

if (-not (Test-Path -LiteralPath $sourceExe)) {
  throw "Cannot find $exeName in $source"
}

if ($source.TrimEnd("\") -ine $target.TrimEnd("\")) {
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  & robocopy $source $target /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS
  $copyCode = $LASTEXITCODE
  if ($copyCode -ge 8) {
    throw "File copy failed. Robocopy exit code: $copyCode"
  }
}

$targetExe = Join-Path $target $exeName
$shell = New-Object -ComObject WScript.Shell

function New-AppShortcut {
  param(
    [string]$ShortcutPath,
    [string]$TargetPath
  )
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = Split-Path -Parent $TargetPath
  $shortcut.IconLocation = $TargetPath
  $shortcut.Description = "Cat Meme Studio"
  $shortcut.Save()
}

$desktop = [Environment]::GetFolderPath("Desktop")
$programs = [Environment]::GetFolderPath("Programs")
$startMenuDir = Join-Path $programs "Cat Meme Studio"
New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null

New-AppShortcut -ShortcutPath (Join-Path $desktop "Cat Meme Studio.lnk") -TargetPath $targetExe
New-AppShortcut -ShortcutPath (Join-Path $startMenuDir "Cat Meme Studio.lnk") -TargetPath $targetExe

Write-Host "Installed to: $target"
Write-Host "Desktop and Start Menu shortcuts were created."
