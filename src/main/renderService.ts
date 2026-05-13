import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import ffmpegStaticPath from 'ffmpeg-static'
import type {
  Asset,
  AssetProcessedVariant,
  ExportPreset,
  ProjectFile,
  RenderProgress,
  RenderRequest,
  RenderResult,
  TimelineItem,
  VisualKeying,
  VisualTransform,
  WorkspaceInfo
} from '../shared/types'

interface VisualSegment {
  inputIndex: number
  durationSeconds: number
  item: TimelineItem
  asset: Asset
  alphaVariant?: AssetProcessedVariant
  mediaSize?: MediaSize
}

interface AudioSegment {
  inputIndex: number
  item: TimelineItem
  durationSeconds: number
}

interface VisualRenderChunk {
  sourceStartFrame: number
  durationFrames: number
  transform: VisualTransform
  filters: string[]
}

interface MediaSize {
  width: number
  height: number
}

const audioProbeCache = new Map<string, boolean>()
const mediaSizeProbeCache = new Map<string, MediaSize | null>()
const DEFAULT_ROLE_LABEL_STYLE: ProjectFile['subtitleStyle'] = {
  fontFamily: 'Microsoft YaHei, Microsoft JhengHei, SimHei, Arial, sans-serif',
  fontSize: 36,
  color: '#ffe933',
  outlineColor: '#111111',
  outlineWidth: 3,
  position: 'bottom',
  background: false,
  backgroundColor: '#111827'
}

export async function renderProject(
  info: WorkspaceInfo,
  request: RenderRequest,
  onProgress?: (progress: RenderProgress) => void
): Promise<RenderResult> {
  const ffmpegPath = resolveFfmpegPath()
  const preset = request.mode === 'preview' ? previewPreset(request.preset) : request.preset
  const now = new Date()
  const baseName = sanitizeFilename(`${request.project.title}-${request.mode}-${now.toISOString().replace(/[:.]/g, '-')}`)
  const outputDir = request.mode === 'export' ? request.outputDir || info.outputDir : info.outputDir
  const outputPath = request.mode === 'export' && request.outputPath ? request.outputPath : path.join(outputDir, `${baseName}.mp4`)
  const tempDir = path.join(info.dataDir, 'render-temp')
  const totalSeconds = projectDurationSeconds(request.project, preset.fps)
  const emit = (progress: Omit<RenderProgress, 'mode'>): void => {
    onProgress?.({ mode: request.mode, ...progress })
  }

  emit({ stage: 'preparing', message: '准备渲染工作区', percent: 0.05, outputPath })
  await mkdir(tempDir, { recursive: true })
  await mkdir(path.dirname(outputPath), { recursive: true })

  const assPath = path.join(tempDir, `${baseName}.ass`)
  emit({ stage: 'building-filters', message: '组装视频图层和字幕滤镜', percent: 0.18, outputPath })
  const args = await buildFfmpegArgs(request.project, preset, outputPath, assPath, ffmpegPath)
  emit({ stage: 'encoding', message: 'FFmpeg 正在编码 MP4', percent: 0.28, outputPath })
  try {
    await runFfmpeg(ffmpegPath, args, totalSeconds, (percent) => {
      emit({ stage: 'encoding', message: 'FFmpeg 正在编码 MP4', percent, outputPath })
    })
  } catch (error) {
    emit({ stage: 'failed', message: '渲染失败', percent: 1, outputPath, error: error instanceof Error ? error.message : String(error) })
    throw error
  }

  emit({ stage: 'done', message: '渲染完成', percent: 1, outputPath })
  return {
    outputPath,
    fileUrl: pathToFileURL(outputPath).toString(),
    durationSeconds: totalSeconds,
    preset
  }
}

