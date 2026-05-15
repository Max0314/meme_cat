import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { join } from 'node:path'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { AppSettings, AssetMetadataPatch, CharacterRole, GreenScreenPreprocessProgress, ProjectFile, RenderProgress, TimelineTrack } from '../shared/types'
import { CAT_MEME_TEMPLATES } from '../shared/templates'
import { EXPORT_PRESETS } from '../shared/presets'
import {
  cleanupGreenScreenCache,
  downloadAsset,
  getAssetWaveform,
  importLocalAsset,
  loadAssetIndex,
  preprocessGreenScreenAssets,
  searchAssets,
  updateAssetMetadata
} from './assetService'
import { generateScript, synthesizeTts } from './aiService'
import { readJson, writeJson } from './jsonStore'
import { renderProject } from './renderService'
import { defaultSettings, ensureWorkspace, projectPath, settingsPath } from './workspace'
import { exportDemoVideo, exportResourceDemoVideo } from './demoProject'

let mainWindow: BrowserWindow | null = null
let settings: AppSettings

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f4f6f9',
    title: 'Cat Meme Studio',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f4f6f9',
      symbolColor: '#17202e',
      height: 42
    },
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('workspace.info', async () => ensureWorkspace())

  ipcMain.handle('settings.get', async () => settings)
  ipcMain.handle('settings.save', async (_event, nextSettings: AppSettings) => {
    settings = { ...nextSettings }
    await writeJson(settingsPath(), settings)
    return settings
  })

  ipcMain.handle('project.new', async () => createDefaultProject())
  ipcMain.handle('project.save', async (_event, project: ProjectFile) => {
    const info = await ensureWorkspace()
    const nextProject = { ...project, updatedAt: new Date().toISOString(), workspaceRoot: info.root }
    const filePath = projectPath(nextProject.title, info)
    await writeJson(filePath, nextProject)
    return { project: nextProject, filePath }
  })
  ipcMain.handle('project.load', async () => {
    const info = await ensureWorkspace()
    const dialogOptions: OpenDialogOptions = {
      title: '打开猫 meme 工程',
      defaultPath: info.projectsDir,
      filters: [{ name: 'Cat Meme Project', extensions: ['catmeme.json', 'json'] }],
      properties: ['openFile']
    }
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, dialogOptions) : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || !result.filePaths[0]) return null
    const project = await readJson<ProjectFile | null>(result.filePaths[0], null)
    return project ? { project, filePath: result.filePaths[0] } : null
  })

  ipcMain.handle('asset.list', async () => {
    const info = await ensureWorkspace()
    return loadAssetIndex(info)
  })
  ipcMain.handle('asset.search', async (_event, request) => searchAssets(request, settings))
  ipcMain.handle('asset.download', async (_event, request) => {
    const info = await ensureWorkspace()
    return downloadAsset(info, request)
  })
  ipcMain.handle('asset.importLocal', async () => {
    const dialogOptions: OpenDialogOptions = {
      title: '导入本地素材',
      filters: [
        { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'aac'] }
      ],
      properties: ['openFile', 'multiSelections']
    }
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, dialogOptions) : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled) return []
    const info = await ensureWorkspace()
    const imported = []
    for (const filePath of result.filePaths) {
      imported.push(await importLocalAsset(info, filePath))
    }
    return imported
  })
  ipcMain.handle('asset.update', async (_event, assetId: string, patch: AssetMetadataPatch) => {
    const info = await ensureWorkspace()
    return updateAssetMetadata(info, assetId, patch)
  })
  ipcMain.handle('asset.waveform', async (_event, assetId: string) => {
    const info = await ensureWorkspace()
    return getAssetWaveform(info, assetId)
  })
  ipcMain.handle('asset.cleanupGreenScreenCache', async () => {
    const info = await ensureWorkspace()
    return cleanupGreenScreenCache(info)
  })
  ipcMain.handle('asset.preprocessGreenScreen', async (_event, request) => {
    const info = await ensureWorkspace()
    return preprocessGreenScreenAssets(info, request, (progress: GreenScreenPreprocessProgress) => {
      mainWindow?.webContents.send('asset.preprocessGreenScreenProgress', progress)
    })
  })

  ipcMain.handle('ai.generateScript', async (_event, request) => generateScript(request, settings))
  ipcMain.handle('ai.tts', async (_event, request) => {
    const info = await ensureWorkspace()
    return synthesizeTts(info, request, settings)
  })

  ipcMain.handle('render.preview', async (_event, request) => {
    const info = await ensureWorkspace()
    return renderProject(info, { ...request, mode: 'preview' }, (progress: RenderProgress) => {
      mainWindow?.webContents.send('render.progress', progress)
    })
  })
  ipcMain.handle('render.export', async (_event, request) => {
    const info = await ensureWorkspace()
    return renderProject(info, { ...request, mode: 'export' }, (progress: RenderProgress) => {
      mainWindow?.webContents.send('render.progress', progress)
    })
  })
  ipcMain.handle('render.cover', async (_event, request) => {
    const info = await ensureWorkspace()
    return renderProject(info, { ...request, mode: 'cover' }, (progress: RenderProgress) => {
      mainWindow?.webContents.send('render.progress', progress)
    })
  })

  ipcMain.handle('dialog.selectExportDir', async (_event, defaultPath?: string) => {
    const info = await ensureWorkspace()
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          title: '选择导出目录',
          defaultPath: defaultPath || settings.defaultExportDir || info.outputDir,
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          title: '选择导出目录',
          defaultPath: defaultPath || settings.defaultExportDir || info.outputDir,
          properties: ['openDirectory', 'createDirectory']
        })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog.selectExportPath', async (_event, defaultPath?: string) => {
    const info = await ensureWorkspace()
    const fallbackName = `cat-meme-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, {
          title: '另存为 MP4',
          defaultPath: defaultPath || path.join(settings.defaultExportDir || info.outputDir, fallbackName),
          filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
        })
      : await dialog.showSaveDialog({
          title: '另存为 MP4',
          defaultPath: defaultPath || path.join(settings.defaultExportDir || info.outputDir, fallbackName),
          filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
        })
    if (result.canceled || !result.filePath) return null
    return result.filePath.toLowerCase().endsWith('.mp4') ? result.filePath : `${result.filePath}.mp4`
  })

  ipcMain.handle('shell.openExternal', async (_event, url: string) => {
    const parsed = new URL(url)
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      throw new Error('不允许打开此类外部链接')
    }
    return shell.openExternal(parsed.toString())
  })
  ipcMain.handle('shell.showItem', async (_event, filePath: string) => {
    const safePath = await resolveSafeUserPath(filePath)
    return shell.showItemInFolder(safePath)
  })
  ipcMain.handle('shell.openPath', async (_event, filePath: string) => {
    const safePath = await resolveSafeUserPath(filePath)
    return shell.openPath(safePath)
  })

  ipcMain.handle('templates.list', async () => CAT_MEME_TEMPLATES)
  ipcMain.handle('presets.list', async () => EXPORT_PRESETS)
}

async function resolveSafeUserPath(filePath: string): Promise<string> {
  const info = await ensureWorkspace()
  const resolved = path.resolve(filePath || '')
  const roots = [
    info.root,
    settings?.defaultExportDir,
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('videos')
  ].filter((value): value is string => Boolean(value))
  if (!roots.some((root) => isPathInside(resolved, path.resolve(root)))) {
    throw new Error('不允许打开工作区之外的路径')
  }
  return resolved
}

function isPathInside(filePath: string, root: string): boolean {
  const relative = path.relative(root, filePath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function createDefaultProject(): Promise<ProjectFile> {
  const info = await ensureWorkspace()
  const now = new Date().toISOString()
  return {
    version: 1,
    id: crypto.randomUUID(),
    title: `猫猫短视频-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}`,
    workspaceRoot: info.root,
    createdAt: now,
    updatedAt: now,
    exportPresetId: settings?.defaultPresetId || 'douyin-1080p',
    durationSeconds: 30,
    tracks: defaultTracks(),
    timeline: [],
    assets: await loadAssetIndex(info),
    roles: defaultRoles(),
    script: '猫猫盯着我看了三秒\n我以为它终于懂我了\n结果它只是想让我让座\n因为我的椅子比较暖',
    subtitleStyle: CAT_MEME_TEMPLATES[0].subtitleStyle,
    aiRecords: []
  }
}

function defaultRoles(): CharacterRole[] {
  return [
    {
      id: 'role-you',
      name: '你',
      title: '渡劫期',
      color: '#facc15',
      defaultTrackId: 'visual-role-a',
      defaultTransform: { x: -280, y: 260, scale: 0.44, rotation: 0, flipX: false, flipY: false, opacity: 1 },
      memeAssetIds: [],
      memeStates: starterMemeStates(['质问', '震惊'], ['听八卦', '对话']),
      memeKeywords: ['质问', '听八卦', '震惊', '你'],
      commonLines: ['那你把你全家人都叫过来一趟', '这事儿合理吗', '我现在很冷静'],
      speakerPosition: 'bottom',
      subtitlePosition: 'top'
    },
    {
      id: 'role-banana',
      name: '香蕉猫',
      title: '练气期',
      color: '#f59e0b',
      defaultTrackId: 'visual-role-b',
      defaultTransform: { x: 250, y: 275, scale: 0.38, rotation: 0, flipX: false, flipY: false, opacity: 1 },
      memeAssetIds: [],
      memeStates: starterMemeStates(['香蕉猫', '哭泣'], ['香蕉猫', '震惊']),
      memeKeywords: ['香蕉猫', '哭泣', '大叫', '震惊'],
      commonLines: ['我真的受不了了', '为什么又是我', '先别急，让我哭完'],
      speakerPosition: 'bottom',
      subtitlePosition: 'top'
    },
    {
      id: 'role-little-sister',
      name: '小师妹',
      title: '筑基期',
      color: '#ec4899',
      defaultTrackId: 'visual-props',
      defaultTransform: { x: 0, y: 285, scale: 0.34, rotation: 0, flipX: false, flipY: false, opacity: 1 },
      memeAssetIds: [],
      memeStates: starterMemeStates(['委屈', '害羞'], ['可爱', '小猫']),
      memeKeywords: ['委屈', '害羞', '可爱', '小猫'],
      commonLines: ['师兄你冷静一点', '我只是路过', '完了，气氛不对'],
      speakerPosition: 'bottom',
      subtitlePosition: 'top'
    }
  ]
}

function starterMemeStates(defaultKeywords: string[], reactionKeywords: string[]) {
  return [
    { id: crypto.randomUUID(), name: '默认', keywords: defaultKeywords },
    { id: crypto.randomUUID(), name: '反应', keywords: reactionKeywords }
  ]
}

function defaultTracks(): TimelineTrack[] {
  return [
    { id: 'visual-main', name: '背景画面', kind: 'visual', groupId: 'background', locked: false, muted: false },
    { id: 'visual-role-a', name: '角色 1', kind: 'visual', groupId: 'role', locked: false, muted: false },
    { id: 'visual-role-b', name: '角色 2', kind: 'visual', groupId: 'role', locked: false, muted: false },
    { id: 'visual-props', name: '贴纸/特效', kind: 'visual', groupId: 'effect', locked: false, muted: false },
    { id: 'subtitles', name: '字幕', kind: 'subtitle', groupId: 'subtitle', locked: false, muted: false },
    { id: 'voice', name: '配音', kind: 'voice', groupId: 'sfx', locked: false, muted: false },
    { id: 'music', name: 'BGM', kind: 'music', groupId: 'bgm', locked: false, muted: false },
    { id: 'sfx', name: '音效', kind: 'sfx', groupId: 'sfx', locked: false, muted: false }
  ]
}

app.whenReady().then(async () => {
  const info = await ensureWorkspace()
  settings = { ...defaultSettings(info), ...(await readJson(settingsPath(info), defaultSettings(info))) }
  await writeJson(settingsPath(info), settings)

  if (process.argv.includes('--export-demo')) {
    try {
      const outputPath = await exportDemoVideo(info)
      console.log(`Demo video exported: ${outputPath}`)
      app.quit()
    } catch (error) {
      console.error(error)
      app.exit(1)
    }
    return
  }

  if (process.argv.includes('--export-resource-demo')) {
    try {
      const outputPath = await exportResourceDemoVideo(info)
      console.log(`Resource demo video exported: ${outputPath}`)
      app.quit()
    } catch (error) {
      console.error(error)
      app.exit(1)
    }
    return
  }

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
