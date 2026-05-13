export type AssetProvider =
  | 'local'
  | 'pexels'
  | 'pixabay'
  | 'openverse'
  | 'wikimedia'
  | 'imgflip'
  | 'giphy'
  | 'knowyourmeme'
  | 'ai'

export type AssetType = 'image' | 'video' | 'audio' | 'gif' | 'font'

export type RiskLevel = 'safe' | 'medium' | 'high'

export interface AssetProcessedVariant {
  kind: 'green-alpha'
  format: 'webm' | 'png'
  localPath: string
  sourceMtimeMs?: number
  sourceSize?: number
  keying: Partial<VisualKeying>
  createdAt: string
  width?: number
  height?: number
  duration?: number
  fileUrl?: string
}

export interface Asset {
  id: string
  type: AssetType
  filename: string
  localPath: string
  sourceUrl: string
  provider: AssetProvider
  license: string
  riskLevel: RiskLevel
  tags: string[]
  title?: string
  author?: string
  duration?: number
  width?: number
  height?: number
  createdAt: string
  fileUrl?: string
  processedVariants?: AssetProcessedVariant[]
}

export interface RemoteAssetResult {
  id: string
  type: AssetType
  provider: AssetProvider
  title: string
  sourceUrl: string
  license: string
  riskLevel: RiskLevel
  tags: string[]
  thumbnailUrl?: string
  previewUrl?: string
  downloadUrl?: string
  author?: string
  width?: number
  height?: number
  duration?: number
  canAutoDownload: boolean
  note?: string
}

export interface AssetSearchRequest {
  query: string
  providers: AssetProvider[]
  type: 'image' | 'video' | 'audio' | 'gif' | 'all'
  limit: number
}

export interface AssetSearchResponse {
  results: RemoteAssetResult[]
  warnings: string[]
}

export interface DownloadAssetRequest {
  result: RemoteAssetResult
}

export interface GreenScreenPreprocessRequest {
  assetIds: string[]
  force?: boolean
  keying?: Partial<VisualKeying>
}

export interface GreenScreenPreprocessProgress {
  total: number
  current: number
  success: number
  skipped: number
  failed: number
  status: 'processing' | 'done' | 'skipped' | 'failed'
  assetId?: string
  filename?: string
  message?: string
}

export interface GreenScreenPreprocessResult {
  assets: Asset[]
  success: number
  skipped: number
  failed: number
  errors: Array<{ assetId: string; filename: string; message: string }>
}

export type TrackKind = 'visual' | 'subtitle' | 'voice' | 'music' | 'sfx'
export type TrackGroupId = 'background' | 'role' | 'effect' | 'subtitle' | 'bgm' | 'sfx'

export interface TimelineTrack {
  id: string
  name: string
  kind: TrackKind
  groupId?: TrackGroupId
  locked: boolean
  muted: boolean
}

export interface TimelineEffect {
  id: string
  type: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'shake' | 'flash' | 'none'
  intensity: number
}

export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  color: string
  outlineColor: string
  outlineWidth: number
  position: 'top' | 'middle' | 'bottom'
  background: boolean
  backgroundColor: string
}

export interface VisualTransform {
  x: number
  y: number
  scale: number
  rotation: number
  flipX: boolean
  flipY: boolean
  opacity: number
}

export interface VisualKeyframe {
  id: string
  frame: number
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  effectIntensity?: number
}

export interface VisualKeying {
  enabled: boolean
  color: string
  similarity: number
  blend: number
}

export interface RoleLabel {
  text?: string
  visible?: boolean
  style?: Partial<SubtitleStyle>
}

export interface CharacterMemeState {
  id: string
  name: string
  assetId?: string
  keywords: string[]
  line?: string
}

export interface CharacterRole {
  id: string
  name: string
  title: string
  color: string
  defaultTrackId?: string
  defaultTransform: Partial<VisualTransform>
  memeAssetIds: string[]
  memeStates?: CharacterMemeState[]
  memeKeywords: string[]
  commonLines: string[]
  speakerPosition: 'top' | 'middle' | 'bottom'
  subtitlePosition: 'top' | 'middle' | 'bottom'
}

export interface TimelineItem {
  id: string
  trackId: string
  assetId?: string
  roleId?: string
  type: TrackKind
  label: string
  startFrame: number
  durationFrames: number
  sourceInFrame: number
  playbackRate?: number
  effects: TimelineEffect[]
  volume?: number
  loop?: boolean
  text?: string
  speakerName?: string
  speakerVisible?: boolean
  speakerPosition?: 'top' | 'middle' | 'bottom'
  style?: Partial<SubtitleStyle>
  roleLabel?: RoleLabel
  transform?: Partial<VisualTransform>
  keyframes?: VisualKeyframe[]
  keying?: Partial<VisualKeying>
}

export interface ExportPreset {
  id: string
  name: string
  platform: 'douyin' | 'kuaishou' | 'xiaohongshu' | 'bilibili' | 'custom'
  width: number
  height: number
  fps: number
  videoBitrate: string
  audioBitrate: string
  coverFrame: number
}

export interface AiGenerationRecord {
  id: string
  kind: 'script' | 'title' | 'tts'
  prompt: string
  outputPath?: string
  outputText?: string
  createdAt: string
}

export interface ProjectFile {
  version: 1
  id: string
  title: string
  workspaceRoot: string
  createdAt: string
  updatedAt: string
  exportPresetId: string
  customExportPreset?: ExportPreset
  durationSeconds?: number
  tracks: TimelineTrack[]
  timeline: TimelineItem[]
  assets: Asset[]
  roles?: CharacterRole[]
  script: string
  subtitleStyle: SubtitleStyle
  aiRecords: AiGenerationRecord[]
}

export interface OpenAiSettings {
  baseUrl: string
  apiKey: string
  textModel: string
  ttsModel: string
  ttsVoice: string
}

export interface ProviderSettings {
  pexelsApiKey: string
  pixabayApiKey: string
  imgflipUsername: string
  imgflipPassword: string
}

export interface AppSettings {
  workspaceRoot: string
  openAi: OpenAiSettings
  providers: ProviderSettings
  defaultPresetId: string
  defaultExportDir?: string
}

export interface CatMemeTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  defaultSceneSeconds: number[]
  subtitleStyle: SubtitleStyle
  effects: TimelineEffect[]
  prompt: string
}

export interface RenderRequest {
  project: ProjectFile
  preset: ExportPreset
  mode: 'preview' | 'export'
  outputDir?: string
  outputPath?: string
}

export interface RenderResult {
  outputPath: string
  fileUrl: string
  durationSeconds: number
  preset: ExportPreset
}

export type RenderProgressStage = 'preparing' | 'building-filters' | 'encoding' | 'done' | 'failed'

export interface RenderProgress {
  mode: RenderRequest['mode']
  stage: RenderProgressStage
  message: string
  percent: number
  outputPath?: string
  error?: string
}

export interface AiScriptRequest {
  topic: string
  templatePrompt: string
  seconds: number
}

export interface AiScriptResponse {
  title: string
  script: string
  subtitles: string[]
}

export interface AiTtsRequest {
  text: string
  voice?: string
}

export interface WorkspaceInfo {
  root: string
  assetsDir: string
  projectsDir: string
  outputDir: string
  dataDir: string
  templatesDir: string
}