async function buildFfmpegArgs(
  project: ProjectFile,
  preset: ExportPreset,
  outputPath: string,
  assPath: string,
  ffmpegPath: string
): Promise<string[]> {
  const args: string[] = ['-hide_banner']
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]))
  const trackOrder = new Map(project.tracks.map((track, index) => [track.id, index]))
  const timelineOrder = new Map(project.timeline.map((item, index) => [item.id, index]))
  const enabledTracks = new Set(project.tracks.filter((track) => !track.muted).map((track) => track.id))
  const visualItems = project.timeline
    .filter((item) => item.type === 'visual' && enabledTracks.has(item.trackId) && item.assetId && item.durationFrames > 0)
    .sort((a, b) => (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0) || (timelineOrder.get(a.id) ?? 0) - (timelineOrder.get(b.id) ?? 0))
  const audioItems = project.timeline
    .filter((item) => ['voice', 'music', 'sfx'].includes(item.type) && enabledTracks.has(item.trackId) && item.assetId && item.durationFrames > 0)
    .sort((a, b) => a.startFrame - b.startFrame)

  const totalFrames = projectDurationFrames(project, preset.fps)
  const totalSeconds = framesToSeconds(totalFrames, preset.fps)
  const visualSegments: VisualSegment[] = []
  const audioSegments: AudioSegment[] = []
  let inputIndex = 0

  args.push(
    '-f',
    'lavfi',
    '-t',
    totalSeconds.toFixed(3),
    '-i',
    `color=c=#f6f8fb:s=${preset.width}x${preset.height}:r=${preset.fps}`
  )
  inputIndex += 1

  for (const item of visualItems) {
    const asset = item.assetId ? assetsById.get(item.assetId) : undefined
    if (!asset?.localPath) continue
    const durationSeconds = framesToSeconds(item.durationFrames, preset.fps)
    const sourceDurationSeconds = mediaSourceDurationSeconds(item, asset, durationSeconds)
    const sourceInSeconds = sourceInSecondsForItem(item, asset, preset.fps)
    const alphaVariant = findGreenAlphaVariant(asset)
    const inputPath = alphaVariant?.localPath || asset.localPath
    const inputType = alphaVariant?.format === 'png' ? 'image' : alphaVariant?.format === 'webm' ? 'video' : asset.type

    if (inputType === 'image') {
      args.push('-loop', '1', '-t', durationSeconds.toFixed(3), '-i', inputPath)
    } else if (inputType === 'gif') {
      args.push('-ignore_loop', item.loop ? '0' : '1', '-t', sourceDurationSeconds.toFixed(3), '-i', inputPath)
    } else {
      if (item.loop) args.push('-stream_loop', '-1')
      args.push('-ss', sourceInSeconds.toFixed(3), '-t', sourceDurationSeconds.toFixed(3), '-i', inputPath)
    }

    visualSegments.push({
      inputIndex,
      item,
      durationSeconds,
      asset,
      alphaVariant,
      mediaSize: alphaVariant?.width && alphaVariant.height ? { width: alphaVariant.width, height: alphaVariant.height } : asset.width && asset.height ? { width: asset.width, height: asset.height } : (await probeMediaSize(ffmpegPath, inputPath)) || undefined
    })
    if (asset.type === 'video' && (item.volume ?? 1) > 0 && (await hasAudioStream(ffmpegPath, asset.localPath))) {
      if (alphaVariant) {
        if (item.loop) args.push('-stream_loop', '-1')
        args.push('-ss', sourceInSeconds.toFixed(3), '-t', sourceDurationSeconds.toFixed(3), '-i', asset.localPath)
        audioSegments.push({ inputIndex: inputIndex + 1, item, durationSeconds })
        inputIndex += 1
      } else {
        audioSegments.push({ inputIndex, item, durationSeconds })
      }
    }
    inputIndex += 1
  }

  for (const item of audioItems) {
    const asset = item.assetId ? assetsById.get(item.assetId) : undefined
    if (!asset?.localPath) continue
    if (asset.type === 'video' && !(await hasAudioStream(ffmpegPath, asset.localPath))) continue
    const durationSeconds = framesToSeconds(item.durationFrames, preset.fps)
    const sourceDurationSeconds = mediaSourceDurationSeconds(item, asset, durationSeconds)
    const sourceInSeconds = sourceInSecondsForItem(item, asset, preset.fps)
    if (item.loop) args.push('-stream_loop', '-1')
    args.push('-ss', sourceInSeconds.toFixed(3), '-t', sourceDurationSeconds.toFixed(3), '-i', asset.localPath)
    audioSegments.push({ inputIndex, item, durationSeconds })
    inputIndex += 1
  }

  const filter = await buildFilterComplex(project, preset, visualSegments, audioSegments, assPath)
  args.push('-filter_complex', filter, '-map', '[vout]')
  if (audioSegments.length) {
    args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', preset.audioBitrate)
  } else {
    args.push('-an')
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-r',
    String(preset.fps),
    '-b:v',
    preset.videoBitrate,
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-y',
    outputPath
  )

  return args
}

