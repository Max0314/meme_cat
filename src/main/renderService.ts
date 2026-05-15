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
import {
  normalizeVisualTransform,
  primaryVisualEffect,
  visualAnimationStateAtFrame,
  visualKeyframes as getVisualKeyframes
} from '../shared/animation'

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
  roleLabelVisible?: boolean
}

type RenderSubtitleItem = TimelineItem & {
  subtitleStreamId?: string
  subtitleCueOrder?: number
}

interface SubtitleAssChunk {
  startFrame: number
  durationFrames: number
  override: string
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
  const layoutPreset = request.preset
  const outputPreset = request.mode === 'preview' ? previewPreset(request.preset) : request.preset
  const now = new Date()
  const baseName = sanitizeFilename(`${request.project.title}-${request.mode}-${now.toISOString().replace(/[:.]/g, '-')}`)
  const isCover = request.mode === 'cover'
  const outputDir = request.mode === 'preview' ? info.outputDir : request.outputDir || info.outputDir
  const extension = isCover ? 'jpg' : 'mp4'
  const outputPath = request.outputPath ? request.outputPath : path.join(outputDir, `${baseName}.${extension}`)
  const tempDir = path.join(info.dataDir, 'render-temp')
  const totalSeconds = projectDurationSeconds(request.project, layoutPreset.fps)
  const outputLabel = isCover ? '封面 JPG' : 'MP4'
  const emit = (progress: Omit<RenderProgress, 'mode'>): void => {
    onProgress?.({ mode: request.mode, ...progress })
  }

  emit({ stage: 'preparing', message: isCover ? '准备导出封面' : '准备渲染工作区', percent: 0.05, outputPath })
  await mkdir(tempDir, { recursive: true })
  await mkdir(path.dirname(outputPath), { recursive: true })

  const assPath = path.join(tempDir, `${baseName}.ass`)
  emit({ stage: 'building-filters', message: '组装视频图层和字幕滤镜', percent: 0.18, outputPath })
  const args = await buildFfmpegArgs(request.project, layoutPreset, outputPreset, outputPath, assPath, ffmpegPath, request.mode)
  emit({ stage: 'encoding', message: `FFmpeg 正在生成 ${outputLabel}`, percent: 0.28, outputPath })
  try {
    await runFfmpeg(ffmpegPath, args, totalSeconds, (percent) => {
      emit({ stage: 'encoding', message: `FFmpeg 正在生成 ${outputLabel}`, percent, outputPath })
    })
  } catch (error) {
    emit({ stage: 'failed', message: isCover ? '封面导出失败' : '渲染失败', percent: 1, outputPath, error: error instanceof Error ? error.message : String(error) })
    throw error
  }

  emit({ stage: 'done', message: isCover ? '封面导出完成' : '渲染完成', percent: 1, outputPath })
  return {
    outputPath,
    fileUrl: pathToFileURL(outputPath).toString(),
    durationSeconds: totalSeconds,
    preset: outputPreset
  }
}

