param(
  [string]$Root = "D:\cat_meme",
  [int]$VideoLimit = 24,
  [int]$BackgroundsPerFolder = 4,
  [switch]$CleanManagedAssets
)

$ErrorActionPreference = "Stop"

$sourceRoot = Join-Path $Root "资源\猫meme素材合集"
$greenRoot = Join-Path $sourceRoot "猫meme绿幕素材 2000个\00.热门常用猫meme素材【B站的在这】"
$backgroundRoot = Join-Path $sourceRoot "背景素材  700个"
$videoTarget = Join-Path $Root "assets\videos\green-screen"
$backgroundTarget = Join-Path $Root "assets\cats\backgrounds"
$dataDir = Join-Path $Root "data"
New-Item -ItemType Directory -Force -Path $videoTarget, $backgroundTarget, $dataDir | Out-Null

function Merge-ManagedAssetIndex([string]$IndexPath, [object[]]$Assets, [string[]]$ManagedRoots) {
  $tempPath = [IO.Path]::GetTempFileName()
  try {
    @($Assets) | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $tempPath -Encoding UTF8
    & node (Join-Path $PSScriptRoot "merge-asset-index.mjs") $IndexPath $tempPath "replace-managed-roots" @ManagedRoots
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to merge asset index."
    }
  } finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Test-IsInsidePath([string]$childPath, [string]$parentPath) {
  if ([string]::IsNullOrWhiteSpace($childPath)) { return $false }
  $fullChild = [IO.Path]::GetFullPath($childPath).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $fullParent = [IO.Path]::GetFullPath($parentPath).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  return $fullChild.StartsWith($fullParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    $fullChild.Equals($fullParent, [StringComparison]::OrdinalIgnoreCase)
}

function Clear-ManagedTarget([string]$targetPath) {
  $assetsRoot = Join-Path $Root "assets"
  if (-not (Test-IsInsidePath $targetPath $assetsRoot)) {
    throw "Refusing to clean outside assets directory: $targetPath"
  }
  if (Test-Path -LiteralPath $targetPath) {
    Remove-Item -LiteralPath $targetPath -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
}

if ($CleanManagedAssets) {
  Clear-ManagedTarget $videoTarget
  Clear-ManagedTarget $backgroundTarget
}

function Sanitize-FileName([string]$name) {
  $invalid = [IO.Path]::GetInvalidFileNameChars()
  foreach ($char in $invalid) {
    $name = $name.Replace($char, "_")
  }
  return $name
}

function Copy-Asset([IO.FileInfo]$file, [string]$targetDir, [string]$prefix) {
  $safeName = Sanitize-FileName $file.Name
  $targetPath = Join-Path $targetDir "$prefix-$safeName"
  if (-not (Test-Path -LiteralPath $targetPath)) {
    Copy-Item -LiteralPath $file.FullName -Destination $targetPath
  }
  return $targetPath
}

function Get-ShortHash([string]$value) {
  $sha1 = [Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($value)
    $hash = $sha1.ComputeHash($bytes)
    return -join ($hash[0..5] | ForEach-Object { $_.ToString("x2") })
  } finally {
    $sha1.Dispose()
  }
}

$videoKeywords = @(
  "大香蕉", "举手大哭香蕉", "震惊大叫香蕉", "甩动香蕉", "委屈猫哭泣", "呆滞猫", "严肃猫",
  "霸总猫", "打电话", "开车猫", "数钱猫", "听八卦", "摇摇猫", "唱歌", "害羞脸红",
  "大叫猫", "打瞌睡", "打架骂人", "橘猫凝视", "吐舌头", "小鸭子", "啊哇猫", "可爱打嗝", "目瞪口呆"
)

$sceneCategories = @(
  "办公室",
  "城市",
  "窗口",
  "古风",
  "建筑内",
  "建筑外",
  "教室",
  "街道",
  "实景--办公室",
  "实景--车内",
  "实景--城市",
  "实景--地铁 公交车 车站",
  "实景--学校",
  "小院",
  "学校",
  "野外"
)

$allVideos = @(Get-ChildItem -LiteralPath $greenRoot -File -Include *.mp4,*.MP4 -ErrorAction SilentlyContinue)
$selectedVideos = New-Object System.Collections.Generic.List[IO.FileInfo]
foreach ($keyword in $videoKeywords) {
  $match = $allVideos | Where-Object { $_.Name -like "*$keyword*" } | Sort-Object Length | Select-Object -First 1
  if ($match -and -not ($selectedVideos | Where-Object { $_.FullName -eq $match.FullName })) {
    $selectedVideos.Add($match)
  }
  if ($selectedVideos.Count -ge $VideoLimit) { break }
}
if ($selectedVideos.Count -lt $VideoLimit) {
  foreach ($file in ($allVideos | Sort-Object Length, Name)) {
    if ($selectedVideos.Count -ge $VideoLimit) { break }
    if (-not ($selectedVideos | Where-Object { $_.FullName -eq $file.FullName })) {
      $selectedVideos.Add($file)
    }
  }
}

$backgroundFiles = New-Object System.Collections.Generic.List[IO.FileInfo]
foreach ($categoryName in $sceneCategories) {
  $categoryPath = Join-Path $backgroundRoot $categoryName
  if (-not (Test-Path -LiteralPath $categoryPath)) {
    Write-Warning "Scene category not found: $categoryName"
    continue
  }
  $categoryFiles = Get-ChildItem -LiteralPath $categoryPath -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' } |
    Sort-Object Name |
    Select-Object -First $BackgroundsPerFolder
  foreach ($file in $categoryFiles) {
    $backgroundFiles.Add($file)
  }
}

$createdAt = (Get-Date).ToUniversalTime().ToString("o")
$newAssets = New-Object System.Collections.Generic.List[object]

foreach ($file in $selectedVideos) {
  $targetPath = Copy-Asset $file $videoTarget "green"
  $newAssets.Add([ordered]@{
    id = "resource-green-" + (Get-ShortHash $targetPath)
    type = "video"
    filename = [IO.Path]::GetFileName($targetPath)
    localPath = $targetPath
    sourceUrl = $file.FullName
    provider = "local"
    license = "Local resource import; rights may vary"
    riskLevel = "safe"
    tags = @("cat-meme", "green-screen", "绿幕", "resource")
    title = [IO.Path]::GetFileNameWithoutExtension($file.Name)
    createdAt = $createdAt
  })
}

foreach ($file in $backgroundFiles) {
  $targetPath = Copy-Asset $file $backgroundTarget "bg"
  $category = Split-Path (Split-Path $file.FullName -Parent) -Leaf
  $newAssets.Add([ordered]@{
    id = "resource-bg-" + (Get-ShortHash $targetPath)
    type = "image"
    filename = [IO.Path]::GetFileName($targetPath)
    localPath = $targetPath
    sourceUrl = $file.FullName
    provider = "local"
    license = "Local resource import; rights may vary"
    riskLevel = "medium"
    tags = @("background", "scene", $category, "resource")
    title = "$category background"
    createdAt = $createdAt
  })
}

$indexPath = Join-Path $dataDir "assets.index.json"
Merge-ManagedAssetIndex -IndexPath $indexPath -Assets @($newAssets) -ManagedRoots @($videoTarget, $backgroundTarget, $sourceRoot)

Write-Host "Imported $($selectedVideos.Count) hot green-screen videos and $($backgroundFiles.Count) backgrounds ($BackgroundsPerFolder per scene folder)."
Write-Host "Targets:"
Write-Host " - $videoTarget"
Write-Host " - $backgroundTarget"
