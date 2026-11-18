# Architecture

## Public Desktop Homepage

`site/` contains the public product page. `deploy/fribench/` runs a versioned, stateless Nginx container with a read-only mount for verified Windows downloads. The site does not access the desktop workspace or handle account data, editing or AI requests. The native editor and its local user-data rules remain separate.

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
- `projectService.ts` and `jsonStore.ts`
  Save projects without overwriting a different project with the same title. JSON defaults apply only to missing files; malformed or unreadable files raise errors. Atomic writes use unique temporary files and a per-path write queue. Read/modify/write operations additionally serialize inside the running main process, preserving unrelated metadata and imports. These queues do not coordinate separate app processes.
- `pathSafety.ts`
  Shared path containment checks. Shell operations resolve canonical paths before checking allowed roots, preventing directory junctions from escaping those roots.
- `src/renderer/src/editorSession.ts`
  Save-response reconciliation, locked-track checks, fractional playback timing, and green-screen completion state. Project updates remain immutable; undo/redo shares unchanged assets and clips instead of cloning the complete project for every edit.
- `src/renderer/src/AssistantPanel.tsx` and `mediaMetadata.ts`
  Script drafts, editable project text, TTS input and bounded template asset selection live in the assistant drawer. Audio metadata is read without playback before inserting TTS. Async completions check the project session, including reopening the same project ID; paid-request duplication is suppressed. Templates add grouped visual/subtitle tracks as one undoable change instead of replacing the timeline. Unapplied script drafts are session-only; applying records their text in the existing project format.

## Editor Appearance And State

- Optional `AppSettings.appearance` is `light` or `dark`; older settings default to light. The renderer theme and native window controls follow the saved preference.
- `styles/themes.css` supplies dark semantic colors and compact-window refinements. Media content, subtitle colors and the export canvas are independent of editor appearance.
- Timeline category navigation filters the timeline only. Explicit solo and track mute control preview scope, including role-state native audio.
- Unsaved project transitions use an in-app save/discard/cancel dialog. Late save replies preserve newer edits, and save failure prevents a pending transition. New/open also reset playhead, clipboard, old export links and solo state.
- External-copy completions use the latest timeline and do not insert into a different active project.
- Green-screen generation and cache cleanup serialize against the same cache directory. UI completion uses success/skipped/failed totals, so out-of-order workers cannot enable cleanup early or leave it permanently disabled.
- AI text integration accepts both aggregated `output_text` and native Responses message `content` text blocks. Empty output and authentication failures remain errors; the existing chat-completions fallback is retained for Responses-unavailable compatible services.

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
