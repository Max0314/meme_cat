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

The top-bar moon/sun button switches between light and dark workspaces and saves the preference. Theme changes affect editor chrome and native title-bar controls; project colors and exported media keep their own settings.

Timeline categories filter tracks without hiding other content in the preview. Use the explicit solo control to isolate a group. Locked tracks reject clip edits, splits, insertion and deletion. New/open/close actions offer save, discard and cancel when the current project has changes; a failed save keeps the current project open. `Ctrl + S` also works while typing in a field.

Saving a different project with an existing title chooses a numbered filename instead of overwriting the other project's file. Saving that same project/title again updates its own file. Renaming still saves under the new title; this is not a Save As/file-move feature.

## Automated Checks

`npm.cmd run test` checks workflow files and runs Node-only regression tests for project persistence, concurrent indexes, external libraries, path validation, playback timing, AI response parsing and editor actions. Tests use temporary fixtures, mocked AI responses and a hook/event harness; they do not launch Electron or FFmpeg, make paid AI requests, or access real user media/settings. They do not replace visual, real-provider/media export or portable-package acceptance.

## AI And Templates

Open **AI 与模板** from the top-bar sparkle button. Configure your OpenAI-compatible Base URL, API Key, text model and TTS model/voice in Settings for AI generation. Templates and manual script editing work without an API key.

- **脚本**: choose a story style, topic and target duration; generate and edit a draft, then apply it to the project. Existing clips remain. Unapplied drafts are session-only; apply and save to retain the text in the project.
- **配音**: fill text from the project or AI draft, edit it, optionally choose a voice, then generate. Audio is added at the request's playhead position using its actual metadata duration; existing voice clips are retained. A locked/missing voice track gets a separate editable track. Generated files remain in the asset library after switching projects or a metadata failure; no automatic audio playback occurs.
- **模板**: select assets in the desired order and insert scenes at the playhead. Visual and subtitle tracks are added without replacing existing clips. External assets are copied before use; the insertion is one undoable edit. Asset search renders at most 60 matching choices at once.

Duplicate in-flight assistant requests are suppressed. Late AI drafts from another project can be read/copied but cannot be applied to the new project. AI settings and generated project edits use the existing preload APIs and project record format.

## Packaging

The [Cat Meme Studio homepage](https://cat.fribench.cn/) serves the Windows x64 portable release and its SHA-256 checksum. Page source is in `site/` and the independent Fribench container is in `deploy/fribench/`. Follow the `fribench_ops` shared policy and Cat Meme Studio runbook when publishing.

To stage a public package, build `npm.cmd run build:portable` from a clean release checkout and run `node scripts/stage-desktop-download.mjs`. It writes the portable EXE, `release.json` and `SHA256SUMS.txt` to `release-downloads/<source SHA>/`. Update the homepage links and displayed version when bumping the package. The public package uses `electron-builder.yml`, which excludes the local resource library and user data.

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