async function buildFilterComplex(
  project: ProjectFile,
  preset: ExportPreset,
  visualSegments: VisualSegment[],
  audioSegments: AudioSegment[],
  assPath: string
): Promise<string> {
  const filters: string[] = []
  let currentVideoLabel = 'base0'
  filters.push(`[0:v]format=rgba[${currentVideoLabel}]`)

  let overlayIndex = 0
  visualSegments.forEach((segment, segmentIndex) => {
    const chunks = visualRenderChunks(segment.item, preset)
    const sourceLabels = chunks.length > 1 ? chunks.map((_, chunkIndex) => `seg${segmentIndex}s${chunkIndex}`) : [`${segment.inputIndex}:v`]
    if (chunks.length > 1) {
      filters.push(`[${segment.inputIndex}:v]split=${chunks.length}${sourceLabels.map((label) => `[${label}]`).join('')}`)
    }

    chunks.forEach((chunk, chunkIndex) => {
      const overlayLabel = `ov${overlayIndex}`
      const nextVideoLabel = `base${overlayIndex + 1}`
      const fitCanvas = !isBackgroundVisualSegment(segment)
      const scaledWidth = even(Math.max(2, Math.round(preset.width * chunk.transform.scale)))
      const scaledHeight = even(
        Math.max(2, Math.round(fitCanvas ? scaledWidth / mediaAspectRatio(segment.asset, segment.mediaSize) : preset.height * chunk.transform.scale))
      )
      const playbackRate = mediaPlaybackRateForAsset(segment.item, segment.asset)
      const sourceStartSeconds = framesToSeconds(chunk.sourceStartFrame, preset.fps) * playbackRate
      const chunkDurationSeconds = framesToSeconds(chunk.durationFrames, preset.fps)
      const startSeconds = framesToSeconds(segment.item.startFrame + chunk.sourceStartFrame, preset.fps)
      const endSeconds = startSeconds + chunkDurationSeconds
      const opacity = clamp(chunk.transform.opacity, 0, 1).toFixed(3)
      const x = `(W-w)/2+${Math.round(chunk.transform.x)}`
      const y = `(H-h)/2+${Math.round(chunk.transform.y)}`
      const sourceLabel = sourceLabels[chunkIndex]

      filters.push(
        `[${sourceLabel}]` +
          buildVisualLayerFilters(
            segment.item,
            preset,
            scaledWidth,
            scaledHeight,
            chunkDurationSeconds,
            startSeconds,
            opacity,
            fitCanvas,
            chunk.transform,
            sourceStartSeconds,
            playbackRate,
            Boolean(segment.alphaVariant),
            chunk.filters
          ).join(',') +
          `[${overlayLabel}]`
      )
      filters.push(
        `[${currentVideoLabel}][${overlayLabel}]overlay=x=${x}:y=${y}:enable='between(t,${startSeconds.toFixed(3)},${endSeconds.toFixed(
          3
        )})':eof_action=pass[${nextVideoLabel}]`
      )
      currentVideoLabel = nextVideoLabel
      overlayIndex += 1
    })
  })

  const subtitleItems = buildSubtitleItems(project, preset.fps)
  const hasRoleLabels = visualSegments.some((segment) => roleLabelForItem(segment.item).visible && roleLabelForItem(segment.item).text.trim())
  if (subtitleItems.length || hasRoleLabels) {
    await writeFile(assPath, makeAssFile(project, preset, subtitleItems, visualSegments), 'utf-8')
    filters.push(`[${currentVideoLabel}]subtitles='${escapeFilterPath(assPath)}'[vsub]`)
    filters.push('[vsub]format=yuv420p[vout]')
  } else {
    filters.push(`[${currentVideoLabel}]format=yuv420p[vout]`)
  }

  if (audioSegments.length) {
    const audioLabels: string[] = []
    audioSegments.forEach((segment, index) => {
      const label = `a${index}`
      const delay = Math.max(0, Math.round(framesToSeconds(segment.item.startFrame, preset.fps) * 1000))
      const volume = Math.max(0, Math.min(segment.item.volume ?? 1, 2.5)).toFixed(2)
      const rate = itemPlaybackRate(segment.item)
      const sourceDurationSeconds = segment.durationSeconds * rate
      const audioFilters = [
        `atrim=duration=${sourceDurationSeconds.toFixed(3)}`,
        'asetpts=PTS-STARTPTS',
        ...atempoFilters(rate),
        `volume=${volume}`,
        `adelay=${delay}|${delay}`
      ]
      filters.push(`[${segment.inputIndex}:a]${audioFilters.join(',')}[${label}]`)
      audioLabels.push(`[${label}]`)
    })
    if (audioLabels.length === 1) {
      filters.push(`${audioLabels[0]}anull[aout]`)
    } else {
      filters.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`)
    }
  }

  return filters.join(';')
}

function buildSubtitleItems(project: ProjectFile, fps: number): TimelineItem[] {
  const enabledTracks = new Set(project.tracks.filter((track) => !track.muted).map((track) => track.id))
  const explicit = project.timeline
    .filter((item) => item.type === 'subtitle' && enabledTracks.has(item.trackId) && (item.text || item.speakerName) && item.durationFrames > 0)
    .sort((a, b) => a.startFrame - b.startFrame)
  if (explicit.length) return explicit

  const lines = project.script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const totalFrames = projectDurationFrames(project, fps)
  const perLine = Math.max(24, Math.floor(totalFrames / lines.length))
  return lines.map((text, index) => ({
    id: `auto-sub-${index}`,
    trackId: 'subtitles',
    type: 'subtitle',
    label: `字幕 ${index + 1}`,
    startFrame: index * perLine,
    durationFrames: perLine,
    sourceInFrame: 0,
    effects: [],
    text
  }))
}

function makeAssFile(project: ProjectFile, preset: ExportPreset, subtitleItems: TimelineItem[], visualSegments: VisualSegment[]): string {
  const baseStyle = normalizeSubtitleStyle(project.subtitleStyle)

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${preset.width}`,
    `PlayResY: ${preset.height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...subtitleStyleRows(baseStyle, preset),
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ]

  const subtitleEvents = subtitleItems.flatMap((item) => {
    const start = framesToAssTime(item.startFrame, preset.fps)
    const end = framesToAssTime(item.startFrame + item.durationFrames, preset.fps)
    const style = normalizeSubtitleStyle({ ...baseStyle, ...item.style })
    const lines: string[] = []
    if (item.speakerVisible && item.speakerName?.trim()) {
      lines.push(
        `Dialogue: 1,${start},${end},${speakerStyleName(item.speakerPosition || style.position)},,0,0,0,,${assTransformOverride(
          item,
          'speaker',
          item.speakerPosition || style.position,
          preset
        )}${escapeAssText(item.speakerName.trim())}`
      )
    }
    const text = escapeAssText(item.text || '')
    if (text) {
      lines.push(`Dialogue: 2,${start},${end},${subtitleStyleName(style.position)},,0,0,0,,${assTransformOverride(item, 'subtitle', style.position, preset)}${text}`)
    }
    return lines
  })
  const roleLabelEvents = buildRoleLabelAssEvents(visualSegments, preset)

  return [...header, ...roleLabelEvents, ...subtitleEvents, ''].join('\n')
}

function buildRoleLabelAssEvents(visualSegments: VisualSegment[], preset: ExportPreset): string[] {
  return visualSegments.flatMap((segment) => {
    const label = roleLabelForItem(segment.item)
    if (!label.visible || !label.text.trim()) return []
    return visualRenderChunks(segment.item, preset).map((chunk) => {
      const startFrame = segment.item.startFrame + chunk.sourceStartFrame
      const endFrame = startFrame + chunk.durationFrames
      return `Dialogue: 1,${framesToAssTime(startFrame, preset.fps)},${framesToAssTime(endFrame, preset.fps)},${speakerStyleName(
        label.style.position
      )},,0,0,0,,${roleLabelAssOverride(segment, chunk.transform, label.style, preset)}${escapeAssText(label.text.trim())}`
    })
  })
}

function roleLabelAssOverride(
  segment: VisualSegment,
  transform: VisualTransform,
  style: ProjectFile['subtitleStyle'],
  preset: ExportPreset
): string {
  const fitCanvas = !isBackgroundVisualSegment(segment)
  const width = Math.max(2, Math.round(preset.width * transform.scale))
  const height = Math.max(2, Math.round(fitCanvas ? width / mediaAspectRatio(segment.asset, segment.mediaSize) : preset.height * transform.scale))
  const padding = Math.max(6, Math.round(style.fontSize * 0.16))
  const x = Math.round(preset.width / 2 + transform.x)
  const baseY = preset.height / 2 + transform.y
  const y =
    style.position === 'top'
      ? Math.round(baseY - height / 2 - padding)
      : style.position === 'middle'
        ? Math.round(baseY)
        : Math.round(baseY + height / 2 + padding)
  const scale = Math.round(transform.scale * 100)
  return `{\\an5\\pos(${x},${y})\\frz${Math.round(transform.rotation)}\\fscx${scale}\\fscy${scale}\\fn${assFontName(
    style.fontFamily
  )}\\fs${style.fontSize}\\c${assColor(style.color)}\\3c${assColor(style.outlineColor)}\\bord${style.outlineWidth}}`
}

function assTransformOverride(
  item: TimelineItem,
  kind: 'speaker' | 'subtitle',
  position: ProjectFile['subtitleStyle']['position'],
  preset: ExportPreset
): string {
  if (!item.transform) return ''
  const transform = normalizeTransform(item.transform)
  const x = Math.round(preset.width / 2 + transform.x)
  const y = Math.round(preset.height * ((kind === 'speaker' ? speakerPositionPercent(position) : subtitlePositionPercent(position)) / 100) + transform.y)
  const scale = Math.round(transform.scale * 100)
  const rotation = Math.round(transform.rotation)
  return `{\\pos(${x},${y})\\frz${rotation}\\fscx${scale}\\fscy${scale}}`
}

function subtitleStyleRows(style: ProjectFile['subtitleStyle'], preset: ExportPreset): string[] {
  const fontName = assFontName(style.fontFamily)
  return (['top', 'middle', 'bottom'] as const).flatMap((position) => {
    const alignment = position === 'top' ? 8 : position === 'middle' ? 5 : 2
    const marginV =
      position === 'top' ? Math.round(preset.height * 0.3) : position === 'middle' ? Math.round(preset.height * 0.43) : Math.round(preset.height * 0.12)
    const speakerMarginV =
      position === 'top' ? Math.round(preset.height * 0.06) : position === 'middle' ? Math.round(preset.height * 0.34) : Math.round(preset.height * 0.055)
    const speakerSize = Math.max(30, Math.round(style.fontSize * 0.58))
    const borderStyle = style.background ? 3 : 1
    const backgroundColor = style.background ? assColor(style.backgroundColor, '22') : '&H80000000'
    return [
      `Style: ${subtitleStyleName(position)},${fontName},${style.fontSize},${assColor(style.color)},&H000000FF,${assColor(style.outlineColor)},${backgroundColor},-1,0,0,0,100,100,0,0,${borderStyle},${style.outlineWidth},1,${alignment},60,60,${marginV},1`,
      `Style: ${speakerStyleName(position)},${fontName},${speakerSize},&H0033E9FF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,0,${alignment},60,60,${speakerMarginV},1`
    ]
  })
}

function subtitlePositionPercent(position: ProjectFile['subtitleStyle']['position']): number {
  if (position === 'top') return 30
  if (position === 'middle') return 50
  return 91
}

function speakerPositionPercent(position: ProjectFile['subtitleStyle']['position']): number {
  if (position === 'top') return 6
  if (position === 'middle') return 38
  return 96
}

function assFontName(fontFamily: string): string {
  return (fontFamily || 'Microsoft YaHei').split(',')[0].replace(/["']/g, '').trim() || 'Microsoft YaHei'
}

function normalizeSubtitleStyle(style?: Partial<ProjectFile['subtitleStyle']>): ProjectFile['subtitleStyle'] {
  return {
    fontFamily: style?.fontFamily || 'Microsoft YaHei, SimHei, Arial, sans-serif',
    fontSize: Math.max(12, Math.round(style?.fontSize || 56)),
    color: /^#[0-9a-f]{6}$/i.test(style?.color || '') ? style?.color || '#ffffff' : '#ffffff',
    outlineColor: /^#[0-9a-f]{6}$/i.test(style?.outlineColor || '') ? style?.outlineColor || '#000000' : '#000000',
    outlineWidth: Math.max(0, Math.round(style?.outlineWidth ?? 3)),
    position: style?.position || 'top',
    background: style?.background ?? false,
    backgroundColor: /^#[0-9a-f]{6}$/i.test(style?.backgroundColor || '') ? style?.backgroundColor || '#111827' : '#111827'
  }
}

function normalizeRoleLabelStyle(style?: Partial<ProjectFile['subtitleStyle']>): ProjectFile['subtitleStyle'] {
  return normalizeSubtitleStyle({ ...DEFAULT_ROLE_LABEL_STYLE, ...style })
}

function roleLabelForItem(item: TimelineItem): { text: string; visible: boolean; style: ProjectFile['subtitleStyle'] } {
  return {
    text: item.roleLabel?.text || '',
    visible: item.roleLabel?.visible ?? Boolean(item.roleLabel?.text?.trim()),
    style: normalizeRoleLabelStyle(item.roleLabel?.style)
  }
}

function subtitleStyleName(position: string): string {
  if (position === 'top') return 'SubTop'
  if (position === 'middle') return 'SubMiddle'
  return 'SubBottom'
}

function speakerStyleName(position: string): string {
  if (position === 'top') return 'NameTop'
  if (position === 'middle') return 'NameMiddle'
  return 'NameBottom'
}

function resolveFfmpegPath(): string {
  if (!ffmpegStaticPath) {
    throw new Error('找不到随应用打包的 FFmpeg。')
  }
  return ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked')
}

function runFfmpeg(
  ffmpegPath: string,
  args: string[],
  totalSeconds: number,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    let lastProgressAt = 0
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      const percent = ffmpegProgressPercent(text, totalSeconds)
      const now = Date.now()
      if (typeof percent === 'number' && now - lastProgressAt > 300) {
        lastProgressAt = now
        onProgress?.(percent)
      }
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg 导出失败，退出码 ${code}\n${stderr.slice(-4000)}`))
      }
    })
  })
}

