# Task 002 - Legacy Editor Reliability Audit

## Goal

Find and repair confirmed data-loss and editing defects without opening the desktop app.

## Context

- Initial Git audit on 2026-11-18: clean checkout, one worktree, local/remote only `main`, both at `e5e488a`; remote HEAD is `main`.
- Existing `npm test` only checks workflow scaffolding. External-library feature acceptance from Task 001 remains pending.
- Confirmed risks: title-based project overwrite, stale save replies replacing edits, silent JSON read failures and competing writes, stale external-file reuse, locked-track editing bypasses, rounded playback timing, and save shortcut ignored in text fields.
- User confirmed: categories filter the timeline only; add save/discard/cancel reminders before new/open/close; retain and refine light appearance and also implement a professional dark mode. The user subsequently requested restoring and improving AI/script/TTS/template entry points in this same task.

## Constraints

- Do not launch Electron, packaged apps, media viewers, or interactive windows.
- Preserve all user media, projects, outputs, resource packs, settings and indexes; test only in temporary fixtures.
- No new dependencies, commit, push, or branch cleanup. The user permits necessary refactoring and confirmed both light and dark editor appearance.
- Preserve shared project format and existing preload API where possible.

## Plan

1. Audit save/load, indexes, external copy-on-use, editing commands, preview/export paths and IPC validation.
2. Repair confirmed defects with focused changes; ask about product behavior before changing it.
3. Add headless regression coverage for the affected data and editing rules.
4. Review changes, synchronize existing documentation, and run `npm.cmd run verify` without launching the app.

## Done When

- Confirmed defects in this task are repaired and regression checks pass.
- User decisions and remaining limitations are recorded accurately.
- Required verification passes, or a specific blocker is documented.
- Existing docs reflect the actual changes.

## Verification

- Node-only temporary-file tests for JSON, project collision handling and asset indexes/materialization.
- Headless checks for playback/save reconciliation and locked editing behavior.
- `npm.cmd run verify` (typecheck, tests, application build; no application launch).
- No visual or real-media export acceptance in this task.

## Rollback Notes

Revert only the source, regression scripts and documentation changes in this task. No user data migration or cleanup is required.

## Findings And Changes

| Priority | Confirmed issue | Implemented correction |
| --- | --- | --- |
| P1 | Default project titles repeat daily; saving can overwrite a different project. | Serialize project saves, compare project IDs and select a numbered filename for collisions. |
| P1 | A completed save replaces edits made while waiting. | Reconcile save metadata only when the submitted content is still current; keep new edits dirty. |
| P1 | New/open/close can discard unsaved editing. | In-app save/discard/cancel, close interception, save failure protection, visible dirty state. |
| P1 | JSON parsing/access failures silently become defaults; concurrent writes share a temporary file and read/modify/write loses changes. | Surface read failures; unique temp paths, Windows-compatible write queue and per-index transactions. Failure paths leave original files intact. |
| P1 | Concurrent external copies can overwrite earlier timeline edits or apply after switching project. | Use the current project when inserting, retain completed copies in the global library, and discard stale project insertion. |
| P1 | Shell checks allow junctions to escape allowed roots. | Resolve canonical paths before containment checks; correctly allow legitimate `..cats`-style child names. |
| P2 | Locking a track still permits deletion, split, duplicate, paste and inspector edits. | Validate all committed timeline changes and guard destructive command entry points. Unlock and unrelated edits remain available. |
| P2 | Timer rounding speeds up slow playback; custom-FPS loading/history uses hardcoded 30 FPS. | Retain fractional frames; derive frame calculations from the project's own preset. |
| P2 | Timeline categories hide other preview groups although exports include them; explicit solo leaks role audio. | Separate category navigation from preview scope; use the same visible-track scope for role audio and bound subtitles. |
| P2 | Source files changed after scanning can reuse an obsolete managed copy. | Compare the live size/mtime before reusing a copy. Preserve previous project copies. |
| P2 | External scan/metadata/remove operations can overwrite one another; scan reports every file as updated. | Serialize mutations and count actual fingerprint/availability changes. |
| P2 | Green-screen worker index is mistaken for completion; cleanup can run during cache generation; failures strand controls and refresh drops external entries. | Use result totals, clear failed progress, retain mounted sources and serialize generation/cleanup against the cache directory. Merge processed variants into the latest asset index. |
| P2 | Ctrl+S is ignored in inputs; project switching retains stale playhead/clipboard/export/solo state; metadata changes reset paging. | Restore save-in-input, reset session-only state on replacement and reset pages only for filter/view changes. |
| P2 | Playback repeatedly merges the asset catalog; asset counters scan the catalog on each render; history deep-clones complete projects repeatedly. | Memoize merged assets/counters and share immutable unchanged objects in history. Use a scan queue cursor instead of repeated array shifts; materialization only checks the requested external source file. |
| P2 | Fixed column minima exceed the window's supported minimum width; theme colors are hardcoded; unsaved state/focus is unclear. | Compact-window layout, visible focus/dirty state, semantic surfaces, persisted light/dark switch and matching native window controls. Preserve media/export colors. |
| P2 | `npm test` only verifies workflow scaffolding. | Add temporary-file and renderer hook/event regression tests using the already installed TypeScript compiler; no new dependency or GUI/media process. |
| P2 | AI/script/TTS/template functions have no current UI entry, and their old completion paths replace project/timeline content. | Restore a dedicated assistant drawer, editable drafts and manual scripts, additive exact-duration TTS and additive new-track templates. Suppress duplicate requests; check session identity and preserve concurrent edits. |
| P2 | Responses output is stringified as a message object instead of extracting nested text. | Parse native Responses text blocks, keep compatible-service fallback, and surface empty/authentication errors. |

