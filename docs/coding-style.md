# Coding Style

## TypeScript

- Keep code TypeScript-first and explicit at boundaries.
- Shared app contracts belong in `src/shared/types.ts`.
- Prefer pure helper functions for timeline, transform, path, and render calculations.
- Avoid `any`. If external data is unknown, normalize it close to the boundary.
- Keep comments short and only where behavior is non-obvious.

## React Renderer

- Keep project state updates centralized in existing project update/history helpers.
- Do not bypass undo/redo history for user-visible edits unless the update is a background reconciliation.
- Use existing UI controls, icons, and CSS patterns.
- Avoid heavy media decoding in the asset library; prefer cached thumbnails, lazy loading, and metadata-only video preload.
- Preview behavior should update immediately in paused state and during playback.

## Electron Main

- Main process owns filesystem, shell, network downloads, FFmpeg, and workspace initialization.
- Validate IPC inputs before touching files or opening links.
- Use `path.resolve`, `path.relative`, and workspace helpers for path checks.
- Keep packaged and development behavior portable. Do not assume `D:\cat_meme`.

## Media and FFmpeg

- Rendering changes must preserve preview/export parity.
- Use existing FFmpeg helper functions before adding new filter builders.
- When changing audio, check native video audio, BGM, voice, SFX, volume, mute, fade, and ducking behavior.
- When changing visuals, check image, GIF, video, green-screen cached variant, and keyed live preview behavior.

## Dependencies

- Default rule: do not add dependencies.
- If a dependency is necessary, document why in the task file and README, then update lockfile and CI.

## Error Handling

- Surface actionable errors to the UI.
- Do not hide root causes with silent fallback unless the fallback is expected product behavior and logged or messaged.
- Prefer early validation with clear messages.

## File Editing

- Keep edits scoped to the active task.
- Do not reformat unrelated files.
- Do not commit generated outputs, local caches, packaged builds, or user media.