function ffmpegProgressPercent(text: string, totalSeconds: number): number | undefined {
  const matches = Array.from(text.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g))
  const match = matches[matches.length - 1]
  if (!match || totalSeconds <= 0) return undefined
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  if (!Number.isFinite(seconds)) return undefined
  return clamp(0.28 + (seconds / totalSeconds) * 0.67, 0.28, 0.95)
}

function hasAudioStream(ffmpegPath: string, filePath: string): Promise<boolean> {
  const cached = audioProbeCache.get(filePath)
  if (typeof cached === 'boolean') return Promise.resolve(cached)

  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', filePath], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', () => {
      audioProbeCache.set(filePath, false)
      resolve(false)
    })
    child.on('close', () => {
      const hasAudio = /Stream #\d+:\d+.*Audio:/i.test(stderr)
      audioProbeCache.set(filePath, hasAudio)
      resolve(hasAudio)
    })
  })
}

function probeMediaSize(ffmpegPath: string, filePath: string): Promise<MediaSize | null> {
  if (mediaSizeProbeCache.has(filePath)) return Promise.resolve(mediaSizeProbeCache.get(filePath) || null)

  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', filePath], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', () => {
      mediaSizeProbeCache.set(filePath, null)
      resolve(null)
    })
    child.on('close', () => {
      const videoLine = stderr.split(/\r?\n/).find((line) => /Video:/i.test(line)) || ''
      const match = videoLine.match(/,\s*(\d{2,5})x(\d{2,5})(?:\s|,|\[)/)
      const size = match ? { width: Number(match[1]), height: Number(match[2]) } : null
      mediaSizeProbeCache.set(filePath, size)
      resolve(size)
    })
  })
}

