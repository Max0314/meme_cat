import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const pendingTransactions = new Map<string, Promise<unknown>>()
const pendingWrites = new Map<string, Promise<unknown>>()

// Serialize the whole read/modify/write operation, not only its final write.
export async function withJsonTransaction<T>(filePath: string, action: () => Promise<T>): Promise<T> {
  return enqueue(pendingTransactions, filePath, action)
}

async function enqueue<T>(pending: Map<string, Promise<unknown>>, filePath: string, action: () => Promise<T>): Promise<T> {
  const resolved = resolve(filePath)
  const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved
  const previous = pending.get(key) || Promise.resolve()
  const current = previous.catch(() => undefined).then(action)
  pending.set(key, current)
  try {
    return await current
  } finally {
    if (pending.get(key) === current) pending.delete(key)
  }
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw new Error(`无法读取 JSON 文件：${filePath}`, { cause: error })
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  return enqueue(pendingWrites, filePath, () => writeJsonAtomic(filePath, value))
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value, null, 2)
  if (serialized === undefined) throw new Error('无法保存空 JSON 值')
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${randomUUID()}.tmp`
  try {
    await writeFile(tempPath, `${serialized}\n`, 'utf-8')
    await rename(tempPath, filePath)
  } finally {
    await unlink(tempPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
}
