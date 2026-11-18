import { useMemo } from 'react'
import type { Asset, CatMemeTemplate } from '../../shared/types'

export interface ScriptDraft {
  projectId: string
  session: number
  title: string
  script: string
  prompt: string
}

export interface AssistantState {
  tab: 'script' | 'voice' | 'templates'
  topic: string
  seconds: number
  templateId: string
  draft: ScriptDraft | null
  voiceText: string
  voice: string
  assetQuery: string
  assetIds: string[]
}

export function AssistantPanel({ state, onChange, templates, assets, script, configured, voicePlaceholder, busy, canApplyDraft, onSettings, onGenerate, onApplyDraft, onEditScript, onVoice, onTemplate }: {
  state: AssistantState
  onChange: (patch: Partial<AssistantState>) => void
  templates: CatMemeTemplate[]
  assets: Asset[]
  script: string
  configured: boolean
  voicePlaceholder: string
  busy: 'script' | 'voice' | 'template' | null
  canApplyDraft: boolean
  onSettings: () => void
  onGenerate: () => Promise<void>
  onApplyDraft: () => void
  onEditScript: (text: string) => void
  onVoice: () => Promise<void>
  onTemplate: (template: CatMemeTemplate) => Promise<void>
}): JSX.Element {
  const selectedTemplate = templates.find((template) => template.id === state.templateId) || templates[0]
  const matchingAssets = useMemo(() => {
    const query = state.assetQuery.trim().toLowerCase()
    return assets.filter((asset) => ['image', 'video', 'gif'].includes(asset.type) && (!asset.availability || asset.availability === 'available') &&
      (!query || `${asset.title || ''} ${asset.filename} ${asset.tags.join(' ')}`.toLowerCase().includes(query)))
  }, [assets, state.assetQuery])
  return (
    <div className="assistant-panel">
      <div className="segmented assistant-tabs" role="tablist" aria-label="AI 与模板工具">
        {([{ id: 'script', name: '脚本' }, { id: 'voice', name: '配音' }, { id: 'templates', name: '模板' }] as const).map((tab) => (
          <button type="button" role="tab" aria-selected={state.tab === tab.id} className={state.tab === tab.id ? 'active' : ''} key={tab.id} onClick={() => onChange({ tab: tab.id })}>{tab.name}</button>
        ))}
      </div>
      {!configured && state.tab !== 'templates' && <div className="warning">先填写 OpenAI 兼容服务的 API Key。<button className="mini-link" type="button" onClick={onSettings}>打开设置</button></div>}
      {state.tab === 'script' && (
        <>
          <label className="field"><span>故事主题</span><input value={state.topic} onChange={(event) => onChange({ topic: event.target.value })} placeholder="例如：猫猫第一次参加周会" /></label>
          <div className="two-buttons">
            <label className="field"><span>脚本风格</span><select value={selectedTemplate?.id || ''} onChange={(event) => onChange({ templateId: event.target.value })}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
            <label className="field"><span>目标秒数</span><input type="number" min={3} max={180} value={state.seconds} onChange={(event) => onChange({ seconds: Math.max(3, Math.min(180, Number(event.target.value) || 3)) })} /></label>
          </div>
          <button type="button" className="command primary wide" disabled={Boolean(busy) || !configured || !state.topic.trim() || !selectedTemplate} onClick={() => void onGenerate()}>{busy === 'script' ? '正在生成草稿…' : state.draft ? '重新生成草稿' : '生成脚本草稿'}</button>
          {state.draft && <section className="assistant-section">
            <strong>AI 草稿</strong>
            <label className="field"><span>草稿标题</span><input value={state.draft.title} onChange={(event) => onChange({ draft: { ...state.draft!, title: event.target.value } })} /></label>
            <label className="field"><span>每行一句台词</span><textarea value={state.draft.script} onChange={(event) => onChange({ draft: { ...state.draft!, script: event.target.value } })} /></label>
            {!canApplyDraft && <p className="warning">这是上一工程的草稿，可以复制文字；当前工程不应用此草稿。</p>}
            <button className="command wide" type="button" disabled={Boolean(busy) || !canApplyDraft || !state.draft.script.trim()} onClick={onApplyDraft}>应用草稿到工程</button>
            <small>应用后随工程保存，已有时间线保留，可撤销。未应用的草稿只保留在本次会话中。</small>
          </section>}
          <section className="assistant-section">
            <strong>工程脚本</strong>
            <textarea aria-label="工程脚本" value={script} placeholder="每行一句台词，也可以直接手动编写" onChange={(event) => onEditScript(event.target.value)} />
            <button type="button" className="mini-link" disabled={!script.trim()} onClick={() => onChange({ tab: 'voice', voiceText: script })}>用工程脚本配音 →</button>
          </section>
        </>
      )}
      {state.tab === 'voice' && (
        <>
          <div className="two-buttons">
            <button type="button" className="command" disabled={!script.trim()} onClick={() => onChange({ voiceText: script })}>填入工程脚本</button>
            <button type="button" className="command" disabled={!state.draft?.script.trim()} onClick={() => onChange({ voiceText: state.draft!.script })}>填入 AI 草稿</button>
          </div>
          <label className="field"><span>配音文本</span><textarea value={state.voiceText} onChange={(event) => onChange({ voiceText: event.target.value })} placeholder="输入或填入要朗读的文字" /></label>
          <label className="field"><span>声音（留空使用设置）</span><input value={state.voice} placeholder={voicePlaceholder} onChange={(event) => onChange({ voice: event.target.value })} /></label>
          <button type="button" className="command primary wide" disabled={Boolean(busy) || !configured || !state.voiceText.trim()} onClick={() => void onVoice()}>{busy === 'voice' ? '正在生成配音…' : '生成并添加配音'}</button>
          <p className="small-note">从当前播放头添加到可编辑的配音轨道，保留已有配音。工程切换后，生成文件仍保存在素材库。</p>
        </>
      )}
      {state.tab === 'templates' && (
        <>
          <label className="field"><span>选择分镜模板</span><select value={selectedTemplate?.id || ''} onChange={(event) => onChange({ templateId: event.target.value })}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          {selectedTemplate && <div className="template-card"><strong>{selectedTemplate.name}</strong><p>{selectedTemplate.description}</p><small>{selectedTemplate.defaultSceneSeconds.length} 个镜头 · {selectedTemplate.defaultSceneSeconds.reduce((sum, seconds) => sum + seconds, 0).toFixed(1)} 秒</small></div>}
          <label className="field"><span>查找分镜素材</span><input value={state.assetQuery} onChange={(event) => onChange({ assetQuery: event.target.value })} placeholder="名称或标签" /></label>
          <div className="assistant-asset-list" aria-label="模板素材">
            {matchingAssets.slice(0, 60).map((asset) => <label key={asset.id}><input type="checkbox" checked={state.assetIds.includes(asset.id)} onChange={(event) => onChange({ assetIds: event.target.checked ? [...state.assetIds, asset.id] : state.assetIds.filter((id) => id !== asset.id) })} /><span title={asset.localPath}>{asset.title || asset.filename}</span></label>)}
            {!matchingAssets.length && <p className="empty-state">没有可用画面素材，请先导入或挂载素材库。</p>}
          </div>
          <small>已选 {state.assetIds.length} 个，按选择顺序循环使用。{matchingAssets.length > 60 ? '仅显示前 60 个匹配项，请输入关键词缩小范围。' : ''}</small>
          <button type="button" className="command primary wide" disabled={Boolean(busy) || !selectedTemplate || !state.assetIds.length} onClick={() => selectedTemplate && void onTemplate(selectedTemplate)}>{busy === 'template' ? '正在准备素材…' : '在播放头插入分镜'}</button>
          <p className="small-note">画面和字幕加入新轨道，现有片段保留。字幕按工程脚本逐行取用；外部素材先复制到工作区。可整体撤销。</p>
        </>
      )}
    </div>
  )
}
