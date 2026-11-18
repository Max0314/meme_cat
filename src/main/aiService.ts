import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AiScriptRequest, AiScriptResponse, AiTtsRequest, AppSettings, Asset, WorkspaceInfo } from '../shared/types'
import { updateAssetIndex, withFileUrl } from './assetService'

export async function generateScript(request: AiScriptRequest, settings: AppSettings): Promise<AiScriptResponse> {
  assertOpenAiReady(settings)
  const prompt = [
    request.templatePrompt,
    '',
    `主题：${request.topic || '猫猫日常发疯'}`,
    `目标时长：${request.seconds} 秒`,
    '请只输出 JSON：{"title":"...","script":"...","subtitles":["..."]}。不要输出 Markdown。'
  ].join('\n')

  const raw = await callOpenAiText(prompt, settings)
  return parseScriptResponse(raw)
}

export async function synthesizeTts(
  info: WorkspaceInfo,
  request: AiTtsRequest,
  settings: AppSettings
): Promise<Asset> {
  assertOpenAiReady(settings)
  const baseUrl = normalizeBaseUrl(settings.openAi.baseUrl)
  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${settings.openAi.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.openAi.ttsModel,
      voice: request.voice || settings.openAi.ttsVoice,
      input: request.text,
      instructions: '中文短视频猫 meme 旁白，语气夸张、节奏快、带一点吐槽感。',
      response_format: 'mp3'
    })
  })

  if (!response.ok) {
    throw new Error(`TTS 生成失败：HTTP ${response.status} ${await safeText(response)}`)
  }

  const dir = path.join(info.assetsDir, 'tts')
  await mkdir(dir, { recursive: true })
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-cat-voice.mp3`
  const localPath = path.join(dir, filename)
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()))

  const asset: Asset = {
    id: crypto.randomUUID(),
    type: 'audio',
    filename,
    localPath,
    sourceUrl: 'openai-compatible-tts',
    provider: 'ai',
    license: 'AI-generated voice; disclose AI voice use where required',
    riskLevel: 'medium',
    tags: ['tts', 'voice', 'ai'],
    title: 'AI 猫 meme 配音',
    createdAt: new Date().toISOString(),
    fileUrl: pathToFileURL(localPath).toString()
  }

  await updateAssetIndex(info, (assets) => [asset, ...assets])
  return withFileUrl(asset)
}

async function callOpenAiText(prompt: string, settings: AppSettings): Promise<string> {
  const baseUrl = normalizeBaseUrl(settings.openAi.baseUrl)
  const responsesBody = {
    model: settings.openAi.textModel,
    input: prompt,
    instructions: '你是中文短视频编剧，擅长猫 meme、吐槽、反转和适合字幕呈现的短句。'
  }

  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${settings.openAi.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(responsesBody)
  })

  if (response.ok) {
    const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
    if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text
    const text = (Array.isArray(data.output) ? data.output : [])
      .flatMap((message) => Array.isArray(message.content) ? message.content : [])
      .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
    if (!text.trim()) throw new Error('AI 服务没有返回可用的脚本文本')
    return text
  }

  if (response.status !== 404 && response.status !== 400) {
    throw new Error(`AI 生成失败：HTTP ${response.status} ${await safeText(response)}`)
  }

  const chatResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${settings.openAi.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.openAi.textModel,
      messages: [
        {
          role: 'system',
          content: '你是中文短视频编剧，擅长猫 meme、吐槽、反转和适合字幕呈现的短句。'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    })
  })

  if (!chatResponse.ok) {
    throw new Error(`AI 生成失败：HTTP ${chatResponse.status} ${await safeText(chatResponse)}`)
  }

  const data = (await chatResponse.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

function parseScriptResponse(raw: string): AiScriptResponse {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Partial<AiScriptResponse>
    const subtitles = Array.isArray(parsed.subtitles) ? parsed.subtitles.map(String).filter(Boolean) : []
    return {
      title: String(parsed.title || '猫猫今天又想通了'),
      script: String(parsed.script || subtitles.join('\n')),
      subtitles: subtitles.length ? subtitles : String(parsed.script || '').split(/\n+/).filter(Boolean)
    }
  } catch {
    const lines = trimmed
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.、\s]+/, '').trim())
      .filter(Boolean)
    return {
      title: lines[0] || '猫猫今天又想通了',
      script: lines.join('\n'),
      subtitles: lines.slice(1)
    }
  }
}

function normalizeBaseUrl(url: string): string {
  return (url || 'https://api.openai.com/v1').replace(/\/+$/, '')
}

function assertOpenAiReady(settings: AppSettings): void {
  if (!settings.openAi.apiKey) {
    throw new Error('请先在设置页填写 OpenAI 兼容 API key。')
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