## Review And Remaining Boundaries

- Reviewed save/error paths, queue ownership, immutable update call sites, locked editing entry points, project FPS handling, external-copy concurrency, theme separation and user-data preservation.
- Main/preload/renderer contracts remain compatible. `appearance` is an optional settings field; existing saved projects do not need migration. No user data has been read, changed, deleted or migrated during this audit.
- The large `App.tsx` and layered legacy CSS still increase maintenance cost. This task extracts editor-session logic and theme styling but does not split the whole editor into new subsystems.
- AI/script/TTS/template entry points are now restored following the user's explicit decision. The assistant UI is a separate component. Unapplied drafts are session-only and labelled accordingly; applying persists script text/AI records with the project. Real-provider/model/voice compatibility and actual audio decoding remain unaccepted because no live API/media execution was authorized for verification.
- New projects still include the managed catalog; restricting project assets to only referenced media would change project/catalog behavior and needs a separate decision.
- No desktop visual, actual media export, large-library benchmark or portable-package acceptance was run. The restriction against opening local apps remains respected.

## Verification Results

- Final `npm.cmd run verify` passed on 2026-11-18 after the AI/template extension: main/preload/shared/renderer TypeScript checks, workflow-file validation, all 26 Node regression cases, and the Electron/Vite application build.
- Regression cases cover JSON failure/atomicity/transaction recovery, same-title projects, managed/external concurrency, source change/offline/removal, canonical junction checks, save races and failed-save transitions, close interception, frame timing/FPS, immutable undo/redo, locked command attempts, theme persistence/failure, paging, category/solo audio, concurrent copy insertion, and green-screen completion/failure/source preservation.
- Added mocked-response cases for nested Responses/chat fallback/auth failures; metadata-only audio duration/timeout; staged AI drafts, duplicate calls, cross-session completion, latest-state application/undo; exact TTS duration with old/locked voice retention; and additive template insertion/undo. No network request was made by these tests.
- Reviewed the final diff and synchronized README, architecture, API, UI proposal, Task 001 progress and lessons. `git diff --check` found no whitespace errors.
- No app/FFmpeg launch, media export, visual screenshot, portable packaging or real-user-data operation was performed. Tests clean only their own generated temporary directories.
- Changes remain uncommitted on `codex/task-002-legacy-editor-audit`; no push or merge was performed.
- Suggested commit: `feat(editor): restore assistant tools and improve workspace reliability`.
