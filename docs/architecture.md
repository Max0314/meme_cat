# Architecture

Cat Meme Studio is an Electron + React + TypeScript desktop editor.

## Runtime Layers

- `src/main/`
  Electron main process. Owns workspace setup, filesystem access, asset indexing, media preprocessing, AI service calls, render/export orchestration, and secure IPC handlers.
- `src/preload/`
  Narrow bridge exposed as `window.catMeme`. Renderer code must call main process capabilities through this API.
- `src/renderer/`
  React editor UI. Owns preview canvas, timeline editing, inspectors, asset library, keyboard shortcuts, and project state.
- `src/shared/`
  Shared types, presets, templates, and pure helpers used by both main and renderer.

## Important Services

- `workspace.ts`
  Resolves the workspace root. Priority is `CAT_MEME_HOME`, development repo root, then packaged app documents folder.
- `assetService.ts`
  Imports/downloads assets, maintains `data/assets.index.json`, generates waveform data, preprocesses green-screen transparency, and cleans unreferenced caches.
- `assetLibraryService.ts`
  Mounts read-only external folders as asset sources, maintains `data/asset-libraries.json` and `data/external-assets.index.json`, derives tags from directory structure, and materializes external assets into the managed workspace before project use.
- `renderService.ts`
  Builds FFmpeg filter graphs for preview MP4, export MP4, and cover JPG. Preview/export/cover should share layer, subtitle, keying, and transform semantics.
- `aiService.ts`
  AI script/TTS integration. Keep model/provider settings in app settings, not hardcoded in UI logic.

## Data Model

- `ProjectFile`
  Serializable project state. Includes tracks, timeline items, assets, roles, subtitles, style, and AI records.
- `Asset`
  Local or remote media entry. Includes metadata, processed variants, favorites, recent usage, and file URL for renderer display.
- `TimelineItem`
  Clip or stream on a track. Visual items may contain transforms, keyframes, keying, role states, and subtitle bindings. Audio-capable items support volume and fades.

## Workspace Layout

- `assets/`: user and managed media
- `projects/`: `.catmeme.json` project files
- `output/`: exported MP4/JPG files
- `data/`: settings, asset indexes, render temp, waveform cache
- `data/asset-libraries.json`: configured external asset folders
- `data/external-assets.index.json`: rebuildable scan cache for external folders
- `资源/`: original resource pack, treated as user-owned source data

These directories are intentionally ignored by Git and must be preserved during cleanup.

## Rendering Flow

1. Renderer sends a `RenderRequest` through preload.
2. Main process validates workspace and calls `renderProject`.
3. `renderService` expands role/subtitle streams, probes media when needed, builds FFmpeg inputs, creates filter graph, and emits progress.
4. Output is written to `output/` or the selected export path.

Rendering-sensitive changes must check:

- video layer order
- background fit behavior
- green-screen alpha variants
- subtitle and role label placement
- native video audio, BGM, voice, and SFX mixing
- preview/export/cover parity

## IPC Boundary

Renderer must not access Node filesystem APIs directly.
Add new filesystem or shell behavior to main process and expose the smallest safe method from preload.
All `openPath`, `showItem`, and `openExternal` style features must validate allowed roots or protocols.
External asset folders become allowed roots only after selection through main-process dialogs, and projects should use managed workspace copies by default rather than depending on external paths.
