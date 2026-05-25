# Cat Meme Studio

Windows desktop app for making Chinese cat meme short videos.

## Commands

PowerShell on Windows may block `npm.ps1`; use `npm.cmd` when that happens.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd run test
npm.cmd run verify
npm.cmd run typecheck
npm.cmd run build:app
```

## AI Engineering Workflow

This repository is prepared for an AI-agent coding flow:

- `AGENTS.md` is the operating manual for Codex/Claude/Gemini-style agents.
- `docs/architecture.md` explains the Electron, workspace, asset, and render boundaries.
- `docs/coding-style.md` defines code and media-editing rules.
- `docs/api-spec.md` describes the preload IPC API surface.
- `docs/workflow.md` describes branch, worktree, self-test, review, and CI flow.
- `tasks/task-template.md` is the starting point for every non-trivial task.
- `tasks/lessons.md` stores reusable project knowledge found during implementation.

Recommended loop:

```powershell
git switch -c codex/task-000-short-name
npm.cmd run verify
```

Use one task file and one branch/worktree per task. Before final handoff, run `npm.cmd run verify`; CI runs the same gate on pull requests.

## Workspace Rules

Workspace root priority:

1. `CAT_MEME_HOME`
2. development: current repository root
3. packaged app: `%USERPROFILE%\Documents\cat_meme`

The workspace keeps:

- `assets/` for downloaded/imported media and processed caches
- `projects/` for `.catmeme.json` project files
- `output/` for exported videos and cover JPGs
- `data/` for settings, asset index, render temp, and waveform cache
- `templates/` for local templates

Conservative cleanup keeps `assets/`, `projects/`, `output/`, and `资源/`. Historical packages, logs, render temp, and backup indexes can be deleted.

## Current Features

- Local/seed asset library with background, character, green-screen, audio, prop, favorite, and recently used categories.
- Drag assets to the preview canvas or timeline; usage count and last-used time are saved globally.
- Favorite assets from the asset card star button.
- Green-screen transparent cache generation and unreferenced cache cleanup.
- Quick preview with visual layers, subtitles, role streams, audio tracks, and native video audio.
- Audio polish: volume, mute-by-track, fade in/out, waveform preview, peak/mean hints, and automatic BGM ducking to 35% while voice/SFX/native audio is active.
- Export MP4 and export cover JPG from the current preset `coverFrame`.

## Editing Shortcuts

- `Space`: play or pause preview
- `J` / `K` / `L`: jump back, pause, play; repeated `L` increases preview speed
- `Left/Right`: step one frame
- `Shift + Left/Right`: jump 15 frames
- `Ctrl + Left/Right`: jump to previous/next edit point
- `Alt + Left/Right`: nudge selected clip by one frame
- `Shift + Alt + Left/Right`: nudge selected clip by ten frames
- `Home/End`: jump to start/end
- `S`, `B`, or `Ctrl + K`: split selected clip
- `[` / `]`: trim selected clip start/end to the playhead
- `Ctrl + C` / `Ctrl + V`: copy and paste selected clip
- `Delete`: delete selected clip
- `Esc`: clear selection
- `Ctrl + S`: save project
- `Ctrl + D`: duplicate selected clip
- `H` / `Shift + V`: flip selected visual clip
- `R` / `Shift + R`: rotate selected visual clip by 15 degrees
- `0`: reset selected visual transform
- `M`: mute or unmute selected clip

## Packaging

Development directory build:

```powershell
npm.cmd run build
```

Full offline Windows package with bundled assets:

```powershell
npm.cmd run build:full
```

The full package is written to `release-full\Cat Meme Studio-0.1.0-full-offline-x64.zip`.

## Resource Import

Copy curated resource samples into the app asset library:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\import-resource-samples.ps1 -CleanManagedAssets
```

Import a larger hot green-screen set:

```powershell
node scripts\import-full-green-screen-library.mjs
```

Pass `--limit 0` only when intentionally importing every unique video from the source folder.

## Demo Export

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate-demo-assets.ps1
npm.cmd run build:app
npx electron . --export-demo
```

Additional notes:

- Cat meme resource links: `docs/cat-meme-resources.md`
- Cat meme theater product notes: `docs/cat-meme-theater-design.md`
