import type { GreenScreenPreprocessProgress, ProjectFile, TimelineTrack } from '../../shared/types'

export function isGreenScreenProcessing(progress: GreenScreenPreprocessProgress | null): boolean {
  return Boolean(progress && progress.success + progress.skipped + progress.failed < progress.total)
}

export function projectContentKey(project: ProjectFile): string {
  return JSON.stringify({ ...project, updatedAt: '' })
}

export function reconcileSavedProject(current: ProjectFile, submitted: ProjectFile, saved: ProjectFile): ProjectFile {
  if (current.id !== submitted.id || projectContentKey(current) !== projectContentKey(submitted)) return current
  return { ...current, workspaceRoot: saved.workspaceRoot, updatedAt: saved.updatedAt }
}

export function changedLockedTrack(before: ProjectFile, after: ProjectFile): TimelineTrack | undefined {
  return before.tracks.find((track) => track.locked && (
    !after.tracks.some((next) => next.id === track.id) ||
    JSON.stringify(before.timeline.filter((item) => item.trackId === track.id)) !==
      JSON.stringify(after.timeline.filter((item) => item.trackId === track.id))
  ))
}

export function advancePlayback(elapsedMs: number, fps: number, speed: number, remainder: number): { frames: number; remainder: number } {
  const exact = remainder + Math.max(0, elapsedMs) * fps * speed / 1000
  const frames = Math.floor(exact + 1e-9)
  return { frames, remainder: Math.max(0, exact - frames) }
}
