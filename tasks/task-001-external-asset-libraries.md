# Task 001 - External Asset Libraries

## Goal

Add a stable external-folder asset library workflow so users can mount a local folder, scan media from its directory structure, and browse those assets alongside the existing managed workspace library.

## Context

Cat Meme Studio currently imports local files by copying them into `assets/` and writing entries to `data/assets.index.json`. Creators also keep large local folders organized by categories such as background, green-screen, BGM, and SFX. The app should support that workflow without weakening project reliability.

## Constraints

- External folders are read-only sources. The app must not delete, rewrite, or create files inside them.
- The existing managed `assets/` library remains the stable project store.
- Dragging an external asset into a project should materialize it into the managed workspace by default.
- Renderer access to external folders must stay behind preload/main IPC.
- Directory-derived categories must complement current asset tags and filters.
- Scanning must tolerate missing files, permission errors, unsupported media, non-ASCII paths, nested folders, and large libraries.
- Do not introduce new dependencies.

## Plan

1. Extend shared asset types with source metadata, external library configuration, scan result, and materialization result contracts.
2. Add workspace helpers and a main-process service for library config, safe scanning, derived tags, scan-cache persistence, and copy-on-use materialization.
3. Expose narrow IPC methods through preload for listing, adding, removing, scanning, and materializing external libraries.
4. Merge external scanned assets into the asset list and keep asset metadata updates working for external entries without writing to external folders.
5. Update the renderer asset library UI with source filters, an external-library toolbar, directory metadata badges, and copy-on-use behavior before adding external assets to the timeline.
6. Add tests for scanning, source validation, derived tags, and materialization where practical.

## Done When

- Users can add a folder as an external asset library.
- Users can rescan or remove the external library without deleting files.
- External assets appear in the existing asset library and can be filtered by source.
- Directory names become searchable/category tags.
- Dragging/adding an external asset copies it into the workspace and uses the managed copy in the project.
- Missing/offline external files do not crash the app and are not silently removed from user project data.

## Verification

- Run `npm.cmd run lint`.
- Run `npm.cmd run test`.
- Run `npm.cmd run build:app`.
- Run `npm.cmd run verify` before handoff unless blocked.
- Manual smoke: add an external folder with nested Chinese directory names, scan it, add an asset to the timeline, remove/rescan the library, and confirm the project still uses the managed copy.

## Rollback Notes

Remove the new external library config/cache files from `data/` and revert the shared/main/preload/renderer changes. Do not remove any user external folders or workspace `assets/`, `projects/`, `output/`, or `资源/` directories.

## 2026-11-17 WIP preservation

The user chose to commit and push this unfinished implementation as WIP and defer feature acceptance. The user approved merging the implementation into `main` on 2026-11-18. The earlier checks below still apply. The user will handle remaining feature acceptance. `npm.cmd run verify` passed: main/renderer TypeScript checks, workflow-file verification, and the Electron/Vite application build. The test script checks workflow scaffolding; it is not an asset-library functional test.

Still required: test read-only scanning, path/protocol validation, missing/offline sources, large/nested/non-ASCII folders, source removal and copy-on-use; perform the manual project/timeline smoke test above. Preserve all existing assets, projects, exports and external source folders. No editor or user media was opened or modified by this cleanup.

## 2026-11-18 follow-up audit

Task 002 adds Node-only temporary-fixture coverage for nested Chinese paths, unsupported files, unchanged scans, concurrent metadata/copies/imports, offline index retention, source removal without deletion and live-fingerprint copy reuse. Renderer action tests cover simultaneous copy insertion and project switching. External scanning, removal and metadata changes now serialize, and copy-on-use no longer stats every external asset. API documentation now includes the external-library bridge.

These checks do not constitute the deferred desktop feature acceptance. Large-library measurement, real-media decoding and the manual application smoke test remain unperformed; no application was launched.
