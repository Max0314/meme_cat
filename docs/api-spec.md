# API Spec

This document describes the local application API exposed by preload as `window.catMeme`.
It is not a public network API.

## Workspace and Settings

- `workspaceInfo()`
  Returns workspace directories.
- `getSettings()`
  Loads app settings from `data/settings.json`. Optional `appearance` is `light` or `dark`, with light as the backward-compatible default.
- `saveSettings(settings)`
  Persists app settings, then updates in-memory settings and native window appearance. A failed write does not replace the in-memory settings.

## Project

- `newProject()`
  Creates a new default project.
- `saveProject(project)`
  Saves a project into the workspace `projects/` directory and returns `{ project, filePath }`. A title collision with another project ID gets a numbered filename; the same ID/title updates its own file. Renaming saves under the new title and does not move/delete the old file.
- `loadProject()`
  Opens a file picker and loads a project.

## Assets

- `listAssets()`
  Loads bundled and workspace assets.
- `importLocalAssets()`
  Imports local media into managed asset folders.
- `searchAssets(request)`
  Searches configured external providers.
- `downloadAsset(request)`
  Downloads a remote asset into the workspace.
- `updateAsset(assetId, patch)`
  Updates metadata such as favorite, last-used time, and use count.
- `getAssetWaveform(assetId)`
  Generates or reads cached waveform samples.
- `preprocessGreenScreen(request)`
  Generates transparent green-screen variants.
- `cleanupGreenScreenCache()`
  Removes unreferenced transparent cache files only.

## External Asset Libraries

- `listAssetLibraries()` returns configured external folder sources.
- `addAssetLibraryFolder()` opens the folder picker, adds a read-only source and returns its initial scan, or `null` on cancellation.
- `scanAssetLibrary(libraryId)` returns scanned assets, changed/new/missing/skipped counts and warnings. Offline sources retain their previous index.
- `removeAssetLibrary(libraryId)` removes configuration/index entries and returns remaining sources; it does not delete source files or managed copies.
- `materializeAsset(assetId)` returns a managed copy of an external asset. Reuse checks the live source size and modification time, even without a rescan. It does not write into the source folder.
- `listAssets()` includes managed/bundled and enabled external entries; unavailable external entries omit their file URL.

## AI

- `generateScript(request)`
  Calls the configured text model and returns `AiScriptResponse` (`title`, `script`, `subtitles`). Supports nested Responses text blocks and the existing chat-completions fallback. The renderer stages the result as a draft before applying it.
- `tts(request)`
  Calls configured TTS service with text and an optional voice, and imports the resulting audio asset. The renderer reads audio metadata without playback, then appends a clip to the active project only if the initiating project session is still active. Metadata failure leaves the generated asset available in the library.

## Rendering

- `renderPreview(request)`
  Generates a lightweight MP4 preview.
- `renderExport(request)`
  Generates final MP4.
- `renderCover(request)`
  Generates JPG cover from preset `coverFrame`.
- `onRenderProgress(callback)`
  Subscribes to render progress.

## Dialog and Shell

- `selectExportDir(defaultPath)`
  Lets user choose export directory.
- `selectExportPath(defaultPath)`
  Lets user choose MP4 output file.
- `openExternal(url)`
  Allows safe external protocols only.
- `showItem(filePath)`
  Shows a file inside allowed workspace/user roots.
- `openPath(filePath)`
  Opens a directory or file inside allowed workspace/user roots.

Shell path checks resolve real filesystem paths, including Windows junctions, before validating containment. Missing/empty paths fail. JSON reads only use defaults for missing files; parse and access errors are surfaced without replacing the file with defaults. The preload method signatures remain unchanged.

## Change Rules

When adding or changing an IPC API:

1. Update `src/shared/types.ts` if a shared type is involved.
2. Update `src/preload/index.ts`.
3. Add the main-process handler in `src/main/index.ts`.
4. Validate paths/protocols in main process.
5. Update this document.
6. Run `npm.cmd run verify`.
