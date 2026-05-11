import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Asset, ProjectFile, TimelineItem, WorkspaceInfo } from '../shared/types'
import { EXPORT_PRESETS } from '../shared/presets'
import { renderProject } from './renderService'
import { writeJson } from './jsonStore'

const DEMO_IMAGES = [
  ['demo-banana-cat', 'banana-cat-original.png', 'Original Banana Cat'],
  ['demo-crying-cat', 'crying-cat-original.png', 'Original Crying Cat'],
  ['demo-office-cat', 'office-cat-original.png', 'Original Office Cat'],
  ['demo-confused-cat', 'confused-cat-original.png', 'Original Confused Cat'],
  ['demo-laser-cat', 'laser-cat-original.png', 'Original Laser Cat']
] as const

const DEMO_LINES = [
  '我是一只香蕉猫',
  '本来今天只想躺平',
  '结果老板说要加班',
  '我当场哭成表情包',
  '但猫粮到账了，先忍'
]

export async function exportDemoVideo(info: WorkspaceInfo): Promise<string> {
  const preset = EXPORT_PRESETS[0]
  const fps = preset.fps
  const assets = buildDemoAssets(info)
  const timeline = buildDemoTimeline(fps)
  const now = new Date().toISOString()

  const project: ProjectFile = {
    version: 1,
    id: 'demo-cat-meme-project',
    title: 'demo-cat-meme-video',
    workspaceRoot: info.root,
    createdAt: now,
    updatedAt: now,
    exportPresetId: preset.id,
    tracks: [
      { id: 'visual-main', name: '背景视频', kind: 'visual', locked: false, muted: false },
      { id: 'visual-role-a', name: '角色猫 A', kind: 'visual', locked: false, muted: false },
      { id: 'visual-role-b', name: '角色猫 B', kind: 'visual', locked: false, muted: false },
      { id: 'subtitles', name: '大字幕', kind: 'subtitle', locked: false, muted: false },
      { id: 'voice', name: '配音', kind: 'voice', locked: false, muted: false },
      { id: 'music', name: 'BGM', kind: 'music', locked: false, muted: false },
      { id: 'sfx', name: '音效', kind: 'sfx', locked: false, muted: false }
    ],
    timeline,
    assets,
    script: DEMO_LINES.join('\n'),
    subtitleStyle: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 56,
      color: '#ffffff',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 'top',
      background: false,
      backgroundColor: '#111827'
    },
    aiRecords: []
  }

  const projectPath = path.join(info.projectsDir, 'demo-cat-meme-video.catmeme.json')
  await writeJson(projectPath, project)
  const result = await renderProject(info, { project, preset, mode: 'export' })
  await writeJson(path.join(info.outputDir, 'demo-cat-meme-video.result.json'), result)
  return result.outputPath
}

