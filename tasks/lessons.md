# Lessons

Reusable project knowledge from completed tasks goes here.

## 2026-05-25

- The editor is media-heavy. Asset-library changes should avoid decoding many videos at once and should prefer thumbnails, cover frames, or metadata-only loading.
- Rendering changes must be checked across preview, final MP4 export, and JPG cover export because they share user expectations even when they use different code paths.
- Workspace cleanup must preserve user-owned media and project data: `assets/`, `projects/`, `output/`, and the original resource pack.
- External asset folders should be treated as read-only sources. Use scan caches for browsing, then materialize external assets into the managed workspace before adding them to project timelines or role state.

## 2026-11-18

- Windows concurrent JSON replacement can raise `EPERM` even with unique temporary files. Serialize writes per path and protect the complete index read/modify/write operation separately; long-running preprocessing must merge only its results into the latest index.
- A save reply is the submitted snapshot, not the latest editor state. Preserve newer edits and reject project-specific results after the user switches projects. External copy-on-use must also append against the latest timeline.
- Project frame calculations must use the project's own preset FPS during normalization, replacement and history preparation. Timer ticks must retain fractional frames at low playback speeds.
- Renderer project updates are immutable. History may share unchanged assets and clips; mutating a retained object would corrupt undo/redo. Legacy migration mutates only explicitly cloned items.
- Parallel preprocessing completion must use completed-result totals, not the index of the last callback. Cache cleanup must wait for generation/index publication to finish.
- Responses REST results may store text in `output[].content[]` rather than a top-level `output_text`; extract text parts instead of stringifying message objects into scripts.
- Async AI/TTS callbacks must check a project-session token, not only the project ID: reopening the same file is a new session. Draft application must use the latest project; template insertion and TTS addition should retain prior timeline content and be undoable.
