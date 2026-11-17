# Lessons

Reusable project knowledge from completed tasks goes here.

## 2026-05-25

- The editor is media-heavy. Asset-library changes should avoid decoding many videos at once and should prefer thumbnails, cover frames, or metadata-only loading.
- Rendering changes must be checked across preview, final MP4 export, and JPG cover export because they share user expectations even when they use different code paths.
- Workspace cleanup must preserve user-owned media and project data: `assets/`, `projects/`, `output/`, and the original resource pack.
- External asset folders should be treated as read-only sources. Use scan caches for browsing, then materialize external assets into the managed workspace before adding them to project timelines or role state.