export async function exportResourceDemoVideo(info: WorkspaceInfo): Promise<string> {
  const preset = EXPORT_PRESETS[0]
  const fps = preset.fps
  const createdAt = new Date().toISOString()
  const backgroundPath = await firstFile(path.join(info.assetsDir, 'cats', 'backgrounds'), /\.(png|jpe?g|webp)$/i)
  const greenVideos = await firstFiles(path.join(info.assetsDir, 'videos', 'green-screen'), /\.(mp4|mov|webm|mkv)$/i, 2)

  if (!backgroundPath || greenVideos.length < 1) {
    throw new Error('Resource demo needs imported backgrounds and green-screen videos. Run scripts/import-resource-samples.ps1 first.')
  }

  const assets: Asset[] = [
    {
      id: 'resource-demo-bg',
      type: 'image',
      filename: path.basename(backgroundPath),
      localPath: backgroundPath,
      sourceUrl: backgroundPath,
      provider: 'local',
      license: 'Local resource import; rights may vary',
      riskLevel: 'medium',
      tags: ['background', 'resource-demo'],
      title: 'Resource Background',
      createdAt
    },
    ...greenVideos.map<Asset>((videoPath, index) => ({
      id: `resource-demo-green-${index}`,
      type: 'video',
      filename: path.basename(videoPath),
      localPath: videoPath,
      sourceUrl: videoPath,
      provider: 'local',
      license: 'Local green-screen import; rights may vary',
      riskLevel: 'high',
      tags: ['green-screen', '绿幕', 'resource-demo'],
      title: path.basename(videoPath, path.extname(videoPath)),
      createdAt
    }))
  ]

  const totalFrames = fps * 8
  const project: ProjectFile = {
    version: 1,
    id: 'resource-green-screen-demo',
    title: 'resource-green-screen-demo',
    workspaceRoot: info.root,
    createdAt,
    updatedAt: createdAt,
    exportPresetId: preset.id,
    tracks: [
      { id: 'visual-main', name: '背景视频', kind: 'visual', locked: false, muted: false },
      { id: 'visual-role-a', name: '角色猫 A', kind: 'visual', locked: false, muted: false },
      { id: 'visual-role-b', name: '角色猫 B', kind: 'visual', locked: false, muted: false },
      { id: 'subtitles', name: '大字幕', kind: 'subtitle', locked: false, muted: false },
      { id: 'voice', name: '配音', kind: 'voice', locked: false, muted: false },
      { id: 'music', name: 'BGM', kind: 'music', locked: false, muted: false },
      { id: 'sfx', name: '音效', kind: 'sfx', locked: false, muted: false }
    ],
    timeline: [
      {
        id: 'resource-bg-item',
        trackId: 'visual-main',
        assetId: 'resource-demo-bg',
        type: 'visual',
        label: '背景',
        startFrame: 0,
        durationFrames: totalFrames,
        sourceInFrame: 0,
        effects: [],
        transform: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 }
      },
      {
        id: 'resource-green-a',
        trackId: 'visual-role-a',
        assetId: 'resource-demo-green-0',
        type: 'visual',
        label: '绿幕角色 A',
        startFrame: 0,
        durationFrames: totalFrames,
        sourceInFrame: 0,
        effects: [],
        transform: { x: -260, y: 280, scale: 0.46, rotation: -3, flipX: false, flipY: false, opacity: 1 },
        keying: { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 }
      },
      ...(greenVideos[1]
        ? [
            {
              id: 'resource-green-b',
              trackId: 'visual-role-b',
              assetId: 'resource-demo-green-1',
              type: 'visual' as const,
              label: '绿幕角色 B',
              startFrame: fps * 2,
              durationFrames: fps * 6,
              sourceInFrame: 0,
              effects: [],
              transform: { x: 260, y: 280, scale: 0.42, rotation: 5, flipX: true, flipY: false, opacity: 1 },
              keying: { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 }
            }
          ]
        : []),
      {
        id: 'resource-subtitle-1',
        trackId: 'subtitles',
        type: 'subtitle',
        label: '字幕 1',
        startFrame: 0,
        durationFrames: fps * 4,
        sourceInFrame: 0,
        effects: [],
        text: '绿幕猫已经能抠出来了',
        speakerName: '香蕉猫',
        speakerVisible: true,
        speakerPosition: 'bottom'
      },
      {
        id: 'resource-subtitle-2',
        trackId: 'subtitles',
        type: 'subtitle',
        label: '字幕 2',
        startFrame: fps * 4,
        durationFrames: fps * 4,
        sourceInFrame: 0,
        effects: [],
        text: '拖到角色轨就能做小剧场',
        speakerName: '哭猫',
        speakerVisible: true,
        speakerPosition: 'bottom'
      }
    ],
    assets,
    script: '绿幕猫已经能抠出来了\n拖到角色轨就能做小剧场',
    subtitleStyle: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 56,
      color: '#ffffff',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 'top',
      background: false,
      backgroundColor: '#111827'
    },
    aiRecords: []
  }

  const projectPath = path.join(info.projectsDir, 'resource-green-screen-demo.catmeme.json')
  await writeJson(projectPath, project)
  const result = await renderProject(info, { project, preset, mode: 'export' })
  await writeJson(path.join(info.outputDir, 'resource-green-screen-demo.result.json'), result)
  return result.outputPath
}

