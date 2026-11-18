import path from 'node:path'
import { existsSync } from 'node:fs'
import type { ProjectFile, WorkspaceInfo } from '../shared/types'
import { projectPath } from './workspace'
import { readJson, withJsonTransaction, writeJson } from './jsonStore'

export async function saveProjectFile(info: WorkspaceInfo, project: ProjectFile): Promise<{ project: ProjectFile; filePath: string }> {
  if (!project.id || typeof project.id !== 'string' || typeof project.title !== 'string') {
    throw new Error('工程缺少有效的标识或名称')
  }
  return withJsonTransaction(info.projectsDir, async () => {
    const nextProject = { ...project, updatedAt: new Date().toISOString(), workspaceRoot: info.root }
    const preferredPath = projectPath(project.title, info)
    const stem = path.basename(preferredPath, '.catmeme.json')
    let filePath = preferredPath
    let suffix = 1
    while (existsSync(filePath)) {
      const existing = await readJson<ProjectFile | null>(filePath, null)
      if (existing?.id === project.id) break
      filePath = path.join(info.projectsDir, `${stem} (${suffix++}).catmeme.json`)
    }
    await writeJson(filePath, nextProject)
    return { project: nextProject, filePath }
  })
}
