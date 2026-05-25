# API Spec

This document describes the local application API exposed by preload as `window.catMeme`.
It is not a public network API.

## Workspace and Settings

- `workspaceInfo()`
  Returns workspace directories.
- `getSettings()`
  Loads app settings from `data/settings.json`.
- `saveSettings(settings)`
  Persists app settings.

## Project

- `newProject()`
  Creates a new default project.
- `saveProject(project)`
  Saves a project into the workspace `projects/` directory.
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

## AI

- `generateScript(request)`
  Calls configured text model for script generation.
- `tts(request)`
  Calls configured TTS service and imports the resulting audio asset.

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

## Change Rules

When adding or changing an IPC API:

1. Update `src/shared/types.ts` if a shared type is involved.
2. Update `src/preload/index.ts`.
3. Add the main-process handler in `src/main/index.ts`.
4. Validate paths/protocols in main process.
5. Update this document.
6. Run `npm.cmd run verify`.