function buildDemoAssets(info: WorkspaceInfo): Asset[] {
  const createdAt = new Date().toISOString()
  const imageAssets = DEMO_IMAGES.map(([id, filename, title]) => {
    const localPath = path.join(info.assetsDir, 'cats', filename)
    assertFile(localPath)
    return {
      id,
      type: 'image' as const,
      filename,
      localPath,
      sourceUrl: `generated-demo://${id}`,
      provider: 'local' as const,
      license: 'Original demo asset generated locally for Cat Meme Studio',
      riskLevel: 'safe' as const,
      tags: ['cat', 'meme', 'demo'],
      title,
      author: 'Cat Meme Studio',
      width: 1080,
      height: 1920,
      createdAt
    }
  })

  const bgmPath = path.join(info.assetsDir, 'music', 'demo-bgm.wav')
  const voicePath = path.join(info.assetsDir, 'sfx', 'demo-voice.wav')
  assertFile(bgmPath)
  assertFile(voicePath)

  return [
    ...imageAssets,
    {
      id: 'demo-bgm',
      type: 'audio',
      filename: 'demo-bgm.wav',
      localPath: bgmPath,
      sourceUrl: 'generated-demo://demo-bgm',
      provider: 'local',
      license: 'Original generated demo tone',
      riskLevel: 'safe',
      tags: ['bgm', 'demo'],
      title: 'Original Light BGM',
      createdAt,
      duration: 12
    },
    {
      id: 'demo-voice',
      type: 'audio',
      filename: 'demo-voice.wav',
      localPath: voicePath,
      sourceUrl: 'generated-demo://demo-voice',
      provider: 'local',
      license: 'Locally synthesized demo voice',
      riskLevel: 'safe',
      tags: ['voice', 'demo'],
      title: 'Demo Cat Voice',
      createdAt,
      duration: 8
    }
  ]
}

function buildDemoTimeline(fps: number): TimelineItem[] {
  const sceneFrames = [64, 58, 64, 62, 72]
  let cursor = 0
  const items: TimelineItem[] = []

  DEMO_IMAGES.forEach(([id, _filename, title], index) => {
    const durationFrames = sceneFrames[index]
    items.push({
      id: `demo-visual-${index}`,
      trackId: 'visual-main',
      assetId: id,
      type: 'visual',
      label: title,
      startFrame: cursor,
      durationFrames,
      sourceInFrame: 0,
      effects: [{ id: `demo-fx-${index}`, type: index % 2 ? 'shake' : 'zoom-in', intensity: 0.28 }],
      transform: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 }
    })
    items.push({
      id: `demo-subtitle-${index}`,
      trackId: 'subtitles',
      type: 'subtitle',
      label: `字幕 ${index + 1}`,
      startFrame: cursor,
      durationFrames,
      sourceInFrame: 0,
      effects: [],
      text: DEMO_LINES[index],
      speakerName: index % 2 === 0 ? '香蕉猫' : '哭猫',
      speakerVisible: true,
      speakerPosition: index === 2 ? 'middle' : 'top'
    })
    cursor += durationFrames
  })

  items.push({
    id: 'demo-role-a-banana',
    trackId: 'visual-role-a',
    assetId: 'demo-banana-cat',
    type: 'visual',
    label: 'Banana Cat Role',
    startFrame: 0,
    durationFrames: cursor,
    sourceInFrame: 0,
    effects: [],
    transform: { x: -270, y: 280, scale: 0.36, rotation: -4, flipX: false, flipY: false, opacity: 0.95 }
  })
  items.push({
    id: 'demo-role-b-crying',
    trackId: 'visual-role-b',
    assetId: 'demo-crying-cat',
    type: 'visual',
    label: 'Crying Cat Role',
    startFrame: sceneFrames[0] + sceneFrames[1],
    durationFrames: cursor - sceneFrames[0] - sceneFrames[1],
    sourceInFrame: 0,
    effects: [],
    transform: { x: 270, y: 280, scale: 0.36, rotation: 4, flipX: true, flipY: false, opacity: 0.95 }
  })

  items.push({
    id: 'demo-voice-item',
    trackId: 'voice',
    assetId: 'demo-voice',
    type: 'voice',
    label: 'Demo Cat Voice',
    startFrame: 0,
    durationFrames: Math.round(8 * fps),
    sourceInFrame: 0,
    effects: [],
    volume: 1
  })
  items.push({
    id: 'demo-bgm-item',
    trackId: 'music',
    assetId: 'demo-bgm',
    type: 'music',
    label: 'Original Light BGM',
    startFrame: 0,
    durationFrames: cursor,
    sourceInFrame: 0,
    effects: [],
    volume: 0.22
  })

  return items
}

function assertFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Demo asset missing: ${filePath}. Run scripts/generate-demo-assets.ps1 first.`)
  }
}

async function firstFile(dir: string, pattern: RegExp): Promise<string | null> {
  const files = await firstFiles(dir, pattern, 1)
  return files[0] || null
}

async function firstFiles(dir: string, pattern: RegExp, limit: number): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .slice(0, limit)
}