function projectContentEndFrame(project: ProjectFile): number {
  return project.timeline.reduce((max, item) => Math.max(max, item.startFrame + item.durationFrames), 0)
}

function projectDurationFrames(project: ProjectFile, fps: number): number {
  const configuredFrames =
    typeof project.durationSeconds === 'number' && Number.isFinite(project.durationSeconds)
      ? Math.round(project.durationSeconds * fps)
      : fps * 10
  return Math.max(projectContentEndFrame(project), configuredFrames, fps * 4)
}

function projectDurationSeconds(project: ProjectFile, fps: number): number {
  return framesToSeconds(projectDurationFrames(project, fps), fps)
}

function normalizeTransform(transform?: Partial<VisualTransform>): VisualTransform {
  return {
    x: transform?.x ?? 0,
    y: transform?.y ?? 0,
    scale: clamp(transform?.scale ?? 1, 0.08, 4),
    rotation: transform?.rotation ?? 0,
    flipX: transform?.flipX ?? false,
    flipY: transform?.flipY ?? false,
    opacity: clamp(transform?.opacity ?? 1, 0, 1)
  }
}

function visualRenderChunks(item: TimelineItem, preset: ExportPreset): VisualRenderChunk[] {
  const keyframes = normalizeVisualKeyframes(item)
  const animatedEffects = hasAnimatedTimelineEffects(item)
  if (!keyframes.length && !animatedEffects) {
    const effectState = applyTimelineEffects(item, normalizeTransform(item.transform), 0, preset)
    return [{ sourceStartFrame: 0, durationFrames: item.durationFrames, transform: effectState.transform, filters: effectState.filters }]
  }

  if (keyframes.length === 1 && !animatedEffects) {
    const effectState = applyTimelineEffects(item, transformFromKeyframe(item, keyframes[0]), 0, preset)
    return [{ sourceStartFrame: 0, durationFrames: item.durationFrames, transform: effectState.transform, filters: effectState.filters }]
  }

  const chunks: VisualRenderChunk[] = []
  const stepFrames = item.durationFrames > preset.fps * 20 ? Math.max(2, Math.round(preset.fps / 8)) : 2
  for (let frame = 0; frame < item.durationFrames; frame += stepFrames) {
    const baseTransform = visualTransformAtLocalFrame(item, frame, keyframes)
    const effectState = applyTimelineEffects(item, baseTransform, frame, preset)
    chunks.push({
      sourceStartFrame: frame,
      durationFrames: Math.min(stepFrames, item.durationFrames - frame),
      transform: effectState.transform,
      filters: effectState.filters
    })
  }
  return chunks
}

