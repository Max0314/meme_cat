import { app } from 'electron'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { AppSettings, WorkspaceInfo } from '../shared/types'

export function resolveWorkspaceRoot(): string {
  if (process.env.CAT_MEME_HOME) {
    return path.resolve(process.env.CAT_MEME_HOME)
  }

  if (!app.isPackaged) {
    return path.resolve(__dirname, '../..')
  }

  return path.join(app.getPath('documents'), 'cat_meme')
}

export function getWorkspaceInfo(root = resolveWorkspaceRoot()): WorkspaceInfo {
  return {
    root,
    assetsDir: path.join(root, 'assets'),
    projectsDir: path.join(root, 'projects'),
    outputDir: path.join(root, 'output'),
    dataDir: path.join(root, 'data'),
    templatesDir: path.join(root, 'templates')
  }
}

export async function ensureWorkspace(): Promise<WorkspaceInfo> {
  const info = getWorkspaceInfo()
  await Promise.all([
    mkdir(info.assetsDir, { recursive: true }),
    mkdir(path.join(info.assetsDir, 'cats'), { recursive: true }),
    mkdir(path.join(info.assetsDir, 'videos'), { recursive: true }),
    mkdir(path.join(info.assetsDir, 'gifs'), { recursive: true }),
    mkdir(path.join(info.assetsDir, 'music'), { recursive: true }),
    mkdir(path.join(info.assetsDir, 'sfx'), { recursive: true }),
    mkdir(path.join(info.assetsDir, 'tts'), { recursive: true }),
    mkdir(info.projectsDir, { recursive: true }),
    mkdir(info.outputDir, { recursive: true }),
    mkdir(info.dataDir, { recursive: true }),
    mkdir(info.templatesDir, { recursive: true })
  ])
  return info
}

export function settingsPath(info = getWorkspaceInfo()): string {
  return path.join(info.dataDir, 'settings.json')
}

export function assetIndexPath(info = getWorkspaceInfo()): string {
  return path.join(info.dataDir, 'assets.index.json')
}

export function assetLibrariesPath(info = getWorkspaceInfo()): string {
  return path.join(info.dataDir, 'asset-libraries.json')
}

export function externalAssetIndexPath(info = getWorkspaceInfo()): string {
  return path.join(info.dataDir, 'external-assets.index.json')
}

export function defaultSettings(info = getWorkspaceInfo()): AppSettings {
  return {
    workspaceRoot: info.root,
    appearance: 'light',
    defaultPresetId: 'douyin-1080p',
    defaultExportDir: info.outputDir,
    openAi: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      textModel: 'gpt-5.2',
      ttsModel: 'gpt-4o-mini-tts',
      ttsVoice: 'coral'
    },
    providers: {
      pexelsApiKey: '',
      pixabayApiKey: '',
      imgflipUsername: '',
      imgflipPassword: ''
    }
  }
}

export function projectPath(projectTitle: string, info = getWorkspaceInfo()): string {
  const safeName = projectTitle.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'untitled'
  return path.join(info.projectsDir, `${safeName}.catmeme.json`)
}