async function buildFfmpegArgs(
  project: ProjectFile,
  layoutPreset: ExportPreset,
  outputPreset: ExportPreset,
  outputPath: string,
  assPath: string,
  ffmpegPath: string,
  mode: RenderRequest['mode']
): Promise<string[]> {
  const args: string[] = ['-hide_banner']
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]))
  const trackOrder = new Map(project.tracks.map((track, index) => [track.id, index]))
  const timelineOrder = new Map(project.timeline.map((item, index) => [item.id, index]))
  const enabledTracks = new Set(project.tracks.filter((track) => !track.muted).map((track) => track.id))
  const visualItems = project.timeline
    .flatMap((item) => expandRoleInstanceForRender(item))
    .filter((item) => item.type === 'visual' && enabledTracks.has(item.trackId) && item.assetId && item.durationFrames > 0)
    .sort((a, b) => (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0) || (timelineOrder.get(a.id) ?? 0) - (timelineOrder.get(b.id) ?? 0))
  const audioItems = project.timeline
    .filter((item) => ['voice', 'music', 'sfx'].includes(item.type) && enabledTracks.has(item.trackId) && item.assetId && item.durationFrames > 0)
    .sort((a, b) => a.startFrame - b.startFrame)

  const totalFrames = projectDurationFrames(project, layoutPreset.fps)
  const totalSeconds = framesToSeconds(totalFrames, layoutPreset.fps)
  const visualSegments: VisualSegment[] = []
  const audioSegments: AudioSegment[] = []
  let inputIndex = 0

  args.push(
    '-f',
    'lavfi',
    '-t',
    totalSeconds.toFixed(3),
    '-i',
    `color=c=#f6f8fb:s=${layoutPreset.width}x${layoutPreset.height}:r=${layoutPreset.fps}`
  )
  inputIndex += 1

  for (const item of visualItems) {
    const asset = item.assetId ? assetsById.get(item.assetId) : undefined
    if (!asset?.localPath) continue
    const durationSeconds = framesToSeconds(item.durationFrames, layoutPreset.fps)
    const sourceDurationSeconds = mediaSourceDurationSeconds(item, asset, durationSeconds)
    const sourceInSeconds = sourceInSecondsForItem(item, asset, layoutPreset.fps)
    const alphaVariant = findGreenAlphaVariant(asset)
    const inputPath = alphaVariant?.localPath || asset.localPath
    const inputType = alphaVariant?.format === 'png' ? 'image' : alphaVariant?.format === 'webm' ? 'video' : asset.type

    if (inputType === 'image') {
      args.push('-loop', '1', '-t', durationSeconds.toFixed(3), '-i', inputPath)
    } else if (inputType === 'gif') {
      args.push('-ignore_loop', item.loop ? '0' : '1', '-t', sourceDurationSeconds.toFixed(3), '-i', inputPath)
    } else {
      if (item.loop) args.push('-stream_loop', '-1')
      if (alphaVariant?.format === 'webm') args.push('-c:v', 'libvpx-vp9')
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
    if (mode !== 'cover' && asset.type === 'video' && (item.volume ?? 1) > 0 && (await hasAudioStream(ffmpegPath, asset.localPath))) {
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

  for (const item of mode === 'cover' ? [] : audioItems) {
    const asset = item.assetId ? assetsById.get(item.assetId) : undefined
    if (!asset?.localPath) continue
    if (asset.type === 'video' && !(await hasAudioStream(ffmpegPath, asset.localPath))) continue
    const durationSeconds = framesToSeconds(item.durationFrames, layoutPreset.fps)
    const sourceDurationSeconds = mediaSourceDurationSeconds(item, asset, durationSeconds)
    const sourceInSeconds = sourceInSecondsForItem(item, asset, layoutPreset.fps)
    if (item.loop) args.push('-stream_loop', '-1')
    args.push('-ss', sourceInSeconds.toFixed(3), '-t', sourceDurationSeconds.toFixed(3), '-i', asset.localPath)
    audioSegments.push({ inputIndex, item, durationSeconds })
    inputIndex += 1
  }

  const filter = await buildFilterComplex(project, layoutPreset, outputPreset, visualSegments, audioSegments, assPath)
  args.push('-filter_complex', filter, '-map', '[vout]')
  if (mode === 'cover') {
    const coverSeconds = framesToSeconds(clamp(outputPreset.coverFrame || 0, 0, Math.max(0, totalFrames - 1)), layoutPreset.fps)
    args.push('-ss', coverSeconds.toFixed(3), '-frames:v', '1', '-q:v', '2', '-update', '1', '-y', outputPath)
    return args
  }

  if (audioSegments.length) {
    args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', outputPreset.audioBitrate)
  } else {
    args.push('-an')
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-r',
    String(outputPreset.fps),
    '-b:v',
    outputPreset.videoBitrate,
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-t',
    totalSeconds.toFixed(3),
    '-y',
    outputPath
  )

  return args
}

async function buildFilterComplex(
  project: ProjectFile,
  preset: ExportPreset,
  outputPreset: ExportPreset,
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

  const subtitleItems = buildSubtitleItems(project)
  const hasRoleLabels = visualSegments.some((segment) => {
    const label = roleLabelForItem(segment.item)
    return Boolean(label.text.trim()) && visualRenderChunks(segment.item, preset).some((chunk) => chunk.roleLabelVisible ?? label.visible)
  })
  if (subtitleItems.length || hasRoleLabels) {
    await writeFile(assPath, makeAssFile(project, preset, subtitleItems, visualSegments), 'utf-8')
    filters.push(`[${currentVideoLabel}]subtitles='${escapeFilterPath(assPath)}'[vsub]`)
    filters.push(buildOutputVideoFilter('vsub', preset, outputPreset))
  } else {
    filters.push(buildOutputVideoFilter(currentVideoLabel, preset, outputPreset))
  }

  if (audioSegments.length) {
    const audioLabels: string[] = []
    audioSegments.forEach((segment, index) => {
      const label = `a${index}`
      const delay = Math.max(0, Math.round(framesToSeconds(segment.item.startFrame, preset.fps) * 1000))
      const volume = clamp(segment.item.volume ?? 1, 0, 2.5).toFixed(3)
      const rate = itemPlaybackRate(segment.item)
      const sourceDurationSeconds = segment.durationSeconds * rate
      const fadeInSeconds = framesToSeconds(clamp(segment.item.fadeInFrames || 0, 0, segment.item.durationFrames), preset.fps)
      const fadeOutSeconds = framesToSeconds(clamp(segment.item.fadeOutFrames || 0, 0, segment.item.durationFrames), preset.fps)
      const audioFilters: string[] = [
        `atrim=duration=${sourceDurationSeconds.toFixed(3)}`,
        'asetpts=PTS-STARTPTS',
        ...atempoFilters(rate),
        ...(fadeInSeconds > 0 ? [`afade=t=in:st=0:d=${fadeInSeconds.toFixed(3)}`] : []),
        ...(fadeOutSeconds > 0
          ? [`afade=t=out:st=${Math.max(0, segment.durationSeconds - fadeOutSeconds).toFixed(3)}:d=${fadeOutSeconds.toFixed(3)}`]
          : []),
        `volume=${volume}`,
        `adelay=${delay}|${delay}`,
        ...audioDuckingFilters(segment, audioSegments, preset)
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

function buildOutputVideoFilter(inputLabel: string, layoutPreset: ExportPreset, outputPreset: ExportPreset): string {
  const filters: string[] = []
  if (layoutPreset.width !== outputPreset.width || layoutPreset.height !== outputPreset.height) {
    filters.push(
      `scale=${outputPreset.width}:${outputPreset.height}:force_original_aspect_ratio=decrease`,
      `pad=${outputPreset.width}:${outputPreset.height}:(ow-iw)/2:(oh-ih)/2:color=0xf6f8fb`,
      'setsar=1'
    )
  }
  filters.push('format=yuv420p')
  return `[${inputLabel}]${filters.join(',')}[vout]`
}

function expandSubtitleStreamForRender(item: TimelineItem): RenderSubtitleItem[] {
  if (item.type !== 'subtitle' || !Array.isArray(item.subtitleCues)) return [item]
  return item.subtitleCues
    .filter((cue) => cue.durationFrames > 0 && cue.text?.trim())
    .map((cue, index) => {
      const cueStart = Math.max(0, Math.round(cue.startFrame))
      const cueDuration = Math.max(1, Math.round(cue.durationFrames))
      const startState = visualAnimationStateAtFrame(item, cueStart)
      const shiftedKeyframes: NonNullable<TimelineItem['keyframes']> = [
        {
          id: `${item.id}:${cue.id}:kf0`,
          frame: 0,
          x: Math.round(startState.transform.x),
          y: Math.round(startState.transform.y),
          scale: Number(startState.transform.scale.toFixed(3)),
          rotation: Math.round(startState.transform.rotation),
          opacity: Number(startState.transform.opacity.toFixed(3)),
          ...(typeof startState.effectIntensity === 'number' ? { effectIntensity: Number(startState.effectIntensity.toFixed(3)) } : {})
        },
        ...getVisualKeyframes(item)
          .filter((keyframe) => keyframe.frame > cueStart && keyframe.frame < cueStart + cueDuration)
          .map((keyframe) => ({ ...keyframe, id: `${item.id}:${cue.id}:${keyframe.id}`, frame: keyframe.frame - cueStart }))
      ]
      return {
        ...item,
        id: `${item.id}:${cue.id}`,
        subtitleStreamId: item.id,
        subtitleCueOrder: index,
        label: cue.text || item.label,
        startFrame: item.startFrame + cueStart,
        durationFrames: cueDuration,
        sourceInFrame: 0,
        text: cue.text,
        transform: startState.transform,
        keyframes: shiftedKeyframes,
        subtitleCues: undefined
      }
    })
}

function expandRoleInstanceForRender(item: TimelineItem): TimelineItem[] {
  if (item.type !== 'visual' || !Array.isArray(item.roleStates)) return [item]
  return item.roleStates
    .filter((state) => state.assetId && state.durationFrames > 0)
    .map((state) => {
      const stateStart = Math.max(0, Math.round(state.startFrame))
      const stateDuration = Math.max(1, Math.round(state.durationFrames))
      const startState = visualAnimationStateAtFrame(item, stateStart)
      const renderedStartTransform = applyRoleStateRenderTransform(startState.transform, state)
      const shiftedKeyframes: NonNullable<TimelineItem['keyframes']> = [
        {
          id: `${item.id}:${state.id}:kf0`,
          frame: 0,
          x: Math.round(renderedStartTransform.x),
          y: Math.round(renderedStartTransform.y),
          scale: Number(renderedStartTransform.scale.toFixed(3)),
          rotation: Math.round(renderedStartTransform.rotation),
          opacity: Number(renderedStartTransform.opacity.toFixed(3)),
          roleLabelVisible: startState.roleLabelVisible,
          ...(typeof startState.effectIntensity === 'number' ? { effectIntensity: Number(startState.effectIntensity.toFixed(3)) } : {})
        },
        ...getVisualKeyframes(item)
          .filter((keyframe) => keyframe.frame > stateStart && keyframe.frame < stateStart + stateDuration)
          .map((keyframe) => {
            const transformed = applyRoleStateRenderTransform(transformFromKeyframe(item, keyframe), state)
            return {
              ...keyframe,
              id: `${item.id}:${state.id}:${keyframe.id}`,
              frame: keyframe.frame - stateStart,
              x: transformed.x,
              y: transformed.y,
              scale: transformed.scale,
              rotation: transformed.rotation,
              opacity: transformed.opacity
            }
          })
      ]
      return {
        ...item,
        id: `${item.id}:${state.id}`,
        assetId: state.assetId,
        label: state.label || item.label,
        startFrame: item.startFrame + stateStart,
        durationFrames: stateDuration,
        sourceInFrame: Math.max(0, Math.round(state.sourceInFrame || 0)),
        playbackRate: state.playbackRate ?? item.playbackRate,
        volume: state.muted ? 0 : (item.volume ?? 1) * (state.volume ?? 1),
        keying: state.keying ?? item.keying,
        transform: renderedStartTransform,
        keyframes: shiftedKeyframes,
        roleStates: undefined
      }
    })
}

function applyRoleStateRenderTransform(transform: VisualTransform, state: NonNullable<TimelineItem['roleStates']>[number]): VisualTransform {
  return {
    ...transform,
    x: transform.x + Math.round(state.offsetX || 0),
    y: transform.y + Math.round(state.offsetY || 0),
    scale: clamp(transform.scale * (state.scale ?? 1), 0.08, 4)
  }
}

function buildSubtitleItems(project: ProjectFile): RenderSubtitleItem[] {
  const enabledTracks = new Set(project.tracks.filter((track) => !track.muted).map((track) => track.id))
  return project.timeline
    .flatMap((item) => expandSubtitleStreamForRender(item))
    .filter((item) => item.type === 'subtitle' && enabledTracks.has(item.trackId) && (item.text || item.speakerName) && item.durationFrames > 0)
    .sort((a, b) => a.startFrame - b.startFrame)
}

function makeAssFile(project: ProjectFile, preset: ExportPreset, subtitleItems: RenderSubtitleItem[], visualSegments: VisualSegment[]): string {
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
    const rawText = item.text || ''
    if (rawText.trim()) {
      const text = escapeAssText(wrapSubtitleText(rawText, style, item.subtitleBox, preset))
      lines.push(...buildSubtitleTextAssEvents(item, subtitleItems, visualSegments, style, preset, text))
    }
    return lines
  })
  const roleLabelEvents = buildRoleLabelAssEvents(visualSegments, preset)

  return [...header, ...roleLabelEvents, ...subtitleEvents, ''].join('\n')
}

function buildSubtitleTextAssEvents(
  item: RenderSubtitleItem,
  allSubtitleItems: RenderSubtitleItem[],
  visualSegments: VisualSegment[],
  style: ProjectFile['subtitleStyle'],
  preset: ExportPreset,
  escapedText: string
): string[] {
  return subtitleAssChunks(item, allSubtitleItems, visualSegments, style, preset).map((chunk) => {
    const start = framesToAssTime(chunk.startFrame, preset.fps)
    const end = framesToAssTime(chunk.startFrame + chunk.durationFrames, preset.fps)
    return `Dialogue: 2,${start},${end},${subtitleStyleName(style.position)},,0,0,0,,${chunk.override}${escapedText}`
  })
}

function subtitleAssChunks(
  item: RenderSubtitleItem,
  allSubtitleItems: RenderSubtitleItem[],
  visualSegments: VisualSegment[],
  style: ProjectFile['subtitleStyle'],
  preset: ExportPreset
): SubtitleAssChunk[] {
  const animated = Boolean(item.subtitleBinding?.roleId) || getVisualKeyframes(item).length > 0 || hasAnimatedTimelineEffects(item)
  if (!animated) {
    const override = subtitleAssOverrideAtFrame(item, allSubtitleItems, visualSegments, style, preset, 0)
    return override ? [{ startFrame: item.startFrame, durationFrames: item.durationFrames, override }] : []
  }

  const chunks: SubtitleAssChunk[] = []
  for (let localFrame = 0; localFrame < item.durationFrames; localFrame += 1) {
    const override = subtitleAssOverrideAtFrame(item, allSubtitleItems, visualSegments, style, preset, localFrame)
    if (!override) continue
    const absoluteFrame = item.startFrame + localFrame
    const previous = chunks[chunks.length - 1]
    if (previous && previous.startFrame + previous.durationFrames === absoluteFrame && previous.override === override) {
      previous.durationFrames += 1
    } else {
      chunks.push({ startFrame: absoluteFrame, durationFrames: 1, override })
    }
  }
  return chunks
}

function subtitleAssOverrideAtFrame(
  item: RenderSubtitleItem,
  allSubtitleItems: RenderSubtitleItem[],
  visualSegments: VisualSegment[],
  style: ProjectFile['subtitleStyle'],
  preset: ExportPreset,
  localFrame: number
): string | null {
  const animationState = visualAnimationStateAtFrame(item, localFrame)
  const effectState = applyTimelineEffects(item, animationState.transform, localFrame, preset, animationState.effectIntensity)
  const transform = effectState.transform
  const absoluteFrame = item.startFrame + localFrame
  const stackOffset = subtitleStackIndex(item, allSubtitleItems, absoluteFrame) * Math.max(18, Math.round(style.fontSize * 1.12))
  const binding = item.subtitleBinding?.roleId ? item.subtitleBinding : undefined

  if (binding?.roleId) {
    const roleSegment = findRoleSegmentAtFrame(visualSegments, binding.roleId, absoluteFrame)
    if (!roleSegment) return null
    const roleLocalFrame = absoluteFrame - roleSegment.item.startFrame
    const roleAnimation = visualAnimationStateAtFrame(roleSegment.item, roleLocalFrame)
    const roleEffect = applyTimelineEffects(roleSegment.item, roleAnimation.transform, roleLocalFrame, preset, roleAnimation.effectIntensity)
    const anchor = roleAnchorForSegment(roleSegment, roleEffect.transform, style.position, style.fontSize, preset)
    return assComputedTextOverride({
      x: anchor.x + transform.x,
      y: anchor.y + transform.y + stackOffset,
      rotation: anchor.rotation + transform.rotation,
      scale: transform.scale,
      opacity: anchor.opacity * transform.opacity
    })
  }

  return assComputedTextOverride({
    x: preset.width / 2 + transform.x,
    y: preset.height * (subtitlePositionPercent(style.position) / 100) + transform.y + stackOffset,
    rotation: transform.rotation,
    scale: transform.scale,
    opacity: transform.opacity
  })
}

function subtitleStackIndex(item: RenderSubtitleItem, allSubtitleItems: RenderSubtitleItem[], absoluteFrame: number): number {
  const streamId = item.subtitleStreamId || item.id
  const active = allSubtitleItems
    .filter((entry) => (entry.subtitleStreamId || entry.id) === streamId)
    .filter((entry) => absoluteFrame >= entry.startFrame && absoluteFrame < entry.startFrame + entry.durationFrames)
    .sort((a, b) => a.startFrame - b.startFrame || (a.subtitleCueOrder ?? 0) - (b.subtitleCueOrder ?? 0))
  return Math.max(0, active.findIndex((entry) => entry.id === item.id))
}

function findRoleSegmentAtFrame(visualSegments: VisualSegment[], roleId: string, absoluteFrame: number): VisualSegment | undefined {
  return visualSegments
    .filter((segment) => segment.item.roleId === roleId && absoluteFrame >= segment.item.startFrame && absoluteFrame < segment.item.startFrame + segment.item.durationFrames)
    .sort((a, b) => a.item.startFrame - b.item.startFrame)
    .slice(-1)[0]
}

function roleAnchorForSegment(
  segment: VisualSegment,
  transform: VisualTransform,
  position: ProjectFile['subtitleStyle']['position'],
  fontSize: number,
  preset: ExportPreset
): { x: number; y: number; rotation: number; opacity: number } {
  const fitCanvas = !isBackgroundVisualSegment(segment)
  const width = Math.max(2, Math.round(preset.width * transform.scale))
  const height = Math.max(2, Math.round(fitCanvas ? width / mediaAspectRatio(segment.asset, segment.mediaSize) : preset.height * transform.scale))
  const padding = Math.max(6, Math.round(fontSize * 0.16))
  const bounds = normalizeVisibleBounds(segment.alphaVariant?.visibleBounds)
  const layerLeft = preset.width / 2 + transform.x - width / 2
  const layerTop = preset.height / 2 + transform.y - height / 2
  const x = Math.round(layerLeft + (bounds.left + bounds.width / 2) * width)
  const visibleTop = layerTop + bounds.top * height
  const visibleMiddle = layerTop + (bounds.top + bounds.height / 2) * height
  const visibleBottom = layerTop + (bounds.top + bounds.height) * height
  const y =
    position === 'top'
      ? Math.round(visibleTop - padding)
      : position === 'middle'
        ? Math.round(visibleMiddle)
        : Math.round(visibleBottom + padding)
  return { x, y, rotation: transform.rotation, opacity: transform.opacity }
}

function assComputedTextOverride(transform: { x: number; y: number; rotation: number; scale: number; opacity: number }): string {
  const scale = Math.round(transform.scale * 100)
  const alpha = Math.round((1 - clamp(transform.opacity, 0, 1)) * 255).toString(16).padStart(2, '0').toUpperCase()
  return `{\\an5\\pos(${Math.round(transform.x)},${Math.round(transform.y)})\\frz${Math.round(transform.rotation)}\\fscx${scale}\\fscy${scale}\\alpha&H${alpha}&}`
}

function buildRoleLabelAssEvents(visualSegments: VisualSegment[], preset: ExportPreset): string[] {
  return visualSegments.flatMap((segment) => {
    const label = roleLabelForItem(segment.item)
    if (!label.text.trim()) return []
    return visualRenderChunks(segment.item, preset).filter((chunk) => chunk.roleLabelVisible ?? label.visible).map((chunk) => {
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
  const bounds = normalizeVisibleBounds(segment.alphaVariant?.visibleBounds)
  const layerLeft = preset.width / 2 + transform.x - width / 2
  const layerTop = preset.height / 2 + transform.y - height / 2
  const x = Math.round(layerLeft + (bounds.left + bounds.width / 2) * width)
  const visibleTop = layerTop + bounds.top * height
  const visibleMiddle = layerTop + (bounds.top + bounds.height / 2) * height
  const visibleBottom = layerTop + (bounds.top + bounds.height) * height
  const y =
    style.position === 'top'
      ? Math.round(visibleTop - padding)
      : style.position === 'middle'
        ? Math.round(visibleMiddle)
        : Math.round(visibleBottom + padding)
  const scale = Math.round(transform.scale * 100)
  const alpha = Math.round((1 - clamp(transform.opacity, 0, 1)) * 255).toString(16).padStart(2, '0').toUpperCase()
  return `{\\an5\\pos(${x},${y})\\frz${Math.round(transform.rotation)}\\fscx${scale}\\fscy${scale}\\alpha&H${alpha}&\\fn${assFontName(
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

function normalizeSubtitleBox(box?: TimelineItem['subtitleBox']): Required<NonNullable<TimelineItem['subtitleBox']>> {
  const autoHeight = box?.autoHeight ?? true
  return {
    widthPct: clamp(box?.widthPct ?? 78, 18, 96),
    heightPct: autoHeight ? 18 : clamp(box?.heightPct ?? 18, 6, 92),
    autoHeight,
    padding: clamp(Math.round(box?.padding ?? 0), 0, 80),
    lineHeight: clamp(Number(box?.lineHeight ?? 1.12), 0.8, 2),
    textAlign: box?.textAlign || 'center',
    verticalAlign: box?.verticalAlign || 'middle',
    overflow: box?.overflow || 'wrap'
  }
}

function wrapSubtitleText(text: string, style: ProjectFile['subtitleStyle'], box: TimelineItem['subtitleBox'], preset: ExportPreset): string {
  const normalizedBox = normalizeSubtitleBox(box)
  if (normalizedBox.overflow === 'clip') return text
  const maxWidth = Math.max(80, preset.width * (normalizedBox.widthPct / 100) - normalizedBox.padding * 2)
  const approxCharWidth = Math.max(8, style.fontSize * 0.56)
  const maxChars = Math.max(2, Math.floor(maxWidth / approxCharWidth))
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const chars = Array.from(line)
      if (chars.length <= maxChars) return [line]
      const rows: string[] = []
      for (let index = 0; index < chars.length; index += maxChars) {
        rows.push(chars.slice(index, index + maxChars).join(''))
      }
      return rows
    })
    .join('\n')
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

function normalizeVisibleBounds(bounds?: AssetProcessedVariant['visibleBounds']): { left: number; top: number; width: number; height: number } {
  const left = clamp(bounds?.left ?? 0, 0, 1)
  const top = clamp(bounds?.top ?? 0, 0, 1)
  const width = clamp(bounds?.width ?? 1, 0.02, 1)
  const height = clamp(bounds?.height ?? 1, 0.02, 1)
  return {
    left,
    top,
    width: Math.min(width, 1 - left),
    height: Math.min(height, 1 - top)
  }
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

function projectDurationFrames(project: ProjectFile, fps: number): number {
  const configuredFrames =
    typeof project.durationSeconds === 'number' && Number.isFinite(project.durationSeconds)
      ? Math.round(project.durationSeconds * fps)
      : fps * 30
  return Math.max(configuredFrames, fps)
}

function projectDurationSeconds(project: ProjectFile, fps: number): number {
  return framesToSeconds(projectDurationFrames(project, fps), fps)
}

function normalizeTransform(transform?: Partial<VisualTransform>): VisualTransform {
  return normalizeVisualTransform(transform)
}

function visualRenderChunks(item: TimelineItem, preset: ExportPreset): VisualRenderChunk[] {
  const keyframes = getVisualKeyframes(item)
  const animatedEffects = hasAnimatedTimelineEffects(item)
  if (!keyframes.length && !animatedEffects) {
    const animationState = visualAnimationStateAtFrame(item, 0)
    const effectState = applyTimelineEffects(item, animationState.transform, 0, preset, animationState.effectIntensity)
    return [{ sourceStartFrame: 0, durationFrames: item.durationFrames, transform: effectState.transform, filters: effectState.filters, roleLabelVisible: animationState.roleLabelVisible }]
  }

  if (keyframes.length === 1 && keyframes[0].frame === 0 && !animatedEffects) {
    const animationState = visualAnimationStateAtFrame(item, 0)
    const effectState = applyTimelineEffects(item, animationState.transform, 0, preset, animationState.effectIntensity)
    return [{ sourceStartFrame: 0, durationFrames: item.durationFrames, transform: effectState.transform, filters: effectState.filters, roleLabelVisible: animationState.roleLabelVisible }]
  }

  const chunks: VisualRenderChunk[] = []
  // Animated transforms are emitted frame-by-frame so FFmpeg export matches the live React preview interpolation.
  const stepFrames = 1
  for (let frame = 0; frame < item.durationFrames; frame += stepFrames) {
    const animationState = visualAnimationStateAtFrame(item, frame)
    const effectState = applyTimelineEffects(item, animationState.transform, frame, preset, animationState.effectIntensity)
    chunks.push({
      sourceStartFrame: frame,
      durationFrames: Math.min(stepFrames, item.durationFrames - frame),
      transform: effectState.transform,
      filters: effectState.filters,
      roleLabelVisible: animationState.roleLabelVisible
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
  preset: ExportPreset,
  effectIntensityOverride?: number
): { transform: VisualTransform; filters: string[] } {
  const durationFrames = Math.max(1, item.durationFrames)
  const progress = clamp(localFrame / durationFrames, 0, 1)
  let nextTransform = { ...transform }
  const filters: string[] = []
  const primaryEffect = primaryVisualEffect(item.effects)

  item.effects.forEach((effect) => {
    const intensity = clamp(effect.id === primaryEffect?.id && typeof effectIntensityOverride === 'number' ? effectIntensityOverride : effect.intensity, 0, 1)
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

function audioDuckingFilters(segment: AudioSegment, audioSegments: AudioSegment[], preset: ExportPreset): string[] {
  if (segment.item.type !== 'music') return []
  const segmentStart = framesToSeconds(segment.item.startFrame, preset.fps)
  const segmentEnd = segmentStart + segment.durationSeconds
  return audioSegments
    .filter((other) => other !== segment && other.item.type !== 'music')
    .map((other) => {
      const otherStart = framesToSeconds(other.item.startFrame, preset.fps)
      const start = Math.max(segmentStart, otherStart)
      const end = Math.min(segmentEnd, otherStart + other.durationSeconds)
      return { start, end }
    })
    .filter((window) => window.end > window.start + 0.01)
    .map((window) => `volume=0.35:enable='between(t,${window.start.toFixed(3)},${window.end.toFixed(3)})'`)
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
  const maxEdge = 960
  const scale = Math.min(1, maxEdge / Math.max(1, preset.width, preset.height))
  const width = even(Math.max(2, Math.round(preset.width * scale)))
  const height = even(Math.max(2, Math.round(preset.height * scale)))
  return {
    ...preset,
    id: `${preset.id}-preview`,
    name: `${preset.name} 预览`,
    width,
    height,
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