function hasAnimatedTimelineEffects(item: TimelineItem): boolean {
  return item.effects.some((effect) => effect.type !== 'none' && effect.intensity > 0)
}

function normalizeVisualKeyframes(item: TimelineItem): NonNullable<TimelineItem['keyframes']> {
  const base = normalizeTransform(item.transform)
  const maxFrame = Math.max(0, item.durationFrames - 1)
  const byFrame = new Map<number, NonNullable<TimelineItem['keyframes']>[number]>()
  ;(item.keyframes || []).forEach((keyframe) => {
    const frame = clamp(Math.round(keyframe.frame ?? 0), 0, maxFrame)
    byFrame.set(frame, {
      id: keyframe.id || `${item.id}-${frame}`,
      frame,
      x: Number.isFinite(keyframe.x) ? Number(keyframe.x) : base.x,
      y: Number.isFinite(keyframe.y) ? Number(keyframe.y) : base.y,
      scale: clamp(keyframe.scale ?? base.scale, 0.08, 4),
      rotation: Number.isFinite(keyframe.rotation) ? Number(keyframe.rotation) : base.rotation,
      opacity: clamp(keyframe.opacity ?? base.opacity, 0, 1)
    })
  })
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame)
}

function visualTransformAtLocalFrame(item: TimelineItem, frame: number, keyframes = normalizeVisualKeyframes(item)): VisualTransform {
  const base = normalizeTransform(item.transform)
  if (!keyframes.length) return base
  const localFrame = clamp(Math.round(frame), 0, Math.max(0, item.durationFrames - 1))
  const first = keyframes[0]
  if (localFrame <= first.frame) {
    if (first.frame > 0) {
      const ratio = localFrame / first.frame
      return {
        ...base,
        x: lerp(base.x, first.x, ratio),
        y: lerp(base.y, first.y, ratio),
        scale: lerp(base.scale, first.scale, ratio),
        rotation: lerp(base.rotation, first.rotation, ratio),
        opacity: lerp(base.opacity, first.opacity, ratio)
      }
    }
    return transformFromKeyframe(item, first)
  }
  const last = keyframes[keyframes.length - 1]
  if (localFrame >= last.frame) return transformFromKeyframe(item, last)

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index]
    const to = keyframes[index + 1]
    if (localFrame < from.frame || localFrame > to.frame) continue
    const ratio = (localFrame - from.frame) / Math.max(1, to.frame - from.frame)
    return {
      ...base,
      x: lerp(from.x, to.x, ratio),
      y: lerp(from.y, to.y, ratio),
      scale: lerp(from.scale, to.scale, ratio),
      rotation: lerp(from.rotation, to.rotation, ratio),
      opacity: lerp(from.opacity, to.opacity, ratio)
    }
  }
  return base
}

