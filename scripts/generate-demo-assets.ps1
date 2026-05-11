param(
  [string]$Root = "D:\cat_meme"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$catsDir = Join-Path $Root "assets\cats"
$musicDir = Join-Path $Root "assets\music"
$sfxDir = Join-Path $Root "assets\sfx"
$dataDir = Join-Path $Root "data"
New-Item -ItemType Directory -Force -Path $catsDir, $musicDir, $sfxDir, $dataDir | Out-Null

function Color-Hex([string]$hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-Brush([string]$hex) {
  return [System.Drawing.SolidBrush]::new((Color-Hex $hex))
}

function New-Pen([string]$hex, [float]$width = 4) {
  $pen = [System.Drawing.Pen]::new((Color-Hex $hex), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Draw-Gradient([System.Drawing.Graphics]$g, [int]$w, [int]$h, [string]$a, [string]$b) {
  $rect = [System.Drawing.Rectangle]::new(0, 0, $w, $h)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, (Color-Hex $a), (Color-Hex $b), 55)
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
}

function Draw-CatFace(
  [System.Drawing.Graphics]$g,
  [float]$cx,
  [float]$cy,
  [float]$scale,
  [string]$fur,
  [string]$eye = "#141827",
  [bool]$cry = $false,
  [bool]$angry = $false
) {
  $furBrush = New-Brush $fur
  $linePen = New-Pen "#33251d" (8 * $scale)
  $earBrush = New-Brush "#f4b7a5"
  $eyeBrush = New-Brush $eye
  $tearBrush = New-Brush "#60a5fa"

  $headW = 430 * $scale
  $headH = 365 * $scale
  $leftEar = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($cx - 175 * $scale, $cy - 128 * $scale),
    [System.Drawing.PointF]::new($cx - 98 * $scale, $cy - 310 * $scale),
    [System.Drawing.PointF]::new($cx - 25 * $scale, $cy - 116 * $scale)
  )
  $rightEar = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($cx + 25 * $scale, $cy - 116 * $scale),
    [System.Drawing.PointF]::new($cx + 98 * $scale, $cy - 310 * $scale),
    [System.Drawing.PointF]::new($cx + 175 * $scale, $cy - 128 * $scale)
  )
  $g.FillPolygon($furBrush, $leftEar)
  $g.FillPolygon($furBrush, $rightEar)
  $g.DrawPolygon($linePen, $leftEar)
  $g.DrawPolygon($linePen, $rightEar)

  $innerL = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($cx - 127 * $scale, $cy - 150 * $scale),
    [System.Drawing.PointF]::new($cx - 96 * $scale, $cy - 238 * $scale),
    [System.Drawing.PointF]::new($cx - 62 * $scale, $cy - 142 * $scale)
  )
  $innerR = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($cx + 62 * $scale, $cy - 142 * $scale),
    [System.Drawing.PointF]::new($cx + 96 * $scale, $cy - 238 * $scale),
    [System.Drawing.PointF]::new($cx + 127 * $scale, $cy - 150 * $scale)
  )
  $g.FillPolygon($earBrush, $innerL)
  $g.FillPolygon($earBrush, $innerR)

  $headRect = [System.Drawing.RectangleF]::new($cx - $headW / 2, $cy - $headH / 2, $headW, $headH)
  $g.FillEllipse($furBrush, $headRect)
  $g.DrawEllipse($linePen, $headRect)

  if ($angry) {
    $browPen = New-Pen "#33251d" (12 * $scale)
    $g.DrawLine($browPen, $cx - 150 * $scale, $cy - 72 * $scale, $cx - 65 * $scale, $cy - 42 * $scale)
    $g.DrawLine($browPen, $cx + 65 * $scale, $cy - 42 * $scale, $cx + 150 * $scale, $cy - 72 * $scale)
    $browPen.Dispose()
  }

  $g.FillEllipse($eyeBrush, $cx - 125 * $scale, $cy - 45 * $scale, 54 * $scale, 62 * $scale)
  $g.FillEllipse($eyeBrush, $cx + 72 * $scale, $cy - 45 * $scale, 54 * $scale, 62 * $scale)
  $g.FillEllipse((New-Brush "#ffffff"), $cx - 109 * $scale, $cy - 30 * $scale, 14 * $scale, 18 * $scale)
  $g.FillEllipse((New-Brush "#ffffff"), $cx + 88 * $scale, $cy - 30 * $scale, 14 * $scale, 18 * $scale)

  $nose = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($cx - 22 * $scale, $cy + 36 * $scale),
    [System.Drawing.PointF]::new($cx + 22 * $scale, $cy + 36 * $scale),
    [System.Drawing.PointF]::new($cx, $cy + 62 * $scale)
  )
  $g.FillPolygon((New-Brush "#d56b7a"), $nose)
  $mouthPen = New-Pen "#33251d" (7 * $scale)
  $g.DrawArc($mouthPen, $cx - 48 * $scale, $cy + 48 * $scale, 48 * $scale, 45 * $scale, 5, 150)
  $g.DrawArc($mouthPen, $cx, $cy + 48 * $scale, 48 * $scale, 45 * $scale, 25, 150)

  $whiskerPen = New-Pen "#33251d" (5 * $scale)
  foreach ($dy in @(-4, 28, 58)) {
    $g.DrawLine($whiskerPen, $cx - 175 * $scale, $cy + $dy * $scale, $cx - 300 * $scale, $cy + ($dy - 34) * $scale)
    $g.DrawLine($whiskerPen, $cx + 175 * $scale, $cy + $dy * $scale, $cx + 300 * $scale, $cy + ($dy - 34) * $scale)
  }

  if ($cry) {
    $g.FillEllipse($tearBrush, $cx - 124 * $scale, $cy + 20 * $scale, 42 * $scale, 124 * $scale)
    $g.FillEllipse($tearBrush, $cx + 82 * $scale, $cy + 20 * $scale, 42 * $scale, 124 * $scale)
  }

  $furBrush.Dispose()
  $linePen.Dispose()
  $earBrush.Dispose()
  $eyeBrush.Dispose()
  $tearBrush.Dispose()
  $mouthPen.Dispose()
  $whiskerPen.Dispose()
}

