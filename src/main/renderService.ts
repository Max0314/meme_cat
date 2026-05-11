import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import ffmpegStaticPath from 'ffmpeg-static'
import type { Asset, ExportPreset, ProjectFile, RenderRequest, RenderResult, TimelineItem, VisualKeying, VisualTransform, WorkspaceInfo } from '../shared/types'

interface VisualSegment {
  inputIndex: number
  durationSeconds: number
  item: TimelineItem
  asset: Asset
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
}

interface MediaSize {
  width: number
  height: number
}

const audioProbeCache = new Map<string, boolean>()
const mediaSizeProbeCache = new Map<string, MediaSize | null>()

export async function renderProject(info: WorkspaceInfo, request: RenderRequest): Promise<RenderResult> {
  const ffmpegPath = resolveFfmpegPath()
  const preset = request.mode === 'preview' ? previewPreset(request.preset) : request.preset
  const now = new Date()
  const baseName = sanitizeFilename(`${request.project.title}-${request.mode}-${now.toISOString().replace(/[:.]/g, '-')}`)
  const outputDir = request.mode === 'export' ? request.outputDir || info.outputDir : info.outputDir
  const outputPath = request.mode === 'export' && request.outputPath ? request.outputPath : path.join(outputDir, `${baseName}.mp4`)
  const tempDir = path.join(info.dataDir, 'render-temp')
  await mkdir(tempDir, { recursive: true })
  await mkdir(path.dirname(outputPath), { recursive: true })

  const assPath = path.join(tempDir, `${baseName}.ass`)
  const args = await buildFfmpegArgs(request.project, preset, outputPath, assPath, ffmpegPath)
  await runFfmpeg(ffmpegPath, args)

  return {
    outputPath,
    fileUrl: pathToFileURL(outputPath).toString(),
    durationSeconds: projectDurationSeconds(request.project, preset.fps),
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

  const totalFrames = Math.max(projectDurationFrames(project), preset.fps * 4)
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
    const sourceInSeconds = sourceInSecondsForItem(item, asset, preset.fps)

    if (asset.type === 'image') {
      args.push('-loop', '1', '-t', durationSeconds.toFixed(3), '-i', asset.localPath)
    } else if (asset.type === 'gif') {
      args.push('-ignore_loop', item.loop ? '0' : '1', '-t', durationSeconds.toFixed(3), '-i', asset.localPath)
    } else {
      if (item.loop) args.push('-stream_loop', '-1')
      args.push('-ss', sourceInSeconds.toFixed(3), '-t', durationSeconds.toFixed(3), '-i', asset.localPath)
    }

    visualSegments.push({
      inputIndex,
      item,
      durationSeconds,
      asset,
      mediaSize: asset.width && asset.height ? { width: asset.width, height: asset.height } : (await probeMediaSize(ffmpegPath, asset.localPath)) || undefined
    })
    if (asset.type === 'video' && (item.volume ?? 1) > 0 && (await hasAudioStream(ffmpegPath, asset.localPath))) {
      audioSegments.push({ inputIndex, item, durationSeconds })
    }
    inputIndex += 1
  }

  for (const item of audioItems) {
    const asset = item.assetId ? assetsById.get(item.assetId) : undefined
    if (!asset?.localPath) continue
    if (asset.type === 'video' && !(await hasAudioStream(ffmpegPath, asset.localPath))) continue
    const durationSeconds = framesToSeconds(item.durationFrames, preset.fps)
    const sourceInSeconds = sourceInSecondsForItem(item, asset, preset.fps)
    if (item.loop) args.push('-stream_loop', '-1')
    args.push('-ss', sourceInSeconds.toFixed(3), '-t', durationSeconds.toFixed(3), '-i', asset.localPath)
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
    '-shortest',
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
    const chunks = visualRenderChunks(segment.item, preset.fps)
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
      const sourceStartSeconds = framesToSeconds(chunk.sourceStartFrame, preset.fps)
      const chunkDurationSeconds = framesToSeconds(chunk.durationFrames, preset.fps)
      const startSeconds = framesToSeconds(segment.item.startFrame + chunk.sourceStartFrame, preset.fps)
      const endSeconds = startSeconds + chunkDurationSeconds
      const opacity = clamp(chunk.transform.opacity, 0, 1).toFixed(3)
      const x = `(W-w)/2+${Math.round(chunk.transform.x)}`
      const y = `(H-h)/2+${Math.round(chunk.transform.y)}`
      const sourceLabel = sourceLabels[chunkIndex]

      filters.push(
        `[${sourceLabel}]` +
          buildVisualLayerFilters(segment.item, preset, scaledWidth, scaledHeight, chunkDurationSeconds, startSeconds, opacity, fitCanvas, chunk.transform, sourceStartSeconds).join(',') +
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

  const subtitleItems = buildSubtitleItems(project)
  if (subtitleItems.length) {
    await writeFile(assPath, makeAssFile(project, preset, subtitleItems), 'utf-8')
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
      filters.push(
        `[${segment.inputIndex}:a]atrim=duration=${segment.durationSeconds.toFixed(3)},asetpts=PTS-STARTPTS,volume=${volume},adelay=${delay}|${delay}[${label}]`
      )
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

function buildSubtitleItems(project: ProjectFile): TimelineItem[] {
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

  const totalFrames = Math.max(projectDurationFrames(project), 30 * 8)
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

function makeAssFile(project: ProjectFile, preset: ExportPreset, subtitleItems: TimelineItem[]): string {
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

  const events = subtitleItems.flatMap((item) => {
    const start = framesToAssTime(item.startFrame, preset.fps)
    const end = framesToAssTime(item.startFrame + item.durationFrames, preset.fps)
    const style = normalizeSubtitleStyle({ ...baseStyle, ...item.style })
    const lines: string[] = []
    if (item.speakerVisible && item.speakerName?.trim()) {
      lines.push(`Dialogue: 1,${start},${end},${speakerStyleName(item.speakerPosition || style.position)},,0,0,0,,${escapeAssText(item.speakerName.trim())}`)
    }
    const text = escapeAssText(item.text || '')
    if (text) {
      lines.push(`Dialogue: 2,${start},${end},${subtitleStyleName(style.position)},,0,0,0,,${text}`)
    }
    return lines
  })

  return [...header, ...events, ''].join('\n')
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

function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
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

function projectDurationFrames(project: ProjectFile): number {
  return project.timeline.reduce((max, item) => Math.max(max, item.startFrame + item.durationFrames), 0)
}

function projectDurationSeconds(project: ProjectFile, fps: number): number {
  return framesToSeconds(Math.max(projectDurationFrames(project), fps * 4), fps)
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

function visualRenderChunks(item: TimelineItem, fps: number): VisualRenderChunk[] {
  const keyframes = normalizeVisualKeyframes(item)
  if (!keyframes.length) {
    return [{ sourceStartFrame: 0, durationFrames: item.durationFrames, transform: normalizeTransform(item.transform) }]
  }

  if (keyframes.length === 1) {
    return [{ sourceStartFrame: 0, durationFrames: item.durationFrames, transform: transformFromKeyframe(item, keyframes[0]) }]
  }

  const chunks: VisualRenderChunk[] = []
  const stepFrames = item.durationFrames > fps * 20 ? Math.max(2, Math.round(fps / 8)) : 2
  for (let frame = 0; frame < item.durationFrames; frame += stepFrames) {
    chunks.push({
      sourceStartFrame: frame,
      durationFrames: Math.min(stepFrames, item.durationFrames - frame),
      transform: visualTransformAtLocalFrame(item, frame, keyframes)
    })
  }
  return chunks
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
  sourceStartSeconds = 0
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

  if (keying.enabled) {
    filters.push(`chromakey=${keying.color}:${keying.similarity.toFixed(3)}:${keying.blend.toFixed(3)}`)
  }

  filters.push(
    `trim=start=${sourceStartSeconds.toFixed(3)}:duration=${durationSeconds.toFixed(3)}`,
    `setpts=PTS-STARTPTS+${startSeconds.toFixed(3)}/TB`,
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