function transformFromKeyframe(item: TimelineItem, keyframe: NonNullable<TimelineItem['keyframes']>[number]): VisualTransform {
  const base = normalizeTransform(item.transform)
  return {
    ...base,
    x: keyframe.x,
    y: keyframe.y,
    scale: clamp(keyframe.scale, 0.08, 4),
    rotation: keyframe.rotation,
    opacity: clamp(keyframe.opacity, 0, 1)
  }
}

function applyTimelineEffects(
  item: TimelineItem,
  transform: VisualTransform,
  localFrame: number,
  preset: ExportPreset
): { transform: VisualTransform; filters: string[] } {
  const durationFrames = Math.max(1, item.durationFrames)
  const progress = clamp(localFrame / durationFrames, 0, 1)
  let nextTransform = { ...transform }
  const filters: string[] = []

  item.effects.forEach((effect) => {
    const intensity = clamp(effect.intensity, 0, 1)
    if (effect.type === 'zoom-in') {
      nextTransform = { ...nextTransform, scale: clamp(nextTransform.scale * (1 + intensity * progress), 0.08, 4) }
    } else if (effect.type === 'zoom-out') {
      nextTransform = { ...nextTransform, scale: clamp(nextTransform.scale * (1 + intensity * (1 - progress)), 0.08, 4) }
    } else if (effect.type === 'pan-left') {
      nextTransform = { ...nextTransform, x: nextTransform.x + Math.round(preset.width * intensity * (0.5 - progress) * 0.5) }
    } else if (effect.type === 'pan-right') {
      nextTransform = { ...nextTransform, x: nextTransform.x + Math.round(preset.width * intensity * (progress - 0.5) * 0.5) }
    } else if (effect.type === 'shake') {
      const wave = localFrame * 2.35
      nextTransform = {
        ...nextTransform,
        x: nextTransform.x + Math.round(Math.sin(wave) * preset.width * intensity * 0.018),
        y: nextTransform.y + Math.round(Math.cos(wave * 1.17) * preset.height * intensity * 0.012),
        rotation: nextTransform.rotation + Math.sin(wave * 0.77) * intensity * 5
      }
    } else if (effect.type === 'flash') {
      const pulse = Math.max(0, Math.sin(progress * Math.PI))
      if (pulse > 0.001) {
        filters.push(`eq=brightness=${(pulse * intensity * 0.55).toFixed(3)}:saturation=${(1 + pulse * intensity * 0.25).toFixed(3)}`)
      }
    }
  })

  return { transform: nextTransform, filters }
}

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * clamp(ratio, 0, 1)
}

function normalizeKeying(keying?: Partial<VisualKeying>): VisualKeying {
  return {
    enabled: keying?.enabled ?? false,
    color: normalizeHexColor(keying?.color || '#00ff00'),
    similarity: clamp(keying?.similarity ?? 0.22, 0.01, 1),
    blend: clamp(keying?.blend ?? 0.08, 0, 1)
  }
}

function isBackgroundVisualSegment(segment: VisualSegment): boolean {
  return (
    segment.item.trackId === 'visual-main' ||
    (segment.asset.tags || []).some((tag) => ['background', 'scene', '背景', '场景'].includes(tag))
  )
}

function findGreenAlphaVariant(asset: Asset): AssetProcessedVariant | undefined {
  return asset.processedVariants?.find((variant) => variant.kind === 'green-alpha' && existsSync(variant.localPath))
}

