import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { pathToFileURL } from 'node:url'
import type {
  AiScriptRequest,
  AiTtsRequest,
  AppSettings,
  Asset,
  AssetSearchRequest,
  AssetSearchResponse,
  CatMemeTemplate,
  DownloadAssetRequest,
  ExportPreset,
  GreenScreenPreprocessProgress,
  GreenScreenPreprocessRequest,
  GreenScreenPreprocessResult,
  ProjectFile,
  RenderRequest,
  RenderResult,
  WorkspaceInfo
} from '../shared/types'

const api = {
  workspaceInfo: (): Promise<WorkspaceInfo> => ipcRenderer.invoke('workspace.info'),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings.get'),
  saveSettings: (settings: AppSettings): Promise<AppSettings> => ipcRenderer.invoke('settings.save', settings),
  newProject: (): Promise<ProjectFile> => ipcRenderer.invoke('project.new'),
  saveProject: (project: ProjectFile): Promise<{ project: ProjectFile; filePath: string }> =>
    ipcRenderer.invoke('project.save', project),
  loadProject: (): Promise<{ project: ProjectFile; filePath: string } | null> => ipcRenderer.invoke('project.load'),
  listAssets: (): Promise<Asset[]> => ipcRenderer.invoke('asset.list'),
  searchAssets: (request: AssetSearchRequest): Promise<AssetSearchResponse> => ipcRenderer.invoke('asset.search', request),
  downloadAsset: (request: DownloadAssetRequest): Promise<Asset> => ipcRenderer.invoke('asset.download', request),
  importLocalAssets: (): Promise<Asset[]> => ipcRenderer.invoke('asset.importLocal'),
  preprocessGreenScreen: (request: GreenScreenPreprocessRequest): Promise<GreenScreenPreprocessResult> =>
    ipcRenderer.invoke('asset.preprocessGreenScreen', request),
  onGreenScreenPreprocessProgress: (callback: (progress: GreenScreenPreprocessProgress) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, progress: GreenScreenPreprocessProgress): void => callback(progress)
    ipcRenderer.on('asset.preprocessGreenScreenProgress', listener)
    return () => ipcRenderer.removeListener('asset.preprocessGreenScreenProgress', listener)
  },
  generateScript: (request: AiScriptRequest) => ipcRenderer.invoke('ai.generateScript', request),
  tts: (request: AiTtsRequest): Promise<Asset> => ipcRenderer.invoke('ai.tts', request),
  renderPreview: (request: RenderRequest): Promise<RenderResult> => ipcRenderer.invoke('render.preview', request),
  renderExport: (request: RenderRequest): Promise<RenderResult> => ipcRenderer.invoke('render.export', request),
  selectExportDir: (defaultPath?: string): Promise<string | null> => ipcRenderer.invoke('dialog.selectExportDir', defaultPath),
  selectExportPath: (defaultPath?: string): Promise<string | null> => ipcRenderer.invoke('dialog.selectExportPath', defaultPath),
  listTemplates: (): Promise<CatMemeTemplate[]> => ipcRenderer.invoke('templates.list'),
  listPresets: (): Promise<ExportPreset[]> => ipcRenderer.invoke('presets.list'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell.openExternal', url),
  showItem: (filePath: string): Promise<void> => ipcRenderer.invoke('shell.showItem', filePath),
  openPath: (filePath: string): Promise<string> => ipcRenderer.invoke('shell.openPath', filePath),
  toFileUrl: (filePath: string): string => pathToFileURL(filePath).toString()
}

contextBridge.exposeInMainWorld('catMeme', api)

export type CatMemeApi = typeof api
