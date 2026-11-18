import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSourceLoader } from './test-support.mjs'

const load = createSourceLoader({ electron: {}, 'node:child_process': { spawn() { throw new Error('Media processes are forbidden in these tests') } }, 'ffmpeg-static': 'unused-ffmpeg' })
const { generateScript } = load('src/main/aiService.ts')
const settings = { openAi: { apiKey: 'test-placeholder', baseUrl: 'https://example.invalid/v1', textModel: 'configured-model' } }
const request = { topic: '猫猫开会', templatePrompt: '剧本要求', seconds: 20 }

test('AI parses nested Responses output and ignores reasoning blocks without an actual network request', async () => {
  const previousFetch = globalThis.fetch
  const requests = []
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ title: '会议猫', script: '一句\n二句', subtitles: ['一句', '二句'] }) }] }
      ] }) }
    }
    const result = await generateScript(request, settings)
    assert.equal(result.title, '会议猫')
    assert.deepEqual(result.subtitles, ['一句', '二句'])
    assert.equal(requests.length, 1)
    assert.equal(requests[0].body.model, 'configured-model')
    assert.ok(requests[0].body.input.includes('20 秒'))
  } finally { globalThis.fetch = previousFetch }
})

test('Responses-unavailable services fall back to chat completions; authentication errors and empty output remain failures', async () => {
  const previousFetch = globalThis.fetch
  try {
    let calls = 0
    globalThis.fetch = async () => ++calls === 1
      ? { ok: false, status: 404 }
      : { ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"title":"猫","script":"你好","subtitles":["你好"]}\n```' } }] }) }
    assert.equal((await generateScript(request, settings)).script, '你好')
    assert.equal(calls, 2)
    calls = 0
    globalThis.fetch = async () => { calls++; return { ok: false, status: 401, text: async () => 'invalid credentials' } }
    await assert.rejects(generateScript(request, settings), /HTTP 401/)
    assert.equal(calls, 1)
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ output: [{ type: 'reasoning' }] }) })
    await assert.rejects(generateScript(request, settings), /没有返回可用/)
  } finally { globalThis.fetch = previousFetch }
})

test('audio duration reads metadata and cleans up without playback; timeout is actionable', async () => {
  const { readAudioDuration } = load('src/renderer/src/mediaMetadata.ts')
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const media = { duration: 3.25, loads: 0, load() { this.loads++ }, removeAttribute(name) { delete this[name] }, play() { throw new Error('Must never play audio') } }
  let timeout
  try {
    globalThis.document = { createElement: (tag) => { assert.equal(tag, 'audio'); return media } }
    globalThis.window = { setTimeout: (fn) => { timeout = fn; return 1 }, clearTimeout() {}, catMeme: { toFileUrl: () => 'file:///fixture.mp3' } }
    const duration = readAudioDuration({ localPath: 'fixture.mp3' })
    media.onloadedmetadata()
    assert.equal(await duration, 3.25)
    assert.equal(media.src, undefined)
    assert.equal(media.onloadedmetadata, null)
    assert.equal(media.loads, 2)
    const missing = readAudioDuration({ localPath: 'fixture.mp3' })
    timeout()
    await assert.rejects(missing, /配音已生成并保留在素材库/)
    assert.equal(await readAudioDuration({ duration: 1.25 }), 1.25)
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow
  }
})