function Save-Canvas([string]$path, [scriptblock]$draw) {
  $w = 1080
  $h = 1920
  $bmp = [System.Drawing.Bitmap]::new($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  & $draw $g $w $h
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$assetSpecs = @(
  @{
    Id = "demo-banana-cat"
    Title = "Original Banana Cat"
    File = "banana-cat-original.png"
    Tags = @("banana-cat", "meme", "cat", "demo")
    Draw = {
      param($g, $w, $h)
      Draw-Gradient $g $w $h "#fff7b0" "#ffdf52"
      $bananaPen = New-Pen "#f4bd1f" 92
      $g.DrawArc($bananaPen, 190, 410, 710, 880, 118, 235)
      $bananaPen.Dispose()
      $darkPen = New-Pen "#9c6410" 18
      $g.DrawArc($darkPen, 188, 408, 710, 880, 118, 235)
      $g.DrawLine($darkPen, 720, 460, 790, 370)
      $darkPen.Dispose()
      Draw-CatFace $g 540 910 1.05 "#f2b879"
    }
  },
  @{
    Id = "demo-crying-cat"
    Title = "Original Crying Cat"
    File = "crying-cat-original.png"
    Tags = @("crying-cat", "tears", "meme", "demo")
    Draw = {
      param($g, $w, $h)
      Draw-Gradient $g $w $h "#e0f2fe" "#93c5fd"
      $cloud = New-Brush "#ffffff"
      $g.FillEllipse($cloud, 120, 250, 260, 120)
      $g.FillEllipse($cloud, 660, 360, 300, 130)
      $cloud.Dispose()
      Draw-CatFace $g 540 900 1.12 "#d8a068" "#1f2937" $true
    }
  },
  @{
    Id = "demo-office-cat"
    Title = "Original Office Cat"
    File = "office-cat-original.png"
    Tags = @("office-cat", "work", "meme", "demo")
    Draw = {
      param($g, $w, $h)
      Draw-Gradient $g $w $h "#f8fafc" "#dbeafe"
      $desk = New-Brush "#c08457"
      $g.FillRectangle($desk, 0, 1260, $w, 250)
      $desk.Dispose()
      $laptop = New-Brush "#334155"
      $g.FillRectangle($laptop, 300, 1110, 480, 250)
      $g.FillRectangle($laptop, 230, 1360, 620, 42)
      $laptop.Dispose()
      Draw-CatFace $g 540 835 0.95 "#d6a16b" "#111827" $false $true
    }
  },
  @{
    Id = "demo-confused-cat"
    Title = "Original Confused Cat"
    File = "confused-cat-original.png"
    Tags = @("confused-cat", "question", "meme", "demo")
    Draw = {
      param($g, $w, $h)
      Draw-Gradient $g $w $h "#fef3c7" "#fde68a"
      $font = [System.Drawing.Font]::new("Arial", 178, [System.Drawing.FontStyle]::Bold)
      $brush = New-Brush "#f97316"
      $g.DrawString("?", $font, $brush, 250, 390)
      $g.DrawString("?", $font, $brush, 720, 500)
      $font.Dispose()
      $brush.Dispose()
      Draw-CatFace $g 540 930 1.03 "#e7b57f"
    }
  },
  @{
    Id = "demo-laser-cat"
    Title = "Original Laser Cat"
    File = "laser-cat-original.png"
    Tags = @("laser-cat", "chaos", "meme", "demo")
    Draw = {
      param($g, $w, $h)
      Draw-Gradient $g $w $h "#fee2e2" "#fda4af"
      Draw-CatFace $g 540 910 1.06 "#c79061" "#ef4444" $false $true
      $laserPen = New-Pen "#ef4444" 24
      $g.DrawLine($laserPen, 435, 870, 110, 600)
      $g.DrawLine($laserPen, 645, 870, 970, 600)
      $laserPen.Dispose()
    }
  }
)

$createdAt = (Get-Date).ToUniversalTime().ToString("o")
$assets = @()
foreach ($spec in $assetSpecs) {
  $path = Join-Path $catsDir $spec.File
  Save-Canvas $path $spec.Draw
  $assets += [ordered]@{
    id = $spec.Id
    type = "image"
    filename = $spec.File
    localPath = $path
    sourceUrl = "generated-demo://$($spec.Id)"
    provider = "local"
    license = "Original demo asset generated locally for Cat Meme Studio"
    riskLevel = "safe"
    tags = $spec.Tags
    title = $spec.Title
    author = "Cat Meme Studio"
    width = 1080
    height = 1920
    createdAt = $createdAt
  }
}

$ffmpeg = (& node -e "console.log(require('ffmpeg-static'))").Trim()
$bgmPath = Join-Path $musicDir "demo-bgm.wav"
$sfxPath = Join-Path $sfxDir "demo-pop.wav"
& $ffmpeg -hide_banner -y -f lavfi -i "sine=frequency=523:duration=12" -f lavfi -i "sine=frequency=659:duration=12" -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest,volume=0.10" $bgmPath | Out-Null
& $ffmpeg -hide_banner -y -f lavfi -i "sine=frequency=880:duration=0.18" -af "volume=0.20" $sfxPath | Out-Null

$voicePath = Join-Path $sfxDir "demo-voice.wav"
try {
  Add-Type -AssemblyName System.Speech
  $synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
  $synth.Rate = 1
  $synth.Volume = 85
  $synth.SetOutputToWaveFile($voicePath)
  $synth.Speak("I am only a banana cat. The boss said overtime again. I instantly cried cat tears.")
  $synth.Dispose()
} catch {
  & $ffmpeg -hide_banner -y -f lavfi -i "sine=frequency=330:duration=8" -af "volume=0.13" $voicePath | Out-Null
}

$assets += [ordered]@{
  id = "demo-bgm"
  type = "audio"
  filename = "demo-bgm.wav"
  localPath = $bgmPath
  sourceUrl = "generated-demo://demo-bgm"
  provider = "local"
  license = "Original generated demo tone"
  riskLevel = "safe"
  tags = @("bgm", "demo")
  title = "Original Light BGM"
  author = "Cat Meme Studio"
  duration = 12
  createdAt = $createdAt
}
$assets += [ordered]@{
  id = "demo-voice"
  type = "audio"
  filename = "demo-voice.wav"
  localPath = $voicePath
  sourceUrl = "generated-demo://demo-voice"
  provider = "local"
  license = "Locally synthesized demo voice"
  riskLevel = "safe"
  tags = @("voice", "demo")
  title = "Demo Cat Voice"
  author = "Cat Meme Studio"
  duration = 8
  createdAt = $createdAt
}
$assets += [ordered]@{
  id = "demo-pop"
  type = "audio"
  filename = "demo-pop.wav"
  localPath = $sfxPath
  sourceUrl = "generated-demo://demo-pop"
  provider = "local"
  license = "Original generated demo sound effect"
  riskLevel = "safe"
  tags = @("sfx", "demo")
  title = "Demo Pop Sound"
  author = "Cat Meme Studio"
  duration = 0.18
  createdAt = $createdAt
}

$indexPath = Join-Path $dataDir "assets.index.json"
$existing = @()
if (Test-Path -LiteralPath $indexPath) {
  $raw = Get-Content -LiteralPath $indexPath -Raw
  if ($raw.Trim()) {
    $existing = @($raw | ConvertFrom-Json)
  }
}
$demoIds = @($assets | ForEach-Object { $_.id })
$kept = @($existing | Where-Object { $demoIds -notcontains $_.id })
@($assets + $kept) | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $indexPath -Encoding UTF8

Write-Host "Generated demo assets:"
$assets | ForEach-Object { Write-Host " - $($_.localPath)" }