function mediaAspectRatio(asset: Asset, mediaSize?: MediaSize): number {
  const width = mediaSize?.width || asset.width
  const height = mediaSize?.height || asset.height
  if (width && height) return clamp(width / height, 0.1, 10)
  if (asset.type === 'video') return 16 / 9
  return 1
}

function buildVisualLayerFilters(
  item: TimelineItem,
  preset: ExportPreset,
  scaledWidth: number,
  scaledHeight: number,
  durationSeconds: number,
  startSeconds: number,
  opacity: string,
  fitCanvas: boolean,
  transformOverride?: VisualTransform,
  sourceStartSeconds = 0,
  playbackRate = 1,
  skipKeying = false,
  effectFilters: string[] = []
): string[] {
  const keying = normalizeKeying(item.keying)
  const transform = transformOverride || normalizeTransform(item.transform)
  const filters = fitCanvas
    ? [
        `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=decrease`,
        `pad=${scaledWidth}:${scaledHeight}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
        'setsar=1',
        `fps=${preset.fps}`,
        'format=rgba'
      ]
    : [
        `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase`,
        `crop=${scaledWidth}:${scaledHeight}`,
        'setsar=1',
        `fps=${preset.fps}`,
        'format=rgba'
      ]

  if (transform.flipX) filters.push('hflip')
  if (transform.flipY) filters.push('vflip')
  if (Math.abs(transform.rotation) > 0.001) {
    filters.push(`rotate=${((transform.rotation * Math.PI) / 180).toFixed(6)}:ow=rotw(iw):oh=roth(ih):c=0x00000000`)
  }

  if (keying.enabled && !skipKeying) {
    filters.push(`chromakey=${keying.color}:${keying.similarity.toFixed(3)}:${keying.blend.toFixed(3)}`)
  }

  filters.push(...effectFilters)

  const rate = clamp(playbackRate, 0.25, 4)
  const sourceDurationSeconds = durationSeconds * rate
  filters.push(
    `trim=start=${sourceStartSeconds.toFixed(3)}:duration=${sourceDurationSeconds.toFixed(3)}`,
    `setpts=(PTS-STARTPTS)/${rate.toFixed(4)}+${startSeconds.toFixed(3)}/TB`,
    `colorchannelmixer=aa=${opacity}`
  )

  return filters
}

function normalizeHexColor(color: string): string {
  const clean = color.trim().replace(/^0x/i, '#')
  if (/^#[0-9a-f]{6}$/i.test(clean)) return `0x${clean.slice(1)}`
  if (/^[0-9a-f]{6}$/i.test(clean)) return `0x${clean}`
  return '0x00ff00'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function even(value: number): number {
  return value % 2 === 0 ? value : value + 1
}

function framesToSeconds(frames: number, fps: number): number {
  return frames / fps
}

function itemPlaybackRate(item: TimelineItem): number {
  return clamp(item.playbackRate ?? 1, 0.25, 4)
}

function mediaPlaybackRateForAsset(item: TimelineItem, asset: Asset): number {
  return asset.type === 'video' || asset.type === 'gif' || asset.type === 'audio' ? itemPlaybackRate(item) : 1
}

function mediaSourceDurationSeconds(item: TimelineItem, asset: Asset, durationSeconds: number): number {
  return durationSeconds * mediaPlaybackRateForAsset(item, asset)
}

function atempoFilters(rate: number): string[] {
  const filters: string[] = []
  let remaining = clamp(rate, 0.25, 4)
  while (remaining < 0.5) {
    filters.push('atempo=0.5')
    remaining /= 0.5
  }
  while (remaining > 2) {
    filters.push('atempo=2')
    remaining /= 2
  }
  if (Math.abs(remaining - 1) > 0.001) filters.push(`atempo=${remaining.toFixed(4)}`)
  return filters
}

function sourceInSecondsForItem(item: TimelineItem, asset: Asset, fps: number): number {
  const seconds = framesToSeconds(item.sourceInFrame || 0, fps)
  if (!item.loop || !asset.duration || asset.duration <= 0.05) return seconds
  return seconds % asset.duration
}

function framesToAssTime(frame: number, fps: number): string {
  const totalCentiseconds = Math.max(0, Math.round((frame / fps) * 100))
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(totalCentiseconds / 100)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad2(centiseconds)}`
}

function assColor(hex: string, alpha = '00'): string {
  const clean = hex.replace('#', '')
  const r = clean.slice(0, 2) || 'ff'
  const g = clean.slice(2, 4) || 'ff'
  const b = clean.slice(4, 6) || 'ff'
  return `&H${alpha}${b}${g}${r}`.toUpperCase()
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N')
}

function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:').replace(/'/g, "\\'")
}

function previewPreset(preset: ExportPreset): ExportPreset {
  return {
    ...preset,
    id: `${preset.id}-preview`,
    name: `${preset.name} 预览`,
    width: 540,
    height: 960,
    videoBitrate: '2500k',
    audioBitrate: '128k'
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, '_').slice(0, 120)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}
