import path from 'node:path'
import { realpath } from 'node:fs/promises'

export function isPathInside(filePath: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(filePath))
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

export async function resolveAllowedUserPath(filePath: string, roots: string[]): Promise<string> {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('请选择有效的文件或目录')
  const resolved = await realpath(path.resolve(filePath))
  const canonicalRoots = await Promise.all(roots.map((root) => realpath(root).catch(() => null)))
  if (!canonicalRoots.some((root) => root && isPathInside(resolved, root))) {
    throw new Error('不允许打开工作区之外的路径')
  }
  return resolved
}
